// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Travel Rule workflow
//
// Tracks the required Travel Rule information for DPT transfers:
//   - Originator info (name / address)
//   - Beneficiary info (name / address)
//   - Originating VASP
//   - Beneficiary VASP
//   - Transfer amount, asset, status
//   - Information completeness
//
// The workflow is SIMULATED for this prototype — it does NOT connect to a real
// Travel Rule network. Status is either READY (all required fields present) or
// INCOMPLETE (the UI shows exactly which fields are missing).
// =============================================================================

import type { CounterpartyScreening, PolicyEffect, TravelRuleField, TravelRuleResult, TravelRuleStatus } from "./types";

// ---------------------------------------------------------------------------
// Simulated Travel Rule payload (the "information" collected for a transfer).
// ---------------------------------------------------------------------------

export interface TravelRulePayload {
  originatorName?: string | null;
  originatorAddress?: string | null;
  originatorVasp?: string | null;
  beneficiaryName?: string | null;
  beneficiaryAddress?: string | null;
  beneficiaryVasp?: string | null;
}

export const TRAVEL_RULE_FIELDS: TravelRuleField[] = [
  "originator_name",
  "originator_address",
  "originator_vasp",
  "beneficiary_name",
  "beneficiary_address",
  "beneficiary_vasp",
];

export const TRAVEL_RULE_FIELD_LABELS: Record<TravelRuleField, string> = {
  originator_name: "Originator name",
  originator_address: "Originator address",
  originator_vasp: "Originating VASP",
  beneficiary_name: "Beneficiary name",
  beneficiary_address: "Beneficiary address",
  beneficiary_vasp: "Beneficiary VASP",
};

/** Transfer amounts above which Travel Rule information is required (USD). */
export const TRAVEL_RULE_REQUIRED_ABOVE_USD = 1_000;
export const TRAVEL_RULE_BLOCK_ABOVE_USD = 10_000;

/** True when this field maps to a present (non-empty) payload value. */
function isPresent(field: TravelRuleField, payload: TravelRulePayload): boolean {
  switch (field) {
    case "originator_name":
      return Boolean(payload.originatorName);
    case "originator_address":
      return Boolean(payload.originatorAddress);
    case "originator_vasp":
      return Boolean(payload.originatorVasp);
    case "beneficiary_name":
      return Boolean(payload.beneficiaryName);
    case "beneficiary_address":
      return Boolean(payload.beneficiaryAddress);
    case "beneficiary_vasp":
      return Boolean(payload.beneficiaryVasp);
  }
}

/**
 * Evaluate the Travel Rule status for a transfer. Below the applicability
 * threshold the workflow is considered READY (not applicable). Above it, every
 * missing field is reported.
 */
export function evaluateTravelRule(
  payload: TravelRulePayload,
  amountUsd: number
): TravelRuleResult {
  const applicable = amountUsd >= TRAVEL_RULE_REQUIRED_ABOVE_USD;

  const presentFields: TravelRuleField[] = [];
  const missingFields: TravelRuleField[] = [];

  if (applicable) {
    for (const field of TRAVEL_RULE_FIELDS) {
      if (isPresent(field, payload)) presentFields.push(field);
      else missingFields.push(field);
    }
  } else {
    // Not applicable — all fields treated as satisfied (no info required).
    presentFields.push(...TRAVEL_RULE_FIELDS);
  }

  const complete = applicable ? missingFields.length === 0 : true;
  const status: TravelRuleStatus = complete ? "READY" : "INCOMPLETE";

  // Deterministic effect: incomplete + very large transfer -> BLOCK;
  // incomplete otherwise -> REVIEW; complete -> ALLOW.
  let effect: PolicyEffect = "ALLOW";
  if (!complete) {
    effect = amountUsd >= TRAVEL_RULE_BLOCK_ABOVE_USD ? "BLOCK" : "REVIEW";
  }

  return {
    status,
    presentFields,
    missingFields,
    complete,
    effect,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Default simulated payloads
// ---------------------------------------------------------------------------

/** Complete Travel Rule payload used for trusted/verified counterparties. */
export const COMPLETE_TRAVEL_RULE: TravelRulePayload = {
  originatorName: "TechCorp Treasury",
  originatorAddress: "0x3C44CdD470368A0623A22D2c4022878d3F9905E5",
  originatorVasp: "PayMaster Sandbox VASP",
  beneficiaryName: "Acme Suppliers Pte. Ltd.",
  beneficiaryAddress: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  beneficiaryVasp: "Simulated Counterparty VASP",
};

/** Incomplete payload used to demonstrate the INCOMPLETE workflow. */
export const INCOMPLETE_TRAVEL_RULE: TravelRulePayload = {
  originatorName: "TechCorp Treasury",
  originatorAddress: "0x3C44CdD470368A0623A22D2c4022878d3F9905E5",
  originatorVasp: "PayMaster Sandbox VASP",
  beneficiaryName: null,
  beneficiaryAddress: null,
  beneficiaryVasp: null,
};

/** Empty payload (no Travel Rule information at all). */
export const EMPTY_TRAVEL_RULE: TravelRulePayload = {};

/**
 * Default Travel Rule payload derived from a counterparty screening result.
 * Verified / known counterparties carry a complete simulated payload; unknown
 * or unverified counterparties carry none (so their transfers correctly fall
 * into REVIEW/BLOCK until the operator provides the missing information).
 */
export function defaultTravelRulePayloadFor(screening: CounterpartyScreening): TravelRulePayload {
  if (screening.profile.verificationStatus === "VERIFIED") {
    return {
      originatorName: "TechCorp Treasury",
      originatorAddress: "0x3C44CdD470368A0623A22D2c4022878d3F9905E5",
      originatorVasp: "PayMaster Sandbox VASP",
      beneficiaryName: screening.profile.name ?? "Verified counterparty",
      beneficiaryAddress: screening.profile.address,
      beneficiaryVasp: "Simulated Counterparty VASP",
    };
  }
  return {};
}
