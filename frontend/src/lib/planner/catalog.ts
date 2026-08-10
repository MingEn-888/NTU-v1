// =============================================================================
// PayMaster Phase 6 — Deterministic execution catalog
//
// Every number the planner uses to size a step lives here as a constant table.
// Nothing in this file is influenced by the LLM — it is the single source of
// truth for chains, gas costs, durations and risk so that two identical intents
// always produce identical plans.
// =============================================================================

import type { ChainRef } from "./types";

// -----------------------------------------------------------------------------
// Chain registry (canonical, mirrors Phase 3 wallet chain config)
// -----------------------------------------------------------------------------

export const PLANNER_CHAINS: Record<number, ChainRef> = {
  1: { chainId: 1, name: "Ethereum", symbol: "ETH" },
  137: { chainId: 137, name: "Polygon", symbol: "POL" },
  42161: { chainId: 42161, name: "Arbitrum", symbol: "ETH" },
  10: { chainId: 10, name: "Optimism", symbol: "ETH" },
  8453: { chainId: 8453, name: "Base", symbol: "ETH" },
};

/** Chain names/aliases (incl. Phase 5 intent vocabulary) -> chain id. */
const CHAIN_ALIASES: Record<string, number> = {
  ethereum: 1,
  eth: 1,
  mainnet: 1,
  polygon: 137,
  poly: 137,
  matic: 137,
  arbitrum: 42161,
  arb: 42161,
  optimism: 10,
  op: 10,
  base: 8453,
};

/** Resolve a chain name/alias to a chain id, or null if unknown. */
export function resolveChainId(name: string | null | undefined): number | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return CHAIN_ALIASES[key] ?? null;
}

/** Ordered by settlement cost (cheapest first) for deterministic alt-chain picks. */
const CHAIN_COST_ORDER: number[] = [137, 42161, 10, 8453, 1];

/** Pick the cheapest settlement chain different from `preferredId` (deterministic). */
export function pickCheaperChain(preferredId: number): number {
  return CHAIN_COST_ORDER.find((id) => id !== preferredId) ?? 42161;
}

// -----------------------------------------------------------------------------
// Cost tables — estimated gas (USD) per action per chain
// -----------------------------------------------------------------------------

interface ChainCosts {
  transfer: number;
  swap: number;
  approve: number;
  bridgeOut: number;
  bridgeIn: number;
  confirm: number;
}

const GAS: Record<number, ChainCosts> = {
  1: { transfer: 3.2, swap: 4.2, approve: 1.2, bridgeOut: 6.0, bridgeIn: 0.9, confirm: 0 },
  137: { transfer: 0.03, swap: 0.05, approve: 0.01, bridgeOut: 0.5, bridgeIn: 0.4, confirm: 0 },
  42161: { transfer: 0.08, swap: 0.12, approve: 0.03, bridgeOut: 0.6, bridgeIn: 0.5, confirm: 0 },
  10: { transfer: 0.1, swap: 0.15, approve: 0.04, bridgeOut: 0.7, bridgeIn: 0.5, confirm: 0 },
  8453: { transfer: 0.12, swap: 0.18, approve: 0.05, bridgeOut: 0.7, bridgeIn: 0.5, confirm: 0 },
};

// -----------------------------------------------------------------------------
// Duration tables — estimated time (seconds) per action per chain
// -----------------------------------------------------------------------------

interface ChainDurations {
  transfer: number;
  swap: number;
  approve: number;
  bridgeOut: number;
  bridgeIn: number;
  confirm: number;
}

const DURATION: Record<number, ChainDurations> = {
  1: { transfer: 150, swap: 180, approve: 120, bridgeOut: 300, bridgeIn: 60, confirm: 15 },
  137: { transfer: 15, swap: 45, approve: 12, bridgeOut: 300, bridgeIn: 60, confirm: 15 },
  42161: { transfer: 20, swap: 60, approve: 15, bridgeOut: 300, bridgeIn: 60, confirm: 15 },
  10: { transfer: 25, swap: 70, approve: 18, bridgeOut: 300, bridgeIn: 60, confirm: 15 },
  8453: { transfer: 30, swap: 80, approve: 20, bridgeOut: 300, bridgeIn: 60, confirm: 15 },
};

// -----------------------------------------------------------------------------
// Risk tables — deterministic, additive risk contributions
// -----------------------------------------------------------------------------

const ACTION_RISK: Record<string, number> = {
  CHECK_ALLOWANCE: 0,
  APPROVE: 8,
  SWAP: 18,
  BRIDGE: 30,
  TRANSFER: 4,
  CONFIRM: 0,
};

const CHAIN_RISK: Record<number, number> = {
  1: 6,
  137: 2,
  42161: 3,
  10: 4,
  8453: 4,
};

// -----------------------------------------------------------------------------
// Helpers used by the step builders
// -----------------------------------------------------------------------------

export function gasFor(chainId: number, action: keyof ChainCosts): number {
  return GAS[chainId]?.[action] ?? GAS[137][action];
}

export function durationFor(chainId: number, action: keyof ChainDurations): number {
  return DURATION[chainId]?.[action] ?? DURATION[137][action];
}

export function riskForAction(action: string): number {
  return ACTION_RISK[action] ?? 0;
}

export function riskForChain(chainId: number | null): number {
  return chainId !== null ? CHAIN_RISK[chainId] ?? 0 : 0;
}

export function chainById(chainId: number | null): ChainRef | null {
  if (chainId === null) return null;
  return PLANNER_CHAINS[chainId] ?? null;
}

/** Native assets need no ERC20 approval / allowance checks. */
export function isNativeAsset(asset: string | null | undefined): boolean {
  if (!asset) return false;
  const upper = asset.toUpperCase();
  return upper === "ETH" || upper === "POL";
}
