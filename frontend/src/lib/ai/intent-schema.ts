// =============================================================================
// PayMaster Phase 5 — AI Intent & Payment Extraction Engine
// Schema + system prompt for converting natural-language business payment
// instructions into a validated, structured intent.
//
// Trust boundary (the LLM NEVER executes anything):
//   Natural Language -> LLM (interpret only) -> Structured Intent
//   -> Zod validation -> Deterministic normalization (security gate)
//   -> Payment request
//
// The LLM only interprets the user's words. It MUST NOT fabricate recipients,
// wallet addresses, amounts, currencies, invoices, chains or dates. Every field
// it returns is re-validated deterministically in intent-parser.ts, and the
// confidence score is treated as a security guarantee: low confidence blocks
// downstream execution.
// =============================================================================

import { z } from "zod";

// -----------------------------------------------------------------------------
// Canonical constants
// -----------------------------------------------------------------------------

/** Only these three actions exist — deliberately no more. */
export const INTENT_ACTIONS = ["payment", "swap_and_payment", "bridge_and_payment"] as const;
export type IntentAction = (typeof INTENT_ACTIONS)[number];

/** Currency codes the treasury understands (canonical form). */
export const SUPPORTED_CURRENCIES = [
  "MYR",
  "USD",
  "USDC",
  "USDT",
  "SGD",
  "EUR",
  "GBP",
  "ETH",
  "POL",
] as const;

/** User/LLM spellings -> canonical currency code. */
export const CURRENCY_ALIASES: Record<string, string> = {
  RM: "MYR",
  MYR: "MYR",
  "$": "USD",
  USD: "USD",
  USDC: "USDC",
  USDT: "USDT",
  SGD: "SGD",
  "S$": "SGD",
  EUR: "EUR",
  "€": "EUR",
  GBP: "GBP",
  "£": "GBP",
  ETH: "ETH",
  POL: "POL",
  MATIC: "POL",
};

/** Chains a bridge_and_payment can deliver on. */
export const SUPPORTED_CHAINS = ["polygon", "ethereum", "arbitrum", "base", "optimism"] as const;

/** EOA wallet address: 0x + 40 hex chars. Anything else is treated as missing. */
export const WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Plausibility ceiling for a single payment — larger amounts are treated as invalid. */
export const MAX_AMOUNT = 1_000_000_000;

// -----------------------------------------------------------------------------
// Raw LLM structured-output schema
// Lenient on purpose: the deterministic layer in intent-parser.ts owns strict
// validation. If a field cannot be determined the model MUST emit null AND add
// a human-readable entry to `missingInformation`.
// -----------------------------------------------------------------------------

const NullableString = z.string().trim().max(200).nullable();
const NullableAmount = z.number().positive().max(MAX_AMOUNT).nullable();
const NullableCurrency = z.string().trim().min(1).max(12).nullable();
const NullableChain = z.string().trim().min(1).max(24).nullable();

export const RawLLMIntentSchema = z.object({
  /** payment | swap_and_payment | bridge_and_payment */
  action: z.enum(INTENT_ACTIONS),
  /** Payee name exactly as stated by the user (never invented). */
  recipient: NullableString,
  /** Verbatim wallet address IF the user typed one. Never invented. */
  recipientAddress: NullableString,
  /** Plain positive number in `currency`. No symbols, no commas. */
  amount: NullableAmount,
  /** Currency the amount is denominated in (e.g. MYR, USDC). */
  currency: NullableCurrency,
  /** swap_and_payment: asset being sold/swapped FROM. */
  sourceCurrency: NullableCurrency,
  /** swap_and_payment: quantity being swapped FROM. */
  sourceAmount: NullableAmount,
  /** bridge_and_payment: chain the payment must be delivered on. */
  targetChain: NullableChain,
  /** Short description of what the payment is for, as stated (e.g. "Invoice INV-1024"). */
  purpose: NullableString,
  /** User's own wording for the deadline, e.g. "Friday", "end of month". */
  dueDate: NullableString,
  /** 0..1 — how completely/unambiguously the instruction was interpreted. Security gate. */
  confidence: z.number().min(0).max(1),
  /** Human-readable list of what is missing/ambiguous, e.g. ["recipient wallet address"]. */
  missingInformation: z.array(z.string().trim().max(200)),
});

export type RawLLMIntent = z.infer<typeof RawLLMIntentSchema>;

// -----------------------------------------------------------------------------
// Final validated structured intent (what the API returns)
// -----------------------------------------------------------------------------

