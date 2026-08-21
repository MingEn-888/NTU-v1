// =============================================================================
// PayMaster Phase 13 — Yield Automation · deterministic engine.
//
// The ONLY place idle treasury is turned into yield positions. Trust boundary:
//   - strategy + APY come from the catalog (never the LLM)
//   - amounts come from treasury balances (never the LLM)
//   - every result carries `requiresApproval: true` (human signs before the
//     SmartWallet calls the vault)
// =============================================================================

import { ethers } from "ethers";
import { DEFAULT_LIQUIDITY_BUFFER, pickBestStrategy } from "./catalog";
import { YIELD_VAULT_ABI, resolveExecutionTokenAddress } from "../execution/abi";
import type { ExecutionPlan, ExecutionStep, ExecutionTx } from "../execution/types";
import type {
  YieldAllocation,
  YieldSuggestion,
  YieldTreasuryContext,
  YieldStrategy,
} from "./types";
import { YieldEngineError } from "./types";

const USDC_DECIMALS = 6;

/** Round to 2dp for display/USD figures. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert a human-unit amount to token units (wei) as a decimal string. */
export function toWei(amount: number, decimals: number): string {
  const fixed = amount.toFixed(decimals);
  return ethers.parseUnits(fixed, decimals).toString();
}

/** From token units back to human units. */
export function fromWei(amountWei: string | bigint, decimals: number): number {
  return Number(ethers.formatUnits(amountWei.toString(), decimals));
}

/** Projected annual yield in USD at a given APY. */
export function computeExpectedAnnualYieldUsd(amountUsd: number, apyBps: number): number {
  return round2((amountUsd * apyBps) / 10_000);
}

// -----------------------------------------------------------------------------
// Deterministic sweep (DEPOSIT)
// -----------------------------------------------------------------------------

export interface SuggestYieldOptions {
  /** Override the liquidity buffer ratio (default 0.2). */
  bufferRatio?: number;
  /** Chain to allocate on; defaults to the first eligible chain. */
  chainId?: number;
}

/**
 * Deterministically sweep idle USDC above the safety buffer into the best
 * catalog strategy. Returns a single DEPOSIT suggestion (or none when there is
 * no idle capital). NEVER executes — the caller must obtain human approval.
 */
export function suggestYieldAllocation(
  treasury: YieldTreasuryContext,
  opts: SuggestYieldOptions = {}
): YieldSuggestion {
  const bufferRatio = opts.bufferRatio ?? DEFAULT_LIQUIDITY_BUFFER;
  const totalUsd =
    treasury.totalEstimatedUSDValue ??
    treasury.availableAssets.reduce((sum, a) => sum + (a.usdValue || 0), 0);

  const bufferUsd = round2(totalUsd * bufferRatio);
  const usdc = treasury.availableAssets.find(
    (a) => a.symbol.toUpperCase() === "USDC"
  );

  const suggestions: YieldAllocation[] = [];
  let idleUsd = 0;

  if (usdc) {
    const usdcUsd = usdc.usdValue || 0;
    idleUsd = round2(Math.max(0, usdcUsd - bufferUsd));

    if (idleUsd > 0) {
      const chainId = opts.chainId ?? 137;
      const strategy = pickBestStrategy("USDC", chainId);
      if (!strategy || !strategy.vaultAddress) {
        throw new YieldEngineError(
          "NOT_DEPLOYED",
          `No USDC yield vault is deployed on chain ${chainId}.`,
          { chainId }
        );
      }
      const amountUsd = Math.min(idleUsd, strategy.maxDepositUsd);
      suggestions.push(buildDepositAllocation(strategy, amountUsd));
    }
  }

  return {
    suggestions,
    idleUsd,
    deployedUsd: 0,
    bufferUsd,
    source: "deterministic",
  };
}

// -----------------------------------------------------------------------------
// Deterministic redeem (WITHDRAW) — auto-free liquidity for a payment
// -----------------------------------------------------------------------------

