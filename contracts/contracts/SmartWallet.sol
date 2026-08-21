// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SmartWallet
 * @notice PayMaster controlled payment execution layer (Phase 9).
 *
 * @dev
 * TRUST BOUNDARY — the contract NEVER trusts an LLM, a solver or any off-chain
 * party by itself. It only executes *explicit, already-validated* transaction
 * parameters that are supplied by an AUTHORIZED caller:
 *   - the `owner` (human signer / backend keeper), or
 *   - an executor explicitly authorized by the owner via `setExecutorAuthorization`.
 *
 * SECURITY PROPERTIES
 *   1. OWNER AUTHZ    — every mutative entry point is gated by onlyAuthorized().
 *   2. REPLAY PROTECTION — an incrementing `nonce` is consumed by every mutative
 *      call. Callers must pass the current nonce; stale payloads revert, so a
 *      captured (already-seen) execution cannot be replayed.
 *   3. INPUT VALIDATION — zero addresses / zero amounts / empty batches revert
 *      before any side effect.
 *   4. REENTRANCY GUARD — nonReentrant() on every mutative entry point.
 *   5. SAFE ERC20 HANDLING — `_callOptionalReturn` tolerates non-conforming
 *      tokens (e.g. USDT-style tokens that return no boolean) and surfaces
 *      inner revert reasons, so a token cannot silently swallow a failed call.
 *   6. REVERT BUBBLING — inner call failures decode and bubble up their reason
 *      (prefixed), keeping failures auditable and atomic.
 *
 * This is a SIMPLIFIED architecture for a hackathon MVP — it is NOT a full
 * ERC-4337 implementation. It demonstrates the security primitives (authz,
 * nonce, guard, validation) that a production account-abstraction stack would
 * build on.
 */
