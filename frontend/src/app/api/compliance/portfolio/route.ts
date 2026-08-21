// =============================================================================
// GET /api/compliance/portfolio — DPT portfolio monitoring endpoint.
//
// Returns a deterministic PortfolioSnapshot: total treasury value, per-asset
// allocation %, 24h change, volatility, liquidity, stablecoin reserve share,
// concentration risk, portfolio risk and treasury warnings.
//
// Holdings are SIMULATED reference data for this prototype (the real wallet
// balances are read client-side by useTreasury; the panel can also run
// analyzePortfolio() directly). Prices / volatility are simulated.
// =============================================================================

import { NextResponse } from "next/server";
import { analyzePortfolio } from "@/lib/compliance/portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deterministic demo holdings (mirrors the dashboard treasury composition). */
const DEMO_HOLDINGS = [
  { symbol: "USDC", usdValue: 647366 },
  { symbol: "USDT", usdValue: 0 },
  { symbol: "ETH", usdValue: 286324 },
  { symbol: "BTC", usdValue: 249064 },
  { symbol: "POL", usdValue: 62366 },
];

export async function GET() {
  const snapshot = analyzePortfolio(DEMO_HOLDINGS);
  return NextResponse.json({
    success: true,
    snapshot,
    isFallback: true,
    fallbackReason: "Portfolio holdings are simulated reference data for this prototype.",
  });
}
