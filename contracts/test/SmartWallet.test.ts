import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { SmartWallet, MockERC20, ReentrancyAttacker } from "../typechain-types";

describe("SmartWallet (PayMaster Phase 9)", () => {
  // ------------------------------------------------------------------
  // Fixtures
  // ------------------------------------------------------------------
  async function deployWalletFixture() {
    const [owner, alice, bob, executor, stranger] = await ethers.getSigners();

    const SmartWallet = await ethers.getContractFactory("SmartWallet");
    const wallet = (await SmartWallet.deploy()) as SmartWallet;
    await wallet.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = (await MockERC20.deploy("Mock USDC", "mUSDC", 6)) as MockERC20;
    await token.waitForDeployment();

    const ReentrancyAttacker = await ethers.getContractFactory("ReentrancyAttacker");
    const attacker = (await ReentrancyAttacker.deploy(await wallet.getAddress())) as ReentrancyAttacker;
    await attacker.waitForDeployment();

    return { wallet, token, attacker, owner, alice, bob, executor, stranger };
  }

  // ------------------------------------------------------------------
  // 1. Deployment & roles
  // ------------------------------------------------------------------
  describe("Deployment", () => {
    it("sets deployer as owner and starts nonce at 0", async () => {
      const { wallet, owner } = await loadFixture(deployWalletFixture);
      expect(await wallet.owner()).to.equal(owner.address);
      expect(await wallet.nonce()).to.equal(0n);
      expect(await wallet.getBalance()).to.equal(0n);
    });

    it("rejects calls from non-authorized addresses", async () => {
      const { wallet, stranger } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.connect(stranger).executeTransaction(stranger.address, 0n, "0x", 0n)
      ).to.be.revertedWithCustomError(wallet, "NotAuthorized");
    });
  });

  // ------------------------------------------------------------------
  // 2. Owner / executor authorization
  // ------------------------------------------------------------------
  describe("Authorization", () => {
    it("owner can authorize and deauthorize an executor", async () => {
      const { wallet, executor } = await loadFixture(deployWalletFixture);
      await expect(wallet.setExecutorAuthorization(executor.address, true))
        .to.emit(wallet, "ExecutorAuthorized")
        .withArgs(executor.address, true);
      expect(await wallet.authorizedExecutors(executor.address)).to.equal(true);

      await expect(wallet.setExecutorAuthorization(executor.address, false))
        .to.emit(wallet, "ExecutorAuthorized")
        .withArgs(executor.address, false);
      expect(await wallet.authorizedExecutors(executor.address)).to.equal(false);
    });

    it("only owner can change executor authorization", async () => {
      const { wallet, executor, stranger } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.connect(stranger).setExecutorAuthorization(executor.address, true)
      ).to.be.revertedWithCustomError(wallet, "NotAuthorized");
    });

    it("rejects authorizing the zero address", async () => {
      const { wallet } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.setExecutorAuthorization(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(wallet, "ZeroAddress");
    });

    it("authorized executor can execute a transaction", async () => {
      const { wallet, executor, alice, owner } = await loadFixture(deployWalletFixture);
      await wallet.setExecutorAuthorization(executor.address, true);

      const value = ethers.parseEther("1");
      await owner.sendTransaction({ to: await wallet.getAddress(), value });

      await expect(
        wallet.connect(executor).executeTransaction(alice.address, value, "0x", 0n)
      ).to.emit(wallet, "NativeTransfer").withArgs(alice.address, value, 1n);
    });
  });

  // ------------------------------------------------------------------
  // 3. Two-step ownership transfer
  // ------------------------------------------------------------------
  describe("Ownership transfer", () => {
    it("two-step transfer requires the new owner to accept", async () => {
      const { wallet, owner, alice, bob } = await loadFixture(deployWalletFixture);

      await expect(wallet.transferOwnership(alice.address))
        .to.emit(wallet, "OwnershipTransferStarted")
        .withArgs(owner.address, alice.address);
      expect(await wallet.pendingOwner()).to.equal(alice.address);
      // owner is still owner until accept
      expect(await wallet.owner()).to.equal(owner.address);

      // wrong party cannot accept
      await expect(
        wallet.connect(bob).acceptOwnership()
      ).to.be.revertedWithCustomError(wallet, "NotOwner");

      // new owner accepts
      await expect(wallet.connect(alice).acceptOwnership())
        .to.emit(wallet, "OwnershipTransferred")
        .withArgs(owner.address, alice.address);
      expect(await wallet.owner()).to.equal(alice.address);
      expect(await wallet.pendingOwner()).to.equal(ethers.ZeroAddress);
    });
  });

  // ------------------------------------------------------------------
  // 4. executeTransaction — native transfers & calls
  // ------------------------------------------------------------------
  describe("executeTransaction", () => {
    it("transfers native currency and emits events with incremented nonce", async () => {
      const { wallet, alice, owner } = await loadFixture(deployWalletFixture);
      const value = ethers.parseEther("2.5");
      await owner.sendTransaction({ to: await wallet.getAddress(), value });
      const aliceBefore = await ethers.provider.getBalance(alice.address);

      await expect(wallet.executeTransaction(alice.address, value, "0x", 0n))
        .to.emit(wallet, "TransactionExecuted")
        .withArgs(alice.address, value, "0x", 1n)
        .and.to.emit(wallet, "NativeTransfer")
        .withArgs(alice.address, value, 1n);

      expect(await ethers.provider.getBalance(alice.address)).to.equal(aliceBefore + value);
      expect(await wallet.nonce()).to.equal(1n);
    });

    it("forwards calldata to contract targets (e.g. token mint via call)", async () => {
      const { wallet, token } = await loadFixture(deployWalletFixture);
      // Execute a call to the token's mint() as the wallet (anyone can mint in mock).
      const mintCalldata = token.interface.encodeFunctionData("mint", [wallet.target, 1000n]);
      await expect(wallet.executeTransaction(await token.getAddress(), 0n, mintCalldata, 0n))
        .to.emit(wallet, "TransactionExecuted");
      expect(await token.balanceOf(await wallet.getAddress())).to.equal(1000n);
    });

    it("reverts atomically when the inner call reverts, bubbling the reason", async () => {
      const { wallet, token, bob } = await loadFixture(deployWalletFixture);
      // token.transfer with no balance -> MockERC20 InsufficientBalance (custom error)
      const transferCalldata = token.interface.encodeFunctionData("transfer", [bob.address, 1n]);
      await expect(
        wallet.executeTransaction(await token.getAddress(), 0n, transferCalldata, 0n)
      ).to.be.revertedWithCustomError(wallet, "CallFailed");
      expect(await wallet.nonce()).to.equal(0n); // nonce not consumed on revert
    });

    it("reverts on invalid nonce (replay protection)", async () => {
      const { wallet, alice, owner } = await loadFixture(deployWalletFixture);
      await owner.sendTransaction({ to: await wallet.getAddress(), value: ethers.parseEther("1") });
      // First execution consumes nonce 0 -> nonce becomes 1
      await wallet.executeTransaction(alice.address, ethers.parseEther("0.1"), "0x", 0n);
      // Replaying the SAME payload (nonce 0) must be rejected
      await expect(
        wallet.executeTransaction(alice.address, ethers.parseEther("0.1"), "0x", 0n)
      ).to.be.revertedWithCustomError(wallet, "InvalidNonce").withArgs(1n, 0n);
      // Passing a wrong future nonce also rejected
      await expect(
        wallet.executeTransaction(alice.address, 0n, "0x", 99n)
      ).to.be.revertedWithCustomError(wallet, "InvalidNonce").withArgs(1n, 99n);
    });

    it("rejects zero target address", async () => {
      const { wallet } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.executeTransaction(ethers.ZeroAddress, 0n, "0x", 0n)
      ).to.be.revertedWithCustomError(wallet, "ZeroAddress");
    });

    it("blocked by reentrancy guard even when the caller is authorized", async () => {
      const { wallet, attacker, owner } = await loadFixture(deployWalletFixture);
      // Authorize the malicious contract so only the guard stands in its way.
      await wallet.setExecutorAuthorization(await attacker.getAddress(), true);

      await owner.sendTransaction({ to: await wallet.getAddress(), value: ethers.parseEther("5") });
      const attackData = attacker.interface.encodeFunctionData("attack", [1n]); // reenter with next nonce

      // Outer execution succeeds; the guard prevents the reentrant drain.
      await expect(
        wallet.executeTransaction(await attacker.getAddress(), 0n, attackData, 0n)
      ).to.emit(wallet, "TransactionExecuted");

      // Wallet still holds its funds — the reentrant call was blocked.
      expect(await wallet.getBalance()).to.equal(ethers.parseEther("5"));
      expect(await wallet.nonce()).to.equal(1n);
    });
  });

  // ------------------------------------------------------------------
  // 5. batchExecute — atomic multi-step execution
  // ------------------------------------------------------------------
  describe("batchExecute", () => {
    it("executes multiple transactions atomically and emits BatchExecuted", async () => {
      const { wallet, alice, bob, owner } = await loadFixture(deployWalletFixture);
      const total = ethers.parseEther("3");
      await owner.sendTransaction({ to: await wallet.getAddress(), value: total });
      const aliceBefore = await ethers.provider.getBalance(alice.address);
      const bobBefore = await ethers.provider.getBalance(bob.address);

      const txs = [
        { target: alice.address, value: ethers.parseEther("1"), data: "0x" },
        { target: bob.address, value: ethers.parseEther("2"), data: "0x" },
      ];

      // Mirror Solidity `keccak256(abi.encode(txs))` — ethers v6 needs array-form tuples.
      const batchId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["tuple(address,uint256,bytes)[]"],
          [txs.map((t) => [t.target, t.value, t.data])]
        )
      );

      await expect(wallet.batchExecute(txs, 0n))
        .to.emit(wallet, "BatchExecuted")
        .withArgs(batchId, 2n, 1n);

      expect(await ethers.provider.getBalance(alice.address)).to.equal(aliceBefore + ethers.parseEther("1"));
      expect(await ethers.provider.getBalance(bob.address)).to.equal(bobBefore + ethers.parseEther("2"));
      expect(await wallet.nonce()).to.equal(1n);
    });

    it("reverts the whole batch if any step fails (no partial state)", async () => {
      const { wallet, token, alice, bob, owner } = await loadFixture(deployWalletFixture);
      await owner.sendTransaction({ to: await wallet.getAddress(), value: ethers.parseEther("1") });
      const aliceBefore = await ethers.provider.getBalance(alice.address);

      const badTransfer = token.interface.encodeFunctionData("transfer", [bob.address, 1n]);
      const txs = [
        { target: alice.address, value: ethers.parseEther("1"), data: "0x" }, // would succeed
        { target: await token.getAddress(), value: 0n, data: badTransfer },  // reverts
      ];

      await expect(wallet.batchExecute(txs, 0n))
        .to.be.revertedWithCustomError(wallet, "CallFailed");
      // Nothing executed, nonce unchanged, alice got nothing.
      expect(await ethers.provider.getBalance(alice.address)).to.equal(aliceBefore);
      expect(await wallet.nonce()).to.equal(0n);
    });

    it("rejects empty batches", async () => {
      const { wallet } = await loadFixture(deployWalletFixture);
      await expect(wallet.batchExecute([], 0n))
        .to.be.revertedWithCustomError(wallet, "EmptyBatch");
    });

    it("rejects a batch containing a zero target", async () => {
      const { wallet, alice } = await loadFixture(deployWalletFixture);
      const txs = [
        { target: alice.address, value: 0n, data: "0x" },
        { target: ethers.ZeroAddress, value: 0n, data: "0x" },
      ];
      await expect(wallet.batchExecute(txs, 0n))
        .to.be.revertedWithCustomError(wallet, "ZeroAddress");
    });
  });

  // ------------------------------------------------------------------
  // 6. approveToken / transferToken
  // ------------------------------------------------------------------
  describe("Token operations", () => {
    it("approveToken sets allowance and emits TokenApproval", async () => {
      const { wallet, token, alice, owner } = await loadFixture(deployWalletFixture);
      const amount = ethers.parseUnits("1000", 6);

      await expect(wallet.approveToken(await token.getAddress(), alice.address, amount, 0n))
        .to.emit(wallet, "TokenApproval")
        .withArgs(await token.getAddress(), alice.address, amount, owner.address);

      expect(await token.allowance(await wallet.getAddress(), alice.address)).to.equal(amount);
      expect(await wallet.nonce()).to.equal(1n);
    });

    it("transferToken moves tokens and emits TokenTransfer", async () => {
      const { wallet, token, bob, owner } = await loadFixture(deployWalletFixture);
      const walletAddr = await wallet.getAddress();
      const amount = ethers.parseUnits("500", 6);
      await token.mint(walletAddr, amount);

      await expect(wallet.transferToken(await token.getAddress(), bob.address, amount, 0n))
        .to.emit(wallet, "TokenTransfer")
        .withArgs(await token.getAddress(), bob.address, amount, owner.address);

      expect(await token.balanceOf(walletAddr)).to.equal(0n);
      expect(await token.balanceOf(bob.address)).to.equal(amount);
      expect(await wallet.getTokenBalance(await token.getAddress())).to.equal(0n);
    });

    it("transferToken reverts when the token call fails (insufficient balance)", async () => {
      const { wallet, token, bob } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.transferToken(await token.getAddress(), bob.address, 1n, 0n)
      ).to.be.revertedWithCustomError(wallet, "TransferFailed");
    });

    it("rejects zero amount transfers", async () => {
      const { wallet, token, bob } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.transferToken(await token.getAddress(), bob.address, 0n, 0n)
      ).to.be.revertedWithCustomError(wallet, "ZeroAmount");
    });

    it("rejects zero addresses", async () => {
      const { wallet, token } = await loadFixture(deployWalletFixture);
      await expect(
        wallet.approveToken(await token.getAddress(), ethers.ZeroAddress, 1n, 0n)
      ).to.be.revertedWithCustomError(wallet, "ZeroAddress");
      await expect(
        wallet.transferToken(await token.getAddress(), ethers.ZeroAddress, 1n, 0n)
      ).to.be.revertedWithCustomError(wallet, "ZeroAddress");
    });
  });

  // ------------------------------------------------------------------
  // 7. Funds reception
  // ------------------------------------------------------------------
  describe("Funds", () => {
    it("can receive native currency and report balance", async () => {
      const { wallet, owner } = await loadFixture(deployWalletFixture);
      const value = ethers.parseEther("7");
      await owner.sendTransaction({ to: await wallet.getAddress(), value });
      expect(await wallet.getBalance()).to.equal(value);
    });
  });
});