export const StructuredIntentSchema = z.object({
  action: z.enum(INTENT_ACTIONS),
  recipient: z.string().max(200).nullable(),
  recipientAddress: z
    .string()
    .regex(WALLET_ADDRESS_RE, "must be a 0x-prefixed 40-hex wallet address")
    .nullable(),
  amount: z.number().positive().max(MAX_AMOUNT).nullable(),
  currency: z.string().max(12).nullable(),
  sourceCurrency: z.string().max(12).nullable(),
  sourceAmount: z.number().positive().max(MAX_AMOUNT).nullable(),
  targetChain: z.enum(SUPPORTED_CHAINS).nullable(),
  purpose: z.string().max(300).nullable(),
  dueDate: z.string().max(200).nullable(),
  confidence: z.number().min(0).max(1),
  missingInformation: z.array(z.string()),
  rawInput: z.string(),
  /** "llm" = OpenAI structured output, "fallback" = deterministic parser (no key / outage). */
  source: z.enum(["llm", "fallback"]),
});

export type StructuredIntent = z.infer<typeof StructuredIntentSchema>;

// -----------------------------------------------------------------------------
// System prompt (OpenAI structured outputs)
// -----------------------------------------------------------------------------

export const INTENT_SYSTEM_PROMPT = `
You are the PayMaster Intent Extraction Engine, a component of a deterministic
PayMaster treasury system.

Your ONLY job is to convert a user's natural-language business payment instruction
into a single, precise, structured JSON intent. You never execute payments, never
move funds, and never make routing or settlement decisions. Deterministic code
downstream re-validates every field you emit and builds the actual payment request.

CORE RULES (non-negotiable):
1. EXTRACT ONLY WHAT IS EXPLICITLY STATED. Never fabricate, guess or infer any of:
   recipient names/entities, wallet addresses (0x...), payment amounts, currencies,
   invoice numbers/references, due dates, or chains.
2. If a field is not clearly stated, set it to null AND add a short human-readable
   entry to "missingInformation" describing exactly what is needed
   (e.g. "recipient wallet address", "amount", "invoice number").
3. NEVER invent a wallet address. Only copy an address the user typed verbatim
   (format: 0x followed by exactly 40 hex characters). If the user names a payee
   but gives no address, leave "recipientAddress" null and add
   "recipient wallet address" to "missingInformation".
4. "amount" must be a plain positive number with no commas and no currency symbols:
   "RM2,500" -> 2500, "$1,200" -> 1200. Convert spelled-out numbers only when
   unambiguous; otherwise null + missingInformation.
5. "currency" is the 3-4 letter code the user meant (MYR, USD, USDC, USDT, SGD,
   EUR, GBP, ETH, POL, ...). Prefer the code they wrote. If it cannot be
   determined, set null and add "currency" to missingInformation.
6. "dueDate" keeps the user's own wording as a short label ("Friday",
   "end of month", "2026-08-15"). Only set null when no deadline is mentioned.
7. Actions — use ONLY one of:
   - "payment": a direct payment in a single currency.
   - "swap_and_payment": the payment requires a currency swap first
     (e.g. "convert 5,000 USDT to USDC and pay X"). Fill "sourceCurrency" /
     "sourceAmount" for what is swapped from, and "currency" for what is paid.
   - "bridge_and_payment": the payment must be delivered on another chain
     (e.g. "send 2,000 USDC to X on Polygon"). Fill "targetChain" from
     polygon | ethereum | arbitrum | base | optimism.
8. "confidence" (0..1): rate how completely and unambiguously you could interpret
   the instruction. Use 0.9+ only when amount, currency and recipient are all
   explicit, and every field critical to the chosen action is present.
   Use lower values when any critical field is missing or ambiguous. Confidence is
   a security guarantee — never inflate it.
9. "purpose": a short description of what the payment is for, exactly as stated
   ("Invoice INV-1024", "March office rent", "Consulting retainer"). Do not invent
   one; set null if not stated.
10. Output ONLY the JSON object. No commentary, no markdown, no code fences.

Business payment examples:

Input: "Pay Alice RM2,500 for invoice INV-1024 by Friday."
Output: {"action":"payment","recipient":"Alice","recipientAddress":null,
"amount":2500,"currency":"MYR","sourceCurrency":null,"sourceAmount":null,
"targetChain":null,"purpose":"Invoice INV-1024","dueDate":"Friday",
"confidence":0.9,"missingInformation":["recipient wallet address"]}

Input: "Send $1,200 to Marcus for the website audit"
Output: {"action":"payment","recipient":"Marcus","recipientAddress":null,
"amount":1200,"currency":"USD","sourceCurrency":null,"sourceAmount":null,
"targetChain":null,"purpose":"Website audit","dueDate":null,
"confidence":0.8,"missingInformation":["recipient wallet address","due date"]}

Input: "Convert 5,000 USDT to USDC and pay the contractor"
Output: {"action":"swap_and_payment","recipient":"Contractor",
"recipientAddress":null,"amount":null,"currency":"USDC",
"sourceCurrency":"USDT","sourceAmount":5000,"targetChain":null,
"purpose":null,"dueDate":null,"confidence":0.6,
"missingInformation":["payment amount","recipient wallet address","purpose","due date"]}

Input: "Bridge 2,000 USDC to Polygon and pay Emma for rent"
Output: {"action":"bridge_and_payment","recipient":"Emma","recipientAddress":null,
"amount":2000,"currency":"USDC","sourceCurrency":null,"sourceAmount":null,
"targetChain":"polygon","purpose":"Rent","dueDate":null,"confidence":0.75,
"missingInformation":["recipient wallet address","due date"]}

Input: "Pay invoice INV-2048"
Output: {"action":"payment","recipient":null,"recipientAddress":null,
"amount":null,"currency":null,"sourceCurrency":null,"sourceAmount":null,
"targetChain":null,"purpose":"Invoice INV-2048","dueDate":null,"confidence":0.25,
"missingInformation":["recipient name","recipient wallet address","amount","currency","due date"]}
`.trim();

