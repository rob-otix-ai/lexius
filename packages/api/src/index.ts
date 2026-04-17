import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";
import { setup } from "@lexius/infra";
import { createApiRouter } from "./routes/index.js";
import { errorHandler, rateLimiter, requestSizeLimit, apiKeyAuth } from "./middleware/index.js";
import { provenanceMetadata } from "./middleware/provenance-metadata.js";

const { container, pool, db } = setup();

const app: Express = express();
app.use(cors());
app.use(express.json());
app.use((pinoHttp as any)({ logger }));
app.use(requestSizeLimit(1_048_576));  // 1MB
app.use(rateLimiter({ windowMs: 60_000, max: 100 }));
app.use(apiKeyAuth({ db }));

app.get("/health", (_req, res) => { res.json({ status: "ok" }); });
app.use("/api/v1", provenanceMetadata(db), createApiRouter(container));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT }, "legal-ai API server started");
});
