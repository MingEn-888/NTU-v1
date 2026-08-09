// =============================================================================
// IBAP Payment Plan Generator
// Takes a ParsedPaymentIntent + treasury context and produces an optimised
// PaymentPlan: settlement currency, route options, execution steps and a risk
// assessment — mirroring the Phase 2 DB pipeline (payment_plans, route_options,
// payment_steps, risk_assessments).
// =============================================================================

import type { ParsedPaymentIntent, PaymentPlan, RouteOption, PaymentStep, RiskAssessment } from "./types";
import { CURRENCY_CONFIG } from "./intentParser";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function currencySymbol(currency: string | null): string {
  if (!currency) return "";
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}

/** Convert the user-stated amount into the settlement asset the treasury moves. */
export function computeSettlement(intent: ParsedPaymentIntent): {
  settlementAsset: string;
  settlementAmount: number;
  fxRate: number;
} {
  const cfg = intent.currency ? CURRENCY_CONFIG[intent.currency.toUpperCase()] : null;
  const fxRate = cfg?.fxRate || 1;
  const settlementAsset = cfg?.requestedCurrency || intent.currency || "USDC";
  const raw = intent.amount !== null ? intent.amount / fxRate : 0;
  return { settlementAsset, settlementAmount: round2(raw), fxRate };
}

function buildRoutes(intent: ParsedPaymentIntent, settlementAsset: string): RouteOption[] {
  const native = settlementAsset === "ETH" || settlementAsset === "POL";

  if (native) {
    return [
      {
        id: `route-${intent.rawInput.length}-native`,
        routeName: `${settlementAsset === "POL" ? "Polygon" : "Ethereum"} Native Transfer`,
        chain: settlementAsset === "POL" ? "polygon" : "ethereum",
        estimatedGas: settlementAsset === "POL" ? 0.045 : 4.2,
        estimatedTime: settlementAsset === "POL" ? 15 : 150,
        transactionCount: 1,
        riskScore: 5,
        totalScore: 94,
        savings: 0,
        isRecommended: true,
      },
      {
        id: `route-${intent.rawInput.length}-bridge`,
        routeName: "Bridge & Pay via Arbitrum",
        chain: "arbitrum",
        estimatedGas: 0.6,
        estimatedTime: 45,
        transactionCount: 2,
        riskScore: 8,
        totalScore: 88,
        savings: 0,
        isRecommended: false,
      },
    ];
  }

  return [
    {
      id: `route-${intent.rawInput.length}-polygon`,
      routeName: "Polygon Native USDC Direct Transfer",
      chain: "polygon",
      estimatedGas: 0.045,
      estimatedTime: 15,
      transactionCount: 1,
      riskScore: 5,
      totalScore: 95,
      savings: 12.5,
      isRecommended: true,
    },
    {
      id: `route-${intent.rawInput.length}-arbitrum`,
      routeName: "Arbitrum Fast Settlement",
      chain: "arbitrum",
      estimatedGas: 0.6,
      estimatedTime: 45,
      transactionCount: 2,
      riskScore: 8,
      totalScore: 88,
      savings: 0,
      isRecommended: false,
    },
    {
      id: `route-${intent.rawInput.length}-ethereum`,
      routeName: "Ethereum Mainnet Bridge & Pay",
      chain: "ethereum",
      estimatedGas: 4.8,
      estimatedTime: 180,
      transactionCount: 2,
      riskScore: 18,
      totalScore: 72,
      savings: 0,
      isRecommended: false,
    },
  ];
}

