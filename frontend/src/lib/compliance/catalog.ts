// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · catalog & constants
//
// Single source of truth for every threshold, weight, policy and SIMULATED
// reference dataset the compliance layer uses. Everything here is deterministic
// and hard-coded — nothing is influenced by the LLM.
//
// NOTE ON SIMULATED DATA: Counterparty profiles, KYC status, sanctions
// screening, wallet risk ratings and Travel Rule information are MOCK data for
// this hackathon prototype. This app does NOT connect to a real sanctions
// provider or Travel Rule network. The UI must always label these as
// "simulated" / "prototype".
// =============================================================================

import type {
  ComplianceRiskLevel,
  CounterpartyProfile,
  PolicyDefinition,
  PolicyEffect,
} from "./types";

// ---------------------------------------------------------------------------
// Compliance risk classification thresholds (0-100)
// ---------------------------------------------------------------------------

export const COMPLIANCE_LOW_MAX = 29;
export const COMPLIANCE_MEDIUM_MAX = 59;
export const COMPLIANCE_HIGH_MAX = 79;

export function classifyComplianceRisk(score: number): ComplianceRiskLevel {
  if (!isFinite(score) || score <= COMPLIANCE_LOW_MAX) return "LOW";
  if (score <= COMPLIANCE_MEDIUM_MAX) return "MEDIUM";
  if (score <= COMPLIANCE_HIGH_MAX) return "HIGH";
  return "CRITICAL";
}

// ---------------------------------------------------------------------------
// Risk contribution caps (each component contributes 0-… to the 0-100 score)
// ---------------------------------------------------------------------------

export const MAX_COMPLIANCE_SCORE = 100;
/** Counterparty screening risk -> up to 25 points. */
export const MAX_COUNTERPARTY_SCORE = 25;
/** Transaction monitoring risk -> up to 20 points. */
export const MAX_MONITORING_SCORE = 20;
/** Transfer amount exposure -> up to 20 points. */
export const MAX_AMOUNT_SCORE = 20;
/** Asset risk -> up to 15 points. */
export const MAX_ASSET_SCORE = 15;
/** Policy violations -> up to 15 points. */
export const MAX_POLICY_SCORE = 15;
/** Travel Rule incompleteness -> up to 5 points. */
export const MAX_TRAVEL_RULE_SCORE = 5;

// ---------------------------------------------------------------------------
// Asset risk ratings (SIMULATED reference data)
// ---------------------------------------------------------------------------

/** Risk of a settlement asset (0 = stable/centralised fiat-pegged, high = volatile/exotic). */
export const ASSET_RISK: Record<string, number> = {
  USDC: 1,
  USDT: 2,
  DAI: 3,
  ETH: 6,
  WETH: 6,
  POL: 7,
  MATIC: 7,
  BTC: 6,
  WBTC: 6,
  SOL: 8,
  BNB: 7,
};

/** Assets the DPT treasury is permitted to hold/settle (policy "allowed_assets"). */
export const ALLOWED_ASSETS = ["USDC", "USDT", "DAI", "ETH", "WETH", "BTC", "WBTC", "POL", "MATIC"];

/** Assets classified as stablecoin reserve (policy "min_stablecoin_reserve"). */
export const STABLECOIN_ASSETS = ["USDC", "USDT", "DAI"];

/** Simulated reference price (USD) for asset-risk display + USD conversion. */
export const SIMULATED_PRICES: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  DAI: 1,
  ETH: 1800,
  WETH: 1800,
  BTC: 42000,
  WBTC: 42000,
  POL: 0.7,
  MATIC: 0.7,
  SOL: 140,
  BNB: 300,
};

export function assetRiskOf(symbol: string): number {
  return ASSET_RISK[symbol.toUpperCase()] ?? 10;
}

export function isAllowedAsset(symbol: string): boolean {
  return ALLOWED_ASSETS.includes(symbol.toUpperCase());
}

export function isStablecoin(symbol: string): boolean {
  return STABLECOIN_ASSETS.includes(symbol.toUpperCase());
}

export function simulatedPrice(symbol: string): number {
  return SIMULATED_PRICES[symbol.toUpperCase()] ?? 1;
}

