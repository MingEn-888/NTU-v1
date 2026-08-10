// =============================================================================
// PayMaster Phase 8 — The 7 deterministic risk checks
//
// Every check is a pure function of the validated simulation input. Each one
// returns a RiskCheckResult with a status (PASS / WARN / FAIL), a deterministic
// point contribution and a human-readable verdict. No randomness, no LLM, no
// external calls — the same input always yields the same check outcomes.
// =============================================================================

import {
  CHECK_WEIGHTS,
  COMPLEXITY_FAIL_TX,
  COMPLEXITY_WARN_TX,
  GAS_SAFETY_MARGIN,
  GAS_WARN_MARGIN,
  isNativeAsset,
  isSupportedChain,
  normalizeChainName,
  SLIPPAGE_BPS_FAIL,
  SLIPPAGE_BPS_WARN,
  WALLET_ADDRESS_RE,
} from "./catalog";
import type {
  RiskCheckResult,
  RiskCheckStatus,
  SimulationRequest,
  SimulationTreasury,
} from "./types";

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

function result(
  id: RiskCheckResult["id"],
  label: string,
  status: RiskCheckStatus,
  message: string,
  detail?: string
): RiskCheckResult {
  const weight = CHECK_WEIGHTS[id] ?? 0;
  // PASS = 0 points, WARN = half the weight, FAIL = full weight.
  const score = status === "FAIL" ? weight : status === "WARN" ? weight / 2 : 0;
  return { id, label, status, score, message, detail };
}

function parseBalance(raw: string | undefined | null): number {
  const n = parseFloat(raw || "");
  return isFinite(n) && n >= 0 ? n : 0;
}

/** USD value of the native gas the wallet/treasury holds on the settlement chain. */
function effectiveGasBalanceUsd(
  treasury: SimulationTreasury,
  walletGasBalanceUsd: number | undefined
): number | null {
  if (walletGasBalanceUsd !== undefined && isFinite(walletGasBalanceUsd)) {
    return Math.max(0, walletGasBalanceUsd);
  }
  // Derive a USD estimate from the raw native gas balance using the first
  // asset that is native (ETH/POL) so gas is always comparable to USD fees.
  const native = (treasury.availableAssets || []).find((a) =>
    isNativeAsset(a.symbol)
  );
  if (native && native.usdValue > 0 && parseBalance(native.balance) > 0) {
    // usdValue is the total valuation; price = usdValue / balance.
    const bal = parseBalance(native.balance);
    const price = native.usdValue / bal;
    return price * parseBalance(treasury.nativeGasBalance);
  }
  return null;
}

// -----------------------------------------------------------------------------
// 1. Balance check — does the treasury hold enough of the funding asset?
// -----------------------------------------------------------------------------

export function checkBalance(req: SimulationRequest): RiskCheckResult {
  const { payment, route, treasury } = req;
  // Funding asset = the asset the route spends (first on-chain token), falling
  // back to the settlement token.
  const funding = (route.tokenSequence?.[0] || payment.token || "").toUpperCase();

  // Native gas assets are always spendable (the treasury keeps a gas reserve).
  if (isNativeAsset(funding)) {
    return result("balance", "Treasury Balance", "PASS", `Native ${funding} gas is available for the payment.`);
  }

  const asset = (treasury.availableAssets || []).find(
    (a) => (a.symbol || "").toUpperCase() === funding
  );
  if (!asset) {
    return result(
      "balance",
      "Treasury Balance",
      "FAIL",
      `Treasury does not hold ${funding} — the route cannot be funded.`,
      `Held: ${(treasury.availableAssets || []).map((a) => a.symbol).join(", ") || "none"}`
    );
  }

  const held = parseBalance(asset.balance);
  if (held < payment.amount) {
    return result(
      "balance",
      "Treasury Balance",
      "WARN",
      `Treasury holds ${held} ${funding} but ${payment.amount} ${funding} is required.`,
      `Shortfall ≈ ${(payment.amount - held).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${funding}`
    );
  }
  return result(
    "balance",
    "Treasury Balance",
    "PASS",
    `Treasury holds ${held.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${funding} — sufficient to fund the payment.`
  );
}

