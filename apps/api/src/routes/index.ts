import { Router } from "express";

import {
  createAnalyzeController,
  createDownloadController,
  createFileController,
} from "../controllers/mediaController";
import type { DownloadTicketService } from "../services/downloadTicket";
import type { MediaService } from "../services/mediaService";
import type { Semaphore } from "../utils/semaphore";
import { validateBody } from "../middleware/validate";
import { analyzeSchema, downloadSchema } from "../validators/media";

export interface MediaRouterDependencies {
  mediaService: MediaService;
  tickets: DownloadTicketService;
  semaphore: Semaphore;
}

export function createApiRouter(deps: MediaRouterDependencies): Router {
  const router = Router();

  router.post(
    "/media/analyze",
    validateBody(analyzeSchema),
    createAnalyzeController(deps.mediaService),
  );

  router.post(
    "/media/download",
    validateBody(downloadSchema),
    createDownloadController(deps.mediaService, deps.tickets),
  );

  router.get(
    "/media/file/:token",
    createFileController(deps.mediaService, deps.tickets, deps.semaphore),
  );

  return router;
}
