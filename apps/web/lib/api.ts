export type PlatformStatus = "supported" | "experimental" | "restricted";
export type MediaKind = "video" | "audio" | "image" | "file";

export interface MediaFormat {
  id: string;
  kind: MediaKind;
  label: string;
  container: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  fileSizeBytes: number | null;
  requiresMerge: boolean;
  requiresFfmpeg: boolean;
  hasAudio: boolean;
  note: string | null;
}

export interface AnalyzedMedia {
  title: string;
  description: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  webpageUrl: string;
  uploader: string | null;
  isLive: boolean;
  mediaType: MediaKind;
  platform: {
    id: string;
    label: string;
    status: PlatformStatus;
    note: string;
  };
}

export interface AnalyzeResponse {
  media: AnalyzedMedia;
  formats: MediaFormat[];
  warnings: string[];
  limits: {
    maxDownloadSizeMb: number;
  };
}

export interface DownloadResponse {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
  expiresInSeconds: number;
  format: MediaFormat;
}

export interface PlatformInfo {
  id: string;
  label: string;
  hosts: string[];
  status: PlatformStatus;
  note: string;
}

export interface PlatformsResponse {
  engine: {
    ytdlpAvailable: boolean;
    ytdlpVersion: string | null;
    ffmpegAvailable: boolean;
  };
  platforms: PlatformInfo[];
}

interface ApiEnvelope<T> {
  ok: boolean;
  data: T;
}

interface ApiErrorEnvelope {
  ok: false;
  error?: {
    code?: string;
    message?: string;
  };
  requestId?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(
    code: string,
    message: string,
    status = 0,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

export function absoluteApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      "Impossible de joindre le serveur AllDown. Vérifiez votre connexion et réessayez.",
    );
  }

  let payload: ApiEnvelope<T> | ApiErrorEnvelope | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const errorPayload = payload as ApiErrorEnvelope | null;
    throw new ApiError(
      errorPayload?.error?.code ?? "API_ERROR",
      errorPayload?.error?.message ??
        "Le serveur n'a pas pu traiter la demande.",
      response.status,
      errorPayload?.requestId,
    );
  }

  return payload.data;
}

export async function analyzeMedia(
  url: string,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>(
    "/api/v1/media/analyze",
    { method: "POST", body: JSON.stringify({ url }) },
    signal,
  );
}

export async function createDownload(
  url: string,
  formatId: string,
  signal?: AbortSignal,
): Promise<DownloadResponse> {
  return request<DownloadResponse>(
    "/api/v1/media/download",
    { method: "POST", body: JSON.stringify({ url, formatId }) },
    signal,
  );
}

export async function fetchPlatforms(
  signal?: AbortSignal,
): Promise<PlatformsResponse> {
  return request<PlatformsResponse>("/api/v1/platforms", { method: "GET" }, signal);
}