// -----------------------------------------------------------------------------
// 2. Gas check — does the wallet hold enough native gas for the fees?
// -----------------------------------------------------------------------------

export function checkGas(req: SimulationRequest): RiskCheckResult {
  const { route, treasury } = req;
  const gasUsd = route.estimatedGas;
  const gasBalUsd = effectiveGasBalanceUsd(treasury, req.walletGasBalanceUsd);

  if (gasBalUsd === null) {
    return result(
      "gas",
      "Native Gas",
      "WARN",
      "Native gas balance is unknown — assuming the treasury reserve covers the estimated fee.",
    );
  }
  if (gasBalUsd < gasUsd * GAS_WARN_MARGIN) {
    return result(
      "gas",
      "Native Gas",
      "FAIL",
      `Native gas (~$${gasBalUsd.toFixed(2)}) is below the estimated fee ($${gasUsd.toFixed(2)}).`,
      "Top up gas before executing, or execution will revert."
    );
  }
  if (gasBalUsd < gasUsd * GAS_SAFETY_MARGIN) {
    return result(
      "gas",
      "Native Gas",
      "WARN",
      `Native gas (~$${gasBalUsd.toFixed(2)}) covers the fee ($${gasUsd.toFixed(2)}) but with a thin safety buffer.`,
      "Recommended buffer is 2x the estimated gas."
    );
  }
  return result(
    "gas",
    "Native Gas",
    "PASS",
    `Native gas (~$${gasBalUsd.toFixed(2)}) comfortably covers the estimated fee ($${gasUsd.toFixed(2)}).`
  );
}

// -----------------------------------------------------------------------------
// 3. Recipient check — is the recipient address a valid 0x address?
// -----------------------------------------------------------------------------

export function checkRecipient(req: SimulationRequest): RiskCheckResult {
  const addr = req.payment.recipientAddress;
  if (!addr) {
    return result(
      "recipient",
      "Recipient Address",
      "WARN",
      "No wallet address on file for this recipient — the payee name cannot be resolved on-chain.",
      "Add the recipient's 0x address before execution."
    );
  }
  if (!WALLET_ADDRESS_RE.test(addr.trim())) {
    return result(
      "recipient",
      "Recipient Address",
      "FAIL",
      `"${addr}" is not a valid 0x wallet address.`,
      "Expected 0x followed by exactly 40 hex characters."
    );
  }
  return result("recipient", "Recipient Address", "PASS", "Recipient address is a valid 0x wallet address.");
}

// -----------------------------------------------------------------------------
// 4. Network check — is every required chain supported?
// -----------------------------------------------------------------------------

export function checkNetwork(req: SimulationRequest): RiskCheckResult {
  const { route, treasury } = req;
  const supported = new Set(
    (treasury.supportedChains || [])
      .map((c) => normalizeChainName(c))
      .filter(Boolean)
  );
  const required = (route.chainSequence || []).map((c) => normalizeChainName(c));

  const unknown = required.filter((c) => !isSupportedChain(c));
  if (unknown.length) {
    return result(
      "network",
      "Network Support",
      "FAIL",
      `Route requires unsupported network${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`,
      `Supported: ${[...supported].join(", ") || "none"}`
    );
  }

  const unsupported = required.filter((c) => supported.size > 0 && !supported.has(c));
  if (unsupported.length) {
    return result(
      "network",
      "Network Support",
      "WARN",
      `Route uses ${unsupported.join(", ")} which is outside the configured treasury network list.`,
    );
  }

  return result(
    "network",
    "Network Support",
    "PASS",
    `All required network${required.length > 1 ? "s" : ""} (${required.join(", ") || "—"}) are supported.`
  );
}

// -----------------------------------------------------------------------------
// 5. Slippage check — is the estimated swap slippage acceptable?
// -----------------------------------------------------------------------------

