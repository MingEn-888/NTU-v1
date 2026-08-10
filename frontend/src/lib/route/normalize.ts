// =============================================================================
// IBAP Phase 7 — Deterministic Route Optimization (normalization functions)
//
// Every factor of a candidate route is min-max normalized to [0,1] across the
// candidate set: 0 = best in the set, 1 = worst. This makes the four factors
// (gas, time, steps, risk) dimension-free and directly comparable inside the
// weighted scoring model.
//
//   factor(r) = (value(r) - minValue) / (maxValue - minValue)
//
// When every route shares the same value for a factor (max == min) the factor
// is defined as 0 — it cannot influence the ranking. All functions are pure
// and deterministic (same inputs -> same outputs).
// =============================================================================

/** Min-max normalize a single value within [min, max]. 0 = best, 1 = worst. */
export function minMaxNormalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  if (!isFinite(t)) return 0;
  return Math.min(1, Math.max(0, t));
}

/** Normalize an array of values to [0,1] using the array's own min/max. */
export function normalizeArray(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((v) => minMaxNormalize(v, min, max));
}

/**
 * Clamp a raw factor value into its domain bounds before normalization.
 * Guards the engine against malformed inputs (e.g. negative gas, absurd
 * durations) so a single bad route can never distort the whole ranking.
 */
export function clampFactor(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the normalized factor breakdown for every route.
 *
 * Returns an array parallel to `routes`, each entry being
 *   { gas, time, steps, risk } all in [0,1] (0 = best).
 */
export function computeFactorBreakdowns(routeValues: {
  gas: number[];
  time: number[];
  steps: number[];
  risk: number[];
}): { gas: number; time: number; steps: number; risk: number }[] {
  const gas = normalizeArray(routeValues.gas);
  const time = normalizeArray(routeValues.time);
  const steps = normalizeArray(routeValues.steps);
  const risk = normalizeArray(routeValues.risk);
  return routeValues.gas.map((_, i) => ({
    gas: gas[i],
    time: time[i],
    steps: steps[i],
    risk: risk[i],
  }));
}

/**
 * Estimated savings (USD) for a route versus a baseline gas cost.
 *
 * The default baseline is the most expensive candidate route, so the cheapest
 * route shows the largest positive savings and the most expensive shows 0.
 * Savings are never negative (a route cannot "cost more than baseline" by
 * definition of using the max as baseline).
 */
export function computeSavings(routeGas: number, baselineGas: number): number {
  return Math.max(0, round2(baselineGas - routeGas));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
