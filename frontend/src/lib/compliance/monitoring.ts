// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Transaction Monitoring Engine
//
// Monitors each transfer for suspicious / abnormal behaviour using DETERMINISTIC
// rules and simple statistical calculations (never the LLM):
//   - txn amount vs historical average (deviation ratio)
//   - txn frequency / velocity (daily txn count)
//   - unusual timing (night / off-hours window)
//   - repeated identical transfers
//   - sudden increase in txn size
//   - new recipient (no history with this counterparty)
//   - unusual asset (never used by this customer before)
//   - unusual network (never used by this customer before)
//
// Every anomaly produces a MonitoringSignal { signal, severity, description }.
// =============================================================================

import type { ComplianceRiskLevel, MonitoringHistory, MonitoringResult, MonitoringSignal } from "./types";

// ---------------------------------------------------------------------------
// Deterministic severity thresholds
// ---------------------------------------------------------------------------

/** Transfer amount > this multiple of historical average = HIGH anomaly. */
const HIGH_DEVIATION_MULT = 8;
/** Transfer amount > this multiple of historical average = MEDIUM anomaly. */
const MEDIUM_DEVIATION_MULT = 3;
/** Daily txn count above this = velocity anomaly. */
const HIGH_DAILY_TXNS = 10;
/** Repeated identical transfers above this count in a day = repetition anomaly. */
const REPEAT_TXNS = 5;
/** Off-hours window (e.g. 00:00 - 05:00 local) is considered unusual timing. */
const UNUSUAL_HOUR_START = 0;
const UNUSUAL_HOUR_END = 5;

/** Aggregate contribution of monitoring signals to the 0-100 risk score. */
export function monitoringRiskScore(signals: MonitoringSignal[]): number {
  let score = 0;
  for (const s of signals) {
    if (s.severity === "CRITICAL") score += 20;
    else if (s.severity === "HIGH") score += 15;
    else if (s.severity === "MEDIUM") score += 8;
    else score += 3;
  }
  return Math.max(0, Math.min(20, score));
}

/** Highest severity present, else LOW. */
export function aggregateAnomalyLevel(signals: MonitoringSignal[]): ComplianceRiskLevel {
  const rank: Record<ComplianceRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  let level: ComplianceRiskLevel = "LOW";
  for (const s of signals) {
    if (rank[s.severity] > rank[level]) level = s.severity;
  }
  return level;
}

function hasHighAnomaly(signals: MonitoringSignal[]): boolean {
  return signals.some((s) => s.severity === "HIGH" || s.severity === "CRITICAL");
}

// ---------------------------------------------------------------------------
// Monitoring input
// ---------------------------------------------------------------------------

export interface MonitoringInput {
  /** Settlement amount in USD. */
  amountUsd: number;
  /** Counterparty address being paid. */
  recipientAddress: string;
  /** Asset symbol being settled. */
  asset: string;
  /** Chain/network the transfer is routed on. */
  network: string;
  /** Current timestamp (ms) — used for unusual-timing detection. */
  timestamp: number;
  /** Historical behaviour of this customer (simulated reference data). */
  history: MonitoringHistory;
  /** Recent identical transfers count (simulated). */
  repeatTxnCount?: number;
  /** Customer's daily txn count today (simulated). */
  dailyTxnCount?: number;
}

/**
 * Deterministic transaction monitoring. Produces signals; empty signals means
 * the transfer looks normal.
 */