export function checkSlippage(req: SimulationRequest): RiskCheckResult {
  const hasSwap = (req.steps || []).some((s) => s.actionType === "SWAP");
  const bps = req.slippageBps ?? 0;

  if (!hasSwap) {
    return result(
      "slippage",
      "Slippage",
      "PASS",
      "No token swap in this route — slippage is not applicable.",
    );
  }
  if (bps > SLIPPAGE_BPS_FAIL) {
    return result(
      "slippage",
      "Slippage",
      "FAIL",
      `Estimated slippage ${bps} bps (${(bps / 100).toFixed(2)}%) exceeds the ${SLIPPAGE_BPS_FAIL} bps hard limit.`,
      "Consider a single-hop pool or a larger liquidity pair."
    );
  }
  if (bps > SLIPPAGE_BPS_WARN) {
    return result(
      "slippage",
      "Slippage",
      "WARN",
      `Estimated slippage ${bps} bps (${(bps / 100).toFixed(2)}%) is above the ${SLIPPAGE_BPS_WARN} bps comfort threshold.`,
    );
  }
  return result(
    "slippage",
    "Slippage",
    "PASS",
    `Estimated slippage ${bps} bps (${(bps / 100).toFixed(2)}%) is within the acceptable budget.`
  );
}

// -----------------------------------------------------------------------------
// 6. Route risk — does the route involve additional bridges / swaps?
// -----------------------------------------------------------------------------

export function checkRoute(req: SimulationRequest): RiskCheckResult {
  const actions = (req.steps || []).map((s) => s.actionType);
  const hasBridge = actions.includes("BRIDGE");
  const hasSwap = actions.includes("SWAP");

  if (hasBridge) {
    return result(
      "route",
      "Route Risk",
      "FAIL",
      "Route crosses chains via a bridge — adds counterparty, lock-up and settlement risk.",
      "Bridge finality can take minutes and is the largest single failure surface."
    );
  }
  if (hasSwap) {
    return result(
      "route",
      "Route Risk",
      "WARN",
      "Route includes a DEX swap — introduces slippage and pool-liquidity risk.",
    );
  }
  return result(
    "route",
    "Route Risk",
    "PASS",
    "Direct route — no bridges or swaps. Lowest structural risk.",
  );
}

// -----------------------------------------------------------------------------
// 7. Complexity — how many on-chain operations are required?
// -----------------------------------------------------------------------------

export function checkComplexity(req: SimulationRequest): RiskCheckResult {
  const tx = req.route.transactionCount;
  if (tx >= COMPLEXITY_FAIL_TX) {
    return result(
      "complexity",
      "Transaction Complexity",
      "FAIL",
      `${tx} on-chain operations required — a large failure surface that must be monitored.`,
      "Each extra transaction adds a place the payment can revert or be front-run."
    );
  }
  if (tx >= COMPLEXITY_WARN_TX) {
    return result(
      "complexity",
      "Transaction Complexity",
      "WARN",
      `${tx} on-chain operations required — multi-step execution, monitor each hop.`,
    );
  }
  return result(
    "complexity",
    "Transaction Complexity",
    "PASS",
    `${tx} on-chain operation${tx === 1 ? "" : "s"} — compact execution surface.`
  );
}

// -----------------------------------------------------------------------------
// Aggregate — run all 7 checks in deterministic order
// -----------------------------------------------------------------------------

export const RISK_CHECK_RUNNERS: Record<
  RiskCheckResult["id"],
  (req: SimulationRequest) => RiskCheckResult
> = {
  balance: checkBalance,
  gas: checkGas,
  recipient: checkRecipient,
  network: checkNetwork,
  slippage: checkSlippage,
  route: checkRoute,
  complexity: checkComplexity,
};

export function runRiskChecks(req: SimulationRequest): RiskCheckResult[] {
  return (Object.keys(RISK_CHECK_RUNNERS) as RiskCheckResult["id"][]).map((id) =>
    RISK_CHECK_RUNNERS[id](req)
  );
}
