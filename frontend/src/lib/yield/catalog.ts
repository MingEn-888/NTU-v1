// =============================================================================
// PayMaster Phase 13 — Yield Automation · deterministic strategy catalog.
//
// The ONLY source of APY / risk / bounds. No LLM may invent a strategy or an
// APY figure; the catalog below is the single deterministic source of truth.
// =============================================================================

import type { YieldStrategy } from "./types";

/**
 * Where yield vaults are known to be deployed. Only localhost (31337) has a
 * real vault by default (deployed by contracts/scripts/deploySmartWallet.ts
 * immediately after the SmartWallet + mockUSDC, at Hardhat account#0 nonce 2).
 * Mainnet entries are intentionally null — an allocation on an un-deployed
 * chain fails fast with NOT_DEPLOYED, never silently mis-allocates.
 */
export const YIELD_VAULT_DEPLOYMENTS: Record<number, { vault: string; asset: string }> = {
  31337: {
    vault: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    asset: "USDC",
  },
};

/** Default safety buffer: keep this share of the treasury liquid (20%). */
export const DEFAULT_LIQUIDITY_BUFFER = 0.2;

/** Deterministic strategy catalog. APY/risk are hand-set demo values. */
export const YIELD_STRATEGIES: YieldStrategy[] = [
  {
    id: "usdc-polygon-treasury",
    protocol: "PayMaster Treasury Vault",
    asset: "USDC",
    chainId: 137,
    vaultAddress: null, // not deployed on Polygon yet
    apyBps: 450,
    riskScore: 15,
    minDepositUsd: 100,
    maxDepositUsd: 100_000,
    lockupDays: 0,
  },
  {
    id: "usdc-localhost-treasury",
    protocol: "PayMaster Treasury Vault",
    asset: "USDC",
    chainId: 31337,
    vaultAddress: YIELD_VAULT_DEPLOYMENTS[31337]?.vault ?? null,
    apyBps: 500,
    riskScore: 10,
    minDepositUsd: 1,
    maxDepositUsd: 100_000,
    lockupDays: 0,
  },
];

/** Resolve a strategy by id. */
export function findStrategy(id: string): YieldStrategy | null {
  return YIELD_STRATEGIES.find((s) => s.id === id) ?? null;
}

/** Strategies eligible for a given asset + chain. */
export function strategiesForAsset(
  asset: string,
  chainId: number
): YieldStrategy[] {
  const upper = asset.toUpperCase();
  return YIELD_STRATEGIES.filter((s) => s.asset.toUpperCase() === upper && s.chainId === chainId);
}

/**
 * Deterministic strategy score (lower = better).
 *   score = risk/100 * 0.6 + (1 - apy normalized) * 0.4
 *   → prefer high APY and low risk, purely from catalog numbers.
 */
export function scoreStrategy(s: YieldStrategy): number {
  const riskPart = (s.riskScore / 100) * 0.6;
  const apyPart = (1 - Math.min(s.apyBps, 2000) / 2000) * 0.4;
  return Number((riskPart + apyPart).toFixed(4));
}

/** Pick the best strategy for an asset on a chain, or null. */
export function pickBestStrategy(asset: string, chainId: number): YieldStrategy | null {
  const eligible = strategiesForAsset(asset, chainId);
  if (eligible.length === 0) return null;
  return eligible.slice().sort((a, b) => scoreStrategy(a) - scoreStrategy(b))[0];
}
