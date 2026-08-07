"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get("/health", (_req, res) => {
    const response = {
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
