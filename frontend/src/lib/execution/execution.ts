// =============================================================================
// PayMaster Phase 10 — Human Approval & Blockchain Execution engine.
//
// The ONLY place the frontend turns an APPROVED plan into on-chain execution:
//   buildExecutionPlan()  — deterministic, validated step -> SmartWallet payload
//   executePlan()         — broadcast via the Phase 9 SmartWallet (SUBMITTED)
//   confirmExecution()    — wait for a mined receipt (PENDING -> CONFIRMED)
//
// Trust boundary: this file NEVER trusts the LLM. The plan was already parsed
// (Phase 5), planned (Phase 6), route-optimized (Phase 7) and risk-checked
// (Phase 8) by deterministic engines, then explicitly approved by a human
// (Phase 10). Every mutative call still goes through SmartWallet's nonce +
// authorization + reentrancy guards.
// =============================================================================

import { ethers } from "ethers";
import type { ParsedPaymentIntent, PaymentPlan } from "../payment/types";
import type { SimulationResult } from "../risk/types";
import { ExecutionError, NATIVE_USD_PRICES } from "./types";
import type { ExecutionOutcome, ExecutionPlan, ExecutionStep, ExecutionTx } from "./types";
import { mapEthersError } from "./errors";
import {
  ERC20_MIN_ABI,
  SMART_WALLET_ABI,
  YIELD_VAULT_ABI,
  isNativeAsset,
  resolveExecutionTokenAddress,
  resolveTokenDecimals,
} from "./abi";
import { buildExplorerUrl } from "../payment/execution";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Deterministic, stable plan id for a payment + route. */
export function executionPlanId(paymentRequestId: string, routeId: string): string {
  const key = `${paymentRequestId}:${routeId}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return `exec-${Math.abs(hash).toString(36).padStart(6, "0")}`;
}

export function parseAmountToWei(amount: number | string, decimals: number): string {
  return ethers.parseUnits(amount.toString(), decimals).toString();
}

/** Read the token decimals from the chain (fallback to the registry value). */
export async function readTokenDecimals(
  provider: ethers.BrowserProvider,
  chainId: number,
  asset: string | null
): Promise<number> {
  const addr = resolveExecutionTokenAddress(chainId, asset);
  const fallback = resolveTokenDecimals(chainId, asset);
  if (!addr) return fallback;
  try {
    const contract = new ethers.Contract(addr, ERC20_MIN_ABI, provider);
    const decimals = await contract.decimals();
    return Number(decimals);
  } catch {
    return fallback;
  }
}

// -----------------------------------------------------------------------------
// Step -> SmartWallet payload builder (deterministic)
// -----------------------------------------------------------------------------

export interface BuildExecutionPlanInput {
  paymentRequestId: string;
  paymentPlanId?: string | null;
  routeId?: string;
  intent: ParsedPaymentIntent;
  plan: PaymentPlan;
  /** Phase 8 simulation result (risk score / AI explanation / gas). */
  simulation?: SimulationResult | null;
  chainId: number;
  smartWalletAddress: string;
  sourceLabel?: string;
  /** Phase 13 — yield vault address (enables STAKE/UNSTAKE steps). */
  yieldVaultAddress?: string | null;
}

/**
 * Build a validated ExecutionPlan from an intent + PaymentPlan + simulation.
 * Only TRANSFER / EXECUTE_PAYMENT steps become real SmartWallet calls; DEX
 * SWAP / BRIDGE steps (which need external calldata) are kept as non-executable
 * metadata so the plan is always truthful about what will actually move.
 */
export function buildExecutionPlan(input: BuildExecutionPlanInput): ExecutionPlan {
  const { intent, plan, chainId, smartWalletAddress, simulation } = input;
  const settlementAsset = plan.settlementAsset;
  const isNative = isNativeAsset(settlementAsset);
  const tokenAddress = isNative ? null : resolveExecutionTokenAddress(chainId, settlementAsset);
  const decimals = isNative ? 18 : resolveTokenDecimals(chainId, settlementAsset);
  const amountWei = parseAmountToWei(plan.settlementAmount, decimals);

  const recommended = plan.routes.find((r) => r.isRecommended) ?? plan.routes[0];
  const routeId = input.routeId || recommended?.id || "recommended";

  const recipientAddress = intent.recipientAddress || "";
  const recipient = intent.recipientName || recipientAddress || "Unspecified";

  const steps: ExecutionStep[] = plan.steps.map((s) => {
    const action = (s.actionType || "").toUpperCase();
    const order = s.stepOrder;
    let title = s.title;
    let description = s.description || "";
    let tx: ExecutionTx | null = null;

    if (action === "EXECUTE_PAYMENT" || action === "TRANSFER" || action === "TRANSFER_TOKEN" || action === "SEND") {
      if (isNative) {
        tx = {
          target: smartWalletAddress,
          value: amountWei,
          data: "0x",
          label: `Send ${plan.settlementAmount} ${settlementAsset} to ${recipient}`,
          token: null,
          amountWei,
          kind: "executeTransaction",
          to: recipientAddress,
        };
        title = `Native ${settlementAsset} transfer to recipient`;
        description = `SmartWallet.executeTransaction → ${recipientAddress} (value ${amountWei} wei).`;
      } else if (tokenAddress) {
        tx = {
          target: smartWalletAddress,
          value: "0",
          data: "0x",
          label: `Transfer ${plan.settlementAmount} ${settlementAsset} to ${recipient}`,
          token: tokenAddress,
          amountWei,
          kind: "transferToken",
          to: recipientAddress,
        };
        title = `Transfer ${settlementAsset} to recipient`;
        description = `SmartWallet.transferToken(${tokenAddress} → ${recipientAddress}, ${amountWei}).`;
      } else {
        title = "Settlement transfer";
        description = `Unable to resolve a token address for ${settlementAsset} on chain ${chainId}.`;
      }
    } else if (action === "APPROVE") {
      if (tokenAddress) {
        tx = {
          target: smartWalletAddress,
          value: "0",
          data: "0x",
          label: `Approve ${settlementAsset} spending`,
          token: tokenAddress,
          amountWei,
          kind: "approveToken",
          to: smartWalletAddress,
          spender: smartWalletAddress,
        };
        description = `SmartWallet.approveToken(${tokenAddress}, ${smartWalletAddress}, ${amountWei}).`;
      } else {
        description = "No ERC20 approval required for native settlement.";
      }
    } else if ((action === "STAKE" || action === "UNSTAKE") && input.yieldVaultAddress) {
      // Phase 13 — yield steps become real SmartWallet.executeTransaction calls
      // to the vault (the calldata is known, unlike DEX/bridge steps).
      const vault = input.yieldVaultAddress;
      const fn = action === "STAKE" ? "deposit" : "withdraw";
      const vaultData = new ethers.Interface(YIELD_VAULT_ABI).encodeFunctionData(fn, [amountWei]);
      tx = {
        target: vault,
        value: "0",
        data: vaultData,
        label: `${action === "STAKE" ? "Deposit" : "Withdraw"} ${plan.settlementAmount} ${settlementAsset} in yield vault`,
        token: tokenAddress,
        amountWei,
        kind: "executeTransaction",
        to: vault,
      };
      description = `SmartWallet.executeTransaction → YieldVault.${fn}(${amountWei}).`;
    } else if (action === "SWAP" || action === "BRIDGE") {
      title = `${title} (external)`;
      description = `${description || "External swap/bridge step."} Requires DEX/bridge calldata — not executed by the direct wallet path.`;
    } else {
      // CHECK_ALLOWANCE / CONFIRM / CONFIRM_SETTLEMENT / unknown -> metadata only.
    }

    return { order, actionType: action, title, description, status: "PENDING", tx };
  });

  return {
    id: executionPlanId(input.paymentRequestId, routeId),
    paymentRequestId: input.paymentRequestId,
    paymentPlanId: input.paymentPlanId ?? null,
    routeId,
    chainId,
    smartWalletAddress,
    recipient,
    recipientAddress,
    token: isNative ? null : settlementAsset,
    amount: plan.settlementAmount.toString(),
    amountWei,
    tokenAddress,
    tokenDecimals: decimals,
    estimatedGas: simulation?.totals.estimatedGasUsd ?? plan.totalEstimatedGas,
    estimatedGasUsd: simulation?.totals.estimatedGasUsd ?? plan.totalEstimatedGas,
    estimatedSavingsUsd: plan.savings,
    steps,
    sourceLabel: input.sourceLabel ?? "chat",
  };
}

// -----------------------------------------------------------------------------
// On-chain submission (SUBMITTED)
// -----------------------------------------------------------------------------

/**
 * Broadcast the approved execution plan through the SmartWallet. Returns the
 * transaction hash. Throws a typed ExecutionError on any failure (rejected,
 * insufficient balance, RPC timeout, contract revert, wrong network, ...).
 */
export async function executePlan(
  provider: ethers.BrowserProvider,
  plan: ExecutionPlan
): Promise<{ txHash: string; nonce: number }> {
  const signer = await provider.getSigner();
  const wallet = new ethers.Contract(plan.smartWalletAddress, SMART_WALLET_ABI, signer);

  // Read the live nonce (replay protection from Phase 9).
  const nonce = Number(await wallet.nonce());
  const executable = plan.steps.filter((s) => s.tx);

  if (executable.length === 0) {
    throw new ExecutionError(
      "UNKNOWN",
      "Execution plan has no executable steps (direct wallet path cannot run swaps/bridges)."
    );
  }

  let tx: ethers.TransactionResponse;
  if (executable.length === 1) {
    const t = executable[0].tx as ExecutionTx;
    if (t.kind === "transferToken") {
      tx = await wallet.transferToken(t.token, t.to, BigInt(t.amountWei as string), nonce);
    } else if (t.kind === "approveToken") {
      tx = await wallet.approveToken(t.token, t.spender as string, BigInt(t.amountWei as string), nonce);
    } else {
      // executeTransaction (native)
      tx = await wallet.executeTransaction(t.to, BigInt(t.value), t.data, nonce);
    }
  } else {
    // All-or-nothing batch (one nonce).
    const txs = executable.map((s) => {
      const t = s.tx as ExecutionTx;
      return [t.target, t.value, t.data];
    });
    tx = await wallet.batchExecute(txs, nonce);
  }

  return { txHash: tx.hash, nonce };
}

// -----------------------------------------------------------------------------
// Confirmation (PENDING -> CONFIRMED)
// -----------------------------------------------------------------------------

export async function confirmExecution(
  provider: ethers.BrowserProvider,
  plan: ExecutionPlan,
  txHash: string,
  timeoutMs = 120_000
): Promise<ethers.TransactionReceipt | null> {
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs);
  if (!receipt) {
    throw new ExecutionError("RPC_TIMEOUT", "Transaction confirmation timed out.");
  }
  if (receipt.status === 0) {
    throw new ExecutionError(
      "CONTRACT_REVERT",
      "Transaction was mined but reverted on-chain. No funds were moved."
    );
  }
  return receipt;
}

/** Convert a receipt's gas cost into USD (uses chain-native price). */
export function computeGasCostUsd(receipt: { gasUsed?: bigint; gasPrice?: bigint | null; effectiveGasPrice?: bigint | null }, chainId: number): number {
  const gasUsed = receipt.gasUsed ?? BigInt(0);
  const gasPrice = receipt.gasPrice ?? receipt.effectiveGasPrice ?? BigInt(0);
  const wei = gasUsed * gasPrice;
  const native = Number(ethers.formatEther(wei));
  const price = NATIVE_USD_PRICES[chainId] ?? 0;
  // 4 decimals keeps small gas costs precise (e.g. $0.0378 not rounded to $0.04).
  return Math.round(native * price * 10000) / 10000;
}

/**
 * Execute + confirm an approved plan end-to-end (SUBMITTED -> CONFIRMED).
 * Persistence of each stage is the caller's responsibility.
 */
export async function executeAndConfirm(
  provider: ethers.BrowserProvider,
  plan: ExecutionPlan
): Promise<ExecutionOutcome> {
  const { txHash } = await executePlan(provider, plan);
  const receipt = await confirmExecution(provider, plan, txHash);
  const gasUsed = (receipt?.gasUsed ?? BigInt(0)).toString();
  const gasCostUsd = computeGasCostUsd(receipt ?? {}, plan.chainId);
  const explorerUrl = buildExplorerUrl(plan.chainId, txHash);
  return {
    txHash,
    status: "CONFIRMED",
    gasUsed,
    gasCostUsd,
    explorerUrl,
    receipt,
  };
}

export { mapEthersError, buildExplorerUrl, SMART_WALLET_ABI };
