// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Counterparty Screening Engine
//
// Screens the transfer recipient BEFORE any execution. For every counterparty
// the engine maintains a simulated profile: wallet address, label, verification
// status, sanctions screening, wallet risk, wallet age, transaction behaviour
// and history.
//
// The verdict is computed deterministically from the profile:
//   - blocklist / sanctions match        -> BLOCK
//   - high-risk profile / high score     -> BLOCK or REVIEW
//   - unverified / flagged / new wallet  -> REVIEW
//   - verified, low risk, clean history  -> PASS
//
// IMPORTANT: This is SIMULATED screening data for the prototype. The app does
// NOT connect to a real sanctions provider. Everything is labelled simulated.
// =============================================================================

import {
  BLOCKLIST,
  MOCK_COUNTERPARTIES,
  unknownCounterpartyProfile,
} from "./catalog";
import type { CounterpartyProfile, CounterpartyScreening, ScreeningVerdict } from "./types";

// ---------------------------------------------------------------------------
// Weighting used to build the 0-100 counterparty risk score (deterministic).
// ---------------------------------------------------------------------------

const VERIFICATION_POINTS: Record<CounterpartyProfile["verificationStatus"], number> = {
  VERIFIED: 0,
  PENDING: 12,
  UNVERIFIED: 25,
};

const WALLET_RISK_POINTS: Record<CounterpartyProfile["walletRisk"], number> = {
  LOW: 0,
  MEDIUM: 12,
  HIGH: 25,
};

/** Clamp to 0-100. */
function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Deterministic 0-100 counterparty risk score. Higher = riskier.
 * Contributions: verification status, sanctions, wallet risk, wallet age,
 * history depth, suspicious indicators, known-vendor status.
 */
export function scoreCounterparty(profile: CounterpartyProfile): number {
  let score = 0;

  score += VERIFICATION_POINTS[profile.verificationStatus];
  score += WALLET_RISK_POINTS[profile.walletRisk];
  if (!profile.sanctionsScreened) score += 15;
  if (BLOCKLIST.includes(profile.address.toLowerCase())) score += 40;

  // New wallets are inherently riskier.
  if (profile.walletAgeDays === 0) score += 10;
  else if (profile.walletAgeDays < 30) score += 7;
  else if (profile.walletAgeDays < 180) score += 3;

  // Thin transaction history.
  if (profile.txnHistoryCount === 0) score += 8;
  else if (profile.txnHistoryCount < 5) score += 4;

  // Suspicious indicators.
  score += Math.min(20, profile.suspiciousIndicators.length * 6);

  // Trusted on-boarded vendors get a small deterministic credit.
  if (profile.isKnownVendor && profile.verificationStatus === "VERIFIED") score -= 5;

  return clampScore(score);
}

/** Human-readable reasons for the counterparty score (transparency). */
export function counterpartyReasons(profile: CounterpartyProfile, score: number): string[] {
  const reasons: string[] = [];
  if (BLOCKLIST.includes(profile.address.toLowerCase()))
    reasons.push("Counterparty is on the blocklist (simulated sanctions match)");
  if (profile.verificationStatus !== "VERIFIED")
    reasons.push(`Counterparty verification status: ${profile.verificationStatus}`);
  if (!profile.sanctionsScreened)
    reasons.push("Sanctions screening has not been completed");
  if (profile.walletRisk === "HIGH")
    reasons.push("Counterparty wallet risk is HIGH");
  if (profile.walletAgeDays < 30)
    reasons.push(`Wallet is new (${profile.walletAgeDays} days old)`);
  if (profile.txnHistoryCount < 5)
    reasons.push(`Thin transaction history (${profile.txnHistoryCount} txns)`);
  if (profile.suspiciousIndicators.length > 0)
    reasons.push(`Suspicious indicators: ${profile.suspiciousIndicators.join("; ")}`);
  if (profile.isKnownVendor)
    reasons.push("Counterparty is a known, verified vendor");
  if (reasons.length === 0) reasons.push("No material counterparty risk factors");
  return reasons;
}

/**
 * Deterministic screening verdict from the risk score + profile.
 *   BLOCK for blocklist; BLOCK for score >= 70; REVIEW for score >= 40;
 *   PASS otherwise.
 */
export function verdictFromScore(profile: CounterpartyProfile, score: number): ScreeningVerdict {
  if (BLOCKLIST.includes(profile.address.toLowerCase())) return "BLOCK";
  if (score >= 70) return "BLOCK";
  if (score >= 40) return "REVIEW";
  return "PASS";
}

/** Screen a single recipient address. */
export function screenCounterparty(address: string): CounterpartyScreening {
  const normalized = address.toLowerCase();
  const profile =
    MOCK_COUNTERPARTIES[normalized] ?? unknownCounterpartyProfile(address);

  const riskScore = scoreCounterparty(profile);
  const verdict = verdictFromScore(profile, riskScore);
  const reasons = counterpartyReasons(profile, riskScore);

  const summary =
    verdict === "PASS"
      ? `Counterparty cleared (simulated screening). Score ${riskScore}/100.`
      : verdict === "REVIEW"
      ? `Counterparty flagged for review (simulated screening). Score ${riskScore}/100.`
      : `Counterparty blocked (simulated screening). Score ${riskScore}/100.`;

  return {
    verdict,
    riskScore,
    profile,
    simulated: true,
    summary,
    reasons,
  };
}

/** Deterministic label for the UI (GREEN / YELLOW / RED). */
export function screeningTone(verdict: ScreeningVerdict): "green" | "yellow" | "red" {
  return verdict === "PASS" ? "green" : verdict === "REVIEW" ? "yellow" : "red";
}
