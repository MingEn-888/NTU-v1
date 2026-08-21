// =============================================================================
// PayMaster — DPT Treasury Compliance Layer self-test
// Exercises the compliance engines (no API key needed):
//   - counterparty screening (PASS / REVIEW / BLOCK + scores)
//   - transaction monitoring (signals, severity, deviation)
//   - unified risk scoring (0-100 + LOW/MEDIUM/HIGH/CRITICAL)
//   - policy engine (ALLOW / REVIEW / BLOCK aggregation)
//   - travel rule workflow (READY / INCOMPLETE)
//   - full orchestrator pipeline + audit event
//   - determinism (identical input -> identical output)
//   - Zod validation
//   cd frontend && npx tsx scripts/compliance-selftest.ts
// =============================================================================

import { screenCounterparty } from "../src/lib/compliance/counterparty";
import { monitorTransaction, DEFAULT_MONITORING_HISTORY } from "../src/lib/compliance/monitoring";
import { assessRisk } from "../src/lib/compliance/risk";
import { evaluatePolicies } from "../src/lib/compliance/policy";
import { evaluateTravelRule, COMPLETE_TRAVEL_RULE, INCOMPLETE_TRAVEL_RULE } from "../src/lib/compliance/travelRule";
import { runCompliancePipeline, buildAuditEvent } from "../src/lib/compliance/orchestrator";
import { ComplianceRequestSchema } from "../src/lib/compliance/schema";
import { classifyComplianceRisk } from "../src/lib/compliance/catalog";
import { analyzePortfolio, price24hAgo, priceOf, changeLabel } from "../src/lib/compliance/portfolio";
import type { ComplianceRequest } from "../src/lib/compliance/orchestrator";

// -----------------------------------------------------------------------------
// Tiny test harness
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertEqual(name: string, actual: unknown, expected: unknown) {
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  );
}

// -----------------------------------------------------------------------------
// Shared fixtures
// -----------------------------------------------------------------------------

const TRUSTED = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
const HIGH_RISK = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
const BLOCKED = "0x000000000000000000000000000000000000dEaD";
const NEW_ADDR = "0x111122223333444455556666777788889999aAaA";

const baseRequest: ComplianceRequest = {
  intent: "Pay supplier $5,000 USDC",
  recipient: "Acme Suppliers",
  recipientAddress: TRUSTED,
  asset: "USDC",
  amountUsd: 5000,
  network: "polygon",
  customerId: "cust_techcorp",
  txnReference: "TX-82931",
  travelRulePayload: COMPLETE_TRAVEL_RULE,
};

// -----------------------------------------------------------------------------
// 1. Counterparty screening
// -----------------------------------------------------------------------------

const sTrusted = screenCounterparty(TRUSTED);
check("screening trusted -> PASS", sTrusted.verdict === "PASS", sTrusted.verdict);
check("screening trusted low score", sTrusted.riskScore < 40, `score ${sTrusted.riskScore}`);
check("screening trusted simulated flag", sTrusted.simulated === true);

const sHighRisk = screenCounterparty(HIGH_RISK);
check("screening high-risk -> REVIEW or BLOCK", sHighRisk.verdict !== "PASS", sHighRisk.verdict);
check("screening high-risk score >= 40", sHighRisk.riskScore >= 40, `score ${sHighRisk.riskScore}`);

const sBlocked = screenCounterparty(BLOCKED);
check("screening blocklisted -> BLOCK", sBlocked.verdict === "BLOCK", sBlocked.verdict);

const sNew = screenCounterparty(NEW_ADDR);
check("screening unknown -> REVIEW (no record)", sNew.verdict === "REVIEW" || sNew.verdict === "BLOCK", sNew.verdict);
check("screening unknown has reasons", sNew.reasons.length > 0);

// -----------------------------------------------------------------------------
// 2. Transaction monitoring
// -----------------------------------------------------------------------------

const mNormal = monitorTransaction({
  amountUsd: 5000,
  recipientAddress: TRUSTED,
  asset: "USDC",
  network: "polygon",
  timestamp: new Date("2026-08-21T10:00:00").getTime(),
  history: DEFAULT_MONITORING_HISTORY,
});
check("monitoring normal -> no signals", mNormal.signals.length === 0, JSON.stringify(mNormal.signals));
check("monitoring normal anomalyLevel LOW", mNormal.anomalyLevel === "LOW");

