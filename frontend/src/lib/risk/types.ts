// =============================================================================
// PayMaster Phase 8 — Risk Evaluation & Transaction Simulation Engine (domain types)
//
// Phase 7 selected the *best route* deterministically. Phase 8 evaluates that
// selected route — and every candidate — BEFORE any human approval:
//   Selected Route + Treasury + Wallet + Recipient
//     -> 7 deterministic risk checks (balance / gas / recipient / network /
//        slippage / route / complexity)
//     -> deterministic 0-100 risk score + LOW / MEDIUM / HIGH classification
//     -> transaction simulation (recipient, token, amount, route, gas, total
//        cost, txn count, warnings, expected result)
//     -> plain-English explanation grounded ONLY in validated simulation data
//     -> explicit human approval gate (NO auto blockchain execution)
//
// Trust boundary: the LLM NEVER decides risk, NEVER invents financial numbers
// and NEVER executes. Risk checks + scoring + simulation are pure deterministic
// functions; the AI explanation may only reference figures that already exist
// in the validated simulation result.
// =============================================================================

/** The 7 deterministic risk checks run on every payment before approval. */
export type RiskCheckId =
  | "balance" // 1. treasury holds enough of the funding asset?
  | "gas" // 2. wallet holds enough native gas?
  | "recipient" // 3. recipient address is a valid 0x address?
  | "network" // 4. every required chain is supported?
  | "slippage" // 5. estimated swap slippage is acceptable?
  | "route" // 6. route involves extra bridges / swaps?
  | "complexity"; // 7. how many on-chain operations are required?

export const RISK_CHECK_IDS: RiskCheckId[] = [
  "balance",
  "gas",
  "recipient",
  "network",
  "slippage",
  "route",
  "complexity",
];

export type RiskCheckStatus = "PASS" | "WARN" | "FAIL";

/** Result of a single deterministic risk check. */
export interface RiskCheckResult {
  id: RiskCheckId;
  /** Human-readable title, e.g. "Treasury Balance". */
  label: string;
  status: RiskCheckStatus;
  /** Deterministic points this check contributes to the 0-100 score. */
  score: number;
  /** Concise, human-readable verdict. */
  message: string;
  /** Optional extra context (e.g. the balance that is missing). */
  detail?: string;
}

/** Deterministic risk classification. */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** Point-by-point breakdown of how the 0-100 risk score was built. */
export interface RiskContributionBreakdown {
  balance: number;
  gas: number;
  recipient: number;
  network: number;
  slippage: number;
  route: number;
  complexity: number;
  /** Contribution from payment size (larger payouts = higher exposure). */
  amount: number;
  /** Total 0-100. */
  total: number;
}

// -----------------------------------------------------------------------------
// Simulation inputs
// -----------------------------------------------------------------------------

export interface SimulationTreasuryAsset {
  symbol: string;
  balance: string;
  usdValue: number;
}

export interface SimulationTreasury {
  /** Assets the treasury holds (symbol, raw balance, USD valuation). */
  availableAssets: SimulationTreasuryAsset[];
  /** Chain names/aliases the treasury supports (e.g. ["polygon", "ethereum"]). */
  supportedChains: string[];
  preferredChain?: string | null;
  /** Native gas balance on the active chain (raw token units). */
  nativeGasBalance?: string;
  totalEstimatedUSDValue?: number;
}

/** One execution step of the simulated payment (mirrors Phase 6 PlanStep). */
export interface SimulationStep {
  order: number;
  actionType: string; // CHECK_ALLOWANCE | APPROVE | SWAP | BRIDGE | TRANSFER | CONFIRM
  title: string;
  chain?: string | null;
  token?: string | null;
  estimatedGas?: number;
  estimatedDuration?: number;
}

