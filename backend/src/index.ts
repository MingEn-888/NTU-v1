import express from "express";
import cors from "cors";
import { ENV } from "./config/env.js";
import { healthRouter } from "./routes/health.js";

const app = express();

app.use(
  cors({
    origin: ENV.ALLOWED_ORIGINS,
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/v1", healthRouter);

app.listen(ENV.PORT, () => {
  console.log(`[Backend] IBAP Payment Router running on port ${ENV.PORT} (${ENV.NODE_ENV})`);
});

export default app;