const mAnomaly = monitorTransaction({
  amountUsd: 95000,
  recipientAddress: NEW_ADDR,
  asset: "XYZ",
  network: "solana",
  timestamp: new Date("2026-08-21T02:00:00").getTime(),
  history: DEFAULT_MONITORING_HISTORY,
  repeatTxnCount: 6,
  dailyTxnCount: 12,
});
check("monitoring anomaly has signals", mAnomaly.signals.length >= 4, JSON.stringify(mAnomaly.signals));
check("monitoring anomaly has UNUSUAL_AMOUNT HIGH", mAnomaly.signals.some((s) => s.signal === "UNUSUAL_AMOUNT" && s.severity === "HIGH"));
check("monitoring anomaly hasHighAnomaly", mAnomaly.hasHighAnomaly === true);
check("monitoring anomaly riskScore > 0", mAnomaly.riskScore > 0, `score ${mAnomaly.riskScore}`);

// -----------------------------------------------------------------------------
// 3. Unified risk scoring
// -----------------------------------------------------------------------------

const rLow = assessRisk({
  screening: sTrusted,
  monitoring: mNormal,
  amountUsd: 5000,
  asset: "USDC",
  policy: evaluatePolicies({
    amountUsd: 5000,
    asset: "USDC",
    network: "polygon",
    screening: sTrusted,
    travelRule: evaluateTravelRule(COMPLETE_TRAVEL_RULE, 5000),
    counterpartyExposureUsd: 0,
    dailyVolumeUsd: 0,
    allocation: { USDC: 0.52 },
    stablecoinShare: 0.6,
  }),
  travelRule: evaluateTravelRule(COMPLETE_TRAVEL_RULE, 5000),
});
check("risk low level", rLow.level === "LOW", rLow.level);
check("risk low score <= 29", rLow.score <= 29, `score ${rLow.score}`);
check("risk breakdown total matches", rLow.breakdown.total === rLow.score);

const rCritical = assessRisk({
  screening: sBlocked,
  monitoring: mAnomaly,
  amountUsd: 95000,
  asset: "XYZ",
  policy: evaluatePolicies({
    amountUsd: 95000,
    asset: "XYZ",
    network: "solana",
    screening: sBlocked,
    travelRule: evaluateTravelRule(INCOMPLETE_TRAVEL_RULE, 95000),
    counterpartyExposureUsd: 0,
    dailyVolumeUsd: 0,
    allocation: { XYZ: 0.3 },
    stablecoinShare: 0.2,
  }),
  travelRule: evaluateTravelRule(INCOMPLETE_TRAVEL_RULE, 95000),
});
check("risk critical level", rCritical.level === "CRITICAL", rCritical.level);
check("risk critical score >= 80", rCritical.score >= 80, `score ${rCritical.score}`);

// -----------------------------------------------------------------------------
// 4. Policy engine
// -----------------------------------------------------------------------------

const pAllow = evaluatePolicies({
  amountUsd: 5000,
  asset: "USDC",
  network: "polygon",
  screening: sTrusted,
  travelRule: evaluateTravelRule(COMPLETE_TRAVEL_RULE, 5000),
  counterpartyExposureUsd: 0,
  dailyVolumeUsd: 0,
  allocation: { USDC: 0.52 },
  stablecoinShare: 0.6,
});
check("policy allow decision", pAllow.decision === "ALLOW", pAllow.decision);
check("policy allow no violations", pAllow.violations.length === 0, JSON.stringify(pAllow.violations));

const pBlock = evaluatePolicies({
  amountUsd: 5000,
  asset: "USDC",
  network: "polygon",
  screening: sBlocked,
  travelRule: evaluateTravelRule(COMPLETE_TRAVEL_RULE, 5000),
  counterpartyExposureUsd: 0,
  dailyVolumeUsd: 0,
  allocation: { USDC: 0.52 },
  stablecoinShare: 0.6,
});
check("policy blocklisted -> BLOCK", pBlock.decision === "BLOCK", pBlock.decision);

