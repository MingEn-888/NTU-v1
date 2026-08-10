// =============================================================================
// IBAP Phase 8 — Risk & Simulation Zod schemas
//
// Every input to POST /api/risk/simulate is validated here, and every
// SimulationResult is shape-checked before it can leave the service boundary.
// This guarantees that a free-form / malicious request can never become a risk
// verdict or an expected result, and that the deterministic engine (never the
// LLM) is always the final decision.
// =============================================================================

import { z } from "zod";
import { RISK_CHECK_IDS } from "./types";

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

export const SimulationTreasuryAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(12),
  balance: z.string(),
  usdValue: z.number().nonnegative(),
});

export const SimulationTreasurySchema = z.object({
  availableAssets: z.array(SimulationTreasuryAssetSchema).max(50),
  supportedChains: z.array(z.string().trim().min(1).max(40)).max(50),
  preferredChain: z.string().trim().min(1).max(40).nullable().optional(),
  nativeGasBalance: z.string().optional(),
  totalEstimatedUSDValue: z.number().nonnegative().optional(),
});

const ActionTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((v) => ["CHECK_ALLOWANCE", "APPROVE", "SWAP", "BRIDGE", "TRANSFER", "CONFIRM"].includes(v), {
    message: "unknown action type",
  });

export const SimulationStepSchema = z.object({
  order: z.number().int().positive(),
  actionType: ActionTypeSchema,
  title: z.string().trim().min(1).max(200),
  chain: z.string().trim().min(1).max(40).nullable().optional(),
  token: z.string().trim().min(1).max(16).nullable().optional(),
  estimatedGas: z.number().nonnegative().optional(),
  estimatedDuration: z.number().nonnegative().optional(),
});

export const SimulationRouteSchema = z.object({
  routeId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/, "invalid route id"),
  name: z.string().trim().min(1).max(200),
  chainSequence: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  tokenSequence: z.array(z.string().trim().min(1).max(16)).min(1).max(8),
  transactionCount: z.number().int().min(0).max(100),
  estimatedGas: z.number().min(0).max(100_000),
  estimatedDuration: z.number().min(0).max(7 * 24 * 3600),
  strategy: z.string().trim().min(1).max(64).nullable().optional(),
});

export const SimulationPaymentSchema = z.object({
  recipient: z.string().trim().min(1).max(200).nullable(),
  recipientAddress: z.string().trim().min(1).max(64).nullable(),
  token: z.string().trim().min(1).max(16),
  amount: z.number().positive().max(1_000_000_000),
});

export const SimulationAlternativeSchema = z.object({
  routeId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  chainSequence: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  estimatedGas: z.number().min(0).max(100_000),
  estimatedDuration: z.number().min(0).max(7 * 24 * 3600),
  transactionCount: z.number().int().min(0).max(100),
});

export const SimulationRequestSchema = z.object({
  payment: SimulationPaymentSchema,
  route: SimulationRouteSchema,
  steps: z.array(SimulationStepSchema).max(20),
  treasury: SimulationTreasurySchema,
  slippageBps: z.number().int().min(0).max(1000).optional(),
  walletGasBalanceUsd: z.number().nonnegative().optional(),
  alternatives: z.array(SimulationAlternativeSchema).max(12).optional(),
  businessId: z.string().max(64).optional(),
  sourceLabel: z.string().max(64).optional(),
});

// -----------------------------------------------------------------------------
// Output — the verdict must be shape-checked before it leaves the service
// -----------------------------------------------------------------------------

export const RiskCheckResultSchema = z.object({
  id: z.enum(RISK_CHECK_IDS),
  label: z.string().min(1).max(60),
  status: z.enum(["PASS", "WARN", "FAIL"]),
  score: z.number().nonnegative(),
  message: z.string().min(1).max(300),
  detail: z.string().max(300).optional(),
});

export const RiskContributionBreakdownSchema = z.object({
  balance: z.number().nonnegative(),
  gas: z.number().nonnegative(),
  recipient: z.number().nonnegative(),
  network: z.number().nonnegative(),
  slippage: z.number().nonnegative(),
  route: z.number().nonnegative(),
  complexity: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  total: z.number().min(0).max(100),
});

export const SimulationTotalsSchema = z.object({
  estimatedGasUsd: z.number().nonnegative(),
  estimatedBridgeFeeUsd: z.number().nonnegative(),
  estimatedSlippageUsd: z.number().nonnegative(),
  estimatedTotalCostUsd: z.number().nonnegative(),
  estimatedDuration: z.number().nonnegative(),
  transactionCount: z.number().int().nonnegative(),
});

export const ApprovalGateSchema = z.object({
  required: z.literal(true),
  status: z.literal("PENDING"),
  canProceed: z.boolean(),
  note: z.string().min(1).max(300),
  highRiskAcknowledged: z.boolean(),
});

export const SimulationResultSchema = z.object({
  simulationId: z.string().min(1).max(64),
  payment: SimulationPaymentSchema,
  route: SimulationRouteSchema,
  steps: z.array(SimulationStepSchema).max(20),
  checks: z.array(RiskCheckResultSchema).length(7),
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  riskBreakdown: RiskContributionBreakdownSchema,
  totals: SimulationTotalsSchema,
  warnings: z.array(z.string()).max(20),
  expectedResult: z.string().min(1).max(500),
  explanation: z.string().min(1).max(1200),
  explanationSource: z.enum(["ai", "deterministic"]),
  approval: ApprovalGateSchema,
  source: z.literal("risk"),
});

export type SimulationRequestInput = z.infer<typeof SimulationRequestSchema>;
export type SimulationResultOutput = z.infer<typeof SimulationResultSchema>;
