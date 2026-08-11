// =============================================================================
// PayMaster — Gemini (Google AI) thin client
//
// Replaces the OpenAI client for the three sanctioned LLM touch points:
//   Phase 5 intent parsing, Phase 6 strategy proposal, Phase 8 risk prose.
// The trust boundary is unchanged: the model only produces DATA; deterministic
// code decides and executes.
//
// API:
//   - geminiJson()  structured JSON output, optionally shape-enforced via a Zod
//                   schema converted to Gemini's responseSchema
//   - geminiText()  free-form text (risk explanation prose)
//
// Env vars:
//   GEMINI_API_KEY                   (also accepts GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY)
//   GEMINI_MODEL                     default model (gemini-2.5-flash)
//   GEMINI_INTENT_MODEL / GEMINI_PLANNER_MODEL / GEMINI_RISK_MODEL  per-call overrides
//
// Error contract: any API/auth/network failure throws GeminiError (carrying the
// HTTP status when available, e.g. 429 = rate limit). A successful response with
// unusable content returns null so callers keep their deterministic fallbacks.
// =============================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import { toJSONSchema } from "zod";
import type { ZodType } from "zod";

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** Raised for auth / quota / network failures. Carries HTTP status when known. */
export class GeminiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

/** Resolve the API key from the usual env var names, ignoring placeholders. */
export function getGeminiApiKey(): string | undefined {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;
  return key && !key.includes("placeholder") ? key : undefined;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

// ---------------------------------------------------------------------------
// responseSchema sanitisation
// Gemini accepts a subset of JSON Schema. zod's toJSONSchema (draft 2020-12)
// emits keywords Gemini rejects, so we:
//   1. collapse `anyOf: [X, {type:"null"}]` into X (nulls are handled by the
//      system prompts + Zod re-validation + deterministic normalisation)
//   2. keep only a safe keyword allow-list
// ---------------------------------------------------------------------------

const ALLOWED_KEYS = new Set([
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "description",
  "minimum",
  "maximum",
]);

function sanitizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeSchema);
  if (node && typeof node === "object") {
    const src = node as Record<string, unknown>;
    // Nullable union: anyOf [X, {type:"null"}] -> X
    if (Array.isArray(src.anyOf)) {
      const nonNull = src.anyOf.filter(
        (s) => !(s && (s as { type?: string }).type === "null")
      );
      if (nonNull.length === 1) return sanitizeSchema(nonNull[0]);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      // `properties` maps arbitrary FIELD NAMES -> schemas. Keep the field names
      // and sanitize each nested schema; do NOT apply the keyword allow-list here.
      if (k === "properties" && v && typeof v === "object" && !Array.isArray(v)) {
        const props: Record<string, unknown> = {};
        for (const [name, schema] of Object.entries(v as Record<string, unknown>)) {
          props[name] = sanitizeSchema(schema);
        }
        out.properties = props;
        continue;
      }
      if (ALLOWED_KEYS.has(k)) out[k] = sanitizeSchema(v);
    }
    return out;
  }
  return node;
}

export function toGeminiSchema(schema: ZodType): Schema {
  return sanitizeSchema(toJSONSchema(schema)) as unknown as Schema;
}

// ---------------------------------------------------------------------------
// Client + request helpers
// ---------------------------------------------------------------------------

interface JsonRequest {
  system: string;
  user: string;
  model?: string;
  /** Optional Zod schema — converted to Gemini responseSchema for shape enforcement. */
  schema?: ZodType;
}

interface TextRequest {
  system: string;
  user: string;
  model?: string;
}

function getClient(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new GeminiError("Gemini API key is not configured (set GEMINI_API_KEY).", 401);
  }
  return new GoogleGenerativeAI(apiKey);
}

/** Normalize any thrown error into GeminiError with an HTTP status when known. */
function asGeminiError(err: unknown): GeminiError {
  if (err instanceof GeminiError) return err;
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  return new GeminiError(`Gemini request failed: ${message}`, status);
}

/**
 * Structured JSON output.
 * @returns the parsed object, or null when the model returned no usable JSON.
 * @throws GeminiError on auth / quota / network failures (status 429 = rate limit).
 */
export async function geminiJson<T = Record<string, unknown>>(
  req: JsonRequest
): Promise<T | null> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: req.model || DEFAULT_GEMINI_MODEL,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      ...(req.schema ? { responseSchema: toGeminiSchema(req.schema) } : {}),
    },
  });

  let result;
  try {
    result = await model.generateContent({
      systemInstruction: req.system,
      contents: [{ role: "user", parts: [{ text: req.user }] }],
    });
  } catch (err) {
    throw asGeminiError(err);
  }

  const text = result.response.text().trim();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    // Tolerate a markdown code fence if the model wrapped the JSON anyway.
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Free-form text output (used by the risk explanation prose).
 * @returns trimmed text, or null when empty / unusable.
 */
export async function geminiText(req: TextRequest): Promise<string | null> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: req.model || DEFAULT_GEMINI_MODEL,
    generationConfig: { temperature: 0 },
  });

  let result;
  try {
    result = await model.generateContent({
      systemInstruction: req.system,
      contents: [{ role: "user", parts: [{ text: req.user }] }],
    });
  } catch (err) {
    throw asGeminiError(err);
  }

  const text = result.response.text().trim();
  return text || null;
}
