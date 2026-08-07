export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: number;
    requestId?: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface WsAgentEvent {
  type: "INTENT_UPDATE" | "ROUTE_PROPOSED" | "STEP_EXECUTED" | "AGENT_LOG";
  intentId: string;
  payload: unknown;
  timestamp: number;
}
