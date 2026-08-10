// =============================================================================
// POST /api/risk/simulate
// PayMaster Phase 8 — Risk Evaluation & Transaction Simulation Engine endpoint.
//
// Evaluates a payment plan BEFORE any human approval:
//   - runs the 7 deterministic risk checks
//   - computes a deterministic 0-100 risk score + LOW/MEDIUM/HIGH classification
//   - simulates the payment (recipient, token, amount, route, gas, total cost,
//     txn count, warnings, expected result)
//   - returns a plain-English explanation grounded ONLY in validated data
//   - always requires explicit human approval (the engine never auto-executes)
//
// Body:  {
//          "payment":    { recipient?, recipientAddress?, token, amount },
//          "route":      { routeId, name, chainSequence, tokenSequence,
//                          transactionCount, estimatedGas, estimatedDuration,
//                          strategy? },
//          "steps":      [ { order, actionType, title, chain?, token? } ],
//          "treasury":   { availableAssets, supportedChains, preferredChain?,
//                          nativeGasBalance?, totalEstimatedUSDValue? },
//          "slippageBps"?, "walletGasBalanceUsd"?, "alternatives"?,
//          "businessId"?, "sourceLabel"?
//        }
// 200:   { "success": true,  "result": SimulationResult }
// 4xx/5xx:{ "success": false, "error": { code, message, details? } }
//
// NOTE: The verdict is DETERMINISTIC. The LLM may only polish the prose of the
// explanation — it never decides risk and never invents financial numbers.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { simulate } from "@/lib/risk/simulate";
import { RiskEngineError } from "@/lib/risk/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;

function errorResponse(code: string, message: string, details?: unknown, status = 400) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse the JSON body (bounded size).
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse(
        "BODY_TOO_LARGE",
        `Request body exceeds the ${MAX_BODY_BYTES}-byte limit.`,
        { received: raw.length, max: MAX_BODY_BYTES },
        413
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("INVALID_JSON", "Request body is not valid JSON.");
    }

    // 2. Run the deterministic risk engine (validates the body via Zod).
    const result = await simulate(body as Parameters<typeof simulate>[0]);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    // 3. Typed engine errors.
    if (err instanceof RiskEngineError) {
      const status =
        err.code === "VALIDATION_FAILED" || err.code === "EMPTY_PAYMENT" || err.code === "INVALID_ROUTE"
          ? 422
          : 400;
      return errorResponse(err.code, err.message, err.details, status);
    }

    // 4. Unexpected errors.
    console.error("[PayMaster-risk] /api/risk/simulate unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("INTERNAL", message, undefined, 500);
  }
}