export function monitorTransaction(input: MonitoringInput): MonitoringResult {
  const signals: MonitoringSignal[] = [];
  const h = input.history;

  // 1. Amount vs historical average.
  if (h.avgTxnSizeUsd > 0 && input.amountUsd > h.avgTxnSizeUsd * HIGH_DEVIATION_MULT) {
    signals.push({
      signal: "UNUSUAL_AMOUNT",
      severity: "HIGH",
      description: `Transaction ($${input.amountUsd.toLocaleString()}) exceeds historical average ($${h.avgTxnSizeUsd.toLocaleString()}) by more than ${HIGH_DEVIATION_MULT}x`,
    });
  } else if (h.avgTxnSizeUsd > 0 && input.amountUsd > h.avgTxnSizeUsd * MEDIUM_DEVIATION_MULT) {
    signals.push({
      signal: "UNUSUAL_AMOUNT",
      severity: "MEDIUM",
      description: `Transaction ($${input.amountUsd.toLocaleString()}) is ${(input.amountUsd / h.avgTxnSizeUsd).toFixed(1)}x the historical average ($${h.avgTxnSizeUsd.toLocaleString()})`,
    });
  }

  // 2. Txn frequency / velocity.
  const daily = input.dailyTxnCount ?? 0;
  if (daily > HIGH_DAILY_TXNS) {
    signals.push({
      signal: "HIGH_FREQUENCY",
      severity: "HIGH",
      description: `High transaction velocity: ${daily} transactions today`,
    });
  } else if (daily > HIGH_DAILY_TXNS / 2) {
    signals.push({
      signal: "HIGH_FREQUENCY",
      severity: "MEDIUM",
      description: `Elevated transaction frequency: ${daily} transactions today`,
    });
  }

  // 3. Unusual timing (off-hours).
  const hour = new Date(input.timestamp).getHours();
  if (hour >= UNUSUAL_HOUR_START && hour < UNUSUAL_HOUR_END) {
    signals.push({
      signal: "UNUSUAL_TIMING",
      severity: "MEDIUM",
      description: `Transaction initiated during off-hours (${String(hour).padStart(2, "0")}:00 window)`,
    });
  }

  // 4. Repeated identical transfers.
  const repeats = input.repeatTxnCount ?? 0;
  if (repeats >= REPEAT_TXNS) {
    signals.push({
      signal: "REPEATED_TRANSFERS",
      severity: "MEDIUM",
      description: `${repeats} identical transfers observed today (possible structuring)`,
    });
  }

  // 5. New recipient (no history with this counterparty).
  if (!h.knownRecipients.some((r) => r.toLowerCase() === input.recipientAddress.toLowerCase())) {
    signals.push({
      signal: "NEW_RECIPIENT",
      severity: "MEDIUM",
      description: "Recipient has no prior transaction history with this customer",
    });
  }

  // 6. Unusual asset.
  if (!h.knownAssets.some((a) => a.toUpperCase() === input.asset.toUpperCase())) {
    signals.push({
      signal: "UNUSUAL_ASSET",
      severity: "MEDIUM",
      description: `${input.asset} is not a typical asset for this customer`,
    });
  }

  // 7. Unusual network.
  if (!h.knownChains.some((c) => c.toLowerCase() === input.network.toLowerCase())) {
    signals.push({
      signal: "UNUSUAL_NETWORK",
      severity: "LOW",
      description: `${input.network} is not a typical network for this customer`,
    });
  }

  const riskScore = monitoringRiskScore(signals);
  const anomalyLevel = aggregateAnomalyLevel(signals);

  return {
    signals,
    riskScore,
    anomalyLevel,
    hasHighAnomaly: hasHighAnomaly(signals),
  };
}

// ---------------------------------------------------------------------------
// Default simulated monitoring history (per-customer reference behaviour).
// The demo customer (TechCorp) uses this unless overridden.
// ---------------------------------------------------------------------------

export const DEFAULT_MONITORING_HISTORY: MonitoringHistory = {
  avgTxnSizeUsd: 5000,
  avgDailyTxnCount: 2,
  avgIntervalMin: 720,
  knownRecipients: [
    "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
    "0x3c44cdd470368a0623a22d2c4022878d3f9905e5",
  ],
  knownAssets: ["USDC", "USDT"],
  knownChains: ["polygon", "ethereum"],
};

/** Build a monitoring history tuned to a counterparty (simulated reference). */
export function monitoringHistoryFor(avgTxnSizeUsd: number): MonitoringHistory {
  return {
    ...DEFAULT_MONITORING_HISTORY,
    avgTxnSizeUsd: avgTxnSizeUsd > 0 ? avgTxnSizeUsd : 5000,
  };
}
