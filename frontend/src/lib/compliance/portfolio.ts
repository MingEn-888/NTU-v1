// =============================================================================
// PayMaster — DPT Treasury Compliance Layer · Portfolio Monitoring
//
// Monitors the DPT treasury as a portfolio:
//   - total treasury value
//   - per-asset USD value, allocation %, 24h change, volatility, liquidity
//   - stablecoin reserve share
//   - concentration risk (a single non-stablecoin asset dominating)
//   - portfolio risk level
//   - treasury warnings (allocation limit exceeded / volatility high /
//     liquidity low / stablecoin reserve below min / over-concentration)
//
// Deterministic — all prices/volatility are simulated reference data.
// =============================================================================

import {
  POLICY_LIMITS,
  SIMULATED_PRICES,
  STABLECOIN_ASSETS,
  isStablecoin,
  simulatedPrice,
} from "./catalog";
import type { ComplianceRiskLevel } from "./types";

// ---------------------------------------------------------------------------
// Simulated market reference data (per asset)
// ---------------------------------------------------------------------------

interface MarketMeta {
  /** Simulated 24h price change as a fraction (e.g. 0.03 = +3%). */
  change24h: number;
  /** Simulated annualized volatility (0-1). */
  volatility: number;
  /** Simulated liquidity indicator 0-100 (higher = more liquid). */
  liquidity: number;
}

const MARKET_META: Record<string, MarketMeta> = {
  USDC: { change24h: 0.0001, volatility: 0.005, liquidity: 95 },
  USDT: { change24h: 0.0002, volatility: 0.006, liquidity: 94 },
  DAI: { change24h: 0.0001, volatility: 0.005, liquidity: 90 },
  ETH: { change24h: 0.024, volatility: 0.42, liquidity: 85 },
  WETH: { change24h: 0.024, volatility: 0.42, liquidity: 85 },
  BTC: { change24h: 0.018, volatility: 0.38, liquidity: 88 },
  WBTC: { change24h: 0.018, volatility: 0.38, liquidity: 84 },
  POL: { change24h: 0.03, volatility: 0.52, liquidity: 72 },
  MATIC: { change24h: 0.03, volatility: 0.52, liquidity: 72 },
  SOL: { change24h: 0.04, volatility: 0.6, liquidity: 68 },
  BNB: { change24h: 0.02, volatility: 0.44, liquidity: 74 },
};

