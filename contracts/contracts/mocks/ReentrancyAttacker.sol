// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReentrancyAttacker
 * @notice Malicious test contract used to verify the SmartWallet reentrancy
 *         guard. When invoked by the wallet (via executeTransaction), it
 *         attempts to re-enter `wallet.executeTransaction`.
 * @dev If the inner (reentrant) call SUCCEEDS, the guard was bypassed and this
 *      contract reverts with "REENTRANCY_BYPASSED", failing the test. If the
 *      guard works, the inner call reverts, this call returns normally, and
 *      the outer execution completes as expected.
 */
contract ReentrancyAttacker {
    address public wallet;

    constructor(address _wallet) {
        wallet = _wallet;
    }

    /// @notice Attempt to re-enter the wallet with the given nonce.
    function attack(uint256 targetNonce) external payable returns (bool) {
        (bool success, ) = wallet.call(
            abi.encodeWithSignature(
                "executeTransaction(address,uint256,bytes,uint256)",
                address(this),
                uint256(0),
                "",
                targetNonce
            )
        );
        if (success) {
            // Guard bypassed — should NEVER happen.
            revert("REENTRANCY_BYPASSED");
        }
        return false;
    }

    receive() external payable {}
}
