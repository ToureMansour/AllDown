import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

import type { AppConfig, YtdlpRunner } from "./types";
import { createLogger } from "./utils/logger";
import { Semaphore } from "./utils/semaphore";
import { YtdlpService } from "./services/ytdlp";
import { UrlSafety } from "./services/urlSafety";
import { MediaService } from "./services/mediaService";
import { DownloadTicketService } from "./services/downloadTicket";
import { createApiRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createApiRouter } from "./routes";
import {
  createHealthController,
  createPlatformsController,
} from "./controllers/systemController";

export interface CreateAppOptions {
  config: AppConfig;
  logger?: Logger;
  runner?: YtdlpRunner;
  urlSafety?: UrlSafety;
}

export function createApp(options: CreateAppOptions) {
  const { config } = options;
  const logger = options.logger ?? createLogger(config);
  const runner = options.runner ?? new YtdlpService(config);
  const urlSafety =
    options.urlSafety ??
    new UrlSafety({ allowedHosts: config.allowedDownloadHosts });

  const tickets = new DownloadTicketService(config.downloadSigningSecret);
  const semaphore = new Semaphore(config.maxConcurrentDownloads);
  const mediaService = new MediaService(config, runner, urlSafety);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const requestId = randomUUID();
        res.setHeader("X-Request-Id", requestId);
        return requestId;
      },
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req(req) {
          const rawUrl = String(req.url ?? "");
          const cleanUrl = rawUrl
            .split("?")[0]
            ?.replace(/\/api\/v1\/media\/file\/[^/]+/, "/api/v1/media/file/[redacted]");
          return { method: req.method, url: cleanUrl };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.frontendOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "Retry-After"],
      maxAge: 600,
      credentials: false,
    }),
  );

  app.use(express.json({ limit: "10kb", strict: true }));

  app.get("/health", createHealthController(runner));
  app.get("/api/v1/platforms", createPlatformsController(runner));

  app.use(
    "/api/v1",
    createApiRateLimiter(config),
    createApiRouter({ mediaService, tickets, semaphore }),
  );

  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}
