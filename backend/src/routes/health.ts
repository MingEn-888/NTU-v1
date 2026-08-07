import { Router, Request, Response } from "express";
import { ApiResponse } from "@intent-router/shared";

export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  const response: ApiResponse<{ status: string; service: string; timestamp: number }> = {
    success: true,
    data: {
      status: "HEALTHY",
      service: "intent-agentic-payment-router-backend",
      timestamp: Date.now(),
    },
    meta: {
      timestamp: Date.now(),
    },
  };
  res.status(200).json(response);
});
