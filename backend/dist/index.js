"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const env_js_1 = require("./config/env.js");
const health_js_1 = require("./routes/health.js");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: env_js_1.ENV.ALLOWED_ORIGINS,
    credentials: true,
}));
app.use(express_1.default.json());
app.use("/api/v1", health_js_1.healthRouter);
app.listen(env_js_1.ENV.PORT, () => {
    console.log(`[Backend] Agentic Router Server running on port ${env_js_1.ENV.PORT} (${env_js_1.ENV.NODE_ENV})`);
});
exports.default = app;