// ---------------------------------------------------------------------------
// Policy Engine — configured treasury/compliance policies (hard-coded defaults)
//
// Each policy carries an explicit effect: ALLOW (no action), REVIEW (human
// review required) or BLOCK (execution prevented). The engine aggregates them:
// BLOCK > REVIEW > ALLOW. Policies are deterministic and configurable here.
// ---------------------------------------------------------------------------

export const POLICIES: PolicyDefinition[] = [
  {
    id: "max_single_txn",
    name: "Maximum single transaction",
    category: "limits",
    description: "A single DPT transfer may not exceed the configured USD ceiling.",
    limitLabel: "$50,000 per transaction",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "max_daily_txn",
    name: "Maximum daily transaction volume",
    category: "limits",
    description: "Aggregate DPT transfers per customer may not exceed the daily USD ceiling.",
    limitLabel: "$100,000 per day",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "allowed_assets",
    name: "Allowed DPT assets",
    category: "assets",
    description: "Only whitelisted digital payment tokens may be settled.",
    limitLabel: "USDC, USDT, DAI, ETH, BTC, WBTC, POL",
    effect: "BLOCK",
    enabled: true,
  },
  {
    id: "allowed_networks",
    name: "Allowed networks",
    category: "networks",
    description: "Transfers may only route through supported, whitelisted networks.",
    limitLabel: "Ethereum, Polygon, Arbitrum, Optimism, Base",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "max_counterparty_exposure",
    name: "Maximum counterparty exposure",
    category: "exposure",
    description: "Outstanding transfers to a single counterparty may not exceed the USD ceiling.",
    limitLabel: "$150,000 per counterparty",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "max_asset_concentration",
    name: "Maximum asset concentration",
    category: "exposure",
    description: "A single non-stablecoin asset may not exceed its allocation ceiling of the treasury.",
    limitLabel: "20% per asset",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "min_stablecoin_reserve",
    name: "Minimum stablecoin reserve",
    category: "reserves",
    description: "Stablecoin holdings may not fall below the configured share of the treasury.",
    limitLabel: "40% stablecoin reserve",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "high_risk_counterparty",
    name: "High-risk counterparty threshold",
    category: "counterparty",
    description: "Transfers to counterparties above the risk threshold require review.",
    limitLabel: "Counterparty risk ≥ 70 → BLOCK, ≥ 40 → REVIEW",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "travel_rule_required",
    name: "Travel Rule information required",
    category: "travel_rule",
    description: "Transfers above the threshold require complete Travel Rule information.",
    limitLabel: "Required above $1,000 (incomplete → REVIEW, above $10,000 → BLOCK)",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "manual_approval_threshold",
    name: "Manual approval threshold",
    category: "approval",
    description: "Transfers above this USD value require explicit human approval.",
    limitLabel: "Manual approval required above $25,000",
    effect: "REVIEW",
    enabled: true,
  },
  {
    id: "blocklist",
    name: "Blocklisted counterparties",
    category: "counterparty",
    description: "Transfers to blocklisted / sanctioned counterparties are prevented.",
    limitLabel: "Blocked addresses cannot receive transfers",
    effect: "BLOCK",
    enabled: true,
  },
];

/** Aggregation rule: BLOCK wins, then REVIEW, else ALLOW. */
export function aggregatePolicyDecision(effects: PolicyEffect[]): "ALLOW" | "REVIEW" | "BLOCK" {
  if (effects.includes("BLOCK")) return "BLOCK";
  if (effects.includes("REVIEW")) return "REVIEW";
  return "ALLOW";
}

// ---------------------------------------------------------------------------
// Policy configuration values (used by the policy engine)
// ---------------------------------------------------------------------------

export const POLICY_LIMITS = {
  maxSingleTxnUsd: 50_000,
  maxDailyTxnUsd: 100_000,
  maxCounterpartyExposureUsd: 150_000,
  maxAssetConcentrationPct: 0.20, // 20%
  minStablecoinReservePct: 0.40, // 40%
  highRiskCounterpartyReview: 40,
  highRiskCounterpartyBlock: 70,
  travelRuleThresholdUsd: 1_000,
  travelRuleBlockThresholdUsd: 10_000,
  manualApprovalThresholdUsd: 25_000,
} as const;

