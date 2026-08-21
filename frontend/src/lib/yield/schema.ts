// =============================================================================
// PayMaster Phase 13 — Yield Automation · Zod schemas.
//
// Every API input is validated here so free-form / malicious input can never
// become a yield movement; every output is shape-checked before it leaves the
// service boundary. The LLM is never in the loop for allocation.
// =============================================================================

import { z } from "zod";

export const YieldTreasuryAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(12),
  balance: z.string().optional(),
  usdValue: z.number().nonnegative().optional(),
  chain: z.string().trim().max(40).optional(),
});

export const YieldTreasuryContextSchema = z.object({
  availableAssets: z.array(YieldTreasuryAssetSchema).min(1).max(50),
  preferredChain: z.string().trim().min(1).max(40).nullable().optional(),
  totalEstimatedUSDValue: z.number().nonnegative().optional(),
});

export const YieldSuggestRequestSchema = z.object({
  treasury: YieldTreasuryContextSchema,
  bufferRatio: z.number().min(0).max(1).optional(),
  chainId: z.number().int().positive().optional(),
  sourceLabel: z.string().trim().min(1).max(64).nullable().optional(),
});

export const YieldWithdrawRequestSchema = z.object({
  strategyId: z.string().trim().min(1).max(64),
  neededUsd: z.number().positive().max(1_000_000_000),
  chainId: z.number().int().positive().optional(),
  sourceLabel: z.string().trim().min(1).max(64).nullable().optional(),
});

export const YieldAllocationSchema = z.object({
  strategyId: z.string().min(1),
  chainId: z.number().int(),
  vaultAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  asset: z.string().min(1),
  action: z.enum(["DEPOSIT", "WITHDRAW", "HARVEST"]),
  amount: z.string().min(1),
  amountWei: z.string().min(1),
  shares: z.string().optional(),
  expectedApyBps: z.number().nonnegative(),
  expectedAnnualYieldUsd: z.number().nonnegative(),
  reason: z.string().min(1),
  requiresApproval: z.literal(true),
});

export const YieldSuggestionSchema = z.object({
  suggestions: z.array(YieldAllocationSchema),
  idleUsd: z.number().nonnegative(),
  deployedUsd: z.number().nonnegative(),
  bufferUsd: z.number().nonnegative(),
  source: z.literal("deterministic"),
});