export interface SuggestWithdrawOptions {
  /** Chain the vault lives on. */
  chainId?: number;
  /** Vault shares currently held (for converting USD need → shares). */
  sharesHeld?: string;
  /** Vault share price in USD (asset USD value per share). */
  sharePriceUsd?: number;
}

/**
 * Deterministically redeem enough yield to cover a liquidity shortfall. The
 * amount is capped at the requested need (never over-redeems). Returns null
 * when nothing needs to be freed.
 */
export function suggestYieldWithdrawal(
  strategy: YieldStrategy,
  neededUsd: number,
  opts: SuggestWithdrawOptions = {}
): YieldAllocation | null {
  if (!strategy.vaultAddress) {
    throw new YieldEngineError("NOT_DEPLOYED", `Vault not deployed for ${strategy.id}.`);
  }
  if (neededUsd <= 0) return null;

  // 1 share ≈ 1 asset unit at first deposit; share price = 1 USD for USDC.
  const sharePriceUsd = opts.sharePriceUsd ?? 1;
  const sharesWei = Math.ceil(neededUsd / sharePriceUsd);

  return {
    strategyId: strategy.id,
    chainId: strategy.chainId,
    vaultAddress: strategy.vaultAddress,
    asset: strategy.asset,
    action: "WITHDRAW",
    amount: sharesWei.toString(),
    amountWei: sharesWei.toString(),
    shares: sharesWei.toString(),
    expectedApyBps: strategy.apyBps,
    expectedAnnualYieldUsd: 0,
    reason: `Free ${neededUsd} ${strategy.asset} of yield liquidity to cover a payment shortfall.`,
    requiresApproval: true,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function buildDepositAllocation(strategy: YieldStrategy, amountUsd: number): YieldAllocation {
  const amountWei = toWei(amountUsd, USDC_DECIMALS);
  return {
    strategyId: strategy.id,
    chainId: strategy.chainId,
    vaultAddress: strategy.vaultAddress as string,
    asset: strategy.asset,
    action: "DEPOSIT",
    amount: amountUsd.toFixed(USDC_DECIMALS).replace(/\.?0+$/, ""),
    amountWei,
    expectedApyBps: strategy.apyBps,
    expectedAnnualYieldUsd: computeExpectedAnnualYieldUsd(amountUsd, strategy.apyBps),
    reason: `Sweep ${round2(amountUsd)} ${strategy.asset} of idle treasury into ${strategy.protocol} (APY ${(strategy.apyBps / 100).toFixed(2)}%).`,
    requiresApproval: true,
  };
}

/** Encode a SmartWallet-compatible payload for a yield allocation. */
export function buildYieldExecutionPayload(allocation: YieldAllocation): {
  target: string;
  value: string;
  data: string;
} {
  const iface = new ethers.Interface(YIELD_VAULT_ABI);
  if (allocation.action === "DEPOSIT") {
    return {
      target: allocation.vaultAddress,
      value: "0",
      data: iface.encodeFunctionData("deposit", [allocation.amountWei]),
    };
  }
  if (allocation.action === "WITHDRAW") {
    return {
      target: allocation.vaultAddress,
      value: "0",
      data: iface.encodeFunctionData("withdraw", [allocation.shares ?? allocation.amountWei]),
    };
  }
  // HARVEST = re-record the accrual marker via setApy (demo no-op that updates lastHarvest).
  return {
    target: allocation.vaultAddress,
    value: "0",
    data: iface.encodeFunctionData("setApy", [allocation.expectedApyBps]),
  };
}

// -----------------------------------------------------------------------------
// ExecutionPlan adapter — so the existing useWallet.executeSmartWalletPlan path
// can submit yield movements through the SmartWallet (same approval + nonce +
// reentrancy guards as a payment).
// -----------------------------------------------------------------------------

export interface BuildYieldPlanInput {
  allocation: YieldAllocation;
  chainId: number;
  smartWalletAddress: string;
  /** Resolved ERC-20 address of the vault asset (USDC). */
  tokenAddress: string | null;
}

/** Turn a deterministic yield allocation into a SmartWallet ExecutionPlan. */
export function buildYieldExecutionPlan(input: BuildYieldPlanInput): ExecutionPlan {
  const { allocation, chainId, smartWalletAddress, tokenAddress } = input;
  const steps: ExecutionStep[] = [];

  if (allocation.action === "DEPOSIT") {
    // 1. Approve the vault to pull the deposit from the wallet.
    steps.push({
      order: 1,
      actionType: "APPROVE",
      title: `Approve ${allocation.asset} for yield vault`,
      description: `SmartWallet.approveToken(${tokenAddress}, ${allocation.vaultAddress}, ${allocation.amountWei}).`,
      status: "PENDING",
      tx: {
        target: smartWalletAddress,
        value: "0",
        data: "0x",
        label: `Approve ${allocation.asset} spending for yield`,
        token: tokenAddress,
        amountWei: allocation.amountWei,
        kind: "approveToken",
        to: allocation.vaultAddress,
        spender: allocation.vaultAddress,
      } as ExecutionTx,
    });
    // 2. Deposit into the vault.
    const deposit = buildYieldExecutionPayload(allocation);
    steps.push({
      order: 2,
      actionType: "STAKE",
      title: `Deposit ${allocation.asset} into yield vault`,
      description: `YieldVault.deposit(${allocation.amountWei}) via SmartWallet.executeTransaction.`,
      status: "PENDING",
      tx: {
        target: allocation.vaultAddress,
        value: deposit.value,
        data: deposit.data,
        label: `Deposit ${allocation.amount} ${allocation.asset} into vault`,
        token: tokenAddress,
        amountWei: allocation.amountWei,
        kind: "executeTransaction",
        to: allocation.vaultAddress,
      } as ExecutionTx,
    });
  } else if (allocation.action === "WITHDRAW") {
    const withdraw = buildYieldExecutionPayload(allocation);
    steps.push({
      order: 1,
      actionType: "UNSTAKE",
      title: `Withdraw ${allocation.asset} from yield vault`,
      description: `YieldVault.withdraw(${allocation.shares ?? allocation.amountWei}) via SmartWallet.executeTransaction.`,
      status: "PENDING",
      tx: {
        target: allocation.vaultAddress,
        value: withdraw.value,
        data: withdraw.data,
        label: `Withdraw ${allocation.asset} yield`,
        token: tokenAddress,
        amountWei: allocation.shares ?? allocation.amountWei,
        kind: "executeTransaction",
        to: allocation.vaultAddress,
      } as ExecutionTx,
    });
  } else {
    const harvest = buildYieldExecutionPayload(allocation);
    steps.push({
      order: 1,
      actionType: "HARVEST",
      title: "Harvest yield accrual",
      description: `YieldVault.setApy(${allocation.expectedApyBps}) via SmartWallet.executeTransaction.`,
      status: "PENDING",
      tx: {
        target: allocation.vaultAddress,
        value: harvest.value,
        data: harvest.data,
        label: "Record yield harvest",
        token: tokenAddress,
        amountWei: "0",
        kind: "executeTransaction",
        to: allocation.vaultAddress,
      } as ExecutionTx,
    });
  }

  return {
    id: `yield-${allocation.strategyId}-${allocation.action.toLowerCase()}`,
    paymentRequestId: `yield-${allocation.strategyId}`,
    paymentPlanId: null,
    routeId: `yield-${allocation.action.toLowerCase()}`,
    chainId,
    smartWalletAddress,
    recipient: allocation.vaultAddress,
    recipientAddress: allocation.vaultAddress,
    token: allocation.asset,
    amount: allocation.amount,
    amountWei: allocation.amountWei,
    tokenAddress,
    tokenDecimals: 6,
    estimatedGas: 0,
    estimatedGasUsd: 0,
    estimatedSavingsUsd: 0,
    steps,
    sourceLabel: "yield",
  };
}

/** Resolve the vault asset's ERC-20 address for a chain (null when undeployed). */
export function resolveYieldTokenAddress(chainId: number, asset: string): string | null {
  return resolveExecutionTokenAddress(chainId, asset);
}
