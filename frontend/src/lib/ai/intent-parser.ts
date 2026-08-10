// =============================================================================
// PayMaster Phase 5 — Intent & Payment Extraction Engine (parser)
//
// The LLM interprets a natural-language business payment instruction and returns
// a structured intent (OpenAI Structured Outputs, enforced by a Zod schema).
// The LLM NEVER executes blockchain transactions — it only produces data.
//
// This module then runs a DETERMINISTIC validation + normalization pass that
// acts as the security gate:
//   - rejects/hallucination-guards wallet addresses, amounts, currencies, chains
//   - resolves payees against the trusted on-file vendor directory (never invents)
//   - recomputes `confidence` as a security guarantee
//   - surfaces anything missing/ambiguous in `missingInformation`
//
// If no OPENAI_API_KEY is configured or the network fails, it degrades to the
// deterministic Phase-4 parser (source: "fallback") so the pipeline never dies.
// =============================================================================

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

import {
  CURRENCY_ALIASES,
  INTENT_SYSTEM_PROMPT,
  MAX_AMOUNT,
  RawLLMIntentSchema,
  StructuredIntentSchema,
  SUPPORTED_CHAINS,
  SUPPORTED_CURRENCIES,
  WALLET_ADDRESS_RE,
} from "./intent-schema";
import type { RawLLMIntent, StructuredIntent } from "./intent-schema";

// Relative imports (not @/) so this module can also be executed directly by a
// Node type-stripping self-test without a bundler / path alias resolver.
import { findVendorByMention } from "../payment/vendors";
import { parsePaymentIntent } from "../payment/intentParser";

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const DEFAULT_MODEL = process.env.OPENAI_INTENT_MODEL || "gpt-4o-mini";
const FALLBACK_MAX_CONFIDENCE = 0.75; // deterministic-only parsing never reaches LLM certainty

export interface ParseIntentOptions {
  text: string;
  /** Optional business scope — reserved for auditing / directory context. */
  businessId?: string;
  /** Override the OpenAI model for this call. */
  model?: string;
  /** Force the deterministic fallback (used by self-tests / offline mode). */
  forceFallback?: boolean;
}

// -----------------------------------------------------------------------------
// Typed errors
// -----------------------------------------------------------------------------

export type IntentErrorCode = "EMPTY_INPUT" | "VALIDATION_FAILED" | "RATE_LIMITED";

export class IntentExtractionError extends Error {
  constructor(
    public readonly code: IntentErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "IntentExtractionError";
  }
}

// -----------------------------------------------------------------------------
// Public entrypoint
// -----------------------------------------------------------------------------

