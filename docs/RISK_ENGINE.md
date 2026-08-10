# PayMaster Phase 8 — Deterministic Risk Evaluation & Transaction Simulation Engine

> **Role in the pipeline:** Phase 7 selected the *best route* deterministically.
> **Phase 8 evaluates that selected route — and every candidate — BEFORE any
> human approval.** It runs 7 risk checks, produces a deterministic 0–100 risk
> score (LOW / MEDIUM / HIGH), simulates the payment end-to-end, and hands the
> result to an explicit human approval gate. The engine **never executes on its
> own** — every payment requires a human signature.

The LLM's only contribution is the optional prose polish of the explanation.
Every risk verdict, score, simulated cost and expected result is produced by
pure deterministic code.

---

## 1. The 7 risk checks

Each payment is evaluated against exactly 7 checks before approval:

| # | Check | Question | PASS | WARN | FAIL |
|---|-------|----------|------|------|------|
| 1 | `balance` | Does the treasury hold enough of the funding asset? | balance ≥ amount | balance < amount | asset not held at all |
| 2 | `gas` | Does the wallet hold enough native gas for the fees? | gas ≥ 2× fee | fee ≤ gas < 2× fee | gas < fee |
| 3 | `recipient` | Is the recipient address a valid 0x address? | `0x` + 40 hex | no address (name only) | invalid format |
| 4 | `network` | Is every required chain supported? | all supported | chain outside treasury list | unsupported chain |
| 5 | `slippage` | Is estimated swap slippage acceptable? | ≤ 50 bps | ≤ 100 bps | > 100 bps |
| 6 | `route` | Does the route involve extra bridges / swaps? | direct | swap only | bridge present |
| 7 | `complexity` | How many on-chain operations are required? | ≤ 2 tx | 3–4 tx | ≥ 5 tx |

Native gas assets (`ETH`/`POL`) are always considered spendable (the treasury
keeps a gas reserve). `PASS = 0` points, `WARN` = half the check weight, `FAIL`
= full weight — so a hard failure always hurts the score more than a soft one.

---

## 2. Deterministic risk score (0–100)

$$
\text{RiskScore} = \underbrace{\text{CheckPoints}}_{\text{0–50}} +
\underbrace{\text{RoutePoints}}_{\text{0–25}} +
\underbrace{\text{AmountPoints}}_{\text{0–25}}
$$

### Check points (0–50)

| Check | Weight | Why |
|---|---|---|
| `recipient` | **13** | Recipient identity is the highest-leverage control |
| `balance` | **12** | The payment must actually be fundable |
| `gas` | **8** | Execution reverts without native gas |
| `network` | **6** | Unsupported chains cannot settle |
| `complexity` | **6** | More transactions = bigger failure surface |
| `slippage` | **5** | Swap price uncertainty |

`route` is scored separately below (its check flags bridges/swaps for display).

### Route points (0–25)

$$
\text{Route} = \underbrace{2}_{\text{base}} + 7\cdot\min(\text{swaps},2) +
\underbrace{14}_{\text{if bridge}} + \underbrace{3}_{\text{if approve}} \;\;(\le 25)
$$

Bridges are the largest single structural risk (counterparty + lock-up +
settlement risk); swaps add slippage/pool risk; an allowance approval adds
router exposure.

### Amount points (0–25)

| Amount | Points |
|---|---|
| ≤ $1,000 | 0 |
| ≤ $10,000 | 8 |
| ≤ $50,000 | 14 |
| ≤ $250,000 | 19 |
| > $250,000 | 25 |

### Classification

| Score | Level |
|---|---|
| 0–33 | **LOW** |
| 34–66 | **MEDIUM** |
| 67–100 | **HIGH** |

**HIGH risk is NOT blocked.** The engine never auto-executes and never
auto-blocks — every payment proceeds to the human approval gate. HIGH simply
triggers a prominent warning and a mandatory acknowledgement checkbox before
the human can sign.

### Worked examples (from the self-test)

| Scenario | Checks | Route | Amount | Total | Level |
|---|---|---|---|---|---|
| Direct USDC transfer, $1,200, valid recipient | 0 | 2 | 8 | **10** | LOW |
| Bridge+swap, $30,000, no address, 80 bps | 22 | 25 | 14 | **61** | MEDIUM |
| Bridge+double swap, $300,000, bad address, no funds, unsupported chain | 50 | 25 | 25 | **100** | HIGH |

---

## 3. Simulation output

Every simulation returns the fields the UI displays:

| Field | Description |
|---|---|
| `payment.recipient / recipientAddress / token / amount` | the payment itself |
| `route` | routeId, name, chain/token sequence, tx count, gas, duration |
| `steps` | ordered execution steps (normalized action types) |
| `checks` | the 7 risk checks with status, points and messages |
| `riskScore` / `riskLevel` | deterministic 0–100 score + LOW/MEDIUM/HIGH |
| `riskBreakdown` | points per check + route + amount + total |
| `totals` | gas, bridge fee, slippage, **total cost**, duration, tx count |
| `warnings` | aggregated FAIL/WARN messages + HIGH-risk note |
| `expectedResult` | plain-English expected outcome |
| `explanation` | plain-English AI explanation (numbers from data only) |
| `approval` | `{ required: true, canProceed: true, status: "PENDING", highRiskAcknowledged }` |

