// =============================================================================
// POST /api/execution — Phase 10 human approval & execution persistence.
//
// Persists every stage of the safe execution flow and writes the audit trail.
// All persistence is BEST-EFFORT: the on-chain transaction is the source of
// truth, so when Supabase is unreachable this endpoint returns success with
// persisted:false instead of blocking the approved execution.
//
// Body: { action, businessId, paymentRequestId, ...stage-specific fields }
//   PLAN_CREATED  -> audit PLAN_CREATED + ROUTE_SELECTED
//   RISK_CHECKED  -> audit RISK_CHECKED
//   APPROVE       -> approval row + payment_request APPROVED + audit PAYMENT_APPROVED
//   REJECT        -> approval row REJECTED + payment_request CANCELLED + audit PAYMENT_REJECTED
//   SUBMIT        -> txn row SUBMITTED + payment_request EXECUTING
//   CONFIRM       -> txn row CONFIRMED + payment_request COMPLETED + audit PAYMENT_EXECUTED
//   FAIL          -> txn row FAILED + payment_request FAILED + audit PAYMENT_FAILED
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExecutionAction =
  | "PLAN_CREATED"
  | "RISK_CHECKED"
  | "APPROVE"
  | "REJECT"
  | "SUBMIT"
  | "CONFIRM"
  | "FAIL";

interface ExecutionBody {
  action: ExecutionAction;
  businessId?: string;
  paymentRequestId?: string;
  paymentPlanId?: string | null;
  routeId?: string;
  routeName?: string;
  riskLevel?: string | null;
  riskScore?: number | null;
  savingsUsd?: number | null;
  approvedByAddress?: string | null;
  rejectionReason?: string | null;
  txHash?: string | null;
  chainId?: number | null;
  smartWalletAddress?: string | null;
  executionPlanId?: string | null;
  gasUsed?: string | number | null;
  gasCostUsd?: number | null;
  explorerUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

function ok(data: Record<string, unknown>, persisted: boolean) {
  return NextResponse.json({ success: true, persisted, ...data });
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

export async function POST(req: NextRequest) {
  let body: ExecutionBody;
  try {
    body = (await req.json()) as ExecutionBody;
  } catch {
    return err("Request body is not valid JSON.");
  }

  const action = body.action;
  if (!action) return err("action is required.");

  // ---- Offline fallback: never block the approved on-chain execution. ------
  if (!isSupabaseConfigured()) {
    return ok(
      { action, warning: "Supabase not configured — execution record not persisted." },
      false
    );
  }

  const supabase = getSupabaseAdmin();
  const businessId = body.businessId;
  const paymentRequestId = body.paymentRequestId;

  if (!businessId && action !== "PLAN_CREATED") {
    return err("businessId is required.");
  }
  if (!paymentRequestId && action !== "PLAN_CREATED") {
    return err("paymentRequestId is required.");
  }

  const audit = async (eventType: string, description: string, meta: Record<string, unknown> = {}) => {
    if (!businessId) return;
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      payment_request_id: paymentRequestId ?? null,
      event_type: eventType,
      description,
      meta,
    });
  };

