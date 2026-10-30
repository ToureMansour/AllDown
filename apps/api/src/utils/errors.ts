export type ErrorCode =
  | "INVALID_URL"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_PROTOCOL"
  | "FORBIDDEN_URL"
  | "DOMAIN_NOT_ALLOWED"
  | "UNRESOLVABLE_HOST"
  | "PLAYLIST_NOT_SUPPORTED"
  | "LIVE_NOT_SUPPORTED"
  | "MEDIA_UNAVAILABLE"
  | "MEDIA_RESTRICTED"
  | "FORMAT_NOT_AVAILABLE"
  | "ENGINE_UNAVAILABLE"
  | "FFMPEG_UNAVAILABLE"
  | "ENGINE_ERROR"
  | "ENGINE_TIMEOUT"
  | "DOWNLOAD_TOO_LARGE"
  | "DOWNLOAD_BUSY"
  | "DOWNLOAD_FAILED"
  | "DOWNLOAD_EXPIRED"
  | "INVALID_TOKEN"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetails;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { details?: ErrorDetails; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class AbortError extends Error {
  constructor() {
    super("Operation aborted");
    this.name = "AbortError";
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof AbortError ||
    (error instanceof Error && error.name === "AbortError")
  );
}
