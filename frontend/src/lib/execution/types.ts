// =============================================================================
// PayMaster Phase 10 — Human Approval & Blockchain Execution · domain types
//
// This layer connects an APPROVED, RISK-CHECKED payment plan to the Phase 9
// SmartWallet execution contract. The LLM NEVER executes: it produces the
// intent + plan; the deterministic optimizer selects the route; the risk
// engine evaluates it; a HUMAN approves; and ONLY THEN does the client submit
// a validated transaction batch to the SmartWallet.
//
// On-chain status lifecycle (mirrors the `txns` DB rows):
//   SUBMITTED  — tx broadcast to the mempool (hash known)
//   PENDING    — waiting for a mined receipt
//   CONFIRMED  — receipt mined, status == 1 (success)
//   FAILED     — rejected by user / reverted / timed out / wrong network ...
// =============================================================================

/** Lifecycle of a blockchain execution. */
export type ExecutionStatus = "SUBMITTED" | "PENDING" | "CONFIRMED" | "FAILED";

/** Every execution failure the UI must handle explicitly. */
export type ExecutionErrorCode =
  | "WALLET_NOT_CONNECTED" // MetaMask not installed / disconnected mid-flow
  | "REJECTED" // user rejected the MetaMask signature prompt
  | "INSUFFICIENT_BALANCE" // wallet lacks native gas or token balance
  | "RPC_TIMEOUT" // node timeout / network error / cannot estimate gas
  | "CONTRACT_REVERT" // SmartWallet (or inner call) reverted on-chain
  | "WRONG_NETWORK" // wallet chainId != execution plan chainId
  | "NOT_DEPLOYED" // SmartWallet not deployed on the target chain
  | "UNKNOWN";

/** Typed execution error thrown by the engine. */
export class ExecutionError extends Error {
  constructor(
    public readonly code: ExecutionErrorCode,
    message: string,
    public readonly raw?: unknown
  ) {
    super(message);
    this.name = "ExecutionError";
  }
}

/** A single validated call the SmartWallet will make on behalf of the wallet. */
export interface ExecutionTx {
  /** Contract / recipient address the SmartWallet calls. */
  target: string;
  /** Native value (wei) forwarded with the call, as a decimal string. */
  value: string;
  /** Hex calldata ("0x" for a plain native transfer). */
  data: string;
  /** Human-readable label, e.g. "Transfer USDC to Acme". */
  label: string;
  /** Settlement token address this tx moves (null for native). */
  token: string | null;
  /** Token amount in wei (null for native). */
  amountWei: string | null;
  /** Which SmartWallet method to invoke for this step. */
  kind: "transferToken" | "approveToken" | "executeTransaction";
  /** Recipient (transferToken / executeTransaction) or spender (approveToken). */
  to: string;
  /** Spender for approveToken (SmartWallet self-approval in the direct model). */
  spender?: string;
}

/** One step of the validated execution plan. */
export interface ExecutionStep {
  order: number;
  actionType: string; // APPROVE | TRANSFER | SWAP | BRIDGE | CHECK_ALLOWANCE | CONFIRM
  title: string;
  description: string;
  status: ExecutionStatus | "PENDING";
  /** SmartWallet tx payload; null for meta steps (CHECK_ALLOWANCE / CONFIRM). */
  tx: ExecutionTx | null;
}

/**
 * A fully validated, human-approved plan that is ready to be executed through
 * the SmartWallet. Built deterministically from the intent + PaymentPlan + the
 * Phase 8 simulation result — never from raw LLM output.
 */
export interface ExecutionPlan {
  id: string;
  paymentRequestId: string;
  paymentPlanId: string | null;
  routeId: string;
  /** Chain the SmartWallet executes on (must match the connected wallet). */
  chainId: number;
  smartWalletAddress: string;
  recipient: string;
  recipientAddress: string;
  /** Settlement token symbol, e.g. "USDC" (null for native ETH/POL). */
  token: string | null;
  /** Settlement amount in human units, e.g. "1200". */
  amount: string;
  /** Settlement amount in wei, as a decimal string. */
  amountWei: string;
  /** Resolved ERC20 address (null for native). */
  tokenAddress: string | null;
  tokenDecimals: number;
  estimatedGas: number;
  estimatedGasUsd: number;
  estimatedSavingsUsd: number;
  steps: ExecutionStep[];
  sourceLabel: string;
}

/** Persisted execution record (mirrors the `txns` DB row). */
export interface ExecutionRecord {
  id: string;
  paymentRequestId: string;
  paymentPlanId: string | null;
  status: ExecutionStatus;
  txHash: string | null;
  chainId: number;
  smartWalletAddress: string | null;
  gasUsed: string | null;
  gasCostUsd: number;
  explorerUrl: string | null;
  submittedAt: string;
  confirmedAt: string | null;
  error: { code: ExecutionErrorCode; message: string } | null;
}

/** Result returned after broadcasting the SmartWallet transaction. */
export interface SubmitResult {
  record: ExecutionRecord;
  txHash: string;
}

/** Result returned after the receipt confirms on-chain. */
export interface ConfirmResult {
  record: ExecutionRecord;
  receipt: unknown;
}

/** Full on-chain execution result surfaced to the UI. */
export interface ExecutionOutcome {
  txHash: string;
  status: "CONFIRMED" | "FAILED";
  gasUsed: string; // bigint as decimal string
  gasCostUsd: number;
  explorerUrl: string | null;
  receipt: unknown;
  error?: { code: ExecutionErrorCode; message: string } | null;
}

/** Native gas price used to convert receipt gas into USD. */
export const NATIVE_USD_PRICES: Record<number, number> = {
  1: 1800,
  137: 0.7,
  42161: 1800,
  10: 1800,
  8453: 1800,
  31337: 1800, // local hardhat — treated as ETH for demo cost display
};
