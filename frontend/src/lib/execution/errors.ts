// =============================================================================
// PayMaster Phase 10 — Execution error classification.
//
// Maps every failure mode the wallet / RPC / contract can surface into a typed
// ExecutionError so the UI can render the correct recovery hint:
//   1. REJECTED              — user closed/rejected the MetaMask prompt
//   2. INSUFFICIENT_BALANCE  — not enough native gas or token balance
//   3. RPC_TIMEOUT           — node unreachable / timed out / cannot estimate
//   4. CONTRACT_REVERT       — SmartWallet (or inner call) reverted
//   5. WRONG_NETWORK         — wallet is on a different chain than the plan
//   6. WALLET_NOT_CONNECTED  — no provider / signer available mid-flow
// =============================================================================

import { ExecutionError, type ExecutionErrorCode } from "./types";

export interface ErrorContext {
  /** Chain id the wallet is currently on. */
  walletChainId?: number | null;
  /** Chain id the execution plan targets. */
  planChainId?: number | null;
}

const REJECTED_HINTS = [
  "action_rejected",
  "user rejected",
  "denied transaction",
  "user denied",
  "rejected transaction",
];

const INSUFFICIENT_HINTS = [
  "insufficient funds",
  "insufficient balance",
  "insufficientfunds",
  "exceeds balance",
];

const RPC_HINTS = [
  "timeout",
  "timed out",
  "etimedout",
  "econnreset",
  "econnrefused",
  "network error",
  "unconnected",
  "cannot estimate gas",
  "could not detect network",
  "server error",
];

const REVERT_HINTS = [
  "revert",
  "execution reverted",
  "transaction reverted",
  "call_exception",
  "callfailed",
  "transferfailed",
  "notauthorized",
  "invalidnonce",
  "reentrancy",
  "zeroaddress",
  "zeroamount",
  "emptybatch",
];

const DISCONNECT_HINTS = [
  "wallet not connected",
  "not connected",
  "no accounts",
  "no signer",
  "missing signer",
  "must provide a signer",
  "provider not found",
];

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/**
 * Classify any error raised while executing a payment into a typed
 * ExecutionError. Preserves existing ExecutionError instances.
 */
export function mapEthersError(err: unknown, context: ErrorContext = {}): ExecutionError {
  if (err instanceof ExecutionError) return err;

  const anyErr = err as { code?: unknown; message?: unknown; shortMessage?: unknown; data?: unknown };
  const code = anyErr?.code;
  const message = [
    anyErr?.message,
    anyErr?.shortMessage,
    typeof anyErr === "string" ? anyErr : "",
  ]
    .filter((m): m is string => typeof m === "string")
    .join(" ");
  const raw = err;

  // 1. User rejected the wallet signature prompt.
  if (code === 4001 || code === "ACTION_REJECTED" || code === 4000) {
    return new ExecutionError("REJECTED", "Transaction rejected in wallet. No funds were moved.", raw);
  }

  // 6. Wallet not connected / missing signer.
  if (includesAny(message, DISCONNECT_HINTS) || code === "UNCONNECTED") {
    return new ExecutionError(
      "WALLET_NOT_CONNECTED",
      "Wallet is not connected. Reconnect and try again.",
      raw
    );
  }

  // 5. Wrong network — wallet chain differs from the plan chain.
  const walletChain = Number(context.walletChainId ?? 0);
  const planChain = Number(context.planChainId ?? 0);
  if (
    (code === "NETWORK_ERROR" || includesAny(message, ["network", "chain mismatch", "wrong network"])) &&
    walletChain > 0 &&
    planChain > 0 &&
    walletChain !== planChain
  ) {
    return new ExecutionError(
      "WRONG_NETWORK",
      `Wallet is on chain ${walletChain} but the payment plan targets chain ${planChain}. Switch networks and try again.`,
      raw
    );
  }

  // 2. Insufficient native gas or token balance.
  if (includesAny(message, INSUFFICIENT_HINTS)) {
    return new ExecutionError(
      "INSUFFICIENT_BALANCE",
      "Insufficient balance — top up native gas or the funding token before executing.",
      raw
    );
  }

  // 4. Contract revert (SmartWallet or inner call).
  if (code === "CALL_EXCEPTION" || includesAny(message, REVERT_HINTS)) {
    const inner =
      typeof anyErr?.data === "object" && anyErr.data !== null && "message" in (anyErr.data as object)
        ? ((anyErr.data as { message?: string }).message ?? "")
        : "";
    const detail = inner ? ` (${inner})` : "";
    return new ExecutionError(
      "CONTRACT_REVERT",
      `SmartWallet execution reverted${detail}. No funds were moved.`,
      raw
    );
  }

  // 3. RPC timeout / node unreachable.
  if (includesAny(message, RPC_HINTS) || code === "TIMEOUT" || code === "SERVER_ERROR") {
    return new ExecutionError(
      "RPC_TIMEOUT",
      "Blockchain node timed out or is unreachable. Check your network connection and try again.",
      raw
    );
  }

  // Anything else.
  return new ExecutionError("UNKNOWN", message.trim() || "Unknown execution error.", raw);
}

/** Short human label for a failure code (used in badges/toasts). */
export function errorLabel(code: ExecutionErrorCode): string {
  switch (code) {
    case "WALLET_NOT_CONNECTED":
      return "Wallet disconnected";
    case "REJECTED":
      return "Rejected";
    case "INSUFFICIENT_BALANCE":
      return "Insufficient balance";
    case "RPC_TIMEOUT":
      return "RPC timeout";
    case "CONTRACT_REVERT":
      return "Contract reverted";
    case "WRONG_NETWORK":
      return "Wrong network";
    case "NOT_DEPLOYED":
      return "SmartWallet not deployed";
    default:
      return "Execution failed";
  }
}

/** Recovery hint rendered next to a failed execution. */
export function recoveryHint(code: ExecutionErrorCode): string {
  switch (code) {
    case "REJECTED":
      return "You rejected the signature. No funds were moved — approve again if intended.";
    case "INSUFFICIENT_BALANCE":
      return "Fund the SmartWallet with native gas and the funding token, then retry.";
    case "RPC_TIMEOUT":
      return "Retry when the node is reachable, or switch RPC endpoint.";
    case "CONTRACT_REVERT":
      return "The SmartWallet rejected the payload. The plan may be stale (nonce) or invalid — regenerate and retry.";
    case "WRONG_NETWORK":
      return "Switch your wallet to the plan's target chain, then retry.";
    case "WALLET_NOT_CONNECTED":
      return "Reconnect your wallet and approve again.";
    case "NOT_DEPLOYED":
      return "Deploy the SmartWallet on this chain first (see contracts/deployments).";
    default:
      return "Review the error details and retry.";
  }
}