function marketMetaOf(symbol: string): MarketMeta {
  return (
    MARKET_META[symbol.toUpperCase()] ?? {
      change24h: 0.05,
      volatility: 0.6,
      liquidity: 30,
    }
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PortfolioAsset {
  symbol: string;
  /** USD value currently held. */
  usdValue: number;
  /** Share of the treasury (0-1). */
  allocation: number;
  /** Simulated 24h price change as a fraction. */
  change24h: number;
  /** Simulated annualized volatility (0-1). */
  volatility: number;
  /** Simulated liquidity 0-100. */
  liquidity: number;
  /** True for stablecoin reserve assets. */
  isStablecoin: boolean;
}

export type PortfolioWarningKind =
  | "allocation_exceeded"
  | "high_volatility"
  | "low_liquidity"
  | "stablecoin_reserve_below_min"
  | "over_concentrated";

export interface PortfolioWarning {
  kind: PortfolioWarningKind;
  severity: ComplianceRiskLevel;
  message: string;
}

export interface PortfolioSnapshot {
  totalValueUsd: number;
  assets: PortfolioAsset[];
  /** Stablecoin share of the treasury (0-1). */
  stablecoinShare: number;
  /** Share held in volatile / non-stablecoin DPT assets. */
  dptShare: number;
  /** Highest single non-stablecoin allocation (0-1). */
  maxConcentration: number;
  /** Symbol with the highest non-stablecoin allocation. */
  maxConcentrationAsset: string | null;
  /** Overall portfolio risk level. */
  portfolioRisk: ComplianceRiskLevel;
  warnings: PortfolioWarning[];
  simulated: true;
}

// ---------------------------------------------------------------------------
// Portfolio analysis (deterministic)
// ---------------------------------------------------------------------------

export function analyzePortfolio(
  holdings: { symbol: string; usdValue: number }[]
): PortfolioSnapshot {
  const total = holdings.reduce((sum, h) => sum + Math.max(0, h.usdValue), 0);

  const assets: PortfolioAsset[] = holdings.map((h) => {
    const meta = marketMetaOf(h.symbol);
    return {
      symbol: h.symbol.toUpperCase(),
      usdValue: Math.max(0, h.usdValue),
      allocation: total > 0 ? Math.max(0, h.usdValue) / total : 0,
      change24h: meta.change24h,
      volatility: meta.volatility,
      liquidity: meta.liquidity,
      isStablecoin: isStablecoin(h.symbol),
    };
  });

  const stableValue = assets.filter((a) => a.isStablecoin).reduce((s, a) => s + a.usdValue, 0);
  const stablecoinShare = total > 0 ? stableValue / total : 0;
  const dptShare = 1 - stablecoinShare;

  // Highest non-stablecoin allocation (concentration).
  let maxConcentration = 0;
  let maxConcentrationAsset: string | null = null;
  for (const a of assets) {
    if (!a.isStablecoin && a.allocation > maxConcentration) {
      maxConcentration = a.allocation;
      maxConcentrationAsset = a.symbol;
    }
  }

  // Portfolio risk: blend concentration + volatility + liquidity.
  const avgVolatility = assets.reduce((s, a) => s + a.volatility * a.allocation, 0);
  const avgLiquidity = assets.reduce((s, a) => s + a.liquidity * a.allocation, 0);
  let portfolioRisk: ComplianceRiskLevel = "LOW";
  if (maxConcentration >= 0.6 || avgVolatility > 0.4 || avgLiquidity < 50) portfolioRisk = "HIGH";
  else if (maxConcentration > 0.4 || avgVolatility > 0.25 || avgLiquidity < 70) portfolioRisk = "MEDIUM";

  // Warnings.
  const warnings: PortfolioWarning[] = [];
  for (const a of assets) {
    if (!a.isStablecoin && a.allocation > POLICY_LIMITS.maxAssetConcentrationPct) {
      warnings.push({
        kind: "allocation_exceeded",
        severity: "HIGH",
        message: `${a.symbol} allocation ${(a.allocation * 100).toFixed(0)}% exceeds the ${(POLICY_LIMITS.maxAssetConcentrationPct * 100).toFixed(0)}% policy max`,
      });
    }
    if (a.volatility > 0.5) {
      warnings.push({
        kind: "high_volatility",
        severity: "MEDIUM",
        message: `${a.symbol} volatility is unusually high (${(a.volatility * 100).toFixed(0)}% annualized, simulated)`,
      });
    }
    if (a.liquidity < 60) {
      warnings.push({
        kind: "low_liquidity",
        severity: "MEDIUM",
        message: `${a.symbol} liquidity is low (${a.liquidity}/100, simulated)`,
      });
    }
  }
  if (stablecoinShare < POLICY_LIMITS.minStablecoinReservePct) {
    warnings.push({
      kind: "stablecoin_reserve_below_min",
      severity: "HIGH",
      message: `Stablecoin reserve ${(stablecoinShare * 100).toFixed(0)}% is below the ${(POLICY_LIMITS.minStablecoinReservePct * 100).toFixed(0)}% minimum`,
    });
  }
  if (maxConcentration >= 0.6) {
    warnings.push({
      kind: "over_concentrated",
      severity: "HIGH",
      message: `Portfolio is over-concentrated: ${maxConcentrationAsset} holds ${(maxConcentration * 100).toFixed(0)}% of the treasury`,
    });
  } else if (maxConcentration > 0.4) {
    warnings.push({
      kind: "over_concentrated",
      severity: "MEDIUM",
      message: `Portfolio concentration is elevated: ${maxConcentrationAsset} holds ${(maxConcentration * 100).toFixed(0)}% of the treasury`,
    });
  }

  return {
    totalValueUsd: total,
    assets,
    stablecoinShare,
    dptShare,
    maxConcentration,
    maxConcentrationAsset,
    portfolioRisk,
    warnings,
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulated current price of an asset (USD). */
export function priceOf(symbol: string): number {
  return simulatedPrice(symbol) || SIMULATED_PRICES[symbol.toUpperCase()] || 1;
}

/** Simulated price 24h ago given the 24h change. */
export function price24hAgo(symbol: string): number {
  const meta = marketMetaOf(symbol);
  return priceOf(symbol) / (1 + meta.change24h);
}

/** Human label for an asset's 24h change. */
export function changeLabel(change24h: number): string {
  const pct = change24h * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}
