import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

import type { AppConfig } from "../types";

const boolOrNumber = z
  .string()
  .optional()
  .transform((value) => {
    if (!value || value === "0" || value.toLowerCase() === "false") {
      return false as const;
    }
    if (value === "1" || value.toLowerCase() === "true") {
      return 1;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : false;
  });

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  TRUST_PROXY: boolOrNumber,
  LOG_LEVEL: z.string().default("info"),
  MAX_DOWNLOAD_SIZE_MB: z.coerce.number().int().min(1).max(20_480).default(200),
  DOWNLOAD_TIMEOUT_SECONDS: z.coerce.number().int().min(10).max(3_600).default(300),
  ANALYZE_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(300).default(45),
  MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().min(1).max(20).default(2),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(30),
  TEMP_DIR: optionalString,
  YTDLP_PATH: optionalString,
  FFMPEG_PATH: optionalString,
  ALLOWED_DOWNLOAD_HOSTS: z.string().optional().default(""),
  DOWNLOAD_SIGNING_SECRET: optionalString,
  YTDLP_VERSION: z.string().default("2026.10.26"),
});

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = parsed.data;
  const frontendOrigins = parseList(env.FRONTEND_ORIGIN);

  if (frontendOrigins.length === 0) {
    throw new Error("FRONTEND_ORIGIN must contain at least one allowed origin.");
  }

  for (const origin of frontendOrigins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      throw new Error(`FRONTEND_ORIGIN contains an invalid origin: ${origin}`);
    }
  }

  let downloadSigningSecret = env.DOWNLOAD_SIGNING_SECRET;
  if (!downloadSigningSecret) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "DOWNLOAD_SIGNING_SECRET is required in production (minimum 32 characters).",
      );
    }
    downloadSigningSecret = randomBytes(48).toString("base64url");
  }

  if (downloadSigningSecret.length < 32) {
    throw new Error("DOWNLOAD_SIGNING_SECRET must be at least 32 characters long.");
  }

  if (
    env.NODE_ENV === "production" &&
    frontendOrigins.every(
      (origin) =>
        origin.includes("localhost") || origin.includes("127.0.0.1"),
    )
  ) {
    throw new Error(
      "FRONTEND_ORIGIN must be set to the deployed frontend origin in production.",
    );
  }

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    frontendOrigins,
    trustProxy: env.TRUST_PROXY,
    logLevel: env.LOG_LEVEL,
    maxDownloadSizeMb: env.MAX_DOWNLOAD_SIZE_MB,
    downloadTimeoutSeconds: env.DOWNLOAD_TIMEOUT_SECONDS,
    analyzeTimeoutSeconds: env.ANALYZE_TIMEOUT_SECONDS,
    maxConcurrentDownloads: env.MAX_CONCURRENT_DOWNLOADS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    tempDir:
      env.TEMP_DIR ?? path.join(os.tmpdir(), "alldown"),
    ytdlpPath: env.YTDLP_PATH,
    ffmpegPath: env.FFMPEG_PATH,
    allowedDownloadHosts: parseList(env.ALLOWED_DOWNLOAD_HOSTS),
    downloadSigningSecret,
    ytdlpVersion: env.YTDLP_VERSION,
  };
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 4000,
    frontendOrigins: ["http://localhost:3000"],
    trustProxy: false,
    logLevel: "silent",
    maxDownloadSizeMb: 50,
    downloadTimeoutSeconds: 60,
    analyzeTimeoutSeconds: 10,
    maxConcurrentDownloads: 2,
    rateLimitWindowMs: 60_000,
    rateLimitMaxRequests: 100,
    tempDir: path.join(os.tmpdir(), `alldown-test-${randomBytes(4).toString("hex")}`),
    allowedDownloadHosts: [],
    downloadSigningSecret: "test-secret-that-is-long-enough-for-hmac-signing",
    ytdlpVersion: "2026.10.26",
    ...overrides,
  };
}
