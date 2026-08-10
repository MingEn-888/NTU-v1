// =============================================================================
// Phase 11 — IBAP Business Payment Operations Dashboard types.
//
// These are the canonical shapes the dashboard renders. The server route
// (/api/dashboard) produces a fully-shaped DashboardData payload from either
// live Supabase rows (queries.ts + analytics.ts) or a deterministic seeded
// demo payload when Supabase is unavailable (offline mode).
// =============================================================================

/** Canonical payment lifecycle status (mirrors payment_requests.status). */
export type PaymentStatus =
  | "DRAFT"
  | "PLANNING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface ChainSummary {
  id: number;
  name: string;
  /** Native symbol of the chain (ETH / POL / etc). */
  symbol: string;
  /** USD value currently held on this chain. */
  assetUsd: number;
  /** Short label for chips, e.g. "Polygon". */
  label: string;
}

export interface TreasurySummary {
  businessName: string;
  preferredChain: string;
  walletAddress: string | null;
  ens: string | null;
  /** Total estimated treasury value in USD. */
  totalValueUsd: number;
  /** Spendable USDC balance in USD. */
  availableUsdc: number;
  /** Native gas balance (native token amount, e.g. 1,250.5 POL). */
  nativeGasBalance: number;
  /** Symbol of the native gas asset on the active chain. */
  nativeSymbol: string;
  /** Chains the treasury holds balances on / can route across. */
  supportedChains: ChainSummary[];
  isWalletAssociated: boolean;
}

export interface PaymentOperationCounts {
  pendingApprovals: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface RecentPayment {
  id: string;
  recipientName: string;
  recipientAddress: string;
  amount: number;
  currency: string;
  /** Settlement amount in USDC-equivalent (post FX). */
  netAmountUsdc: number;
  purpose: string;
  status: PaymentStatus;
  /** Gas cost of the settlement transaction in USD (0 if not confirmed). */
  gasCostUsd: number;
  chain: string;
  savingsUsd: number;
  createdAt: string;
  txHash?: string | null;
  explorerUrl?: string | null;
}

export interface OptimizationMetrics {
  totalGasSavedUsd: number;
  avgPaymentCostUsd: number;
  avgExecutionTimeSec: number;
  avgTxnsPerPayment: number;
  /** Number of settled (completed) payments used as the basis. */
  settledCount: number;
}

export interface TimeSeriesPoint {
  /** ISO date (midnight). */
  date: string;
  /** Human label, e.g. "Aug 8". */
  label: string;
  gasSavedUsd: number;
  payments: number;
}

export interface ChainVolumePoint {
  chain: string;
  payments: number;
  volumeUsd: number;
  gasSavedUsd: number;
}

export interface VolumePoint {
  label: string;
  volumeUsd: number;
  payments: number;
}

export interface RouteAnalytics {
  gasSavedOverTime: TimeSeriesPoint[];
  paymentsByChain: ChainVolumePoint[];
  paymentVolume: VolumePoint[];
  /** Number of days of history shown in the time series. */
  windowDays: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ApprovalItem {
  id: string;
  recipientName: string;
  recipientAddress: string;
  amount: number;
  currency: string;
  netAmountUsdc: number;
  purpose: string;
  /** Selected route label, e.g. "Polygon direct". */
  routeName: string;
  chain: string;
  riskLevel: RiskLevel;
  riskScore: number;
  savingsUsd: number;
  dueDate: string | null;
  createdAt: string;
  invoiceRef?: string | null;
}

export interface DashboardData {
  treasury: TreasurySummary;
  operations: PaymentOperationCounts;
  recentPayments: RecentPayment[];
  optimization: OptimizationMetrics;
  routeAnalytics: RouteAnalytics;
  approvals: ApprovalItem[];
  isFallback: boolean;
  fallbackReason?: string;
  generatedAt: string;
}
