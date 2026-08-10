# IBAP Phase 10 — Human Approval & Blockchain Execution Engine

> The safety-critical bridge between an **approved, risk-checked payment plan**
> and the **Phase 9 SmartWallet** on-chain execution layer.

## The safety model (non-negotiable)

```
Payment request
   ↓  Phase 5 — Intent Parsing        (LLM parses; deterministic finalize)
Payment Plan
   ↓  Phase 6 — Planner               (LLM proposes strategies only)
Route Optimization
   ↓  Phase 7 — Deterministic scoring (lower score wins)
Risk Evaluation
   ↓  Phase 8 — 7 checks + 0-100 score (deterministic)
Simulation
   ↓  Phase 8 — totals + explanation  (numbers only from validated data)
Human Approval
   ↓  Phase 10 — explicit [Approve & exec] / [Reject]
Blockchain Execution
   ↓  Phase 9/10 — SmartWallet (nonce + authz + reentrancy guarded)
Audit trail
   ↓  Phase 10 — PLAN_CREATED → … → PAYMENT_EXECUTED / PAYMENT_FAILED
```

**The LLM never executes a transaction.** It may parse intents and propose
strategies; the deterministic engines pick the route, score the risk and build
the exact SmartWallet payload; a human must explicitly approve; only then does
the frontend submit the validated batch to the SmartWallet.

## What was built

### 1. Execution engine library — `frontend/src/lib/execution/`

| File | Purpose |
| --- | --- |
| `types.ts` | `ExecutionStatus` (SUBMITTED→PENDING→CONFIRMED/FAILED), `ExecutionErrorCode`, `ExecutionPlan`, `ExecutionRecord`, `ExecutionOutcome` |
| `errors.ts` | `mapEthersError()` classifies the 6 required failure modes into typed `ExecutionError`s + `errorLabel` / `recoveryHint` |
| `abi.ts` | SmartWallet ABI + deployment registry (`SMART_WALLET_DEPLOYMENTS[31337]` mirrors `contracts/deployments/localhost.json`) + token helpers |
| `execution.ts` | `buildExecutionPlan()` (deterministic step→payload), `executePlan()` (SUBMITTED), `confirmExecution()` (CONFIRMED), `computeGasCostUsd()` |
| `index.ts` | barrel |
| `frontend/lib/execution.ts` | task-required path shim re-exporting the canonical module |

Error handling covers exactly what was asked:
- **REJECTED** — user closed/rejected the MetaMask prompt (`code 4001` / `ACTION_REJECTED`)
- **INSUFFICIENT_BALANCE** — insufficient native gas or token balance
- **RPC_TIMEOUT** — node timeout / network error / cannot estimate gas
- **CONTRACT_REVERT** — SmartWallet or inner call reverted (`CALL_EXCEPTION`)
- **WRONG_NETWORK** — wallet chain ≠ plan chain
- **WALLET_NOT_CONNECTED** — no provider / signer mid-flow
- plus `NOT_DEPLOYED` and `UNKNOWN` for completeness.

### 2. On-chain status lifecycle (mirrors `txns` DB)

```
SUBMITTED  — tx broadcast (hash known)
PENDING    — waiting for a mined receipt
CONFIRMED  — receipt mined, status == 1
FAILED     — rejected / reverted / timed out / wrong network
```

`useWallet.executeSmartWalletPlan(plan)`:
1. validates connectivity + chain + deployment
2. `executePlan()` → reads the live SmartWallet `nonce`, calls
   `transferToken` / `executeTransaction` / `approveToken` (single step) or
   `batchExecute` (all-or-nothing batch)
3. `confirmExecution()` → `waitForTransaction` (120s) + status check
4. returns `{ txHash, gasUsed, gasCostUsd, explorerUrl, receipt }`

### 3. Persistence — `supabase/migrations/20260810000000_phase10_execution.sql`

Extends the Phase 2 pipeline so **payment req · selected route · approval ·
txn hash · status · gas used · gas cost · timestamps · explorer URL** are all
recorded:

