// =============================================================================
// IBAP Phase 5 — Deterministic validation-gate self-test
// Runs `finalizeIntent` against simulated LLM outputs (no OpenAI key needed).
//   cd frontend && npx tsx scripts/intent-selftest.ts
// =============================================================================

import { finalizeIntent } from "../src/lib/ai/intent-parser";
import type { RawLLMIntent } from "../src/lib/ai/intent-schema";

interface Case {
  name: string;
  input: string;
  raw: RawLLMIntent;
  expect: {
    action?: RawLLMIntent["action"];
    recipientAddress?: string | null;
    amount?: number | null;
    currency?: string | null;
    sourceCurrency?: string | null;
    sourceAmount?: number | null;
    targetChain?: string | null;
    confidenceMin?: number;
    confidenceMax?: number;
    missingContains?: string[];
    missingNotContains?: string[];
  };
}

const CASES: Case[] = [
  {
    name: "complete payment resolves directory address",
    input: "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
    raw: {
      action: "payment",
      recipient: "Alice",
      recipientAddress: null,
      amount: 2500,
      currency: "RM",
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: null,
      purpose: "Invoice INV-1024",
      dueDate: "Friday",
      confidence: 0.9,
      missingInformation: ["recipient wallet address"],
    },
    expect: {
      action: "payment",
      recipientAddress: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
      amount: 2500,
      currency: "MYR",
      confidenceMin: 0.85,
      missingContains: [],
      missingNotContains: ["recipient wallet address"],
    },
  },
  {
    name: "unknown recipient keeps address missing",
    input: "Pay Ravi 400 USDC",
    raw: {
      action: "payment",
      recipient: "Ravi",
      recipientAddress: null,
      amount: 400,
      currency: "USDC",
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: null,
      purpose: null,
      dueDate: null,
      confidence: 0.55,
      missingInformation: ["recipient wallet address", "purpose"],
    },
    expect: {
      recipientAddress: null,
      currency: "USDC",
      missingContains: ["recipient wallet address"],
    },
  },
  {
    name: "malformed address rejected",
    input: "Pay 0x123 to Alice",
    raw: {
      action: "payment",
      recipient: "Alice",
      recipientAddress: "0x123",
      amount: null,
      currency: null,
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: null,
      purpose: null,
      dueDate: null,
      confidence: 0.3,
      missingInformation: [],
    },
    expect: {
      // malformed address dropped -> directory used for Alice
      recipientAddress: "0x71c7656ec7ab88b098defb751b7401b5f6d8976f",
      missingContains: ["amount", "currency"],
    },
  },
  {
    name: "swap_and_payment requires source asset",
    input: "Convert 5,000 USDT to USDC and pay the contractor",
    raw: {
      action: "swap_and_payment",
      recipient: "Contractor",
      recipientAddress: null,
      amount: null,
      currency: "USDC",
      sourceCurrency: "USDT",
      sourceAmount: 5000,
      targetChain: null,
      purpose: null,
      dueDate: null,
      confidence: 0.6,
      missingInformation: ["payment amount", "recipient wallet address", "purpose"],
    },
    expect: {
      action: "swap_and_payment",
      sourceCurrency: "USDT",
      sourceAmount: 5000,
      // "Contractor" resolves to Marcus Lee in the vendor directory, so the
      // address is NOT missing — but the payment amount still is.
      missingContains: ["payment amount", "purpose"],
      missingNotContains: ["recipient wallet address"],
    },
  },
  {
    name: "bridge_and_payment requires target chain",
    input: "Bridge 2,000 USDC to Polygon and pay Emma for rent",
    raw: {
      action: "bridge_and_payment",
      recipient: "Emma",
      recipientAddress: null,
      amount: 2000,
      currency: "USDC",
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: "polygon",
      purpose: "Rent",
      dueDate: null,
      confidence: 0.75,
      missingInformation: ["recipient wallet address", "due date"],
    },
    expect: {
      action: "bridge_and_payment",
      targetChain: "polygon",
      missingContains: ["due date"],
      missingNotContains: ["target chain"],
    },
  },
  {
    name: "unsupported currency becomes missing",
    input: "Pay the vendor 1,000 RMB",
    raw: {
      action: "payment",
      recipient: "Vendor",
      recipientAddress: null,
      amount: 1000,
      currency: "RMB",
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: null,
      purpose: null,
      dueDate: null,
      confidence: 0.5,
      missingInformation: [],
    },
    expect: {
      currency: null,
      missingContains: ["currency"],
    },
  },
  {
    name: "implausible amount rejected",
    input: "Pay Alice 5,000,000,000 USD",
    raw: {
      action: "payment",
      recipient: "Alice",
      recipientAddress: null,
      amount: 5_000_000_000,
      currency: "USD",
      sourceCurrency: null,
      sourceAmount: null,
      targetChain: null,
      purpose: null,
      dueDate: null,
      confidence: 0.9,
      missingInformation: [],
    },
    expect: {
      amount: null,
      missingContains: ["amount"],
      confidenceMax: 0.7,
    },
  },
];

let failures = 0;

function ok(cond: boolean, label: string) {
  if (!cond) {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

for (const c of CASES) {
  const out = finalizeIntent(c.raw, c.input);
  const e = c.expect;
  const line: string[] = [];
  line.push(`• ${c.name}`);

  if (e.action !== undefined) {
    ok(out.action === e.action, `action == ${e.action} (got ${out.action})`);
  }
  if (e.recipientAddress !== undefined) {
    ok(out.recipientAddress === e.recipientAddress, `address == ${e.recipientAddress} (got ${out.recipientAddress})`);
  }
  if (e.amount !== undefined) {
    ok(out.amount === e.amount, `amount == ${e.amount} (got ${out.amount})`);
  }
  if (e.currency !== undefined) {
    ok(out.currency === e.currency, `currency == ${e.currency} (got ${out.currency})`);
  }
  if (e.sourceCurrency !== undefined) {
    ok(out.sourceCurrency === e.sourceCurrency, `sourceCurrency == ${e.sourceCurrency} (got ${out.sourceCurrency})`);
  }
  if (e.targetChain !== undefined) {
    ok(out.targetChain === e.targetChain, `targetChain == ${e.targetChain} (got ${out.targetChain})`);
  }
  if (e.confidenceMin !== undefined) {
    ok(out.confidence >= e.confidenceMin, `confidence >= ${e.confidenceMin} (got ${out.confidence})`);
  }
  if (e.confidenceMax !== undefined) {
    ok(out.confidence <= e.confidenceMax, `confidence <= ${e.confidenceMax} (got ${out.confidence})`);
  }
  for (const m of e.missingContains ?? []) {
    ok(out.missingInformation.includes(m), `missing contains "${m}" (got ${JSON.stringify(out.missingInformation)})`);
  }
  for (const m of e.missingNotContains ?? []) {
    ok(!out.missingInformation.includes(m), `missing does NOT contain "${m}" (got ${JSON.stringify(out.missingInformation)})`);
  }
  // Every finalized intent must pass the strict schema.
  if (out.source !== "llm") {
    ok(false, "source == llm");
  }
  line.push(out.confidence.toFixed(2));
  console.log(line.join(" — "));
}

console.log(failures === 0 ? "\n✅ All self-tests passed" : `\n❌ ${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
