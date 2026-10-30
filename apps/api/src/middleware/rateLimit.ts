import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";

import type { AppConfig } from "../types";

export function createApiRateLimiter(config: AppConfig) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMaxRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    handler: (req: Request, res: Response) => {
      const requestId = String((req as Request & { id?: string }).id ?? "");
      res.status(429).json({
        ok: false,
        error: {
          code: "RATE_LIMITED",
          message:
            "Trop de requêtes. Patientez quelques instants avant de réessayer.",
        },
        requestId,
      });
    },
  });
}