**Total cost** = estimated gas + estimated bridge fee (per source chain, e.g.
$12 Ethereum, $2 Polygon) + estimated slippage cost (amount × bps / 10000, only
when the route swaps).

---

## 4. AI explanation — grounded in validated data only

The explanation is built from the **validated simulation result**, never from
the LLM's imagination. `src/lib/risk/explain.ts` has two layers:

1. **`buildDeterministicExplanation`** (pure code, always used): every figure in
   the output (amount, token, gas, total cost, % savings computed from those
   values) already exists in the request/result.
2. **`generateExplanation`** (optional): when `OPENAI_API_KEY` is set, the LLM
   may polish the *qualitative reasoning only*. It receives the validated data
   and is forbidden from producing numbers; its output is post-filtered
   (`stripNumbers`) so a hallucinated financial figure can never leak through.
   Numeric statements are always appended by code. Any failure falls back to
   the deterministic explanation.

Example (spec style):

> "Ethereum → Polygon · USDC settle was selected because estimated execution
> cost is 72% lower than the Ethereum direct transfer route. Trade-off: this
> route includes an additional bridge step across chains, which adds
> counterparty and settlement risk. Overall execution risk is LOW (score
> 24/100)."

---

## 5. Human approval — Review Payment

The engine **never executes on its own**. The `RiskSimulationPanel` UI presents
an explicit two-step gate:

1. **Review Payment** — expands a final-review summary (recipient, amount,
   total cost, risk, tx count, warnings). HIGH-risk payments additionally
   require an "I acknowledge this is a HIGH-risk payment" checkbox.
2. **Confirm & Sign** — only then is the wallet signature flow invoked
   (MetaMask), which is itself a human confirmation.

`approval.required` is always `true`; `approval.canProceed` is always `true`
for every risk level — classification informs the human, it never auto-executes
or auto-blocks.

---

## 6. API

```
POST /api/risk/simulate
```

**Body:**

```jsonc
{
  "payment": { "recipient": "Acme Vendor", "recipientAddress": "0x71C7...6F",
               "token": "USDC", "amount": 1200 },
  "route": { "routeId": "routeB", "name": "Ethereum → Polygon · USDC settle",
             "chainSequence": ["ethereum", "polygon"],
             "tokenSequence": ["USDC", "USDC"],
             "transactionCount": 3, "estimatedGas": 4, "estimatedDuration": 90,
             "strategy": "bridge_then_pay" },
  "steps": [ { "order": 1, "actionType": "CHECK_ALLOWANCE", "title": "..." },
             { "order": 2, "actionType": "BRIDGE", "title": "..." } ],
  "treasury": { "availableAssets": [{ "symbol": "USDC", "balance": "25000", "usdValue": 25000 }],
                "supportedChains": ["ethereum", "polygon", "arbitrum", "optimism", "base"],
                "preferredChain": "ethereum", "nativeGasBalance": "12.5",
                "totalEstimatedUSDValue": 47500 },
  "slippageBps": 30,            // optional
  "walletGasBalanceUsd": 50,    // optional, overrides nativeGasBalance
  "alternatives": [ ... ]       // optional, for the explanation's % comparison
}
```

**Response:** `{ "success": true, "result": SimulationResult }` — the full
object from §3, shape-checked with Zod before it leaves the service.

Errors: `VALIDATION_FAILED` (422), `EMPTY_PAYMENT`/`INVALID_ROUTE` (422),
`BODY_TOO_LARGE` (413), `INVALID_JSON` (400), `INTERNAL` (500).

---

## 7. Files

| Path | Purpose |
|---|---|
| `src/lib/risk/types.ts` | domain types + `RiskEngineError` |
| `src/lib/risk/catalog.ts` | thresholds, weights, tiers, chain fees, address regex |
| `src/lib/risk/checks.ts` | the 7 deterministic risk checks |
| `src/lib/risk/score.ts` | scoring, classification, warnings aggregation |
| `src/lib/risk/simulate.ts` | service: validate → checks → score → totals → explain |
| `src/lib/risk/explain.ts` | deterministic + optional LLM explanation (data-grounded) |
| `src/lib/risk/schema.ts` | Zod request/result schemas |
| `src/lib/risk/adapter.ts` | Phase 4 / Phase 6 plan → `SimulationRequest` adapters |
| `src/app/api/risk/simulate/route.ts` | `POST /api/risk/simulate` |
| `src/components/risk/RiskSimulationPanel.tsx` | risk + simulation + approval UI (Phase 8) |
| `comps/risk/RiskSimulationPanel.tsx` | re-export shim |
| `scripts/risk-selftest.ts` | deterministic unit tests (no key needed) |

**Wired into the payment flow:** `PaymentRequestCard` (plan phase) renders the
panel with `Review Payment` → `Confirm & Sign` → `onApprove` (the existing
MetaMask-gated execution). `PaymentCommandCenter` passes the treasury context
and mounts a standalone demo preview.

**Run tests:** `cd frontend && npx tsc --noEmit` then
`npx tsx scripts/risk-selftest.ts`
