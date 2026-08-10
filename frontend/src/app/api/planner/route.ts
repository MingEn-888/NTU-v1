// =============================================================================
// POST /api/planner
// IBAP Phase 6 — Transaction Planner Engine endpoint.
//
// Converts a *validated* intent (Phase 5 StructuredIntent) + treasury context
// into one or more CandidateExecutionPlan objects. Every input field is checked
// with Zod before it reaches the planner, and every step the planner emits is
// a deterministic structured object — never free-form LLM output.
//
// Body:  {
//          "intent": StructuredIntent,
//          "treasury": { availableAssets, supportedChains, preferredChain,
//                        totalEstimatedUSDValue },
//          "businessId"?: string, "model"?: string, "forceFallback"?: boolean
//        }
// 200:   { "success": true,  "result": PlannerResult }
// 4xx/5xx:{ "success": false, "error": { code, message, details? } }
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PlannerRequestSchema } from "@/lib/planner/schema";
import { generateExecutionPlans } from "@/lib/planner/planner";
import { PlannerError } from "@/lib/planner/types";
import type { PlannerResult } from "@/lib/planner/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

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

    // 2. Zod validation — all input is validated before the planner runs.
    const parsed = PlannerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Request failed Zod validation.", {
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      }, 422);
    }

    // 3. Generate candidate execution plans.
    const result: PlannerResult = await generateExecutionPlans(parsed.data);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    // 4. Typed planner errors.
    if (err instanceof PlannerError) {
      const status =
        err.code === "INCOMPLETE_INTENT" || err.code === "EMPTY_INTENT" || err.code === "INVALID_TREASURY"
          ? 422
          : err.code === "RATE_LIMITED"
            ? 429
            : 400;
      return errorResponse(err.code, err.message, err.details, status);
    }

    // 5. Unexpected errors.
    console.error("[IBAP-planner] /api/planner unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("INTERNAL", message, undefined, 500);
  }
}
