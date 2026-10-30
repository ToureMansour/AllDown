export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  frontendOrigins: string[];
  trustProxy: number | boolean;
  logLevel: string;
  maxDownloadSizeMb: number;
  downloadTimeoutSeconds: number;
  analyzeTimeoutSeconds: number;
  maxConcurrentDownloads: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  tempDir: string;
  ytdlpPath?: string;
  ffmpegPath?: string;
  allowedDownloadHosts: string[];
  downloadSigningSecret: string;
  ytdlpVersion: string;
}

export type PlatformStatus = "supported" | "experimental" | "restricted";

export interface PlatformDefinition {
  id: string;
  label: string;
  hosts: string[];
  status: PlatformStatus;
  note: string;
}

export interface YtdlpFormat {
  format_id?: string;
  ext?: string;
  height?: number | null;
  width?: number | null;
  fps?: number | null;
  vcodec?: string | null;
  acodec?: string | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  tbr?: number | null;
  abr?: number | null;
  format_note?: string | null;
  protocol?: string | null;
  url?: string | null;
}

export interface YtdlpInfo {
  _type?: string;
  id?: string;
  title?: string;
  description?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  webpage_url?: string | null;
  url?: string | null;
  ext?: string | null;
  extractor?: string | null;
  extractor_key?: string | null;
  uploader?: string | null;
  is_live?: boolean | null;
  live_status?: string | null;
  filesize?: number | null;
  filesize_approx?: number | null;
  formats?: YtdlpFormat[];
}

export type MediaKind = "video" | "audio" | "image" | "file";

export interface MediaFormatOption {
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

export interface SelectedFormat {
  option: MediaFormatOption;
  selector: string;
}

export interface EngineStatus {
  ytdlpAvailable: boolean;
  ytdlpVersion: string | null;
  ffmpegAvailable: boolean;
  ffmpegSource: string | null;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  container: string;
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface DownloadInput {
  url: string;
  selector: string;
  directory: string;
  maxBytes: number;
  timeoutMs: number;
  mergeContainer?: string | null;
  signal?: AbortSignal;
}

export interface YtdlpRunner {
  status(): Promise<EngineStatus>;
  analyze(url: string, options?: AnalyzeOptions): Promise<YtdlpInfo>;
  download(input: DownloadInput): Promise<DownloadResult>;
}