const pReview = evaluatePolicies({
  amountUsd: 80000,
  asset: "USDC",
  network: "polygon",
  screening: sTrusted,
  travelRule: evaluateTravelRule(COMPLETE_TRAVEL_RULE, 80000),
  counterpartyExposureUsd: 0,
  dailyVolumeUsd: 0,
  allocation: { USDC: 0.52 },
  stablecoinShare: 0.6,
});
check("policy over max txn -> REVIEW", pReview.decision === "REVIEW", pReview.decision);

const pAssetBlock = evaluatePolicies({
  amountUsd: 5000,
  asset: "XYZ",
  network: "polygon",
  screening: sTrusted,
  travelRule: evaluateTravelRule(COMPLETE_TRAVEL_RULE, 5000),
  counterpartyExposureUsd: 0,
  dailyVolumeUsd: 0,
  allocation: {},
  stablecoinShare: 0.6,
});
check("policy unknown asset -> BLOCK", pAssetBlock.decision === "BLOCK", pAssetBlock.decision);

// -----------------------------------------------------------------------------
// 5. Travel rule
// -----------------------------------------------------------------------------

const trReady = evaluateTravelRule(COMPLETE_TRAVEL_RULE, 5000);
check("travel rule complete -> READY", trReady.status === "READY", trReady.status);
check("travel rule complete no missing", trReady.missingFields.length === 0);

const trIncomplete = evaluateTravelRule(INCOMPLETE_TRAVEL_RULE, 5000);
check("travel rule incomplete -> INCOMPLETE", trIncomplete.status === "INCOMPLETE", trIncomplete.status);
check("travel rule incomplete has missing", trIncomplete.missingFields.length === 3, String(trIncomplete.missingFields.length));
check("travel rule incomplete effect REVIEW", trIncomplete.effect === "REVIEW", trIncomplete.effect);

const trIncompleteBig = evaluateTravelRule(INCOMPLETE_TRAVEL_RULE, 50000);
check("travel rule incomplete large -> BLOCK effect", trIncompleteBig.effect === "BLOCK", trIncompleteBig.effect);

const trNotApplicable = evaluateTravelRule({}, 100);
check("travel rule below threshold -> READY", trNotApplicable.status === "READY", trNotApplicable.status);

// -----------------------------------------------------------------------------
// 6. Orchestrator full pipeline
// -----------------------------------------------------------------------------

const assessment = runCompliancePipeline(baseRequest);
check("orchestrator decision ALLOW", assessment.decision === "ALLOW", assessment.decision);
check("orchestrator executionAllowed", assessment.executionAllowed === true);
check("orchestrator stages order", assessment.stages[0] === "intent" && assessment.stages[assessment.stages.length - 1] === "decision");
check("orchestrator has disclaimer", assessment.disclaimer.includes("simulated"));
check("orchestrator risk score matches decision", assessment.risk.score <= 29, `score ${assessment.risk.score}`);
check("orchestrator txnReference", assessment.txnReference === "TX-82931");

const blockedAssessment = runCompliancePipeline({
  ...baseRequest,
  intent: "Pay unknown $5,000",
  recipient: null,
  recipientAddress: BLOCKED,
  txnReference: "TX-99999",
});
check("orchestrator blocklisted -> BLOCK", blockedAssessment.decision === "BLOCK", blockedAssessment.decision);
check("orchestrator blocked -> execution NOT allowed", blockedAssessment.executionAllowed === false);

const reviewAssessment = runCompliancePipeline({
  ...baseRequest,
  intent: "Pay Acme $95,000 USDC",
  amountUsd: 95000,
  txnReference: "TX-95000",
});
check("orchestrator 95k -> REVIEW (max txn + manual approval)", reviewAssessment.decision === "REVIEW", reviewAssessment.decision);
check("orchestrator REVIEW -> humanApprovalRequired", reviewAssessment.humanApprovalRequired === true);

const manualApprovalAssessment = runCompliancePipeline({
  ...baseRequest,
  intent: "Pay Acme $50,000 USDC",
  amountUsd: 50000,
  txnReference: "TX-50000",
});
check("orchestrator 50k -> REVIEW (manual approval threshold)", manualApprovalAssessment.decision === "REVIEW", manualApprovalAssessment.decision);

// -----------------------------------------------------------------------------
// 7. Audit event
// -----------------------------------------------------------------------------

const audit = buildAuditEvent(assessment, baseRequest);
check("audit event decision matches", audit.decision === "ALLOW");
check("audit event has intent", audit.intent === baseRequest.intent);
check("audit event has screening", audit.screening?.verdict === "PASS");
check("audit event has tx ref", audit.txnReference === "TX-82931");

