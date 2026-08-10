# PayMaster Phase 7 — Deterministic Route Optimization Engine

> **Role in the pipeline:** Phase 5 parses intent (LLM interprets), Phase 6
> generates candidate payment plans (LLM proposes *strategies* only). **Phase 7
> selects the final route — deterministically, by mathematics, never by AI.**

The LLM's only contribution is proposing candidate *strategies* upstream. The
final decision of **which route to execute** is made by this engine using a
normalized, weighted scoring model with **lower score = better**.

---

## 1. Mathematical model

Each candidate route $r$ is scored as:

$$
\text{Score}(r) = w_g \cdot \text{Gas}(r) + w_t \cdot \text{Time}(r) + w_s \cdot \text{Steps}(r) + w_r \cdot \text{Risk}(r)
$$

with the constraint:

$$
w_g + w_t + w_s + w_r = 1
$$

### Factor normalization

Each factor is **min-max normalized** across the candidate set into $[0,1]$,
where **0 = best in the set, 1 = worst**:

$$
\text{Factor}(r) = \frac{\text{value}(r) - \min}{\max - \min}
$$

This removes units (USD, seconds, counts, risk points) so the four factors are
directly comparable. When every route shares a value ($\max = \min$), the
factor is defined as $0$ — it cannot influence the ranking.

| Factor | Raw input | Normalized | Meaning |
|---|---|---|---|
| $\text{Gas}(r)$ | estimated total gas (USD) | $[0,1]$ | cost |
| $\text{Time}(r)$ | estimated duration (sec) | $[0,1]$ | speed |
| $\text{Steps}(r)$ | on-chain transaction count | $[0,1]$ | failure surface |
| $\text{Risk}(r)$ | deterministic risk score (0–100) | $[0,1]$ | funds safety |

### Chain preference (soft, deterministic)

The four weights above are fixed by the model. Treasury *chain preference* is
handled as a **small deterministic bonus**, not a fifth weight:

$$
\text{Final}(r) = \text{Score}(r) - \text{bonus}(r),
\quad \text{bonus}(r) = \begin{cases}
0.02 & \text{if route settles on preferred / requested chain}\\
0 & \text{otherwise}
\end{cases}
$$

The bonus only breaks **near-ties** between otherwise-equal routes, so a
preferred chain never overrides a meaningfully better route.

### Default weights — why these values

| Weight | Value | Rationale |
|---|---|---|
| $w_g$ (gas) | **0.40** | Gas is the direct, recurring **monetary cost** of every payment and the largest controllable lever. A treasury pays it on every execution, so it dominates. |
| $w_r$ (risk) | **0.25** | Funds **safety** is second. Bridges/swaps add counterparty, slippage and failure risk; a cheap route that can lose the payment is unacceptable. Risk outranks speed — a lost payment is irrecoverable. |
| $w_t$ (time) | **0.20** | Business payments often have due dates (Phase 5), so settlement speed matters — but confirmation times are bounded and rarely worth sacrificing safety. |
| $w_s$ (steps) | **0.15** | Fewer transactions shrink the failure surface and operational overhead. Steps already correlate with gas and risk, so this is deliberately the lightest weight to avoid double counting. |

Weights are **configurable** — the API accepts `weights: { gas?, time?, steps?,
risk? }` and re-normalizes them to sum to exactly 1. A gas-heavy profile (e.g.
`gas: 0.9`) will prefer cheap bridge routes; a safety-heavy profile will prefer
fewest-step routes.

### Feasibility — treasury balance (retained with a penalty)

A route is **infeasible** when the treasury does not hold its funding asset
(e.g. a route spending `DAI` when the treasury only holds `USDC`). Native gas
assets (`ETH`/`POL`) are always spendable. Infeasible routes are **NOT
excluded** — they are retained in the candidate set and scored with a fixed,
deterministic penalty added to their normalized score:

$$
\text{Final}(r) = \text{Score}(r) + \underbrace{0.25}_{\text{INFEASIBLE\_PENALTY}}
$$

Consequences:
- The engine always reports the full candidate set, so you can still compare an
  unfundable route's economics.
- Infeasible routes **sort behind every feasible route** (feasibility is the
  primary sort key) and **can never be recommended**.
- The result carries `infeasible: true`, `recommendationReason` explains the
  funding gap, and a `warnings[]` entry is emitted.

---

## 2. Worked example (from the spec)

| Route | Gas | Time | Steps | Risk | Chain (pref = Ethereum) |
|---|---|---|---|---|---|
| A — Ethereum direct | \$18 | 20s | 1 | 8 (Low) | Ethereum ✓ |
| B — Ethereum → Polygon USDC | \$4 | 90s | 3 | 35 (Med) | Polygon ✗ |

**Normalize** (min–max across {A, B}):

| Factor | A | B |
|---|---|---|
| Gas (min 4, max 18) | 1.00 | 0.00 |
| Time (min 20, max 90) | 0.00 | 1.00 |
| Steps (min 1, max 3) | 0.00 | 1.00 |
| Risk (min 8, max 35) | 0.00 | 1.00 |

