// =============================================================================
// POST /api/route/optim
// PayMaster Phase 7 — Deterministic Route Optimization Engine endpoint.
//
// Selects the best blockchain payment route from a set of valid candidate
// routes (e.g. the Phase 6 planner's output, or direct route descriptions).
// The engine normalizes every factor to [0,1], applies the configurable
// weighted scoring model (LOWER IS BETTER), and returns a deterministic
// ranking with the recommended route.
//
// Body:  {
//          "routes": [ { routeId, chainSequence, tokenSequence,
//                        transactionCount, estimatedGas, estimatedDuration,
//                        riskScore, fundingAsset?, strategy?, source? } ],
//          "weights"?: { gas?, time?, steps?, risk? },   // optional, auto-sum=1
//          "treasury"?: { preferredChain?, targetChain?, availableAssets? },
//          "baselineGas"?: number, "sourceLabel"?: string
//        }
// 200:   { "success": true,  "result": RouteOptimizerResult }
// 4xx/5xx:{ "success": false, "error": { code, message, details? } }
//
// NOTE: The final route decision is DETERMINISTIC. The LLM may only have
// proposed candidate strategies upstream (Phase 6) — it never decides here.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { RouteOptimizerRequestSchema } from "@/lib/route/schema";
import { optimizeRoutes } from "@/lib/route/optimizer";
import { RouteOptimizerError } from "@/lib/route/types";

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

    // 2. Zod validation — all input is validated before the engine runs.
    const parsed = RouteOptimizerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Request failed Zod validation.", {
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      }, 422);
    }

    // 3. Run the deterministic optimizer.
    const result = optimizeRoutes(parsed.data);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    // 4. Typed optimizer errors.
    if (err instanceof RouteOptimizerError) {
      const status =
        err.code === "VALIDATION_FAILED" ? 422 : err.code === "NO_FEASIBLE_ROUTES" ? 409 : 400;
      return errorResponse(err.code, err.message, err.details, status);
    }

    // 5. Unexpected errors.
    console.error("[PayMaster-route] /api/route/optim unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return errorResponse("INTERNAL", message, undefined, 500);
  }
}
