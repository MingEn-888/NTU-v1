// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IntentRouter
 * @notice Entrypoint contract for executing agent-driven multi-chain payment intents
 */
contract IntentRouter {
    address public owner;
    
    struct ExecutionStep {
        address targetContract;
        bytes callData;
        uint256 value;
    }

    event IntentExecuted(
        bytes32 indexed intentId,
        address indexed sender,
        address indexed recipient,
        uint256 totalSteps
    );

    event SolverAuthorized(address indexed solver, bool status);

    mapping(address => bool) public authorizedSolvers;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlySolver() {
        require(authorizedSolvers[msg.sender] || msg.sender == owner, "Not authorized solver");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedSolvers[msg.sender] = true;
    }

    function setSolverAuthorization(address solver, bool status) external onlyOwner {
        authorizedSolvers[solver] = status;
        emit SolverAuthorized(solver, status);
    }

    function executeIntentBatch(
        bytes32 intentId,
        address recipient,
        ExecutionStep[] calldata steps
    ) external payable onlySolver returns (bool) {
        require(steps.length > 0, "No steps provided");
        
        for (uint256 i = 0; i < steps.length; i++) {
            (bool success, ) = steps[i].targetContract.call{value: steps[i].value}(steps[i].callData);
            require(success, "Step execution failed");
        }

        emit IntentExecuted(intentId, msg.sender, recipient, steps.length);
        return true;
    }

    receive() external payable {}
}
