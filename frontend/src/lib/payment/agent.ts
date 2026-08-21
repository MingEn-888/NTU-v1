// =============================================================================
// PayMaster Agent reply composer
// Builds the natural-language narration (markdown) that accompanies the
// structured PaymentRequestCard / payment plan rendered in chat.
// =============================================================================

import type { ParsedPaymentIntent, PaymentPlan } from "./types";
import { currencySymbol } from "./planGenerator";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function buildIntentNarration(intent: ParsedPaymentIntent): string {
  const lines: string[] = [];
  lines.push(`**Payment request detected** — I parsed this into a business payment operation.`);
  lines.push("");

  const bullet = (label: string, value: string) => `- **${label}:** ${value}`;

  const amountStr =
    intent.amount !== null && intent.currency
      ? `${currencySymbol(intent.currency)} ${intent.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "—";
  lines.push(bullet("Recipient", intent.recipientName || intent.recipientAddress || "Unspecified"));
  lines.push(bullet("Amount", amountStr));
  lines.push(bullet("Purpose", intent.purpose || "General payment"));
  lines.push(bullet("Deadline", intent.deadlineLabel ? `${intent.deadlineLabel} (${fmtDate(intent.deadlineDate)})` : "Flexible"));

  lines.push("");
  lines.push(
    intent.confidence >= 0.7
      ? `Confidence: **${Math.round(intent.confidence * 100)}%**. Click **Generate Payment Plan** below to route this through the treasury.`
      : `Confidence: **${Math.round(intent.confidence * 100)}%**. Review the fields below and confirm before I build a plan.`
  );

  if (intent.missingInformation.length > 0) {
    lines.push("");
    lines.push(`> ⚠️ Missing: ${intent.missingInformation.join(" · ")}`);
  }

  return lines.join("\n");
}

export function buildClarificationNarration(): string {
  return [
    "I couldn't detect a complete financial instruction from that. As your financial assistant I can pay invoices, reimburse expenses, settle vendors, or check the treasury.",
    "",
    "For a payment, tell me the **recipient**, **amount** and (optionally) the **purpose** and **deadline**. For example:",
    "- \u201CPay Alice RM2,500 for invoice INV-1024 by Friday.\u201D",
    "- \u201CPay contractor $1,200 in USDC.\u201D",
    "- \u201CSettle invoice INV-2048 using treasury.\u201D",
  ].join("\n");
}

export function buildPlanNarration(intent: ParsedPaymentIntent, plan: PaymentPlan): string {
  const rec = plan.routes.find((r) => r.isRecommended);
  const lines: string[] = [];
  lines.push(`**Payment plan generated** — optimised for the treasury.`);
  lines.push("");
  lines.push(`I'll settle **${plan.settlementAmount.toLocaleString("en-US")} ${plan.settlementAsset}**`);
  lines.push(`(${currencySymbol(intent.currency)} ${intent.amount?.toLocaleString("en-US")} → ${plan.settlementAsset} at rate 1:${plan.fxRate.toFixed(2)})`);
  lines.push("");
  if (rec) {
    lines.push(`- **Recommended:** ${rec.routeName} — gas \`$${rec.estimatedGas.toFixed(3)}\`, ~${rec.estimatedTime}s, score ${rec.totalScore}/100`);
  }
  lines.push(`- **Risk:** ${plan.risk.overallRisk} · **Est. savings:** $${plan.savings.toFixed(2)}`);
  if (plan.risk.warnings.length > 0) {
    lines.push("");
    lines.push(`> ⚠️ ${plan.risk.warnings.join(" · ")}`);
  }
  lines.push("");
  lines.push("Before approval, the transfer passes through the **DPT compliance layer** — counterparty screening, transaction monitoring, policy checks and Travel Rule verification. A **blocked** decision prevents execution entirely.");
  lines.push("");
  lines.push("Review the plan and hit **Approve & Execute** to authorise the payout from the treasury vault. Nothing is sent until you approve.");
  return lines.join("\n");
}

export function buildErrorNarration(message: string): string {
  return `> ⚠️ **Execution issue:** ${message}\n\nI've rolled back to a safe state — no funds were moved. You can adjust the payment request and try again.`;
}