**Score** with defaults $w = (0.40, 0.20, 0.15, 0.25)$:

$$
\text{Score}(A) = 0.40(1.0) + 0.20(0) + 0.15(0) + 0.25(0) = 0.40
$$

$$
\text{Score}(B) = 0.40(0) + 0.20(1.0) + 0.15(1.0) + 0.25(1.0) = 0.60
$$

**Chain preference** — A settles on Ethereum (preferred): $\text{Final}(A) = 0.40 - 0.02 = 0.38$. B: $0.60$.

**Result:** $0.38 < 0.60$ → **Route A (Ethereum direct) is recommended** with
default weights. Even though B is \$14 cheaper in gas, B is slower, has more
steps and is riskier — the gas saving does not outweigh the combined penalties.

**Savings:** baseline = max gas = \$18. A saves \$0; B saves \$14.

**Configurable weights demo:** with `gas: 0.9, time: 0.03, steps: 0.02, risk:
0.05`, scores flip to A ≈ 0.88 vs B ≈ 0.10 → **Route B wins**, because gas now
dominates the model. This is the whole point of configurable weights — tune
them to your risk appetite.

---

## 3. Route output contract

Every optimized route contains:

| Field | Description |
|---|---|
| `routeId` | Stable id (`routeA`, `planB`, …) |
| `chainSequence` | Ordered chains, e.g. `["Ethereum", "Polygon"]` |
| `tokenSequence` | Ordered tokens per hop, e.g. `["ETH", "USDC", "USDC"]` |
| `transactionCount` | On-chain txns |
| `estimatedGas` | USD |
| `estimatedDuration` | seconds |
| `riskScore` | 0–100 |
| `normalizedScore` | weighted score, $[0,1]$, **lower is better** |
| `optimizationScore` | `(1 − normalizedScore) × 100`, $[0,100]$, higher is better (display) |
| `estimatedSavings` | USD vs the most expensive candidate (baseline) |
| `recommendationReason` | deterministic, human-readable reason |
| `factorBreakdown` | normalized gas/time/steps/risk |
| `contributions` | weighted contributions $w_g\cdot\text{Gas}(r)$, … |
| `chainPreference` | preferred-chain match + bonus applied |
| `rank`, `isRecommended`, `strategy`, `source` | ranking metadata |

---

## 4. API

```
POST /api/route/optim
```

**Body:**

```jsonc
{
  "routes": [
    {
      "routeId": "routeA",
      "chainSequence": ["ethereum"],
      "tokenSequence": ["USDC"],
      "transactionCount": 1,
      "estimatedGas": 18,
      "estimatedDuration": 20,
      "riskScore": 8,
      "fundingAsset": "USDC",
      "strategy": "native_direct",
      "source": "deterministic"
    }
    // ... more candidates
  ],
  "weights": { "gas": 0.4, "time": 0.2, "steps": 0.15, "risk": 0.25 }, // optional
  "treasury": {
    "preferredChain": "ethereum",
    "targetChain": null,
    "availableAssets": [{ "symbol": "USDC", "usdValue": 25000 }]
  },
  "baselineGas": null // optional explicit savings baseline
}
```

**Response:**

```jsonc
{
  "success": true,
  "result": {
    "routes": [ /* OptimizedRoute[] ranked best-first */ ],
    "recommendedRouteId": "routeA",
    "weights": { "gas": 0.4, "time": 0.2, "steps": 0.15, "risk": 0.25 },
    "baselineGas": 18,
    "warnings": [],
    "source": "optimizer"
  }
}
```

Errors: `VALIDATION_FAILED` (422), `BODY_TOO_LARGE` (413),
`EMPTY_ROUTES`/`INVALID_WEIGHTS` (400), `INTERNAL` (500).
(`NO_FEASIBLE_ROUTES` is no longer emitted — infeasible routes are retained
with a penalty rather than rejected.)

---

## 5. Files

| Path | Purpose |
|---|---|
| `src/lib/route/types.ts` | domain types + `RouteOptimizerError` |
| `src/lib/route/catalog.ts` | default weights, preference bonus, `resolveWeights` |
| `src/lib/route/normalize.ts` | min-max normalization, savings, clamps |
| `src/lib/route/score.ts` | weighted scoring, ranking, recommendation reason |
| `src/lib/route/schema.ts` | Zod request/result schemas |
| `src/lib/route/optimizer.ts` | service + `fromPlannerPlans` adapter + treasury gate |
| `src/app/api/route/optim/route.ts` | `POST /api/route/optim` |
| `src/components/planner/RouteComparison.tsx` | route comparison UI (Phase 7) |
| `comps/planner/RouteComparison.tsx` | re-export shim |
| `scripts/route-selftest.ts` | deterministic unit tests (no key needed) |

**Run tests:** `cd frontend && npx tsc --noEmit` then
`npx tsx scripts/route-selftest.ts`
