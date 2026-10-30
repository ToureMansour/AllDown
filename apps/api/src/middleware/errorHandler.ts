import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "pino";

import { AppError } from "../utils/errors";
import { sanitizeLogText } from "../utils/logger";

interface RequestWithId {
  id?: string;
}

function requestIdOf(value: unknown): string {
  const request = value as RequestWithId;
  return typeof request?.id === "string" ? request.id : "";
}

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(
      new AppError(
        404,
        "NOT_FOUND",
        `La route ${req.method} ${req.path} n'existe pas.`,
      ),
    );
  };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (
      error instanceof SyntaxError &&
      (error as SyntaxError & { type?: string }).type === "entity.parse.failed"
    ) {
      appError = new AppError(
        400,
        "INVALID_REQUEST",
        "Le corps de la requête n'est pas un JSON valide.",
      );
    } else {
      appError = new AppError(
        500,
        "INTERNAL_ERROR",
        "Une erreur interne est survenue.",
        { cause: error },
      );
    }

    const requestId = requestIdOf(req);

    if (appError.status >= 500) {
      logger.error(
        {
          err: error,
          requestId,
          code: appError.code,
          status: appError.status,
          message: sanitizeLogText(appError.message),
        },
        "request failed",
      );
    } else {
      logger.warn(
        {
          requestId,
          code: appError.code,
          status: appError.status,
          message: sanitizeLogText(appError.message),
        },
        "request rejected",
      );
    }

    if (appError.retryAfterSeconds) {
      res.setHeader("Retry-After", String(appError.retryAfterSeconds));
    }

    const details =
      appError.code === "INVALID_REQUEST" ? appError.details : undefined;

    res.status(appError.status).json({
      ok: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(details ? { details } : {}),
      },
      requestId,
    });
  };
}