const blockedAudit = buildAuditEvent(blockedAssessment, { ...baseRequest, recipientAddress: BLOCKED });
check("audit blocked executionStatus BLOCKED", blockedAudit.executionStatus === "BLOCKED");

// -----------------------------------------------------------------------------
// 8. Determinism
// -----------------------------------------------------------------------------

const a1 = runCompliancePipeline(baseRequest);
const a2 = runCompliancePipeline(baseRequest);
check("orchestrator deterministic", JSON.stringify(a1.policy) === JSON.stringify(a2.policy));
check("orchestrator deterministic score", a1.risk.score === a2.risk.score);
check("orchestrator deterministic decision", a1.decision === a2.decision);

// -----------------------------------------------------------------------------
// 9. Zod validation + classification helper
// -----------------------------------------------------------------------------

const parsed = ComplianceRequestSchema.safeParse({
  intent: "Pay supplier $50,000 USDC",
  recipient: "Acme",
  recipientAddress: TRUSTED,
  asset: "USDC",
  amountUsd: 50000,
  network: "polygon",
  customerId: "cust_1",
});
check("zod accepts valid request", parsed.success === true);

const bad = ComplianceRequestSchema.safeParse({
  intent: "",
  recipientAddress: "not-an-address",
  asset: "USDC",
  amountUsd: -5,
  network: "polygon",
  customerId: "cust_1",
});
check("zod rejects invalid request", bad.success === false);

check("classify 0 -> LOW", classifyComplianceRisk(0) === "LOW");
check("classify 29 -> LOW", classifyComplianceRisk(29) === "LOW");
check("classify 30 -> MEDIUM", classifyComplianceRisk(30) === "MEDIUM");
check("classify 59 -> MEDIUM", classifyComplianceRisk(59) === "MEDIUM");
check("classify 60 -> HIGH", classifyComplianceRisk(60) === "HIGH");
check("classify 79 -> HIGH", classifyComplianceRisk(79) === "HIGH");
check("classify 80 -> CRITICAL", classifyComplianceRisk(80) === "CRITICAL");
check("classify 100 -> CRITICAL", classifyComplianceRisk(100) === "CRITICAL");

// -----------------------------------------------------------------------------
// 10. DPT portfolio monitoring
// -----------------------------------------------------------------------------

const portfolio = analyzePortfolio([
  { symbol: "USDC", usdValue: 650000 },
  { symbol: "ETH", usdValue: 290000 },
  { symbol: "BTC", usdValue: 250000 },
  { symbol: "POL", usdValue: 55000 },
]);
check("portfolio total value", portfolio.totalValueUsd === 1245000, String(portfolio.totalValueUsd));
check("portfolio stablecoin share ~52%", Math.abs(portfolio.stablecoinShare - 0.52) < 0.01, String(portfolio.stablecoinShare));
check("portfolio max concentration ETH 23%", Math.abs(portfolio.maxConcentration - 290000 / 1245000) < 0.01, String(portfolio.maxConcentration));
check("portfolio concentration asset ETH", portfolio.maxConcentrationAsset === "ETH");
check("portfolio warnings include allocation exceeded", portfolio.warnings.some((w) => w.kind === "allocation_exceeded"));
check("portfolio simulated flag", portfolio.simulated === true);

const lowReservePortfolio = analyzePortfolio([
  { symbol: "ETH", usdValue: 600000 },
  { symbol: "BTC", usdValue: 300000 },
  { symbol: "USDC", usdValue: 100000 },
]);
check("portfolio low stablecoin reserve warning", lowReservePortfolio.warnings.some((w) => w.kind === "stablecoin_reserve_below_min"));
check("portfolio concentrated risk HIGH", lowReservePortfolio.portfolioRisk === "HIGH");

check("portfolio price USDC", priceOf("USDC") === 1);
check("portfolio price ETH", priceOf("ETH") === 1800);
check("portfolio price24hAgo positive", price24hAgo("ETH") > 0);
check("portfolio changeLabel", changeLabel(0.024) === "+2.40%");

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\nCompliance self-test: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(f));
  process.exit(1);
}
console.log("All compliance engine checks passed ✓");
