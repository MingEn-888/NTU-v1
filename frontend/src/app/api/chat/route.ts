import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { parsePaymentIntent } from "@/lib/payment/intentParser";
import { generatePaymentPlan } from "@/lib/payment/planGenerator";
import {
  buildIntentNarration,
  buildClarificationNarration,
  buildPlanNarration,
} from "@/lib/payment/agent";
import type {
  ChatMessage,
  ParsedPaymentIntent,
  PaymentPlan,
  PersistedEntityIds,
} from "@/lib/payment/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(ts: string): string {
  return new Date(ts).toISOString();
}

function mapMessage(row: any): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status === "ERROR" ? "error" : row.status === "STREAMING" ? "streaming" : "complete",
    intent: row.intent || null,
    plan: row.plan || null,
    entityIds: row.entity_ids || null,
    createdAt: toIso(row.created_at),
  };
}

function dbIntentToParsed(row: any): ParsedPaymentIntent {
  // Rebuild a ParsedPaymentIntent from a persisted intents row (source of truth).
  return parsePaymentIntent(row.raw_input || "");
}

/** Rough treasury USD valuation used to inform risk assessment. */
async function fetchTreasuryUsd(businessId: string): Promise<number | undefined> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: wallets } = await supabaseAdmin
    .from("wallets")
    .select("native_balance")
    .eq("business_id", businessId);
  if (!wallets) return undefined;
  const native = (wallets as any[]).reduce((sum, w) => sum + Number(w.native_balance || 0), 0);
  // Approximate: native (POL) + assumed stablecoin reserves on file.
  return Math.round((native * 0.7 + 30000) * 100) / 100;
}

// ---------------------------------------------------------------------------
// GET /api/chat?businessId=... -> conversation history
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  if (!businessId) {
    return NextResponse.json({ error: "businessId query parameter is required" }, { status: 400 });
  }

  // Supabase not configured -> no persisted history; degrade gracefully instead
  // of failing the chat load.
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, messages: [], source: "fallback" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { data, error } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ success: true, messages: [], source: "fallback" });
    }

    const messages: ChatMessage[] = (data || []).map(mapMessage);
    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    console.warn("[IBAP-chat] Supabase unreachable, returning empty history:", err?.message);
    return NextResponse.json({ success: true, messages: [], source: "fallback" });
  }
}

// ---------------------------------------------------------------------------
// POST /api/chat -> send a message, parse intent, persist payment request
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { businessId, message } = await req.json();

    if (!businessId || !message || typeof message !== "string") {
      return NextResponse.json(
        { error: "businessId and message are required" },
        { status: 400 }
      );
    }

    const trimmed = message.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }

    // 1. Validate business exists.
    const { data: business, error: bizErr } = await supabaseAdmin
      .from("business_profiles")
      .select("id, business_name, default_chain")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !business) {
      return NextResponse.json({ error: "Business profile not found" }, { status: 404 });
    }

    // 2. Persist the user's message.
    const { data: userMsg, error: userErr } = await supabaseAdmin
      .from("conversation_messages")
      .insert({ business_id: businessId, role: "user", content: trimmed, status: "COMPLETED" })
      .select()
      .single();
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }

    // 3. Parse the natural-language payment intent.
    const intent = parsePaymentIntent(trimmed);

    let agentMessage: ChatMessage;
    let operationStage: string;

    if (!intent.detected) {
      // 3a. Not a payment operation — ask a clarifying question.
      const content = buildClarificationNarration();
      const { data: agentMsg, error: agentErr } = await supabaseAdmin
        .from("conversation_messages")
        .insert({
          business_id: businessId,
          role: "agent",
          content,
          status: "COMPLETED",
        })
        .select()
        .single();
      if (agentErr) {
        return NextResponse.json({ error: agentErr.message }, { status: 500 });
      }
      agentMessage = mapMessage(agentMsg);
      operationStage = "natural_language";
    } else {
      // 3b. Payment operation detected — persist payment request + intent row.
      const { data: payReq, error: prErr } = await supabaseAdmin
        .from("payment_requests")
        .insert({
          business_id: businessId,
          description: intent.purpose || trimmed,
          recipient_name: intent.recipientName || null,
          recipient_address: intent.recipientAddress || null,
          amount: intent.amount ?? 0,
          currency: intent.currency || null,
          requested_currency: intent.requestedCurrency || null,
          due_date: intent.deadlineDate || null,
          status: "PLANNING",
          source: "CHAT",
        })
        .select()
        .single();
      if (prErr) {
        return NextResponse.json({ error: prErr.message }, { status: 500 });
      }

      const { data: intentRow, error: intentErr } = await supabaseAdmin
        .from("intents")
        .insert({
          payment_request_id: payReq.id,
          action: intent.action,
          recipient: intent.recipientAddress || intent.recipientName || "",
          amount: intent.amount,
          currency: intent.currency,
          target_chain: business.default_chain || "polygon",
          due_date: intent.deadlineDate,
          confidence: intent.confidence,
          missing_information: intent.missingInformation,
          raw_input: intent.rawInput,
        })
        .select()
        .single();
      if (intentErr) {
        return NextResponse.json({ error: intentErr.message }, { status: 500 });
      }

      // 4. Persist the agent message carrying the parsed intent (plan comes later).
      const content = buildIntentNarration(intent);
      const entityIds: PersistedEntityIds = {
        paymentRequestId: payReq.id,
        intentId: intentRow.id,
        planId: "",
        routeIds: [],
      };
      const { data: agentMsg, error: agentErr } = await supabaseAdmin
        .from("conversation_messages")
        .insert({
          business_id: businessId,
          role: "agent",
          content,
          intent,
          plan: null,
          entity_ids: entityIds,
          status: "COMPLETED",
        })
        .select()
        .single();
      if (agentErr) {
        return NextResponse.json({ error: agentErr.message }, { status: 500 });
      }

      // 5. Audit logs.
      await supabaseAdmin.from("audit_logs").insert([
        {
          business_id: businessId,
          payment_request_id: payReq.id,
          event_type: "PAYMENT_REQUEST_CREATED",
          description: `Payment request created via AI agent chat: ${intent.purpose || trimmed}`,
          meta: {
            source: "CHAT",
            amount: intent.amount,
            currency: intent.currency,
            recipient_name: intent.recipientName,
            confidence: intent.confidence,
          },
        },
        {
          business_id: businessId,
          payment_request_id: payReq.id,
          event_type: "INTENT_PARSED",
          description: `AI intent engine extracted action ${intent.action} with ${Math.round(intent.confidence * 100)}% confidence`,
          meta: { intent_id: intentRow.id, confidence: intent.confidence },
        },
      ]);

      agentMessage = mapMessage(agentMsg);
      operationStage = "payment_request";
    }

    return NextResponse.json({ success: true, message: agentMessage, operationStage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
