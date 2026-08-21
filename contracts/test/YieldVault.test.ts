import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { YieldVault, MockERC20 } from "../typechain-types";

describe("YieldVault (PayMaster Phase 13)", () => {
  async function deployVaultFixture() {
    const [owner, alice] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = (await MockERC20.deploy("Mock USDC", "mUSDC", 6)) as MockERC20;
    await token.waitForDeployment();

    const YieldVault = await ethers.getContractFactory("YieldVault");
    const vault = (await YieldVault.deploy(await token.getAddress())) as YieldVault;
    await vault.waitForDeployment();

    // Fund the manager (owner) so it can deposit.
    await token.mint(owner.address, ethers.parseUnits("10000", 6));

    return { vault, token, owner, alice };
  }

  describe("Deployment", () => {
    it("sets the asset and deployer as manager", async () => {
      const { vault, token, owner } = await loadFixture(deployVaultFixture);
      expect(await vault.asset()).to.equal(await token.getAddress());
      expect(await vault.manager()).to.equal(owner.address);
      expect(await vault.apyBps()).to.equal(0n);
      expect(await vault.totalShares()).to.equal(0n);
    });

    it("rejects the zero asset address", async () => {
      const YieldVault = await ethers.getContractFactory("YieldVault");
      await expect(YieldVault.deploy(ethers.ZeroAddress)).to.be.reverted;
    });
  });

  describe("Authorization", () => {
    it("non-manager cannot deposit", async () => {
      const { vault, token, alice } = await loadFixture(deployVaultFixture);
      await token.mint(alice.address, ethers.parseUnits("100", 6));
      await token.connect(alice).approve(await vault.getAddress(), ethers.parseUnits("100", 6));
      await expect(vault.connect(alice).deposit(ethers.parseUnits("100", 6)))
        .to.be.revertedWithCustomError(vault, "NotManager");
    });

    it("non-manager cannot set APY", async () => {
      const { vault, alice } = await loadFixture(deployVaultFixture);
      await expect(vault.connect(alice).setApy(500)).to.be.revertedWithCustomError(vault, "NotManager");
    });

    it("manager can transfer management", async () => {
      const { vault, owner, alice } = await loadFixture(deployVaultFixture);
      await expect(vault.setManager(alice.address))
        .to.emit(vault, "ManagerUpdated")
        .withArgs(owner.address, alice.address);
      expect(await vault.manager()).to.equal(alice.address);
    });
  });

  describe("Deposit / Withdraw", () => {
    it("mints shares 1:1 on first deposit", async () => {
      const { vault, token } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseUnits("1000", 6);
      await token.approve(await vault.getAddress(), amount);
      await expect(vault.deposit(amount)).to.emit(vault, "Deposited").withArgs(
        await vault.manager(),
        amount,
        amount
      );
      expect(await vault.totalShares()).to.equal(amount);
      expect(await vault.totalAssets()).to.equal(amount);
    });

    it("withdraws pro-rata assets and burns shares", async () => {
      const { vault, token } = await loadFixture(deployVaultFixture);
      const amount = ethers.parseUnits("1000", 6);
      await token.approve(await vault.getAddress(), amount);
      await vault.deposit(amount);

      await expect(vault.withdraw(amount)).to.emit(vault, "Withdrawn").withArgs(
        await vault.manager(),
        amount,
        amount
      );
      expect(await vault.totalShares()).to.equal(0n);
      expect(await vault.totalAssets()).to.equal(0n);
    });

    it("rejects withdrawing more shares than held", async () => {
      const { vault, token } = await loadFixture(deployVaultFixture);
      await token.approve(await vault.getAddress(), ethers.parseUnits("1000", 6));
      await vault.deposit(ethers.parseUnits("1000", 6));
      await expect(vault.withdraw(ethers.parseUnits("1001", 6)))
        .to.be.revertedWithCustomError(vault, "InsufficientShares");
    });

    it("rejects zero deposit and zero withdraw", async () => {
      const { vault } = await loadFixture(deployVaultFixture);
      await expect(vault.deposit(0n)).to.be.revertedWithCustomError(vault, "ZeroAmount");
      await expect(vault.withdraw(0n)).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });
  });

  describe("APY", () => {
    it("updates APY and records a harvest", async () => {
      const { vault } = await loadFixture(deployVaultFixture);
      await expect(vault.setApy(500)).to.emit(vault, "ApyUpdated").withArgs(500n);
      expect(await vault.apyBps()).to.equal(500n);
      expect(await vault.apyPercent()).to.equal(5n);
      expect(await vault.lastHarvest()).to.be.greaterThan(0n);
    });
  });
});
