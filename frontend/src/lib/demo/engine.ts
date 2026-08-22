// =============================================================================
// PayMaster Phase 12 — Product Demo pipeline (engine)
//
// Drives the REAL deterministic engines through the Alice INV-1024 scenario.
// Trust boundary is identical to production: the LLM parses intent + proposes
// strategies only; the deterministic planner / optimizer / risk engine compute
// every financial figure; the human approves; the SmartWallet executes.
// =============================================================================

import { parsePaymentIntent } from "@/lib/payment/intentParser";
import { generatePaymentPlan, computeSettlement } from "@/lib/payment/planGenerator";
import { optimizeRoutes } from "@/lib/route/optimizer";
import type { CandidateRoute, RouteTreasuryContext } from "@/lib/route/types";
import { simulationRequestFromPlan } from "@/lib/risk/adapter";
import type { SimulationTreasuryLike } from "@/lib/risk/adapter";
import { simulate } from "@/lib/risk/simulate";
import { buildExecutionPlan } from "@/lib/execution/execution";
import { getSmartWalletDeployment } from "@/lib/execution/abi";
import { runCompliancePipeline } from "@/lib/compliance/orchestrator";
import type { DemoPipelineResult, DemoAuditEntry } from "./types";

/** The one realistic business scenario used throughout the demo. */
export const DEFAULT_DEMO_INSTRUCTION = "Pay Alice $2,500 for invoice INV-1024 by Friday.";

/** Demo SmartWallet execution chain (localhost Hardhat deployment). */
export const DEMO_CHAIN_ID = 31337;

/** A stable, clearly-fake transaction hash for the simulated confirmation. */
export function demoTxHash(instruction: string): string {
  let hash = 0;
  for (let i = 0; i < instruction.length; i++) hash = (hash * 31 + instruction.charCodeAt(i)) | 0;
  const h = Math.abs(hash).toString(16).padStart(6, "0");
  // 0x + "DEMO"(4) + 6 hex + padding = 66 chars (same shape as a real hash).
  return `0xDEMO${h}${"0".repeat(64 - 4 - h.length)}`;
}

/**
 * Run the full deterministic demo pipeline for the Alice scenario.
 * All stages use the same engine code the live product uses — nothing is
 * mocked. The only simulated values are the final on-chain tx hash and the
 * approval (a human signature), which are clearly labelled as such.
 */
