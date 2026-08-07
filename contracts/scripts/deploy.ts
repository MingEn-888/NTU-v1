import { ethers } from "hardhat";

async function main() {
  console.log("[Hardhat] Deploying IntentRouter contract...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Account: ${deployer.address}`);

  const IntentRouter = await ethers.getContractFactory("IntentRouter");
  const router = await IntentRouter.deploy();

  await router.waitForDeployment();

  const routerAddress = await router.getAddress();
  console.log(`[Hardhat] IntentRouter successfully deployed to: ${routerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