function buildSteps(intent: ParsedPaymentIntent, settlementAsset: string, settlementAmount: number): PaymentStep[] {
  const recipient = intent.recipientName || intent.recipientAddress || "recipient";
  const steps: PaymentStep[] = [];

  if (settlementAsset !== "ETH" && settlementAsset !== "POL") {
    steps.push({
      stepOrder: 1,
      actionType: "CHECK_ALLOWANCE",
      title: "Verify Treasury Allowance",
      description: "Confirm corporate treasury vault allowance for the payment router contract.",
      status: "PENDING",
    });
    steps.push({
      stepOrder: 2,
      actionType: "EXECUTE_PAYMENT",
      title: `Transfer ${settlementAmount} ${settlementAsset} to ${recipient}`,
      description: `Settle ${settlementAmount} ${settlementAsset} on Polygon to ${recipient} in a single atomic transaction.`,
      status: "PENDING",
    });
  } else {
    steps.push({
      stepOrder: 1,
      actionType: "EXECUTE_PAYMENT",
      title: `Transfer ${settlementAmount} ${settlementAsset} to ${recipient}`,
      description: `Send ${settlementAmount} ${settlementAsset} from treasury vault to ${recipient}.`,
      status: "PENDING",
    });
    steps.push({
      stepOrder: 2,
      actionType: "CONFIRM_SETTLEMENT",
      title: "Confirm On-Chain Settlement",
      description: "Await block confirmation and update treasury balance.",
      status: "PENDING",
    });
  }

  return steps;
}

function assessRisk(intent: ParsedPaymentIntent, settlementAmount: number, totalUsdValue?: number): RiskAssessment {
  const warnings: string[] = [];

  const balanceCheck: RiskAssessment["balanceCheck"] =
    totalUsdValue !== undefined && settlementAmount > totalUsdValue ? "WARN" : "PASS";
  if (balanceCheck === "WARN") {
    warnings.push(`Settlement amount (${settlementAmount} USDC) exceeds current treasury valuation.`);
  }

  const recipientCheck: RiskAssessment["recipientCheck"] = intent.recipientAddress ? "PASS" : "WARN";
  if (recipientCheck === "WARN") {
    warnings.push("Recipient address is not on file — manual address confirmation recommended.");
  }

  const slippageCheck: RiskAssessment["slippageCheck"] = "PASS";
  const networkCheck: RiskAssessment["networkCheck"] = "PASS";
  const contractCheck: RiskAssessment["contractCheck"] = "PASS";

  let overallRisk: RiskAssessment["overallRisk"] = "LOW";
  if (recipientCheck === "WARN" || balanceCheck === "WARN") overallRisk = "MEDIUM";
  if (settlementAmount > 10000) overallRisk = "MEDIUM";
  if (settlementAmount > 50000) overallRisk = "HIGH";

  return {
    balanceCheck,
    recipientCheck,
    slippageCheck,
    networkCheck,
    contractCheck,
    overallRisk,
    warnings,
  };
}

export function generatePaymentPlan(
  intent: ParsedPaymentIntent,
  treasuryCtx?: { totalEstimatedUSDValue?: number }
): PaymentPlan {
  const { settlementAsset, settlementAmount, fxRate } = computeSettlement(intent);
  const routes = buildRoutes(intent, settlementAsset);
  const recommended = routes.find((r) => r.isRecommended)!;
  const steps = buildSteps(intent, settlementAsset, settlementAmount);
  const risk = assessRisk(intent, settlementAmount, treasuryCtx?.totalEstimatedUSDValue);

  const mostExpensive = routes.reduce((max, r) => (r.estimatedGas > max.estimatedGas ? r : max), routes[0]);
  const savings = round2(mostExpensive.estimatedGas - recommended.estimatedGas);

  const recipient = intent.recipientName || intent.recipientAddress || "recipient";
  const explanation =
    `${recommended.routeName} selected. Converts ${intent.currency || "?"} ${intent.amount ?? ""} to ` +
    `${settlementAmount} ${settlementAsset} for ${recipient}. ` +
    `Estimated gas fee ($${recommended.estimatedGas.toFixed(3)}) with ~${recommended.estimatedTime}s settlement.`;

  return {
    settlementAsset,
    settlementAmount,
    fxRate,
    totalEstimatedGas: round2(recommended.estimatedGas),
    estimatedDuration: recommended.estimatedTime,
    savings,
    explanation,
    routes,
    steps,
    risk,
  };
}
