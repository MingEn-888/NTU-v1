// =============================================================================
// POST /api/intent/parse
// IBAP Phase 5 — AI Intent & Payment Extraction Engine endpoint.
//
// Converts a natural-language business payment instruction into a validated
// structured intent:
//   Natural Language -> LLM (structured outputs) -> Zod validation
//   -> deterministic normalization -> StructuredIntent
//
// The LLM never executes anything. Low `confidence` / non-empty
// `missingInformation` are signals the caller MUST gate execution on.
//
// Body:  { "text": "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
//          "businessId"?: string, "model"?: string }
// 200:   { "success": true,  "intent": StructuredIntent }
// 4xx/5xx:{ "success": false, "error": { code, message, details? } }
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import {
  IntentExtractionError,
  parseIntentWithAI,
} from "@/lib/ai/intent-parser";
import type { StructuredIntent } from "@/lib/ai/intent-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 4000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const businessId = typeof body?.businessId === "string" ? body.businessId : undefined;
    const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : undefined;

    // 1. Input validation.
    if (!text) {
      return NextResponse.json(
        { success: false, error: { code: "EMPTY_INPUT", message: "text is required and cannot be empty." } },
        { status: 400 }
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TEXT_TOO_LONG",
            message: `Instruction exceeds the ${MAX_TEXT_LENGTH}-character limit.`,
            details: { received: text.length, max: MAX_TEXT_LENGTH },
          },
        },
        { status: 400 }
      );
    }

    // 2. Extract + validate intent (LLM primary, deterministic fallback).
    const intent: StructuredIntent = await parseIntentWithAI({ text, businessId, model });

    return NextResponse.json({ success: true, intent });
  } catch (err) {
    // 3. Typed errors from the extraction engine.
    if (err instanceof IntentExtractionError) {
      const status =
        err.code === "RATE_LIMITED"
          ? 429
          : err.code === "VALIDATION_FAILED"
            ? 422
            : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message, details: err.details } },
        { status }
      );
    }

    // 4. Unexpected errors.
    console.error("[IBAP-intent] /api/intent/parse unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message } },
      { status: 500 }
    );
  }
}
