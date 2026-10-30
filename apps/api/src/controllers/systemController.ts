import type { RequestHandler } from "express";

import { publicPlatforms } from "../config/platforms";
import type { YtdlpRunner } from "../types";
import { asyncHandler } from "../utils/asyncHandler";

export function createHealthController(runner: YtdlpRunner): RequestHandler {
  return asyncHandler(async (_req, res) => {
    const status = await runner.status();
    const healthy = status.ytdlpAvailable;

    res.status(healthy ? 200 : 503).json({
      ok: healthy,
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        ytdlp: {
          available: status.ytdlpAvailable,
          version: status.ytdlpVersion,
        },
        ffmpeg: {
          available: status.ffmpegAvailable,
        },
      },
    });
  });
}

export function createPlatformsController(runner: YtdlpRunner): RequestHandler {
  return asyncHandler(async (_req, res) => {
    const status = await runner.status();

    res.json({
      ok: true,
      data: {
        engine: {
          ytdlpAvailable: status.ytdlpAvailable,
          ytdlpVersion: status.ytdlpVersion,
          ffmpegAvailable: status.ffmpegAvailable,
        },
        platforms: publicPlatforms(),
      },
    });
  });
}
