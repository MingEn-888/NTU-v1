// =============================================================================
// PayMaster Phase 8 — Risk Evaluation & Simulation (catalog & constants)
//
// Every threshold and weight the risk engine uses lives here as a constant
// table — the SINGLE source of truth. Nothing in this file is influenced by
// the LLM, so two identical payments always produce identical risk scores.
//
// SCORING MODEL (deterministic, 0-100):
//
//   RiskScore = CheckPoints  (0-50)   <- 7 checks, PASS=0 / WARN=half / FAIL=full
//             + RoutePoints  (0-25)   <- bridges/swaps/approvals structure
//             + AmountPoints (0-25)   <- payout size exposure
//
// Classification:  0-33  LOW  |  34-66  MEDIUM  |  67-100  HIGH
//
// HIGH risk is NOT blocked by the engine — every payment still proceeds to the
// explicit human approval gate (see ApprovalGate in types.ts). Classification
// only drives how prominently the system warns the human before they sign.
// =============================================================================

import type { RiskCheckId } from "./types";

// -----------------------------------------------------------------------------
// Address / recipient validation
// -----------------------------------------------------------------------------

/** EOA wallet address: 0x + 40 hex chars. Anything else is not an address. */
export const WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// -----------------------------------------------------------------------------
// Check points (PASS = 0). Max = 50 across all 7 checks.
//   balance    12  - funds available to settle the payment
//   recipient  13  - recipient identity is the highest-leverage check
//   gas         8  - enough native gas to pay fees
//   network     6  - every required chain is supported
//   complexity  6  - more transactions = bigger failure surface
//   slippage    5  - swap slippage budget
// -----------------------------------------------------------------------------

export const CHECK_WEIGHTS: Record<RiskCheckId, number> = {
  balance: 12,
  recipient: 13,
  gas: 8,
  network: 6,
  complexity: 6,
  slippage: 5,
  route: 0, // route structure is scored separately (RoutePoints, 0-25)
};

/** Sum of all check weights = 50. */
export const MAX_CHECK_SCORE = 50;
export const MAX_ROUTE_SCORE = 25;
export const MAX_AMOUNT_SCORE = 25;
export const MAX_RISK_SCORE = 100;

// -----------------------------------------------------------------------------
// Risk classification thresholds
// -----------------------------------------------------------------------------

export const RISK_LEVEL_LOW_MAX = 33;
export const RISK_LEVEL_MEDIUM_MAX = 66;

// -----------------------------------------------------------------------------
// Payout-size exposure tiers (AmountPoints, max 25)
// -----------------------------------------------------------------------------

export interface AmountRiskTier {
  /** Payments strictly above this USD value fall into this tier. */
  aboveUsd: number;
  points: number;
}

export const AMOUNT_RISK_TIERS: AmountRiskTier[] = [
  { aboveUsd: 250_000, points: 25 },
  { aboveUsd: 50_000, points: 19 },
  { aboveUsd: 10_000, points: 14 },
  { aboveUsd: 1_000, points: 8 },
  { aboveUsd: 0, points: 0 },
];

// -----------------------------------------------------------------------------
// Route structure points (RoutePoints, max 25)
//   base      2  - any on-chain payment carries base execution risk
//   SWAP     +7  - DEX swap (slippage + pool risk), capped at 2 swaps
//   BRIDGE  +14  - cross-chain bridge (counterparty + settlement risk)
//   APPROVE  +3  - ERC20 allowance grant to a router contract
// -----------------------------------------------------------------------------

export const ROUTE_BASE_POINTS = 2;
export const ROUTE_SWAP_POINTS = 7;
export const ROUTE_BRIDGE_POINTS = 14;
export const ROUTE_APPROVE_POINTS = 3;
export const ROUTE_MAX_SWAPS = 2;

/** Actions that count as "on-chain operations" for the complexity check. */
export const ON_CHAIN_ACTIONS = ["APPROVE", "SWAP", "BRIDGE", "TRANSFER"] as const;

// -----------------------------------------------------------------------------
// Gas check — the wallet must hold a safety buffer over the estimated fee
// -----------------------------------------------------------------------------

/** PASS when native gas >= 2x estimated gas. */
export const GAS_SAFETY_MARGIN = 2.0;
/** WARN when gas <= native gas < 2x estimated gas; FAIL below 1x. */
export const GAS_WARN_MARGIN = 1.0;

// -----------------------------------------------------------------------------
// Slippage check (basis points; 1 bps = 0.01%)
// -----------------------------------------------------------------------------

/** Default estimated slippage budget used when the caller omits it. */
export const SLIPPAGE_BPS_DEFAULT = 30; // 0.30%
export const SLIPPAGE_BPS_WARN = 50; // 0.50%
export const SLIPPAGE_BPS_FAIL = 100; // 1.00%

// -----------------------------------------------------------------------------
// Complexity check — on-chain transaction thresholds
// -----------------------------------------------------------------------------

export const COMPLEXITY_WARN_TX = 3;
export const COMPLEXITY_FAIL_TX = 5;

// -----------------------------------------------------------------------------
// Deterministic bridge fee estimate (USD per hop) by chain name
// -----------------------------------------------------------------------------

export const BRIDGE_FEE_USD: Record<string, number> = {
  ethereum: 12,
  polygon: 2,
  arbitrum: 3,
  optimism: 3.5,
  base: 3.5,
};

export function bridgeFeeFor(chainName: string | null | undefined): number {
  if (!chainName) return 0;
  return BRIDGE_FEE_USD[chainName.trim().toLowerCase()] ?? 3;
}

// -----------------------------------------------------------------------------
// Network support — canonical chain set (mirrors Phase 3/6 chain registry)
// -----------------------------------------------------------------------------

/** Canonical chain aliases the treasury can settle on. */
export const SUPPORTED_CHAIN_SET = new Set([
  "ethereum",
  "polygon",
  "arbitrum",
  "optimism",
  "base",
]);

/** Normalize a chain name/alias for comparison. */
export function normalizeChainName(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().toLowerCase();
}

/** True when a chain name is in the canonical supported set. */
export function isSupportedChain(name: string | null | undefined): boolean {
  return SUPPORTED_CHAIN_SET.has(normalizeChainName(name));
}

/** True when a chain is the native home of a token (e.g. ETH on Ethereum). */
export function isNativeAsset(asset: string | null | undefined): boolean {
  const a = (asset || "").toUpperCase();
  return a === "ETH" || a === "POL";
}
