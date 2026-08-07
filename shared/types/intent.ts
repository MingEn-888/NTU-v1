export type IntentStatus =
  | "CREATED"
  | "ANALYZING"
  | "ROUTING"
  | "OPTIMIZED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type RoutingPriority = "SPEED" | "LOW_COST" | "MAX_SECURITY" | "BALANCED";

export interface IntentConstraints {
  maxSlippagePercent: number;
  maxGasFeeUsd: number;
  deadlineTimestamp: number;
  priority: RoutingPriority;
  requirePrivacy?: boolean;
}

export interface IntentPayload {
  sourceChainId: number;
  targetChainId: number;
  sourceAssetSymbol: string;
  targetAssetSymbol: string;
  sourceAssetAddress: string;
  targetAssetAddress: string;
  amountIn: string;
  minAmountOut: string;
  recipientAddress: string;
  senderAddress: string;
}

export interface UserIntent {
  id: string;
  userId: string;
  status: IntentStatus;
  payload: IntentPayload;
  constraints: IntentConstraints;
  selectedRouteId?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  agentNotes?: string;
}
