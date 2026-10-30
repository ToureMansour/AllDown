import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../utils/errors";

export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(400, "INVALID_REQUEST", "La requête n'est pas valide.", {
          details: {
            fields: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        }),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