  try {
    switch (action) {
      // ======================================================================
      // PLAN_CREATED — plan + route persisted; audit the route selection.
      // ======================================================================
      case "PLAN_CREATED": {
        if (!body.paymentPlanId || !businessId) {
          return err("paymentPlanId and businessId are required for PLAN_CREATED.");
        }
        if (!paymentRequestId) {
          return err("paymentRequestId is required for PLAN_CREATED.");
        }
        if (body.routeId) {
          await supabase
            .from("payment_plans")
            .update({ selected_route_id: body.routeId })
            .eq("id", body.paymentPlanId);
        }
        await audit(
          "PLAN_CREATED",
          `Payment plan generated (id ${body.paymentPlanId}).`,
          { plan_id: body.paymentPlanId, route_id: body.routeId ?? null }
        );
        await audit(
          "ROUTE_SELECTED",
          `Route selected: ${body.routeName || body.routeId || "n/a"}${
            typeof body.savingsUsd === "number" ? ` — savings $${body.savingsUsd}` : ""
          }.`,
          {
            route_id: body.routeId ?? null,
            route_name: body.routeName ?? null,
            savings_usd: body.savingsUsd ?? null,
          }
        );
        return ok({ action, paymentPlanId: body.paymentPlanId }, true);
      }

      // ======================================================================
      // RISK_CHECKED — deterministic risk evaluation recorded before approval.
      // ======================================================================
      case "RISK_CHECKED": {
        await audit(
          "RISK_CHECKED",
          `Deterministic risk evaluation: ${body.riskLevel ?? "n/a"}${typeof body.riskScore === "number" ? ` (${body.riskScore}/100)` : ""}.`,
          { risk_level: body.riskLevel ?? null, risk_score: body.riskScore ?? null }
        );
        return ok({ action }, true);
      }

      // ======================================================================
      // APPROVE — explicit human approval before any execution.
      // ======================================================================
      case "APPROVE": {
        await supabase
          .from("payment_requests")
          .update({ status: "APPROVED" })
          .eq("id", paymentRequestId)
          .eq("business_id", businessId);

        const { data: approval, error: apprErr } = await supabase
          .from("approvals")
          .insert({
            payment_request_id: paymentRequestId,
            status: "APPROVED",
            approved_at: new Date().toISOString(),
            approved_by_address: body.approvedByAddress ?? null,
            risk_level: body.riskLevel ?? null,
            note: "Approved via PayMaster Phase 10 approval gate.",
          })
          .select()
          .single();

        await audit(
          "PAYMENT_APPROVED",
          `Payment approved by operator${body.approvedByAddress ? ` (${body.approvedByAddress})` : ""}${
            body.riskLevel ? ` — risk ${body.riskLevel}` : ""
          }.`,
          {
            approval_id: approval?.id ?? null,
            approved_by: body.approvedByAddress ?? null,
            risk_level: body.riskLevel ?? null,
          }
        );
        if (apprErr) return err(apprErr.message, 500);
        return ok({ action, approvalId: approval?.id ?? null }, true);
      }

      // ======================================================================
      // REJECT — operator declined; payment cancelled, nothing executed.
      // ======================================================================
      case "REJECT": {
        await supabase
          .from("payment_requests")
          .update({ status: "CANCELLED" })
          .eq("id", paymentRequestId)
          .eq("business_id", businessId);

        await supabase.from("approvals").insert({
          payment_request_id: paymentRequestId,
          status: "REJECTED",
          rejection_reason: body.rejectionReason ?? "Rejected at the approval gate.",
        });

        await audit(
          "PAYMENT_REJECTED",
          `Payment rejected before execution${body.rejectionReason ? `: ${body.rejectionReason}` : ""}.`,
          { rejection_reason: body.rejectionReason ?? null }
        );
        return ok({ action }, true);
      }

      // ======================================================================
      // SUBMIT — txn broadcast through the SmartWallet (SUBMITTED).
      // ======================================================================
      case "SUBMIT": {
        if (!body.txHash) return err("txHash is required for SUBMIT.");

        await supabase
          .from("payment_requests")
          .update({ status: "EXECUTING" })
          .eq("id", paymentRequestId)
          .eq("business_id", businessId);

        const { data: txn, error: txnErr } = await supabase
          .from("txns")
          .insert({
            payment_request_id: paymentRequestId,
            payment_plan_id: body.paymentPlanId ?? null,
            execution_plan_id: body.executionPlanId ?? null,
            hash: body.txHash,
            status: "SUBMITTED",
            chain_id: body.chainId ?? 137,
            smart_wallet_address: body.smartWalletAddress ?? null,
          })
          .select()
          .single();
        if (txnErr) return err(txnErr.message, 500);

        await audit(
          "PAYMENT_SUBMITTED",
          `Execution submitted to chain ${body.chainId ?? "n/a"} via SmartWallet — awaiting confirmation.`,
          { tx_hash: body.txHash, chain_id: body.chainId ?? null }
        );
        return ok({ action, txnId: txn?.id ?? null }, true);
      }

      // ======================================================================
      // CONFIRM — receipt mined successfully (CONFIRMED).
      // ======================================================================
      case "CONFIRM": {
        if (!body.txHash) return err("txHash is required for CONFIRM.");

        await supabase
          .from("payment_requests")
          .update({ status: "COMPLETED" })
          .eq("id", paymentRequestId)
          .eq("business_id", businessId);

        // Fetch the associated plan to mark steps complete.
        const { data: planRow } = await supabase
          .from("payment_plans")
          .select("id")
          .eq("payment_request_id", paymentRequestId)
          .maybeSingle();
        if (planRow) {
          await supabase
            .from("payment_steps")
            .update({ status: "COMPLETED" })
            .eq("payment_plan_id", planRow.id);
        }

        await supabase
          .from("txns")
          .update({
            status: "CONFIRMED",
            gas_used: body.gasUsed ?? 0,
            gas_cost: body.gasCostUsd ?? 0,
            confirmed_at: new Date().toISOString(),
            explorer_url: body.explorerUrl ?? null,
          })
          .eq("hash", body.txHash);

        await audit(
          "PAYMENT_EXECUTED",
          `On-chain transaction confirmed (${body.gasUsed ?? "n/a"} gas, $${body.gasCostUsd ?? 0}).`,
          {
            tx_hash: body.txHash,
            chain_id: body.chainId ?? null,
            gas_used: body.gasUsed ?? null,
            gas_cost_usd: body.gasCostUsd ?? null,
            explorer_url: body.explorerUrl ?? null,
          }
        );
        return ok({ action }, true);
      }

      // ======================================================================
      // FAIL — rejected / reverted / timed out (FAILED).
      // ======================================================================
      case "FAIL": {
        await supabase
          .from("payment_requests")
          .update({ status: "FAILED" })
          .eq("id", paymentRequestId)
          .eq("business_id", businessId);

        if (body.txHash) {
          await supabase
            .from("txns")
            .update({
              status: "FAILED",
              error_code: body.errorCode ?? null,
              error_message: body.errorMessage ?? null,
            })
            .eq("hash", body.txHash);
        }

        await audit(
          "PAYMENT_FAILED",
          `Payment execution failed: ${body.errorMessage || body.errorCode || "unknown error"}.`,
          {
            tx_hash: body.txHash ?? null,
            chain_id: body.chainId ?? null,
            error_code: body.errorCode ?? null,
            error_message: body.errorMessage ?? null,
          }
        );
        return ok({ action }, true);
      }

      default:
        return err(`Unsupported action: ${action}`);
    }
  } catch (e: any) {
    return err(e?.message || "Execution persistence failed.", 500);
  }
}
