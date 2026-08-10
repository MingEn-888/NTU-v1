import { ethers } from "hardhat";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Phase 9 — SmartWallet + MockERC20 local deployment.
 *
 * Usage:
 *   npm --prefix contracts run deploy:wallet:local   (against a running `hardhat node`)
 *   npx hardhat run scripts/deploySmartWallet.ts --network localhost
 *
 * Writes deployment addresses to `contracts/deployments/localhost.json` so the
 * frontend / backend can import them. Optionally authorizes an executor
 * (e.g. the IntentRouter) via the SMART_WALLET_EXECUTOR env var.
 */
async function main() {
  console.log("[Hardhat] Deploying SmartWallet + MockERC20...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // ---- 1. Deploy the wallet -------------------------------------------------
  const SmartWallet = await ethers.getContractFactory("SmartWallet");
  const wallet = await SmartWallet.deploy();
  await wallet.waitForDeployment();
  const walletAddress = await wallet.getAddress();
  console.log(`[Hardhat] SmartWallet deployed to: ${walletAddress}`);
  console.log(`[Hardhat] Owner: ${await wallet.owner()}`);

  // ---- 2. Deploy a mock settlement token (USDC-like) ------------------------
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdc = await MockERC20.deploy("Mock USDC", "mUSDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`[Hardhat] MockERC20 (mUSDC) deployed to: ${usdcAddress}`);

  // ---- 3. Optional: authorize an executor (e.g. IntentRouter address) -------
  const executor = process.env.SMART_WALLET_EXECUTOR;
  if (executor) {
    if (!ethers.isAddress(executor)) {
      throw new Error(`SMART_WALLET_EXECUTOR is not a valid address: ${executor}`);
    }
    await (await wallet.setExecutorAuthorization(executor, true)).wait();
    console.log(`[Hardhat] Executor authorized: ${executor}`);
  }

  // ---- 4. Persist deployment addresses --------------------------------------
  const deploymentsDir = join(__dirname, "..", "deployments");
  if (!existsSync(deploymentsDir)) mkdirSync(deploymentsDir, { recursive: true });
  const record = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    smartWallet: walletAddress,
    mockUSDC: usdcAddress,
    executor: executor ? executor : null,
  };
  const outPath = join(deploymentsDir, "localhost.json");
  writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n");
  console.log(`[Hardhat] Deployment record written to ${outPath}`);

  // ---- 5. Fund wallet for demo ----------------------------------------------
  const funding = ethers.parseEther("10");
  await (await deployer.sendTransaction({ to: walletAddress, value: funding })).wait();
  await (await usdc.mint(walletAddress, ethers.parseUnits("10000", 6))).wait();
  console.log(`[Hardhat] Wallet funded: ${ethers.formatEther(funding)} ETH + 10,000 mUSDC`);

  console.log("\n[Hardhat] Deployment complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