export async function runDemoPipeline(opts: {
  instruction?: string;
  treasury?: SimulationTreasuryLike | null;
}): Promise<DemoPipelineResult> {
  const instruction = opts.instruction?.trim() || DEFAULT_DEMO_INSTRUCTION;
  const treasury = opts.treasury ?? null;

  // 1-2. Intent extraction (deterministic parser; in production this is the
  //      Zod-validated Structured Outputs pipeline with deterministic fallback).
  const intent = parsePaymentIntent(instruction);
  if (!intent.detected) {
    throw new Error("Demo instruction could not be parsed into a payment intent.");
  }

  // 3. Treasury-aware plan (Phase 4/6 deterministic).
  const plan = generatePaymentPlan(intent);
  const settlement = computeSettlement(intent);

  // 4. Compliance layer (deterministic) — screens the recipient, monitors the
  //    transaction, scores regulatory risk, evaluates treasury/compliance
  //    policies and checks the Travel Rule BEFORE route selection. Uses the
  //    same engines as the live product (`/api/compliance/assess`).
  const compliance = runCompliancePipeline({
    intent: instruction,
    recipient: intent.recipientName,
    recipientAddress: intent.recipientAddress ?? "",
    asset: settlement.settlementAsset,
    amountUsd: Math.round(settlement.settlementAmount * 100) / 100,
    network: (plan.routes.find((r) => r.isRecommended)?.chain ?? "polygon").toLowerCase(),
    customerId: "cust_techcorp",
    txnReference: "TX-DEMO-1024",
  });

  // 5-7. Deterministic weighted route scoring (Phase 7) — runs AFTER the
  //      compliance layer.
  const candidateRoutes: CandidateRoute[] = plan.routes.map((r) => ({
    routeId: r.id,
    name: r.routeName,
    chainSequence: [r.chain],
    tokenSequence: [plan.settlementAsset],
    transactionCount: r.transactionCount,
    estimatedGas: r.estimatedGas,
    estimatedDuration: r.estimatedTime,
    riskScore: r.riskScore,
    fundingAsset: plan.settlementAsset,
    strategy: null,
    source: "deterministic" as const,
  }));

  const routeTreasury: RouteTreasuryContext = {
    preferredChain: treasury?.preferredChain ?? null,
    targetChain: (plan.routes.find((r) => r.isRecommended)?.chain ?? null) as string | null,
    availableAssets: treasury?.availableAssets,
  };

  const optimization = optimizeRoutes({
    routes: candidateRoutes,
    weights: { gas: 0.4, time: 0.2, steps: 0.15, risk: 0.25 },
    treasury: routeTreasury,
    sourceLabel: "demo",
  });
  const recommendedRoute =
    optimization.routes.find((r) => r.isRecommended) ?? optimization.routes[0] ?? null;

  // 8-10. Risk evaluation + simulation + explanation (Phase 8).
  const simulationRequest = simulationRequestFromPlan(intent, plan, treasury);
  const simulation = await simulate(simulationRequest);

  // 12. Validated SmartWallet payload (Phase 10).
  const deployment = getSmartWalletDeployment(DEMO_CHAIN_ID);
  const smartWalletAddress = deployment?.smartWallet ?? "0x0000000000000000000000000000000000000000";
  const executionPlan = buildExecutionPlan({
    paymentRequestId: "demo-pr-0001",
    paymentPlanId: "demo-plan-0001",
    routeId: recommendedRoute?.routeId,
    intent,
    plan,
    simulation,
    chainId: DEMO_CHAIN_ID,
    smartWalletAddress,
    sourceLabel: "demo",
  });

  const simulatedTxHash = demoTxHash(instruction);

  const audit: DemoAuditEntry[] = buildDemoAudit({
    instruction,
    intent,
    settlement,
    optimization,
    recommendedRoute: recommendedRoute
      ? {
          routeId: recommendedRoute.routeId,
          name: recommendedRoute.name,
          normalizedScore: recommendedRoute.normalizedScore,
        }
      : null,
    simulation,
    compliance,
    smartWalletAddress,
    simulatedTxHash,
  });

  return {
    instruction,
    intent,
    settlement,
    plan,
    optimization,
    recommendedRoute,
    simulation,
    compliance,
    executionPlan,
    audit,
    chainId: DEMO_CHAIN_ID,
    smartWalletAddress,
    simulatedTxHash,
    generatedAt: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Audit trail — deterministic entries for every stage (stage 14).
// -----------------------------------------------------------------------------

function buildDemoAudit(o: {
  instruction: string;
  intent: ReturnType<typeof parsePaymentIntent>;
  settlement: { settlementAsset: string; settlementAmount: number; fxRate: number };
  optimization: ReturnType<typeof optimizeRoutes>;
  recommendedRoute: { routeId: string; name: string; normalizedScore: number } | null;
  simulation: Awaited<ReturnType<typeof simulate>>;
  compliance: ReturnType<typeof runCompliancePipeline>;
  smartWalletAddress: string;
  simulatedTxHash: string;
}): DemoAuditEntry[] {
  const { intent, settlement, optimization, recommendedRoute, simulation, compliance, smartWalletAddress, simulatedTxHash } = o;
  const entries: DemoAuditEntry[] = [];

  const push = (stage: number, label: string, detail: string, source: DemoAuditEntry["source"]) => {
    entries.push({
      id: `audit-${String(stage).padStart(2, "0")}`,
      stage,
      label,
      detail,
      source,
    });
  };

  push(1, "Instruction received", `“${o.instruction}”`, "ai");
  push(
    2,
    "Intent extracted",
    `Action ${intent.action} · recipient ${intent.recipientName} (${intent.recipientAddress}) · ${intent.amount} ${intent.currency} · invoice ${intent.invoiceNumber} · due ${intent.deadlineLabel} · confidence ${(intent.confidence * 100).toFixed(0)}%`,
    "ai"
  );
  push(
    3,
    "Treasury checked",
    `${settlement.settlementAmount} ${settlement.settlementAsset} required at FX ${settlement.fxRate} ${intent.currency}/${settlement.settlementAsset}`,
    "deterministic"
  );
  push(
    4,
    "Compliance layer",
    `Counterparty ${compliance.screening.verdict} (${compliance.screening.riskScore}/100) · monitoring ${compliance.monitoring.signals.length === 0 ? "normal" : `${compliance.monitoring.signals.length} signal(s)`} · compliance risk ${compliance.risk.score}/100 ${compliance.risk.level} · policies ${compliance.policy.violations.length === 0 ? "pass" : `${compliance.policy.violations.length} violation(s)`} · travel rule ${compliance.travelRule.status} · decision ${compliance.decision}`,
    "deterministic"
  );
  push(5, "Candidate routes generated", `${optimization.routes.length} strategies evaluated`, "deterministic");
  push(
    6,
    "Routes scored",
    `Weighted model gas 0.40 · time 0.20 · steps 0.15 · risk 0.25 (lower is better)`,
    "deterministic"
  );
  push(
    7,
    "Recommended route",
    recommendedRoute ? `${recommendedRoute.name} — score ${(recommendedRoute.normalizedScore * 100).toFixed(1)}` : "None",
    "deterministic"
  );
  push(
    8,
    "Risk assessed",
    `${simulation.riskScore}/100 · ${simulation.riskLevel} · ${simulation.checks.length} checks (${simulation.checks.filter((c) => c.status !== "PASS").length} non-pass)`,
    "deterministic"
  );
  push(
    9,
    "Transaction simulated",
    `${simulation.totals.transactionCount} tx · gas $${simulation.totals.estimatedGasUsd.toFixed(2)} · total $${simulation.totals.estimatedTotalCostUsd.toFixed(2)}`,
    "deterministic"
  );
  push(10, "Explanation generated", "Grounded only in validated simulation data", "ai");
  push(11, "Human approval", "Pending — user signature required", "human");
  push(12, "SmartWallet payload built", `Nonce-protected transfer via ${smartWalletAddress}`, "chain");
  push(13, "Transaction confirmed", `${simulatedTxHash} (SIMULATED — no funds moved in demo)`, "chain");
  push(14, "Audit trail recorded", `${entries.length} deterministic entries`, "deterministic");

  return entries;
}
