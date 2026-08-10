// =============================================================================
// PayMaster Phase 8 — Plain-English explanation (grounded in validated data only)
//
// The explanation is generated from the VALIDATED simulation result — never
// from the LLM's imagination. Two layers:
//
//   1. buildDeterministicExplanation() — pure code. Every financial figure in
//      the output already exists in the SimulationResult / request (amount,
//      gas, total cost, percentages computed from those values). Always safe,
//      always available, fully deterministic.
//
//   2. generateExplanation() — optionally asks the LLM to *polish the prose*,
//      but NEVER to produce numbers. The model receives the validated data and
//      is forbidden from inventing figures; its output is post-filtered to strip
//      any numeric token so a hallucinated financial number can never leak
//      through. The deterministic numeric statements are appended from code.
//      On any failure (no key, network, guard) it falls back to deterministic.
//
// Example (from the spec):
//   "Polygon selected because estimated execution cost 72% lower than Ethereum
//    route. Trade-off: additional bridge step."
// =============================================================================

import type { SimulationRequest, SimulationResult, SimulationAlternative } from "./types";
import { SLIPPAGE_BPS_WARN } from "./catalog";

function fmtUsd(n: number): string {
  if (!isFinite(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAmount(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function displayRecipient(payment: SimulationRequest["payment"]): string {
  if (payment.recipient) return payment.recipient;
  if (payment.recipientAddress) {
    const a = payment.recipientAddress;
    return `${a.slice(0, 6)}…${a.slice(-4)}`;
  }
  return "recipient";
}

function chainLabel(route: SimulationRequest["route"]): string {
  const seq = (route.chainSequence || []).map((c) => c.charAt(0).toUpperCase() + c.slice(1));
  return seq.join(" → ") || "unknown chain";
}

/** Pick the most expensive alternative route as the comparison baseline. */
export function pickBaseline(
  request: SimulationRequest,
  result: SimulationResult
): { name: string; totalCostUsd: number; transactionCount: number } | null {
  const alts: SimulationAlternative[] = request.alternatives || [];
  if (!alts.length) return null;

  const thisCost = result.totals.estimatedTotalCostUsd;
  let baseline: SimulationAlternative | null = null;
  let baselineCost = -Infinity;
  for (const alt of alts) {
    if (alt.routeId === result.route.routeId) continue;
    const cost = alt.estimatedGas;
    if (cost > baselineCost) {
      baselineCost = cost;
      baseline = alt;
    }
  }
  if (!baseline || !isFinite(baselineCost) || baselineCost <= 0) return null;

  // Only report a comparison when the numbers are meaningfully different.
  if (Math.abs(baselineCost - thisCost) / Math.max(baselineCost, thisCost) < 0.05) return null;

  return {
    name: baseline.name,
    totalCostUsd: baselineCost,
    transactionCount: baseline.transactionCount,
  };
}

// -----------------------------------------------------------------------------
// Trade-off sentences (from route structure — deterministic)
// -----------------------------------------------------------------------------

function tradeOffSentences(request: SimulationRequest): string[] {
  const sentences: string[] = [];
  const actions = (request.steps || []).map((s) => s.actionType);

  if (actions.includes("BRIDGE")) {
    sentences.push(
      "Trade-off: this route includes an additional bridge step across chains, which adds counterparty and settlement risk."
    );
  }
  if (actions.includes("SWAP")) {
    const bps = request.slippageBps ?? 0;
    const warn = bps > SLIPPAGE_BPS_WARN ? " — slippage is above the comfort threshold, review before signing" : "";
    sentences.push(
      `Trade-off: it includes a token swap, so the exact amount received depends on market slippage (${bps} bps budget${warn}).`
    );
  }
  if (actions.includes("APPROVE") && !actions.includes("BRIDGE") && !actions.includes("SWAP")) {
    sentences.push("Trade-off: the router requires an ERC20 allowance approval before the payment can move.");
  }
  return sentences;
}

// -----------------------------------------------------------------------------
// Deterministic explanation — pure code, every figure from validated data
// -----------------------------------------------------------------------------

export function buildDeterministicExplanation(
  request: SimulationRequest,
  result: SimulationResult
): string {
  const { payment, route, treasury } = request;
  const t = result.totals;
  const parts: string[] = [];

  // 1. Payment summary.
  parts.push(
    `This payment of ${fmtAmount(payment.amount)} ${payment.token} will be delivered to ${displayRecipient(
      payment
    )} via ${route.name || "the selected route"} on ${chainLabel(route)} in ~${fmtDuration(
      t.estimatedDuration
    )}.`
  );

  // 2. Cost comparison vs the most expensive alternative (spec example style).
  const baseline = pickBaseline(request, result);
  const cheaperPct =
    baseline && baseline.totalCostUsd > t.estimatedTotalCostUsd
      ? Math.round((1 - t.estimatedTotalCostUsd / baseline.totalCostUsd) * 100)
      : null;
  if (baseline && cheaperPct !== null && cheaperPct >= 5) {
    parts.push(
      `${route.name} was selected because estimated execution cost is ${cheaperPct}% lower than the ${baseline.name} route.`
    );
  } else if (baseline) {
    const morePct = Math.round((1 - baseline.totalCostUsd / Math.max(t.estimatedTotalCostUsd, 0.0001)) * 100);
    parts.push(
      `Estimated execution cost is comparable to the ${baseline.name} route; this route was selected on overall score.`
    );
  }

  // 3. Trade-offs (bridge / swap / approval).
  const tradeOffs = tradeOffSentences(request);
  if (tradeOffs.length) parts.push(...tradeOffs);

  // 4. Financial breakdown (all figures already exist in the validated result).
  parts.push(
    `Estimated gas is ${fmtUsd(t.estimatedGasUsd)}${t.estimatedBridgeFeeUsd > 0 ? `, bridge fee ${fmtUsd(t.estimatedBridgeFeeUsd)}` : ""}${
      t.estimatedSlippageUsd > 0 ? `, slippage cost ${fmtUsd(t.estimatedSlippageUsd)}` : ""
    }, for an estimated total cost of ${fmtUsd(t.estimatedTotalCostUsd)} across ${t.transactionCount} on-chain transaction${
      t.transactionCount === 1 ? "" : "s"
    }.`
  );

  // 5. Preferred chain note (deterministic).
  if (treasury?.preferredChain) {
    const pref = treasury.preferredChain.toLowerCase();
    const terminal = (route.chainSequence || [])[route.chainSequence.length - 1]?.toLowerCase();
    if (terminal === pref) {
      parts.push(`The route settles on ${pref}, the treasury's preferred network.`);
    }
  }

  // 6. Risk statement.
  parts.push(`Overall execution risk is ${result.riskLevel} (score ${result.riskScore}/100).`);

  return parts.join(" ");
}

// -----------------------------------------------------------------------------
// Optional LLM prose — numbers are ALWAYS added by code, never by the model
// -----------------------------------------------------------------------------

interface GeneratedExplanation {
  text: string;
  source: "ai" | "deterministic";
}

/** Remove any numeric token so an LLM can never inject a financial figure. */
function stripNumbers(text: string): string {
  return text
    .replace(/\$\s*\d[\d,]*\.?\d*\s*(USD)?/gi, "")
    .replace(/\b\d[\d,]*\.?\d*\s*(%|bps|USD|USDC|USDT|ETH|POL)?\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

/**
 * Generate the explanation. When an LLM is configured it may reword the
 * QUALITATIVE reasoning only; every numeric statement is appended from the
 * validated data. Falls back to the deterministic explanation on any failure.
 */
export async function generateExplanation(
  request: SimulationRequest,
  result: SimulationResult
): Promise<GeneratedExplanation> {
  const deterministic = buildDeterministicExplanation(request, result);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("placeholder")) {
    return { text: deterministic, source: "deterministic" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const dataForModel = {
      recipient: request.payment.recipient,
      recipientAddress: request.payment.recipientAddress,
      token: request.payment.token,
      amount: request.payment.amount,
      route: request.route.name,
      chainSequence: request.route.chainSequence,
      riskLevel: result.riskLevel,
      warnings: result.warnings,
      hasBridge: request.steps.some((s) => s.actionType === "BRIDGE"),
      hasSwap: request.steps.some((s) => s.actionType === "SWAP"),
      transactionCount: result.totals.transactionCount,
    };

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_RISK_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are the PayMaster risk explanation writer. You explain WHY a payment plan is risky or safe for a business treasurer.\n" +
            "CRITICAL RULES:\n" +
            "1. Write plain-English QUALITATIVE prose only. NEVER output any number, currency amount, percentage, fee, rate or statistic.\n" +
            "2. Base your reasoning EXCLUSIVELY on the validated simulation data provided in the JSON. Do not invent facts, prices, routes or warnings.\n" +
            "3. Keep it to 2-4 short sentences. Do not restate the payment details the treasurer already sees.\n" +
            "4. If the data says HIGH risk, say why and recommend careful human review.",
        },
        {
          role: "user",
          content: `Here is the validated simulation data:\n${JSON.stringify(dataForModel, null, 2)}\n\nWrite the qualitative risk explanation now.`,
        },
      ],
    });

    const prose = completion.choices?.[0]?.message?.content?.trim() ?? "";
    const safeProse = stripNumbers(prose);
    if (safeProse.length < 10) {
      return { text: deterministic, source: "deterministic" };
    }

    return { text: `${safeProse} ${deterministic}`, source: "ai" };
  } catch (err) {
    console.error("[PayMaster-risk] AI explanation unavailable, using deterministic:", err);
    return { text: deterministic, source: "deterministic" };
  }
}