export interface SimulationRoute {
  routeId: string;
  name: string;
  /** Ordered chains, e.g. ["ethereum", "polygon"]. */
  chainSequence: string[];
  /** Ordered tokens per hop, e.g. ["USDC", "USDC"]. */
  tokenSequence: string[];
  transactionCount: number;
  estimatedGas: number;
  estimatedDuration: number;
  /** Upstream strategy (native_direct / native_swap / bridge_then_pay / ...). */
  strategy?: string | null;
}

export interface SimulationPayment {
  /** Payee name (may be null when only an address is known). */
  recipient: string | null;
  /** Verbatim 0x wallet address (validated by the recipient check). */
  recipientAddress: string | null;
  /** Settlement asset being delivered (e.g. USDC). */
  token: string;
  /** Settlement amount being delivered. */
  amount: number;
}

/** Alternative route used only for the explanation's cost comparison. */
export interface SimulationAlternative {
  routeId: string;
  name: string;
  chainSequence: string[];
  estimatedGas: number;
  estimatedDuration: number;
  transactionCount: number;
}

export interface SimulationRequest {
  payment: SimulationPayment;
  route: SimulationRoute;
  steps: SimulationStep[];
  treasury: SimulationTreasury;
  /** Estimated swap slippage in basis points (1 bps = 0.01%). Default from catalog. */
  slippageBps?: number;
  /** USD value of native gas available for fees (overrides treasury.nativeGasBalance). */
  walletGasBalanceUsd?: number;
  /** Optional candidate routes used for the explanation's cost comparison. */
  alternatives?: SimulationAlternative[];
  businessId?: string;
  sourceLabel?: string;
}

// -----------------------------------------------------------------------------
// Simulation outputs
// -----------------------------------------------------------------------------

export interface SimulationTotals {
  /** Estimated on-chain gas in USD. */
  estimatedGasUsd: number;
  /** Estimated bridge protocol fee in USD. */
  estimatedBridgeFeeUsd: number;
  /** Estimated slippage cost in USD (amount * bps / 10000, swaps only). */
  estimatedSlippageUsd: number;
  /** Gas + bridge fee + slippage = the full estimated cost of the payment. */
  estimatedTotalCostUsd: number;
  /** Estimated settlement duration in seconds. */
  estimatedDuration: number;
  /** Number of on-chain transactions. */
  transactionCount: number;
}

/** Explicit human-approval gate — the engine NEVER executes on its own. */
export interface ApprovalGate {
  /** Always true — every payment requires a human signature. */
  required: true;
  status: "PENDING";
  /** All risk levels are permitted to proceed to human review (none auto-execute). */
  canProceed: boolean;
  /** Human-readable note on the approval requirement. */
  note: string;
  /** True for HIGH risk — the UI must require an explicit acknowledgement. */
  highRiskAcknowledged: boolean;
}

export interface SimulationResult {
  /** Deterministic id (routeId + timestamp-free hash of the request). */
  simulationId: string;
  payment: SimulationPayment;
  route: SimulationRoute;
  steps: SimulationStep[];
  checks: RiskCheckResult[];
  /** Deterministic 0-100 risk score. */
  riskScore: number;
  riskLevel: RiskLevel;
  riskBreakdown: RiskContributionBreakdown;
  totals: SimulationTotals;
  /** Aggregated human-readable warnings from all FAIL/WARN checks. */
  warnings: string[];
  /** Plain-English expected outcome of executing this payment. */
  expectedResult: string;
  /** Plain-English explanation grounded ONLY in validated simulation data. */
  explanation: string;
  /** "ai" when an LLM polished the prose, "deterministic" when pure code. */
  explanationSource: "ai" | "deterministic";
  approval: ApprovalGate;
  /** Deterministic — the engine never invents figures, only evaluates. */
  source: "risk";
}

export type RiskEngineErrorCode =
  | "EMPTY_PAYMENT"
  | "INVALID_ROUTE"
  | "INVALID_TREASURY"
  | "VALIDATION_FAILED";

/** Typed error thrown by the risk & simulation service. */
export class RiskEngineError extends Error {
  constructor(
    public readonly code: RiskEngineErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "RiskEngineError";
  }
}
