// =============================================================================
// POST /api/yield/execute — Phase 13 yield position persistence.
//
// Records an APPROVED yield movement (DEPOSIT / WITHDRAW / HARVEST) into the
// `yield_positions` table + audit trail. Persistence is BEST-EFFORT: the
// on-chain vault call (submitted client-side via useWallet) is the source of
// truth, so an unreachable Supabase never blocks the approved movement.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type YieldExecuteAction = "DEPOSIT" | "WITHDRAW" | "HARVEST";

interface YieldExecuteBody {
  action: YieldExecuteAction;
  businessId?: string;
  walletAddress?: string;
  vaultAddress?: string;
  strategyId?: string;
  asset?: string;
  chainId?: number | null;
  amountWei?: string | null;
  amount?: string | null;
  shares?: string | null;
  apyBps?: number | null;
  txHash?: string | null;
}

function ok(data: Record<string, unknown>, persisted: boolean) {
  return NextResponse.json({ success: true, persisted, ...data });
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

export async function POST(req: NextRequest) {
  let body: YieldExecuteBody;
  try {
    body = (await req.json()) as YieldExecuteBody;
  } catch {
    return err("Request body is not valid JSON.");
  }

  const action = body.action;
  if (!action || !["DEPOSIT", "WITHDRAW", "HARVEST"].includes(action)) {
    return err("action must be DEPOSIT, WITHDRAW or HARVEST.");
  }

  if (!isSupabaseConfigured()) {
    return ok({ action, warning: "Supabase not configured — yield position not persisted." }, false);
  }

  const supabase = getSupabaseAdmin();
  const businessId = body.businessId;
  const walletAddress = body.walletAddress;

  if (!businessId) return err("businessId is required.");
  if (!walletAddress) return err("walletAddress is required.");
  if (!body.vaultAddress) return err("vaultAddress is required.");

  try {
    const { data: position, error: insertErr } = await supabase
      .from("yield_positions")
      .insert({
        business_id: businessId,
        wallet_address: walletAddress,
        vault_address: body.vaultAddress,
        strategy_id: body.strategyId ?? null,
        asset_symbol: body.asset ?? "USDC",
        chain_id: body.chainId ?? null,
        action: action,
        principal_amount: body.amount ?? null,
        shares: body.shares ?? null,
        apy_bps: body.apyBps ?? null,
        status: action === "WITHDRAW" ? "WITHDRAWN" : action === "DEPOSIT" ? "ACTIVE" : "COMPOUNDED",
        tx_hash: body.txHash ?? null,
      })
      .select()
      .single();

    if (insertErr) return err(insertErr.message, 500);

    // Audit trail (best effort).
    await supabase.from("audit_logs").insert({
      business_id: businessId,
      event_type: `YIELD_${action}`,
      description: `Yield ${action.toLowerCase()} for ${body.asset ?? "USDC"} in vault ${body.vaultAddress}.`,
      meta: { position_id: position?.id ?? null, tx_hash: body.txHash ?? null },
    });

    return ok({ action, positionId: position?.id ?? null }, true);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Persistence failed.", 500);
  }
}
