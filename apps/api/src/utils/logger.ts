import pino, { type Logger } from "pino";

import type { AppConfig } from "../types";

export function createLogger(config: AppConfig): Logger {
  const options: pino.LoggerOptions = {
    level: config.logLevel,
    base: { service: "alldown-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
      ],
      censor: "[redacted]",
    },
  };

  if (config.nodeEnv === "development") {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
    });
  }

  return pino(options);
}

export function sanitizeLogText(value: string, maxLength = 300): string {
  return value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, maxLength);
}
