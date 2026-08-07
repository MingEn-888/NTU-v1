export type TxStatus = "PENDING" | "CONFIRMED" | "FAILED";

export interface ExecutionStepLog {
  stepIndex: number;
  txHash?: string;
  chainId: number;
  status: TxStatus;
  gasUsed?: string;
  effectiveGasPrice?: string;
  errorMessage?: string;
  timestamp: number;
}

export interface TransactionRecord {
  id: string;
  intentId: string;
  routeId: string;
  userAddress: string;
  status: TxStatus;
  logs: ExecutionStepLog[];
  startedAt: number;
  completedAt?: number;
  finalTxHash?: string;
}