export async function parseIntentWithAI(options: ParseIntentOptions): Promise<StructuredIntent> {
  const text = (options.text || "").trim();
  if (!text) {
    throw new IntentExtractionError("EMPTY_INPUT", "Instruction text is required.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || options.forceFallback) {
    return parseFallback(text);
  }

  let raw: RawLLMIntent;
  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.parse({
      model: options.model || DEFAULT_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: zodResponseFormat(RawLLMIntentSchema, "payment_intent"),
    });

    const message = completion.choices[0]?.message;
    if (message?.refusal) {
      throw new IntentExtractionError("VALIDATION_FAILED", "The model refused to interpret the instruction.", {
        refusal: message.refusal,
      });
    }
    if (!message?.parsed) {
      throw new IntentExtractionError("VALIDATION_FAILED", "The model returned no structured intent.", {
        finish_reason: completion.choices[0]?.finish_reason,
      });
    }

    // Defense-in-depth: re-validate the parsed object against the raw schema.
    const parsed = RawLLMIntentSchema.safeParse(message.parsed);
    if (!parsed.success) {
      throw new IntentExtractionError("VALIDATION_FAILED", "LLM output failed Zod validation.", {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    raw = parsed.data;
  } catch (err) {
    if (err instanceof IntentExtractionError) throw err;
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      throw new IntentExtractionError("RATE_LIMITED", "OpenAI rate limit reached — please retry shortly.", { status });
    }
    // Any other OpenAI/network failure degrades gracefully to the deterministic parser.
    console.error("[PayMaster-intent] OpenAI call failed, falling back to deterministic parser:", err);
    return parseFallback(text);
  }

  // The deterministic security gate — the LLM output is NOT trusted as-is.
  return finalizeIntent(raw, text);
}

// -----------------------------------------------------------------------------
// Deterministic validation + normalization (pure, testable)
// -----------------------------------------------------------------------------

export function finalizeIntent(raw: RawLLMIntent, rawInput: string): StructuredIntent {
  const missing = new Set<string>();

  // --- Normalize fields -------------------------------------------------------
  const recipient = raw.recipient && raw.recipient.trim() ? raw.recipient.trim() : null;

  // 1) Accept an address ONLY if it matches the strict 0x + 40-hex format.
  let recipientAddress: string | null = null;
  if (raw.recipientAddress && WALLET_ADDRESS_RE.test(raw.recipientAddress.trim())) {
    recipientAddress = raw.recipientAddress.trim().toLowerCase();
  }

  // 2) Deterministic address resolution from the trusted vendor directory.
  //    The LLM never invents an address — we only attach one we already trust.
  if (recipient && !recipientAddress) {
    const vendor = findVendorByMention(recipient);
    if (vendor) recipientAddress = vendor.address.toLowerCase();
  }

  const amount = normalizeAmount(raw.amount);
  const currency = normalizeCurrency(raw.currency);
  const sourceCurrency = normalizeCurrency(raw.sourceCurrency);
  const sourceAmount = normalizeAmount(raw.sourceAmount);
  const targetChain = normalizeChain(raw.targetChain);
  const purpose = raw.purpose && raw.purpose.trim() ? raw.purpose.trim() : null;
  const dueDate = raw.dueDate && raw.dueDate.trim() ? raw.dueDate.trim() : null;

  // --- Deterministic missing-information audit --------------------------------
  if (!recipient) missing.add("recipient name");
  if (recipient && !recipientAddress) missing.add("recipient wallet address");
  if (amount === null) missing.add("amount");
  if (!currency) missing.add("currency");
  if (!purpose) missing.add("purpose");
  if (!dueDate) missing.add("due date");

  if (raw.action === "swap_and_payment") {
    if (!sourceCurrency) missing.add("asset to swap from");
    if (sourceAmount === null) missing.add("swap amount");
    if (!currency) missing.add("payment currency");
    if (amount === null) missing.add("payment amount");
  }
  if (raw.action === "bridge_and_payment" && !targetChain) {
    missing.add("target chain");
  }

  // Invoice referenced but no number extractable.
  const invoiceMentioned = /\binvoice\b/i.test(rawInput);
  const invoiceNumberPresent = /\b(?:inv|invoice)[\s#.-]*[A-Z0-9][A-Z0-9-]{1,24}\b/i.test(rawInput);
  if (invoiceMentioned && !invoiceNumberPresent) missing.add("invoice number");

  // Merge the LLM's own flags, but drop any that deterministic resolution
  // already satisfied (e.g. "recipient wallet address" after directory lookup).
  for (const gap of raw.missingInformation || []) {
    const g = gap.trim();
    if (!g) continue;
    const lower = g.toLowerCase();
    const satisfied =
      (lower.includes("address") && !!recipientAddress) ||
      (lower.includes("recipient") && !!recipient) ||
      (lower.includes("amount") && (amount !== null || sourceAmount !== null)) ||
      (lower.includes("currenc") && (!!currency || !!sourceCurrency)) ||
      (lower.includes("purpose") && !!purpose) ||
      (lower.includes("date") && !!dueDate) ||
      (lower.includes("chain") && !!targetChain);
    if (!satisfied) missing.add(g);
  }

  // --- Confidence: deterministic security score blended with model confidence --
  let score = 0.05;
  if (amount !== null) score += 0.25;
  if (currency) score += 0.2;
  if (recipient) score += 0.2;
  if (recipientAddress) score += 0.1;
  if (purpose) score += 0.1;
  if (dueDate) score += 0.05;
  score = Math.min(0.95, score);
  score = Math.max(0.05, score - missing.size * 0.05);

  const llmConfidence = clamp01(raw.confidence);
  const confidence = Math.min(0.99, round2(0.4 * llmConfidence + 0.6 * score));
  const clampedConfidence = clamp01(confidence);

  const intent: StructuredIntent = {
    action: raw.action,
    recipient,
    recipientAddress,
    amount,
    currency,
    sourceCurrency,
    sourceAmount,
    targetChain,
    purpose,
    dueDate,
    confidence: clampedConfidence,
    missingInformation: [...missing],
    rawInput,
    source: "llm",
  };

  // Final shape guarantee — this throws if anything above is inconsistent.
  return StructuredIntentSchema.parse(intent);
}

// -----------------------------------------------------------------------------
// Deterministic fallback (Phase-4 parser, no LLM)
// -----------------------------------------------------------------------------

export function parseFallback(rawInput: string): StructuredIntent {
  const p = parsePaymentIntent(rawInput);

  // Normalize Phase-4 wording to the canonical lowercase gap labels used by
  // the LLM path so downstream consumers see one consistent vocabulary.
  const MISSING_MAP: Record<string, string> = {
    "Amount not specified": "amount",
    "Currency not specified": "currency",
    "Recipient not specified": "recipient name",
    "Recipient wallet address not on file": "recipient wallet address",
    "No deadline given": "due date",
  };
  const missing: string[] = p.missingInformation.map((m) => MISSING_MAP[m] || m);

  const intent: StructuredIntent = {
    action: "payment", // Phase-4 parser has no swap/bridge detection
    recipient: p.recipientName,
    recipientAddress: p.recipientAddress ? p.recipientAddress.toLowerCase() : null,
    amount: normalizeAmount(p.amount),
    currency: normalizeCurrency(p.currency),
    sourceCurrency: null,
    sourceAmount: null,
    targetChain: null,
    purpose: p.purpose,
    dueDate: p.deadlineLabel,
    confidence: clamp01(Math.min(FALLBACK_MAX_CONFIDENCE, p.confidence)),
    missingInformation: missing,
    rawInput,
    source: "fallback",
  };

  return StructuredIntentSchema.parse(intent);
}

// -----------------------------------------------------------------------------
// Normalizers
// -----------------------------------------------------------------------------

function normalizeAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value > MAX_AMOUNT) return null; // implausible -> treated as missing
  return round2(value);
}

function normalizeCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  if (CURRENCY_ALIASES[upper]) return CURRENCY_ALIASES[upper];
  if ((SUPPORTED_CURRENCIES as readonly string[]).includes(upper)) return upper;
  return null; // unsupported / ambiguous -> treated as missing
}

function normalizeChain(
  value: string | null | undefined
): (typeof SUPPORTED_CHAINS)[number] | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if ((SUPPORTED_CHAINS as readonly string[]).includes(v)) {
    return v as (typeof SUPPORTED_CHAINS)[number];
  }
  if (v === "poly" || v === "matic") return "polygon";
  if (v === "eth" || v === "mainnet") return "ethereum";
  if (v === "arb") return "arbitrum";
  return null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
