// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title YieldVault
 * @notice PayMaster yield automation vault (added 2026-08-21).
 *
 * @dev
 * A SIMPLE single-asset yield vault that lets the SmartWallet sweep idle
 * treasury balance into a yield-bearing position. For the hackathon MVP the
 * yield itself is a DETERMINISTIC accounting rate (`apyBps`) set by the
 * manager — it is NOT a real lending/DeFi integration.
 *
 * TRUST BOUNDARY — the vault is intentionally dumb:
 *   - Only the `manager` (the SmartWallet) can deposit / withdraw / set APY.
 *   - The manager's own nonce + authorization + reentrancy guards therefore
 *     protect every vault call; the vault trusts the manager, never an LLM.
 *   - Shares are minted 1:1 with assets on first deposit, then pro-rata,
 *     so withdrawals always pay out principal + accrued yield proportionally.
 */

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract YieldVault {
    /// @notice The ERC-20 asset the vault holds (e.g. USDC).
    address public immutable asset;

    /// @notice The only caller allowed to move funds (the SmartWallet).
    address public manager;

    /// @notice Deterministic yield rate, in basis points (500 = 5.00%).
    uint256 public apyBps;

    /// @notice Total shares outstanding.
    uint256 public totalShares;

    /// @notice Per-account share balance.
    mapping(address => uint256) public shares;

    /// @notice Last harvest timestamp (updated whenever APY is set).
    uint256 public lastHarvest;

    event Deposited(address indexed from, uint256 amount, uint256 sharesMinted);
    event Withdrawn(address indexed to, uint256 amount, uint256 sharesBurned);
    event ApyUpdated(uint256 apyBps);
    event ManagerUpdated(address indexed previousManager, address indexed newManager);

    error NotManager();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientShares(uint256 requested, uint256 available);

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    constructor(address _asset) {
        if (_asset == address(0)) revert ZeroAddress();
        asset = _asset;
        manager = msg.sender;
        lastHarvest = block.timestamp;
    }

    // ============================================================
    // Administration
    // ============================================================
    function setManager(address newManager) external onlyManager {
        if (newManager == address(0)) revert ZeroAddress();
        emit ManagerUpdated(manager, newManager);
        manager = newManager;
    }

    /// @notice Set the deterministic APY (basis points) and record a harvest.
    function setApy(uint256 bps) external onlyManager {
        apyBps = bps;
        lastHarvest = block.timestamp;
        emit ApyUpdated(bps);
    }

    // ============================================================
    // Core: deposit / withdraw
    // ============================================================
    /**
     * @notice Deposit `amount` of the asset, pulled from the manager.
     * @dev The SmartWallet MUST have approved this vault for `amount` first.
     * @return sharesMinted The shares credited to the depositor.
     */
    function deposit(uint256 amount) external onlyManager returns (uint256 sharesMinted) {
        if (amount == 0) revert ZeroAmount();
        uint256 assets = totalAssets();
        sharesMinted = totalShares == 0 ? amount : (amount * totalShares) / assets;
        totalShares += sharesMinted;
        shares[msg.sender] += sharesMinted;
        IERC20Minimal(asset).transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, sharesMinted);
    }

    /**
     * @notice Burn `sharesToBurn` and return the pro-rata asset to the caller.
     * @return amount The asset amount returned (principal + accrued yield).
     */
    function withdraw(uint256 sharesToBurn) external onlyManager returns (uint256 amount) {
        if (sharesToBurn == 0) revert ZeroAmount();
        if (sharesToBurn > shares[msg.sender]) {
            revert InsufficientShares(sharesToBurn, shares[msg.sender]);
        }
        amount = (sharesToBurn * totalAssets()) / totalShares;
        totalShares -= sharesToBurn;
        shares[msg.sender] -= sharesToBurn;
        IERC20Minimal(asset).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, sharesToBurn);
    }

    // ============================================================
    // Views
    // ============================================================
    /// @notice Total asset balance held by the vault (principal + yield accrual).
    function totalAssets() public view returns (uint256) {
        return IERC20Minimal(asset).balanceOf(address(this));
    }

    /// @notice Human-friendly APY percentage, e.g. 5.00.
    function apyPercent() external view returns (uint256) {
        return apyBps / 100;
    }
}
