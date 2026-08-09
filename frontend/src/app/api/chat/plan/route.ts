import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parsePaymentIntent } from "@/lib/payment/intentParser";
import { generatePaymentPlan } from "@/lib/payment/planGenerator";
import { buildPlanNarration } from "@/lib/payment/agent";
import type { ChatMessage } from "@/lib/payment/types";

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

async function fetchTreasuryUsd(businessId: string): Promise<number | undefined> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: wallets } = await supabaseAdmin
    .from("wallets")
    .select("native_balance")
    .eq("business_id", businessId);
  if (!wallets) return undefined;
  const native = (wallets as any[]).reduce((sum, w) => sum + Number(w.native_balance || 0), 0);
  return Math.round((native * 0.7 + 30000) * 100) / 100;
}

// ---------------------------------------------------------------------------
// POST /api/chat/plan -> generate + persist the payment plan for a request
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { businessId, paymentRequestId } = await req.json();

    if (!businessId || !paymentRequestId) {
      return NextResponse.json(
        { error: "businessId and paymentRequestId are required" },
        { status: 400 }
      );
    }

    // 1. Fetch the payment request.
    const { data: payReq, error: prErr } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("id", paymentRequestId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (prErr || !payReq) {
      return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
    }

    // 2. Fetch the AI-parsed intent row.
    const { data: intentRow, error: intentErr } = await supabaseAdmin
      .from("intents")
      .select("*")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();
    if (intentErr || !intentRow) {
      return NextResponse.json({ error: "Intent record not found" }, { status: 404 });
    }

    // 3. Rebuild the parsed intent from the persisted raw input (source of truth).
    const intent = parsePaymentIntent(intentRow.raw_input || "");
    if (!intent.detected) {
      return NextResponse.json(
        { error: "Stored input could not be parsed as a payment intent" },
        { status: 422 }
      );
    }

    // 4. Generate the plan with treasury context for risk assessment.
    const treasuryUsd = await fetchTreasuryUsd(businessId);
    const plan = generatePaymentPlan(intent, { totalEstimatedUSDValue: treasuryUsd });

    // 5. Persist payment plan + route options + steps + risk assessment.
    const { data: planRow, error: planErr } = await supabaseAdmin
      .from("payment_plans")
      .insert({
        payment_request_id: paymentRequestId,
        selected_route_id: null,
        total_estimated_gas: plan.totalEstimatedGas,
        estimated_duration: plan.estimatedDuration,
        savings: plan.savings,
        explanation: plan.explanation,
        risk_score: plan.risk.overallRisk === "LOW" ? 5 : plan.risk.overallRisk === "MEDIUM" ? 35 : 70,
      })
      .select()
      .single();
    if (planErr) {
      return NextResponse.json({ error: planErr.message }, { status: 500 });
    }

    const routeRows = plan.routes.map((r) => ({
      payment_plan_id: planRow.id,
      route_name: r.routeName,
      chain: r.chain,
      estimated_gas: r.estimatedGas,
      estimated_time: r.estimatedTime,
      transaction_count: r.transactionCount,
      risk_score: r.riskScore,
      total_score: r.totalScore,
      savings: r.savings,
      is_recommended: r.isRecommended,
    }));

    const { data: routeRowsData, error: routesErr } = await supabaseAdmin
      .from("route_options")
      .insert(routeRows)
      .select("id, is_recommended");
    if (routesErr) {
      return NextResponse.json({ error: routesErr.message }, { status: 500 });
    }

    const recommendedRoute = (routeRowsData as any[]).find((r) => r.is_recommended);
    if (recommendedRoute) {
      await supabaseAdmin
        .from("payment_plans")
        .update({ selected_route_id: recommendedRoute.id })
        .eq("id", planRow.id);
    }

    await supabaseAdmin.from("payment_steps").insert(
      plan.steps.map((s) => ({
        payment_plan_id: planRow.id,
        step_order: s.stepOrder,
        action_type: s.actionType,
        title: s.title,
        description: s.description,
        status: "PENDING",
      }))
    );

    await supabaseAdmin.from("risk_assessments").insert({
      payment_plan_id: planRow.id,
      balance_check: plan.risk.balanceCheck,
      recipient_check: plan.risk.recipientCheck,
      slippage_check: plan.risk.slippageCheck,
      network_check: plan.risk.networkCheck,
      contract_check: plan.risk.contractCheck,
      overall_risk: plan.risk.overallRisk,
      warnings: plan.risk.warnings,
    });

    // 6. Move the payment request to PENDING_APPROVAL.
    await supabaseAdmin
      .from("payment_requests")
      .update({ status: "PENDING_APPROVAL" })
      .eq("id", paymentRequestId);

    // 7. Update the agent message with the plan + narration.
    const { data: agentMsgs } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("business_id", businessId)
      .eq("role", "agent")
      .eq("entity_ids->>paymentRequestId", paymentRequestId)
      .order("created_at", { ascending: false })
      .limit(1);

    const narration = buildPlanNarration(intent, plan);
    let message: ChatMessage | null = null;
    if (agentMsgs && agentMsgs.length > 0) {
      const agentRow = agentMsgs[0];
      const combinedContent = `${agentRow.content}\n\n${narration}`;
      const entityIds = {
        ...(agentRow.entity_ids || {}),
        planId: planRow.id,
        routeIds: (routeRowsData as any[]).map((r) => r.id),
      };
      const { data: updated } = await supabaseAdmin
        .from("conversation_messages")
        .update({ plan, content: combinedContent, entity_ids: entityIds })
        .eq("id", agentRow.id)
        .select()
        .single();
      if (updated) message = mapMessage(updated);
    }

    // 8. Audit log.
    await supabaseAdmin.from("audit_logs").insert({
      business_id: businessId,
      payment_request_id: paymentRequestId,
      event_type: "PAYMENT_PLAN_GENERATED",
      description: `Route optimizer generated ${plan.routes.length} candidate routes; ${plan.routes.find((r) => r.isRecommended)?.routeName} selected`,
      meta: {
        plan_id: planRow.id,
        recommended_route: plan.routes.find((r) => r.isRecommended)?.routeName,
        estimated_gas: plan.totalEstimatedGas,
        risk: plan.risk.overallRisk,
      },
    });

    return NextResponse.json({
      success: true,
      plan,
      message,
      operationStage: "payment_plan",
      entityIds: {
        paymentRequestId,
        intentId: intentRow.id,
        planId: planRow.id,
        routeIds: (routeRowsData as any[]).map((r) => r.id),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
