// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Zod schemas
//
// Validates the /api/compliance/assess request body. All inputs are optional
// beyond the core fields; simulated reference data is filled deterministically
// server-side when omitted.
// =============================================================================

import { z } from "zod";

const ZERO_X_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export const ComplianceRequestSchema = z.object({
  intent: z.string().min(1).max(1000),
  recipient: z.string().max(200).nullable().optional(),
  recipientAddress: z.string().regex(ZERO_X_ADDRESS, "recipientAddress must be a 0x address"),
  asset: z.string().min(1).max(16),
  amountUsd: z.number().positive(),
  network: z.string().min(1).max(32),
  customerId: z.string().min(1).max(64),
  /** Optional Supabase business id used to persist the audit record. */
  businessId: z.string().max(64).optional(),
  txnReference: z.string().max(32).optional(),
  travelRulePayload: z
    .object({
      originatorName: z.string().nullable().optional(),
      originatorAddress: z.string().nullable().optional(),
      originatorVasp: z.string().nullable().optional(),
      beneficiaryName: z.string().nullable().optional(),
      beneficiaryAddress: z.string().nullable().optional(),
      beneficiaryVasp: z.string().nullable().optional(),
    })
    .optional(),
  dailyVolumeUsd: z.number().nonnegative().optional(),
  counterpartyExposureUsd: z.number().nonnegative().optional(),
  allocation: z.record(z.string(), z.number()).optional(),
  stablecoinShare: z.number().min(0).max(1).optional(),
  timestamp: z.number().optional(),
  repeatTxnCount: z.number().nonnegative().optional(),
  dailyTxnCount: z.number().nonnegative().optional(),
});

export type ComplianceRequestInput = z.infer<typeof ComplianceRequestSchema>;
