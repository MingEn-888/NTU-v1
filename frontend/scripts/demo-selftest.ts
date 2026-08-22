// =============================================================================
// PayMaster Phase 12 — Product Demo pipeline self-test
// Exercises the demo engine end-to-end (no wallet / no key / no network):
//   - parses the Alice INV-1024 scenario into a structured intent
//   - settlement FX ($ -> USDC)
//   - deterministic route scoring + recommendation
//   - risk simulation (7 checks, level, totals, explanation)
//   - compliance layer (screening / monitoring / risk / policy / travel rule / decision)
//   - SmartWallet execution payload (transferToken / wei amounts)
//   - 14-stage audit trail
//   - determinism (identical input -> identical output)
//
//   cd frontend && npx tsx scripts/demo-selftest.ts   (run AFTER tsc --noEmit)
// =============================================================================

import { runDemoPipeline, DEFAULT_DEMO_INSTRUCTION, demoTxHash } from "../src/lib/demo/engine";
import { DEMO_STAGES } from "../src/lib/demo/types";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`, extra ?? "");
  }
}

async function main() {
  console.log("\nPayMaster Phase 12 — Demo pipeline self-test\n");

  // --- Deterministic tx hash ------------------------------------------------
  console.log("demoTxHash:");
  const h1 = demoTxHash(DEFAULT_DEMO_INSTRUCTION);
  const h2 = demoTxHash(DEFAULT_DEMO_INSTRUCTION);
  check("hash starts with 0xDEMO", h1.startsWith("0xDEMO"));
  check("hash length is 66", h1.length === 66);
  check("hash is deterministic", h1 === h2);

  // --- Full pipeline ---------------------------------------------------------
  console.log("\nrunDemoPipeline:");
  const result = await runDemoPipeline({});
  const { intent, settlement, plan, optimization, simulation, compliance, executionPlan, audit } = result;

  check("intent detected", intent.detected === true);
  check("recipient is Alice", intent.recipientName?.toLowerCase().includes("alice") === true);
  check(
    "recipient address is vendor address",
    intent.recipientAddress === "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
  );
  check("amount is 2500", intent.amount === 2500);
  check("currency is $", intent.currency === "$");
  check("invoice normalized to 1024", intent.invoiceNumber === "1024");
  check("deadline is Friday", intent.deadlineLabel?.toLowerCase().includes("friday") === true);
  check("no missing information", intent.missingInformation.length === 0);

  check("settlement asset USDC", settlement.settlementAsset === "USDC");
  check("settlement amount 2500 USDC", settlement.settlementAmount === 2500);
  check("fx rate 1", settlement.fxRate === 1);

  check("plan has routes", plan.routes.length >= 2);
  check("plan has steps", plan.steps.length >= 1);
  check("recommended route present", plan.routes.some((r) => r.isRecommended));

  check("optimizer returned routes", optimization.routes.length === plan.routes.length);
  check("optimizer weights sum ~1", Math.abs((optimization.weights.gas + optimization.weights.time + optimization.weights.steps + optimization.weights.risk) - 1) < 1e-6);
  check("recommended route id set", result.recommendedRoute?.routeId === optimization.recommendedRouteId);
  check("recommended rank is 1", result.recommendedRoute?.rank === 1);
  check("optimization score is a number", typeof result.recommendedRoute?.optimizationScore === "number");
  check("recommendation reason present", !!result.recommendedRoute?.recommendationReason);

  check("simulation has 7 checks", simulation.checks.length === 7);
  check("risk score in 0-100", simulation.riskScore >= 0 && simulation.riskScore <= 100);
  check("risk level valid", ["LOW", "MEDIUM", "HIGH"].includes(simulation.riskLevel));
  check("expected result present", simulation.expectedResult.length > 10);
  check("explanation present", simulation.explanation.length > 10);
  check("explanation source valid", ["ai", "deterministic"].includes(simulation.explanationSource));
  check("approval required", simulation.approval.required === true);
  check("can proceed", simulation.approval.canProceed === true);
  check("totals have gas + total cost", simulation.totals.estimatedGasUsd >= 0 && simulation.totals.estimatedTotalCostUsd >= simulation.totals.estimatedGasUsd);

  check("execution plan has chain", executionPlan.chainId === 31337);
  check("execution plan smart wallet set", executionPlan.smartWalletAddress.length > 2);
  check("execution plan amount matches", Number(executionPlan.amount) > 0);
  check("execution plan amountWei present", executionPlan.amountWei.length > 0);
  const hasTransfer = executionPlan.steps.some((s) => s.tx && s.tx.kind === "transferToken");
  check("has a transferToken step", hasTransfer);

  check("audit has 14 stages", audit.length === 14);
  check("audit stages match demo stages", audit.map((e) => e.stage).join(",") === DEMO_STAGES.map((s) => s.n).join(","));
  check("audit includes approval entry", audit.some((e) => e.label.toLowerCase().includes("approval")));
  check("audit includes execution entry", audit.some((e) => e.label.toLowerCase().includes("smartwallet")));
  check("audit includes confirmation", audit.some((e) => e.label.toLowerCase().includes("confirmed")));

  // --- Compliance layer (stage 4, merged) -----------------------------------
  console.log("\ncompliance layer:");
  check("compliance decision is valid", ["ALLOW", "REVIEW", "BLOCK"].includes(compliance.decision));
  check("Alice (verified vendor) is ALLOWED", compliance.decision === "ALLOW");
  check("counterparty verdict is PASS", compliance.screening.verdict === "PASS");
  check("counterparty screened as Acme Suppliers", compliance.screening.profile.name?.includes("Acme") === true);
  check("compliance risk score in 0-100", compliance.risk.score >= 0 && compliance.risk.score <= 100);
  check("compliance risk level valid", ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(compliance.risk.level));
  check("compliance execution allowed", compliance.executionAllowed === true);
  check("compliance human approval not forced", compliance.humanApprovalRequired === false);
  const complianceAudit = audit.find((e) => e.stage === 4);
  check("audit has a compliance layer entry", !!complianceAudit && complianceAudit.label.toLowerCase().includes("compliance layer"));
  check("compliance layer entry includes decision", !!complianceAudit && complianceAudit.detail.includes(compliance.decision));

  // --- Determinism -----------------------------------------------------------
  console.log("\ndeterminism:");
  const again = await runDemoPipeline({});
  check("identical intent", JSON.stringify(again.intent) === JSON.stringify(result.intent));
  check(
    "identical recommended route",
    again.recommendedRoute?.routeId === result.recommendedRoute?.routeId &&
      again.recommendedRoute?.normalizedScore === result.recommendedRoute?.normalizedScore
  );
  check("identical risk score", again.simulation.riskScore === result.simulation.riskScore);
  check("identical execution plan", JSON.stringify(again.executionPlan) === JSON.stringify(executionPlan));

  // --- Edge: empty / weird instruction ---------------------------------------
  console.log("\nedge cases:");
  try {
    await runDemoPipeline({ instruction: "hello there" });
    check("non-payment instruction handled", false);
  } catch {
    check("non-payment instruction handled", true);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Demo self-test crashed:", err);
  process.exit(1);
});