- `txns.status` now allows `SUBMITTED` (lifecycle: SUBMITTED/PENDING/CONFIRMED/FAILED)
- `txns` gains `smart_wallet_address`, `execution_plan_id`, `error_code`, `error_message`
- `approvals` gains `approved_by_address`, `risk_level`, `note`
- indexes on `txns(status)` + `txns(created_at DESC)`

### 4. Audit events — `frontend/src/app/api/execution/route.ts`

All six required audit events (plus `PAYMENT_REJECTED` / `PAYMENT_SUBMITTED`):

| Event | When |
| --- | --- |
| `PLAN_CREATED` | plan generated (handleGeneratePlan) |
| `ROUTE_SELECTED` | recommended route chosen (with savings) |
| `RISK_CHECKED` | risk evaluated (with level/score) |
| `PAYMENT_APPROVED` | human approved at the gate |
| `PAYMENT_EXECUTED` | receipt confirmed on-chain |
| `PAYMENT_FAILED` | execution failed (typed code + message) |

The endpoint is **best-effort**: when Supabase is not configured it returns
`{ success:true, persisted:false, warning }` so the approved on-chain execution
is never blocked by a persistence outage (the transaction is the source of
truth).

### 5. UI

- **`ApprovalPanel`** (`src/components/execution/ApprovalPanel.tsx`) — the
  explicit approval interface. Displays **Recipient · Amount · Token · Selected
  Route · Gas · Gas Savings · Risk · Execution Steps · AI Explanation** and
  requires **[Approve & exec] / [Reject]**.
- **`ExecutionFlowTimeline`** (`src/components/execution/ExecutionFlowTimeline.tsx`):
  ```
  ✓ Payment understood
  ✓ Route optimized
  ✓ Risk checked
  ✓ Approved
  ● Executing
  ○ Confirmed
  ```
  Green check = done, amber pulse = in progress, red ✗ = failed, dim ○ = pending.
  Shows the tx hash + explorer link on confirmation and the failure message on
  error.
- `comps/execution/*` shims re-export both components (codebase convention).
- `PaymentRequestCard` now: evaluates risk (controlled fetch) → Phase 8
  "Confirm & Sign" → **Phase 10 ApprovalPanel** → SmartWallet execution with a
  live timeline.

## Testing

```bash
# 1. Type-check (must pass first)
cd frontend && npx tsc --noEmit

# 2. Engine self-test (57 checks, no wallet/key needed)
cd frontend && npx tsx scripts/execution-selftest.ts
```

The self-test exercises: deployment registry, decimals/wei parsing, plan id
determinism, USDC + native plan building, **all 6 error classes**, gas→USD
conversion, explorer URLs, and the status/audit constants.

## End-to-end manual test (localhost)

1. **Start a local chain + deploy the Phase 9 SmartWallet:**
   ```bash
   npm --prefix contracts run node      # hardhat node on :8545 (chain 31337)
   npm --prefix contracts run deploy:wallet:local
   ```
   (Confirm `contracts/deployments/localhost.json` matches the registry in
   `src/lib/execution/abi.ts`.)

2. **Apply the Phase 10 migration** to Supabase (if you have a hosted project):
   `npx supabase db push` or reset with migrations.

3. **Run the frontend:** `cd frontend && npx next dev --port 3000` and open
   `/operations`.

4. **Connect MetaMask** to the localhost network (chain 31337) using the
   deployer account (the SmartWallet owner).

5. **Describe a payment**, e.g. *"Pay Alice RM2,500 for invoice INV-1024 by
   Friday."* → Generate Payment Plan → review the risk panel → Confirm & Sign →
   the **ApprovalPanel** shows recipient/amount/token/route/savings/risk/steps/
   AI explanation → press **[Approve & exec]**.

6. MetaMask prompts for the SmartWallet call. Confirm → the timeline animates
   through Executing → **Confirmed** with the tx hash. If you reject, the
   timeline shows ✗ Failed with the typed error and no funds move.

## Trust boundary recap

- LLM parses the intent and may propose route strategies — it never executes.
- The route, risk score and execution payload are all deterministic.
- Every mutative call goes through the SmartWallet's `nonce`, `onlyAuthorized`
  and reentrancy guards (Phase 9).
- Nothing is broadcast until the operator presses **Approve & exec**.
