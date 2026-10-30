import { createHmac, timingSafeEqual } from "node:crypto";

import { AppError } from "../utils/errors";

export interface DownloadTicketPayload {
  url: string;
  formatId: string;
  fileName: string;
  expiresAt: number;
}

interface SignedTicket extends DownloadTicketPayload {
  v: 1;
}

function encode(payload: SignedTicket, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function decodeJson(token: string): SignedTicket {
  const [body] = token.split(".");
  if (!body) {
    throw new AppError(
      401,
      "INVALID_TOKEN",
      "Le lien de téléchargement est invalide.",
    );
  }

  try {
    return JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SignedTicket;
  } catch {
    throw new AppError(
      401,
      "INVALID_TOKEN",
      "Le lien de téléchargement est invalide.",
    );
  }
}

export class DownloadTicketService {
  constructor(private readonly secret: string) {}

  sign(
    payload: Omit<DownloadTicketPayload, "expiresAt">,
    ttlSeconds = 300,
  ): { token: string; expiresAt: number } {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = encode({ v: 1, ...payload, expiresAt }, this.secret);
    return { token, expiresAt };
  }

  verify(token: string): DownloadTicketPayload {
    if (!token || token.length > 4_096) {
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "Le lien de téléchargement est invalide.",
      );
    }

    const separator = token.lastIndexOf(".");
    if (separator <= 0) {
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "Le lien de téléchargement est invalide.",
      );
    }

    const body = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    const expected = createHmac("sha256", this.secret)
      .update(body)
      .digest("base64url");

    const givenBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (
      givenBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(givenBuffer, expectedBuffer)
    ) {
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "Le lien de téléchargement est invalide.",
      );
    }

    const payload = decodeJson(token);
    if (
      payload.v !== 1 ||
      typeof payload.url !== "string" ||
      typeof payload.formatId !== "string" ||
      typeof payload.fileName !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      throw new AppError(
        401,
        "INVALID_TOKEN",
        "Le lien de téléchargement est invalide.",
      );
    }

    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) {
      throw new AppError(
        410,
        "DOWNLOAD_EXPIRED",
        "Ce lien de téléchargement a expiré. Relancez l'analyse.",
      );
    }

    return {
      url: payload.url,
      formatId: payload.formatId,
      fileName: payload.fileName,
      expiresAt: payload.expiresAt,
    };
  }
}
