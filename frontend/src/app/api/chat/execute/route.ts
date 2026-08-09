import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// POST /api/chat/execute -> record the on-chain result of an approved payment
// Called by the client AFTER the operator confirms the MetaMask transaction.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const {
      businessId,
      paymentRequestId,
      txHash,
      chainId,
      explorerUrl,
      gasUsed,
      failed,
      errorMessage,
      cancelled,
    } = await req.json();

    if (!businessId || !paymentRequestId) {
      return NextResponse.json(
        { error: "businessId and paymentRequestId are required" },
        { status: 400 }
      );
    }

    // 1. Fetch the payment request to confirm ownership.
    const { data: payReq, error: prErr } = await supabaseAdmin
      .from("payment_requests")
      .select("id, status")
      .eq("id", paymentRequestId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (prErr || !payReq) {
      return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
    }

    const finalStatus = cancelled ? "CANCELLED" : failed ? "FAILED" : "COMPLETED";

    // 2. Update payment request status.
    await supabaseAdmin
      .from("payment_requests")
      .update({ status: finalStatus })
      .eq("id", paymentRequestId);

    // 3. Fetch the associated plan to attach to the txn record.
    const { data: planRow } = await supabaseAdmin
      .from("payment_plans")
      .select("id")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();

    let txnId: string | null = null;

    if (cancelled) {
      // Rejection — no transaction is recorded, only an audit trail.
      await supabaseAdmin.from("audit_logs").insert({
        business_id: businessId,
        payment_request_id: paymentRequestId,
        event_type: "PAYMENT_REJECTED",
        description: `Payment request rejected by operator before execution`,
        meta: { status: "CANCELLED" },
      });
    } else {
      // 4. Record the transaction.
      const txRecord = {
        payment_request_id: paymentRequestId,
        payment_plan_id: planRow?.id || null,
        hash: failed ? null : txHash || null,
        status: failed ? "FAILED" : "CONFIRMED",
        chain_id: chainId || 137,
        gas_used: gasUsed || 0,
        gas_cost: 0,
        confirmed_at: failed ? null : new Date().toISOString(),
        explorer_url: failed ? null : explorerUrl || null,
      };
      const { data: txn, error: txnErr } = await supabaseAdmin
        .from("txns")
        .insert(txRecord)
        .select()
        .single();
      if (txnErr) {
        return NextResponse.json({ error: txnErr.message }, { status: 500 });
      }
      txnId = txn.id;

      // 5. Mark plan steps complete.
      if (!failed && planRow) {
        await supabaseAdmin
          .from("payment_steps")
          .update({ status: "COMPLETED" })
          .eq("payment_plan_id", planRow.id);
      }

      // 6. Audit log.
      await supabaseAdmin.from("audit_logs").insert({
        business_id: businessId,
        payment_request_id: paymentRequestId,
        event_type: failed ? "PAYMENT_FAILED" : "PAYMENT_EXECUTED",
        description: failed
          ? `Payment execution failed: ${errorMessage || "unknown error"}`
          : `On-chain transaction confirmed (${gasUsed || "n/a"} gas used)`,
        meta: {
          tx_hash: txHash || null,
          chain_id: chainId || 137,
          status: finalStatus,
          error: errorMessage || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      paymentRequestId,
      txnId,
      txHash: cancelled || failed ? null : txHash || null,
      status: finalStatus,
      explorerUrl: explorerUrl || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
