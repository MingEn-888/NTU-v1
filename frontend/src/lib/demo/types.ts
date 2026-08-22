// =============================================================================
// PayMaster Phase 12 — Product Demo pipeline (domain types)
//
// The demo drives the REAL deterministic engines (intent parser, planner, route
// optimizer, risk simulator, execution plan builder) through one realistic
// business scenario:
//
//     "Pay Alice $2,500 for invoice INV-1024 by Friday."
//
// Nothing here is hand-typed. Every figure below comes from the same
// deterministic code paths the live product uses, so the demo is an honest
// illustration of the production pipeline, not a mock-up.
// =============================================================================

import type { ParsedPaymentIntent, PaymentPlan } from "@/lib/payment/types";
import type { RouteOptimizerResult, OptimizedRoute } from "@/lib/route/types";
import type { SimulationResult } from "@/lib/risk/types";
import type { ExecutionPlan } from "@/lib/execution/types";
import type { ComplianceAssessment } from "@/lib/compliance/types";

/** The 14 stages of the end-to-end demo walkthrough. */
export const DEMO_STAGES = [
  { n: 1, key: "instruction", title: "Natural-language instruction" },
  { n: 2, key: "intent", title: "AI intent extraction" },
  { n: 3, key: "treasury", title: "Treasury check" },
  // Compliance layer — ONE merged stage; the five sub-workflows render inside it.
  { n: 4, key: "compliance", title: "Compliance layer" },
  // Route optimization — runs AFTER the compliance layer.
  { n: 5, key: "routes", title: "Candidate routes" },
  { n: 6, key: "scoring", title: "Mathematical route scoring" },
  { n: 7, key: "recommended", title: "Recommended route" },
  { n: 8, key: "risk", title: "Risk assessment" },
  { n: 9, key: "simulation", title: "Transaction simulation" },
  { n: 10, key: "explanation", title: "AI explanation" },
  { n: 11, key: "approval", title: "Human approval" },
  { n: 12, key: "execute", title: "SmartWallet execution" },
  { n: 13, key: "confirm", title: "Transaction confirmation" },
  { n: 14, key: "audit", title: "Audit history" },
] as const;

export type DemoStageKey = (typeof DEMO_STAGES)[number]["key"];

export interface DemoAuditEntry {
  id: string;
  stage: number;
  label: string;
  detail: string;
  source: "ai" | "deterministic" | "human" | "chain";
}

export interface DemoPipelineResult {
  /** The exact business instruction being demonstrated. */
  instruction: string;
  intent: ParsedPaymentIntent;
  settlement: { settlementAsset: string; settlementAmount: number; fxRate: number };
  plan: PaymentPlan;
  /** Deterministic route scoring (weighted model) of all candidates. */
  optimization: RouteOptimizerResult;
  recommendedRoute: OptimizedRoute | null;
  simulation: SimulationResult;
  /** Deterministic compliance assessment (screening / monitoring / risk / policy / travel rule / decision). */
  compliance: ComplianceAssessment;
  /** Validated SmartWallet payload the approved plan would submit. */
  executionPlan: ExecutionPlan;
  /** Deterministic audit trail covering every stage. */
  audit: DemoAuditEntry[];
  /** Demo chain + SmartWallet used for the execution/confirmation stages. */
  chainId: number;
  smartWalletAddress: string;
  /** Deterministic demo transaction hash (clearly labelled SIMULATED). */
  simulatedTxHash: string;
  generatedAt: string;
}
