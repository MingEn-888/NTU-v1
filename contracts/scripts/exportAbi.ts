import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Phase 9 — Export clean ABIs for frontend integration.
 *
 * Usage:
 *   npm --prefix contracts run abi:export
 *
 * Reads compiled Hardhat artifacts and writes minimal
 * `{ abi, bytecode }` JSON files into `contracts/abis/`.
 * The frontend can import these directly, e.g.:
 *   import SmartWalletAbi from "@intent-router/contracts/abis/SmartWallet.json";
 */
interface Artifact {
  abi: unknown[];
  bytecode: string;
}

const contractsToExport = [
  "contracts/SmartWallet.sol/SmartWallet.json",
  "contracts/mocks/MockERC20.sol/MockERC20.json",
];

const artifactRoot = join(__dirname, "..", "artifacts");
const outDir = join(__dirname, "..", "abis");

function main() {
  if (!existsSync(artifactRoot)) {
    console.error("Artifacts not found. Run `npm --prefix contracts run compile` first.");
    process.exit(1);
  }
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const exported: Record<string, string> = {};

  for (const rel of contractsToExport) {
    const artifactPath = join(artifactRoot, rel);
    if (!existsSync(artifactPath)) {
      console.error(`Missing artifact: ${artifactPath}`);
      process.exit(1);
    }
    const { abi, bytecode } = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
    const name = rel.split("/").pop()!.replace(".json", "");
    const outPath = join(outDir, `${name}.json`);
    writeFileSync(outPath, JSON.stringify({ abi, bytecode }, null, 2) + "\n");
    exported[name] = outPath;
    console.log(`[ABI] Exported ${name} -> ${outPath} (${abi.length} entries)`);
  }

  // Convenience index so frontend can import all at once.
  writeFileSync(
    join(outDir, "index.json"),
    JSON.stringify(
      Object.fromEntries(
        Object.entries(exported).map(([k, p]) => [k, JSON.parse(readFileSync(p, "utf8"))])
      ),
      null,
      2
    ) + "\n"
  );
  console.log("[ABI] Wrote abis/index.json");
}

main();