export const SUPPORTED_NETWORKS = [
  "ethereum",
  "polygon",
  "arbitrum",
  "optimism",
  "base",
];

// ---------------------------------------------------------------------------
// SIMULATED counterparty registry
//
// This is the mock "screening provider" dataset for the prototype. Every entry
// demonstrates a screening scenario. NOT real verification data.
// ---------------------------------------------------------------------------

export const MOCK_COUNTERPARTIES: Record<string, CounterpartyProfile> = {
  // Trusted vendor used in the product demo / seed payments.
  "0x71c7656ec7ab88b098defb751b7401b5f6d8976f": {
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    name: "Acme Suppliers Pte. Ltd.",
    verificationStatus: "VERIFIED",
    sanctionsScreened: true,
    walletRisk: "LOW",
    walletAgeDays: 410,
    txnHistoryCount: 47,
    avgTxnSizeUsd: 5200,
    recentDailyTxns: 1,
    suspiciousIndicators: [],
    isKnownVendor: true,
    note: "On-boarded vendor, KYC completed (simulated).",
  },
  "0x3c44cdd470368a0623a22d2c4022878d3f9905e5": {
    address: "0x3C44CdD470368A0623A22D2c4022878d3F9905E5",
    name: "TechCorp Treasury",
    verificationStatus: "VERIFIED",
    sanctionsScreened: true,
    walletRisk: "LOW",
    walletAgeDays: 520,
    txnHistoryCount: 63,
    avgTxnSizeUsd: 4800,
    recentDailyTxns: 1,
    suspiciousIndicators: [],
    isKnownVendor: true,
  },
  // High-risk counterparty (unverified, new wallet, large transfers).
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    name: "Unknown wallet",
    verificationStatus: "UNVERIFIED",
    sanctionsScreened: true,
    walletRisk: "HIGH",
    walletAgeDays: 6,
    txnHistoryCount: 2,
    avgTxnSizeUsd: 95000,
    recentDailyTxns: 4,
    suspiciousIndicators: [
      "newly created wallet",
      "large transfer shortly after creation",
      "no KYC / verification on file",
    ],
    isKnownVendor: false,
  },
  // Blocklisted counterparty (simulated sanctions hit).
  "0x000000000000000000000000000000000000dEaD": {
    address: "0x000000000000000000000000000000000000dEaD",
    name: "Blocked address",
    verificationStatus: "UNVERIFIED",
    sanctionsScreened: true,
    walletRisk: "HIGH",
    walletAgeDays: 90,
    txnHistoryCount: 1,
    avgTxnSizeUsd: 0,
    recentDailyTxns: 0,
    suspiciousIndicators: ["sanctions match (simulated)", "blocklisted address"],
    isKnownVendor: false,
  },
};

/** Addresses that are BLOCKED by policy (simulated sanctions / blocklist). */
export const BLOCKLIST = [
  "0x000000000000000000000000000000000000dEaD",
  "0x1111111111111111111111111111111111111111",
];

/** Fallback profile used when a wallet has no record in the mock registry. */
export function unknownCounterpartyProfile(address: string): CounterpartyProfile {
  return {
    address,
    name: null,
    verificationStatus: "UNVERIFIED",
    sanctionsScreened: false,
    walletRisk: "MEDIUM",
    walletAgeDays: 0,
    txnHistoryCount: 0,
    avgTxnSizeUsd: 0,
    recentDailyTxns: 0,
    suspiciousIndicators: ["no screening record — address not previously seen"],
    isKnownVendor: false,
    note: "Simulated screening — no external verification performed.",
  };
}

// ---------------------------------------------------------------------------
// Disclaimer (legal positioning — this is NOT "MAS Compliant")
// ---------------------------------------------------------------------------

export const COMPLIANCE_DISCLAIMER =
  "Prototype demonstrating MAS-aligned compliance controls for digital asset treasury operations. This is a compliance-readiness prototype, not a licensed payment institution or regulated DPT service provider. All screening, KYC, sanctions and Travel Rule data are simulated.";
