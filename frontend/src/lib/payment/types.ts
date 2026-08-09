// =============================================================================
// IBAP Phase 4 — AI Payment Operations domain types
// These types model the full Natural Language -> Payment Request -> Plan -> Approval
// lifecycle that the payment operations agent walks the user through.
// =============================================================================

export type ChatRole = "user" | "agent";

export type ChatMessageStatus = "streaming" | "complete" | "error";

/** Stage of the payment operation pipeline for the UI stepper. */
export type OperationStage =
  | "natural_language"
  | "payment_request"
  | "payment_plan"
  | "approval"
  | "executing"
  | "complete";

/** Result of the natural-language intent parser. */
export interface ParsedPaymentIntent {
  detected: boolean;
  /** Canonical action e.g. PAY_VENDOR, SETTLE_INVOICE, REIMBURSE, PAY_RECIPIENT */
  action: string;
  recipientName: string | null;
  recipientAddress: string | null;
  amount: number | null;
  /** Currency as written by the user e.g. RM, USD, USDC, ETH */
  currency: string | null;
  /** Settlement asset the treasury will actually move e.g. USDC, USDT, ETH */
  requestedCurrency: string | null;
  purpose: string | null;
  invoiceNumber: string | null;
  deadlineLabel: string | null;
  deadlineDate: string | null;
  confidence: number;
  missingInformation: string[];
  rawInput: string;
}

export interface RouteOption {
  id: string;
  routeName: string;
  chain: string;
  estimatedGas: number;
  estimatedTime: number;
  transactionCount: number;
  riskScore: number;
  totalScore: number;
  savings: number;
  isRecommended: boolean;
}

export interface PaymentStep {
  stepOrder: number;
  actionType: string;
  title: string;
  description: string;
  status: "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED";
}

export interface RiskAssessment {
  balanceCheck: "PASS" | "WARN" | "FAIL";
  recipientCheck: "PASS" | "WARN" | "FAIL";
  slippageCheck: "PASS" | "WARN" | "FAIL";
  networkCheck: "PASS" | "WARN" | "FAIL";
  contractCheck: "PASS" | "WARN" | "FAIL";
  overallRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  warnings: string[];
}

export interface PaymentPlan {
  settlementAsset: string;
  settlementAmount: number;
  fxRate: number;
  totalEstimatedGas: number;
  estimatedDuration: number;
  savings: number;
  explanation: string;
  routes: RouteOption[];
  steps: PaymentStep[];
  risk: RiskAssessment;
}

/** UUIDs of the records persisted in Supabase for this operation. */
export interface PersistedEntityIds {
  paymentRequestId: string;
  intentId: string;
  planId: string;
  routeIds: string[];
}

/** A single message in the conversation (client + persisted shape). */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatMessageStatus;
  intent?: ParsedPaymentIntent | null;
  plan?: PaymentPlan | null;
  entityIds?: PersistedEntityIds | null;
  createdAt: string;
  error?: string | null;
}

/** Shape returned by POST /api/chat. */
export interface ChatSendResponse {
  success: boolean;
  message: ChatMessage;
  operationStage?: OperationStage;
  error?: { code: string; message: string; details?: unknown };
}

/** Shape returned by POST /api/chat/execute. */
export interface ExecuteResponse {
  success: boolean;
  paymentRequestId: string;
  txHash?: string;
  status?: string;
  explorerUrl?: string;
  error?: { code: string; message: string; details?: unknown };
}
