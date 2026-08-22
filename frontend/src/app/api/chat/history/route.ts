import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ConversationSummary } from "@/lib/payment/types";

// ---------------------------------------------------------------------------
// GET /api/chat/history?businessId=... -> browsable past conversations
//
// Returns one entry per conversation_id, newest first. Each entry is derived
// deterministically from the persisted rows (no extra storage):
//   - title        = first user message (truncated)
//   - messageCount = rows in the thread
//   - paymentCount = agent messages that carried a parsed payment intent
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "businessId query parameter is required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, conversations: [], source: "fallback" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  try {
    const { data, error } = await supabaseAdmin
      .from("conversation_messages")
      .select("conversation_id, role, content, created_at, intent")
      .eq("business_id", businessId)
      .not("conversation_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(2000);

    if (error) {
      return NextResponse.json({ success: true, conversations: [], source: "fallback" });
    }

    const rows = (data || []) as any[];
    const groups = new Map<string, any[]>();
    for (const row of rows) {
      const cid = row.conversation_id as string;
      if (!cid) continue;
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid)!.push(row);
    }

    const conversations: ConversationSummary[] = Array.from(groups.entries()).map(
      ([cid, msgs]) => {
        const sorted = [...msgs].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const firstUser = sorted.find((m) => m.role === "user");
        const last = sorted[sorted.length - 1];
        const paymentCount = sorted.filter((m) => m.role === "agent" && m.intent).length;
        return {
          conversationId: cid,
          title: firstUser?.content?.slice(0, 80) || "Conversation",
          messageCount: sorted.length,
          paymentCount,
          startedAt: new Date(sorted[0]?.created_at || Date.now()).toISOString(),
          lastMessageAt: new Date(last?.created_at || Date.now()).toISOString(),
          lastPreview: last?.content?.slice(0, 120) || "",
        };
      }
    );

    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return NextResponse.json({ success: true, conversations });
  } catch (err: any) {
    console.warn("[PayMaster-chat] history unavailable:", err?.message);
    return NextResponse.json({ success: true, conversations: [], source: "fallback" });
  }
}