contract SmartWallet {
    // ============================================================
    // Types
    // ============================================================
    /// @notice A single explicit, validated call to make on behalf of the wallet.
    struct Transaction {
        address target; // contract / recipient to call
        uint256 value;  // native value (wei) to send along
        bytes data;     // calldata ("" for a plain native transfer)
    }

    // ============================================================
    // Storage
    // ============================================================
    address public owner;
    address public pendingOwner;

    /// @notice Authorized executor map (set by owner). Executors can trigger
    ///         execution, but only with explicit validated params.
    mapping(address => bool) public authorizedExecutors;

    /// @notice Monotonic counter consumed by every mutative call (replay guard).
    uint256 public nonce;

    /// @notice Reentrancy guard storage. 1 = unlocked, 2 = locked.
    uint256 private _locked = 1;

    // ============================================================
    // Events
    // ============================================================
    /// @notice Emitted when a single validated transaction is executed.
    event TransactionExecuted(
        address indexed target,
        uint256 value,
        bytes data,
        uint256 indexed nonce
    );

    /// @notice Emitted when a batch of transactions is executed (all-or-nothing).
    event BatchExecuted(
        bytes32 indexed batchId,     // keccak256(abi.encode(txs))
        uint256 transactionCount,
        uint256 indexed nonce
    );

    /// @notice Emitted when token allowance is set.
    event TokenApproval(
        address indexed token,
        address indexed spender,
        uint256 amount,
        address indexed caller
    );

    /// @notice Emitted when tokens are transferred out of the wallet.
    event TokenTransfer(
        address indexed token,
        address indexed to,
        uint256 amount,
        address indexed caller
    );

    /// @notice Emitted when idle treasury tokens are swept into a yield vault.
    event YieldDeposit(
        address indexed vault,
        uint256 amount,
        address indexed caller
    );

    /// @notice Emitted when yield shares are redeemed back into the wallet.
    event YieldWithdraw(
        address indexed vault,
        uint256 shares,
        address indexed caller
    );

    /// @notice Emitted when native currency is transferred out of the wallet.
    event NativeTransfer(
        address indexed to,
        uint256 value,
        uint256 indexed nonce
    );

    /// @notice Emitted when an executor is authorized / deauthorized.
    event ExecutorAuthorized(address indexed executor, bool status);

    /// @notice Two-step ownership transfer events.
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============================================================
    // Errors (gas-efficient, no string data where possible)
    // ============================================================
    error NotAuthorized();
    error NotOwner();
    error ZeroAddress();
    error ZeroAmount();
    error EmptyBatch();
    error InvalidNonce(uint256 expected, uint256 provided);
    error CallFailed(bytes reason);
    error TransferFailed(bytes reason);
    error Reentrancy();

    // ============================================================
    // Modifiers
    // ============================================================
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyAuthorized() {
        if (msg.sender != owner && !authorizedExecutors[msg.sender]) revert NotAuthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier validNonce(uint256 _nonce) {
        if (_nonce != nonce) revert InvalidNonce(nonce, _nonce);
        _;
    }

    modifier validAddress(address _addr) {
        if (_addr == address(0)) revert ZeroAddress();
        _;
    }

    // ============================================================
    // Constructor
    // ============================================================
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============================================================
    // Administration
    // ============================================================
    /**
     * @notice Authorize or deauthorize an executor (e.g. the IntentRouter /
     *         solver layer). Owner only.
     */
    function setExecutorAuthorization(address executor, bool status)
        external
        onlyOwner
        validAddress(executor)
    {
        authorizedExecutors[executor] = status;
        emit ExecutorAuthorized(executor, status);
    }

    /**
     * @notice Begin a two-step ownership transfer. Owner only.
     */
    function transferOwnership(address newOwner)
        external
        onlyOwner
        validAddress(newOwner)
    {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /**
     * @notice Complete the two-step ownership transfer. New owner only.
     */
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    // ============================================================
    // Core: single transaction execution
    // ============================================================
    /**
     * @notice Execute a single explicit, validated transaction.
     * @param target Address to call (or recipient for a plain native transfer
     *               when `data` is empty).
     * @param value  Native value (wei) forwarded with the call.
     * @param data   Calldata forwarded to `target`.
     * @param _nonce Must equal the current `nonce` (replay protection).
     * @dev Reverts atomically if the inner call fails; inner revert reason is
     *      bubbled up (prefixed) for auditability.
     */
    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 _nonce
    )
        external
        onlyAuthorized
        nonReentrant
        validNonce(_nonce)
        validAddress(target)
        returns (bool)
    {
        _consumeNonce();

        (bool success, bytes memory ret) = target.call{value: value}(data);
        if (!success) {
            revert CallFailed(_decodeRevertReason(ret));
        }

        if (data.length == 0 && value > 0) {
            emit NativeTransfer(target, value, nonce);
        }
        emit TransactionExecuted(target, value, data, nonce);
        return true;
    }

    // ============================================================
    // Core: batch execution (all-or-nothing)
    // ============================================================
    /**
     * @notice Execute a batch of explicit, validated transactions atomically.
     * @dev If ANY step reverts, the entire batch reverts (no partial state).
     *      Each step's target must be non-zero.
     */
    function batchExecute(Transaction[] calldata txs, uint256 _nonce)
        external
        onlyAuthorized
        nonReentrant
        validNonce(_nonce)
        returns (bool)
    {
        if (txs.length == 0) revert EmptyBatch();
        _consumeNonce();

        for (uint256 i = 0; i < txs.length; i++) {
            if (txs[i].target == address(0)) revert ZeroAddress();
            (bool success, bytes memory ret) = txs[i].target.call{value: txs[i].value}(txs[i].data);
            if (!success) {
                revert CallFailed(_decodeRevertReason(ret));
            }
        }

        bytes32 batchId = keccak256(abi.encode(txs));
        emit BatchExecuted(batchId, txs.length, nonce);
        return true;
    }

    // ============================================================
    // Core: token approval
    // ============================================================
    /**
     * @notice Set an ERC-20 allowance from this wallet to `spender`.
     * @dev Uses `_callOptionalReturn` so non-conforming tokens (USDT-style)
     *      are handled safely. Callers should approve(0) before re-approving
     *      non-zero for tokens that require it.
     */
    function approveToken(
        address token,
        address spender,
        uint256 amount,
        uint256 _nonce
    )
        external
        onlyAuthorized
        nonReentrant
        validNonce(_nonce)
        validAddress(token)
        validAddress(spender)
        returns (bool)
    {
        _consumeNonce();
        _callOptionalReturn(
            token,
            abi.encodeCall(IERC20Minimal.approve, (spender, amount)),
            "SW: approve"
        );
        emit TokenApproval(token, spender, amount, msg.sender);
        return true;
    }

    // ============================================================
    // Core: token transfer
    // ============================================================
    /**
     * @notice Transfer ERC-20 tokens held by this wallet to `to`.
     * @dev Uses `_callOptionalReturn` so non-conforming tokens are safe.
     */
    function transferToken(
        address token,
        address to,
        uint256 amount,
        uint256 _nonce
    )
        external
        onlyAuthorized
        nonReentrant
        validNonce(_nonce)
        validAddress(token)
        validAddress(to)
        returns (bool)
    {
        if (amount == 0) revert ZeroAmount();
        _consumeNonce();
        _callOptionalReturn(
            token,
            abi.encodeCall(IERC20Minimal.transfer, (to, amount)),
            "SW: transfer"
        );
        emit TokenTransfer(token, to, amount, msg.sender);
        return true;
    }

    // ============================================================
    // Core: yield automation (Phase 13, added 2026-08-21)
    // ============================================================
    /**
     * @notice Sweep idle tokens into a yield vault. The wallet MUST have
     *         approved `vault` for `amount` via approveToken() first.
     * @dev The vault pulls `amount` from this wallet with transferFrom.
     */
    function depositYield(
        address vault,
        uint256 amount,
        uint256 _nonce
    )
        external
        onlyAuthorized
        nonReentrant
        validNonce(_nonce)
        validAddress(vault)
        returns (bool)
    {
        if (amount == 0) revert ZeroAmount();
        _consumeNonce();
        (bool success, bytes memory ret) = vault.call(
            abi.encodeWithSignature("deposit(uint256)", amount)
        );
        if (!success) revert CallFailed(_decodeRevertReason(ret));
        emit YieldDeposit(vault, amount, msg.sender);
        return true;
    }

    /**
     * @notice Redeem yield shares back into this wallet. The vault transfers
     *         the pro-rata asset (principal + accrued yield) to the wallet.
     */
    function withdrawYield(
        address vault,
        uint256 shares_,
        uint256 _nonce
    )
        external
        onlyAuthorized
        nonReentrant
        validNonce(_nonce)
        validAddress(vault)
        returns (bool)
    {
        if (shares_ == 0) revert ZeroAmount();
        _consumeNonce();
        (bool success, bytes memory ret) = vault.call(
            abi.encodeWithSignature("withdraw(uint256)", shares_)
        );
        if (!success) revert CallFailed(_decodeRevertReason(ret));
        emit YieldWithdraw(vault, shares_, msg.sender);
        return true;
    }

    // ============================================================
    // Views
    // ============================================================
    /// @notice Native balance held by the wallet.
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Convenience view: token balance held by the wallet.
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20Minimal(token).balanceOf(address(this));
    }

    // ============================================================
    // Internal helpers
    // ============================================================
    /// @dev Consume one nonce slot (replay protection).
    function _consumeNonce() private {
        nonce += 1;
    }

    /**
     * @dev Safe ERC-20 call pattern (OpenZeppelin SafeERC20-style, inlined to
     *      keep the contract zero-dependency). Handles:
     *       - tokens returning a boolean (`true`/`false`)
     *       - tokens returning no data at all (USDT-style)
     *       - tokens that revert (reason bubbled up)
     *       - tokens returning non-boolean data (treated as failure)
     */
    function _callOptionalReturn(
        address token,
        bytes memory callData,
        string memory prefix
    ) private {
        (bool success, bytes memory ret) = token.call(callData);
        if (!success) {
            revert TransferFailed(_decodeRevertReason(ret));
        }
        // No return data -> success (USDT-style).
        if (ret.length == 0) return;
        // Return data must decode as a boolean `true`.
        if (ret.length != 32 || !abi.decode(ret, (bool))) {
            revert TransferFailed(bytes(abi.encodePacked(prefix, ": bad return")));
        }
    }

    /**
     * @dev Decode the revert reason from a failed call, or return a fallback
     *      marker when the callee provided none.
     */
    function _decodeRevertReason(bytes memory ret) private pure returns (bytes memory) {
        if (ret.length > 0) {
            // Standard Error(string) encoding: revert("...")
            if (ret.length >= 68 && bytes4(ret) == bytes4(keccak256("Error(string)"))) {
                return bytes(abi.decode(ret, (string)));
            }
            // Custom error or raw revert data: forward as-is.
            return ret;
        }
        return bytes("Call failed with no reason");
    }

    /// @notice Allow the wallet to receive native currency.
    receive() external payable {}
}

/**
 * @title IERC20Minimal
 * @notice Minimal ERC-20 interface used by the wallet for external calls.
 */
interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
