// =============================================================================
// POST /api/yield/suggest
// PayMaster Phase 13 — Yield Automation suggestion endpoint.
//
// Deterministically sweeps idle treasury USDC above the liquidity buffer into
// the best catalog strategy. The LLM is NEVER involved: strategy + APY come
// from the catalog, amounts from the treasury. The result is a suggestion only
// — every allocation carries `requiresApproval: true` and is never executed
// here.
//
// Body: { treasury: YieldTreasuryContext, bufferRatio?, chainId?, sourceLabel? }
// 200:  { success: true, result: YieldSuggestion }
// 4xx:  { success: false, error: { code, message, details? } }
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { suggestYieldAllocation } from "@/lib/yield/engine";
import { YieldSuggestRequestSchema, YieldSuggestionSchema } from "@/lib/yield/schema";
import { YieldEngineError } from "@/lib/yield/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(code: string, message: string, details?: unknown, status = 400) {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("BAD_JSON", "Request body is not valid JSON.");
    }

    const parsed = YieldSuggestRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_FAILED",
        "Request failed Zod validation.",
        parsed.error.issues,
        422
      );
    }

    const result = suggestYieldAllocation(parsed.data.treasury, {
      bufferRatio: parsed.data.bufferRatio,
      chainId: parsed.data.chainId,
    });

    // Shape-guarantee the output before it leaves the service.
    const shaped = YieldSuggestionSchema.parse(result);
    return NextResponse.json({ success: true, result: shaped });
  } catch (err) {
    if (err instanceof YieldEngineError) {
      return errorResponse(err.code, err.message, err.details);
    }
    return errorResponse(
      "INTERNAL",
      err instanceof Error ? err.message : "Unexpected yield engine error.",
      undefined,
      500
    );
  }
}
