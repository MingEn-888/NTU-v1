// =============================================================================
// PayMaster — Gemini live connection check
// Sends a REAL request to the model configured in .env.local to confirm the
// prompt is actually wired to a Google model.
//   cd frontend && npx tsx scripts/gemini-live-test.ts
// Auto-loads frontend/.env.local (then the repo-root .env.local), so no manual
// shell export is needed.
// =============================================================================

import { existsSync } from "node:fs";
import { join } from "node:path";
import { geminiJson, getGeminiApiKey, DEFAULT_GEMINI_MODEL } from "../src/lib/ai/gemini";
import { INTENT_SYSTEM_PROMPT, RawLLMIntentSchema } from "../src/lib/ai/intent-schema";

// tsx does not auto-load .env.local — load it explicitly (frontend first, then root).
for (const p of [join(process.cwd(), ".env.local"), join(process.cwd(), "..", ".env.local")]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
    } catch {
      /* ignore malformed env files */
    }
  }
}

async function main() {
  const key = getGeminiApiKey();
  if (!key) {
    console.error(
      "❌ No Gemini key detected. Paste your key into frontend/.env.local as\n" +
        "   GEMINI_API_KEY=AIza...\n" +
        "   then re-run this script."
    );
    process.exit(1);
  }

  console.log(`✅ Gemini key detected. Model: ${DEFAULT_GEMINI_MODEL}`);
  console.log("Sending a live structured-output request...\n");

  const parsed = await geminiJson({
    system: INTENT_SYSTEM_PROMPT,
    user: "Pay Alice RM2,500 for invoice INV-1024 by Friday.",
    schema: RawLLMIntentSchema,
  });

  if (parsed === null) {
    console.error("❌ The model responded but produced no usable JSON.");
    process.exit(1);
  }

  console.log("✅ Live result (source should be a valid RawLLMIntent):");
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((err) => {
  console.error("❌ Gemini call failed:", err);
  process.exit(1);
});
