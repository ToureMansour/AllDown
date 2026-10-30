import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { RequestHandler } from "express";

import type { DownloadPreparation, MediaService } from "../services/mediaService";
import type { DownloadTicketService } from "../services/downloadTicket";
import type { Semaphore } from "../utils/semaphore";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError, isAbortError } from "../utils/errors";
import { contentDisposition } from "../utils/sanitize";
import { contentTypeForExtension } from "../utils/mime";

export function createAnalyzeController(mediaService: MediaService): RequestHandler {
  return asyncHandler(async (req, res) => {
    const { url } = req.body as { url: string };
    const result = await mediaService.analyze(url);
    res.json({ ok: true, data: result });
  });
}

export function createDownloadController(
  mediaService: MediaService,
  tickets: DownloadTicketService,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const { url, formatId } = req.body as { url: string; formatId: string };
    const resolved = await mediaService.resolveFormat(url, formatId);
    const fileName = mediaService.suggestedFileName(
      resolved.info,
      resolved.selected.option,
    );
    const { token, expiresAt } = tickets.sign({
      url: resolved.url.href,
      formatId,
      fileName,
    });

    res.json({
      ok: true,
      data: {
        downloadUrl: `/api/v1/media/file/${token}`,
        fileName,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        expiresInSeconds: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
        format: resolved.selected.option,
      },
    });
  });
}

export function createFileController(
  mediaService: MediaService,
  tickets: DownloadTicketService,
  semaphore: Semaphore,
): RequestHandler {
  return asyncHandler(async (req, res) => {
    const rawToken = req.params.token;
    const token = Array.isArray(rawToken) ? (rawToken[0] ?? "") : (rawToken ?? "");
    const payload = tickets.verify(token);

    const release = semaphore.tryAcquire();
    if (!release) {
      throw new AppError(
        503,
        "DOWNLOAD_BUSY",
        "Trop de téléchargements sont en cours. Réessayez dans quelques instants.",
        { retryAfterSeconds: 20 },
      );
    }

    const controller = new AbortController();
    let prepared: DownloadPreparation | null = null;
    let cleaned = false;
    let completed = false;

    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      if (prepared) await prepared.cleanup();
      release();
    };

    res.once("finish", () => {
      completed = true;
      void cleanup();
    });

    res.once("close", () => {
      if (!completed) {
        controller.abort();
        void cleanup();
      }
    });

    try {
      prepared = await mediaService.prepareDownload(
        payload.url,
        payload.formatId,
        controller.signal,
      );
    } catch (error) {
      await cleanup();
      if (isAbortError(error) || controller.signal.aborted) {
        if (!res.writableEnded) res.destroy();
        return;
      }
      throw error;
    }

    const file = prepared;
    res.status(200);
    res.setHeader("Content-Type", contentTypeForExtension(file.container));
    res.setHeader("Content-Length", String(file.sizeBytes));
    res.setHeader("Content-Disposition", contentDisposition(file.fileName));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    try {
      await pipeline(createReadStream(file.filePath), res);
    } catch (error) {
      if (!res.headersSent && !isAbortError(error)) {
        throw error;
      }
    } finally {
      await cleanup();
    }
  });
}
