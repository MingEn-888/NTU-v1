// =============================================================================
// PayMaster Phase 13 — Yield Automation · domain types
//
// Deterministic idle-treasury sweep into a YieldVault, with human-approved
// DEPOSIT / WITHDRAW / HARVEST actions. The LLM NEVER decides allocations:
// every amount, strategy selection and APY figure comes from the catalog +
// deterministic scoring below.
// =============================================================================

/** A single action the yield engine can propose (all require human approval). */
export type YieldAction = "DEPOSIT" | "WITHDRAW" | "HARVEST";

/** A deterministic, catalog-based yield strategy. */
export interface YieldStrategy {
  id: string;
  protocol: string;
  /** Asset symbol swept into the vault, e.g. "USDC". */
  asset: string;
  chainId: number;
  /** Vault address; null = not deployed on that chain (fails fast NOT_DEPLOYED). */
  vaultAddress: string | null;
  /** Deterministic APY in basis points (500 = 5.00%). */
  apyBps: number;
  /** Deterministic risk score 0-100 (lower = safer). */
  riskScore: number;
  /** Deposit bounds in USD. */
  minDepositUsd: number;
  maxDepositUsd: number;
  /** Lock-up period in days. */
  lockupDays: number;
}

/** One concrete, deterministic yield movement. */
export interface YieldAllocation {
  strategyId: string;
  chainId: number;
  vaultAddress: string;
  asset: string;
  action: YieldAction;
  /** Human-unit amount (e.g. "5000" USDC). */
  amount: string;
  /** Token units (wei) as a decimal string. */
  amountWei: string;
  /** Vault shares (WITHDRAW only). */
  shares?: string;
  expectedApyBps: number;
  /** Projected annual yield in USD at the chosen APY. */
  expectedAnnualYieldUsd: number;
  reason: string;
  /** The engine NEVER auto-executes — every suggestion carries this flag. */
  requiresApproval: true;
}

/** Minimal treasury context (mirrors useTreasury's treasuryContext subset). */
export interface YieldTreasuryContext {
  availableAssets: {
    symbol: string;
    balance?: string;
    usdValue?: number;
    chain?: string;
  }[];
  preferredChain?: string | null;
  totalEstimatedUSDValue?: number;
}

/** Result of the deterministic allocation sweep. */
export interface YieldSuggestion {
  suggestions: YieldAllocation[];
  /** Idle capital (USD) available to sweep. */
  idleUsd: number;
  /** Capital already deployed into vaults (USD). */
  deployedUsd: number;
  /** Safety buffer kept liquid (USD). */
  bufferUsd: number;
  source: "deterministic";
}

/** Error type mirroring the ExecutionError convention. */
export type YieldErrorCode =
  | "NO_IDLE_CAPITAL"
  | "NOT_DEPLOYED"
  | "INVALID_STRATEGY"
  | "INSUFFICIENT_BALANCE"
  | "VALIDATION_FAILED";

export class YieldEngineError extends Error {
  constructor(
    public readonly code: YieldErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "YieldEngineError";
  }
}
