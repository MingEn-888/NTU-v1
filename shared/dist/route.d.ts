export interface RouteStep {
    stepIndex: number;
    protocolName: string;
    actionType: "SWAP" | "BRIDGE" | "WRAP" | "UNWRAP" | "STAKE";
    fromChainId: number;
    toChainId: number;
    fromAsset: string;
    toAsset: string;
    expectedAmountIn: string;
    expectedAmountOut: string;
    estimatedGasUsd: number;
    contractAddress?: string;
}
export interface RouteScore {
    totalScore: number;
    gasEfficiencyScore: number;
    speedScore: number;
    securityScore: number;
    slippageScore: number;
}
export interface RouteOption {
    id: string;
    intentId: string;
    solverName: string;
    steps: RouteStep[];
    totalEstimatedGasUsd: number;
    totalEstimatedTimeMs: number;
    estimatedAmountOut: string;
    priceImpactPercent: number;
    score: RouteScore;
    recommended: boolean;
    validUntil: number;
}
//# sourceMappingURL=route.d.ts.map