// -----------------------------------------------------------------------------
// Sample test cases (business payment examples) — used for docs & self-tests.
// -----------------------------------------------------------------------------

export interface SampleTestCase {
  id: string;
  input: string;
  expected: {
    action: IntentAction;
    recipient: string | null;
    recipientAddress: string | null;
    amount: number | null;
    currency: string | null;
    sourceCurrency?: string | null;
    sourceAmount?: number | null;
    targetChain?: string | null;
    purpose: string | null;
    dueDate: string | null;
    minConfidence: number;
    missingContains: string[];
  };
}

export const SAMPLE_TEST_CASES: SampleTestCase[] = [
  {
    id: "complete-payment",
    input: "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
    expected: {
      action: "payment",
      recipient: "Alice",
      recipientAddress: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f", // resolved from vendor directory
      amount: 2500,
      currency: "MYR",
      purpose: "Invoice INV-1024",
      dueDate: "Friday",
      minConfidence: 0.85,
      missingContains: [],
    },
  },
  {
    id: "payment-missing-address",
    input: "Send $1,200 to Marcus for the website audit",
    expected: {
      action: "payment",
      recipient: "Marcus",
      recipientAddress: "0x1d5c3e09a75b1de12ffce9b4a2bccc8ef0ae3d91", // resolved
      amount: 1200,
      currency: "USD",
      purpose: "Website audit",
      dueDate: null,
      minConfidence: 0.7,
      missingContains: ["due date"],
    },
  },
  {
    id: "swap-and-payment",
    input: "Convert 5,000 USDT to USDC and pay the contractor",
    expected: {
      action: "swap_and_payment",
      recipient: "Contractor",
      recipientAddress: "0x1d5c3e09a75b1de12ffce9b4a2bccc8ef0ae3d91", // "contractor" -> Marcus Lee
      amount: null,
      currency: "USDC",
      sourceCurrency: "USDT",
      sourceAmount: 5000,
      targetChain: null,
      purpose: null,
      dueDate: null,
      minConfidence: 0.4,
      missingContains: ["payment amount", "purpose", "due date"],
    },
  },
  {
    id: "bridge-and-payment",
    input: "Bridge 2,000 USDC to Polygon and pay Emma for rent",
    expected: {
      action: "bridge_and_payment",
      recipient: "Emma",
      recipientAddress: "0x8ac1df2b3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b", // resolved
      amount: 2000,
      currency: "USDC",
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: "polygon",
      purpose: "Rent",
      dueDate: null,
      minConfidence: 0.6,
      missingContains: ["due date"],
    },
  },
  {
    id: "vague-instruction",
    input: "Pay invoice INV-2048",
    expected: {
      action: "payment",
      recipient: null,
      recipientAddress: null,
      amount: null,
      currency: null,
      purpose: "Invoice INV-2048",
      dueDate: null,
      minConfidence: 0.15,
      missingContains: ["recipient", "amount", "currency"],
    },
  },
  {
    id: "malformed-address-rejected",
    input: "Pay 0x123 to Alice for the retainer",
    expected: {
      action: "payment",
      recipient: "Alice",
      recipientAddress: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f", // malformed 0x123 ignored, directory used
      amount: null,
      currency: null,
      purpose: "Retainer",
      dueDate: null,
      minConfidence: 0.4,
      missingContains: ["amount", "currency"],
    },
  },
];
