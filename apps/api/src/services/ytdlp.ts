import { existsSync, promises as fs, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  AppConfig,
  DownloadInput,
  DownloadResult,
  EngineStatus,
  YtdlpInfo,
  YtdlpRunner,
} from "../types";
import { AppError, isAbortError } from "../utils/errors";
import { sanitizeLogText } from "../utils/logger";
import { runProcess } from "../utils/process";
import { normalizeTikTokPhotoUrl, TIKTOK_COVER_FORMAT_ID } from "./tiktok";

const require = createRequire(import.meta.url);
const STATUS_CACHE_MS = 60_000;
const MAX_ANALYZE_OUTPUT = 10 * 1024 * 1024;

interface ResolvedEngine {
  ytdlp: string | null;
  ytdlpVersion: string | null;
  ffmpeg: string | null;
  checkedAt: number;
}

function extensionForPlatform(): string {
  return process.platform === "win32" ? ".exe" : "";
}

function uniqueCandidates(candidates: Array<string | undefined | null>): string[] {
  return [...new Set(candidates.filter((value): value is string => Boolean(value)))];
}

function firstLine(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-1)[0] ?? "";
}

export function mapEngineFailure(stderr: string, stdout: string): AppError {
  const raw = `${stderr}\n${stdout}`.toLowerCase();
  const message = sanitizeLogText(firstLine(stderr) || firstLine(stdout));

  if (raw.includes("requested format is not available")) {
    return new AppError(
      422,
      "FORMAT_NOT_AVAILABLE",
      "Ce format n'est plus disponible pour ce média. Relancez l'analyse.",
    );
  }
  if (raw.includes("ffmpeg") && (raw.includes("not found") || raw.includes("not installed"))) {
    return new AppError(
      503,
      "FFMPEG_UNAVAILABLE",
      "FFmpeg n'est pas disponible sur le serveur, la fusion vidéo est impossible.",
    );
  }
  if (
    raw.includes("private video") ||
    raw.includes("login required") ||
    raw.includes("log in") ||
    raw.includes("sign in to confirm") ||
    raw.includes("cookies") ||
    raw.includes("members-only") ||
    raw.includes("age-restricted") ||
    raw.includes("authentication") ||
    raw.includes("access denied") ||
    raw.includes("http error 401") ||
    raw.includes("http error 403")
  ) {
    return new AppError(
      403,
      "MEDIA_RESTRICTED",
      "Ce média est privé, réservé aux membres ou nécessite une connexion. AllDown ne contourne pas ces restrictions.",
    );
  }
  if (
    raw.includes("video unavailable") ||
    raw.includes("has been removed") ||
    raw.includes("does not exist") ||
    raw.includes("not found") ||
    raw.includes("http error 404") ||
    raw.includes("deleted") ||
    raw.includes("no video formats found")
  ) {
    return new AppError(
      404,
      "MEDIA_UNAVAILABLE",
      "Ce média est introuvable, supprimé ou n'est plus accessible publiquement.",
    );
  }
  if (
    raw.includes("unsupported url") ||
    raw.includes("no suitable extractor") ||
    raw.includes("is not a valid url")
  ) {
    return new AppError(
      422,
      "MEDIA_UNAVAILABLE",
      "Cette source n'est pas reconnue par le moteur d'extraction.",
    );
  }
  if (raw.includes("http error 429") || raw.includes("too many requests")) {
    return new AppError(
      429,
      "RATE_LIMITED",
      "La plateforme source limite temporairement les requêtes. Réessayez plus tard.",
      { retryAfterSeconds: 60 },
    );
  }
  if (raw.includes("timed out") || raw.includes("timeout")) {
    return new AppError(
      504,
      "ENGINE_TIMEOUT",
      "Le moteur d'extraction a dépassé le délai autorisé.",
    );
  }
  if (
    raw.includes("not available in your country") ||
    raw.includes("geo") ||
    raw.includes("region")
  ) {
    return new AppError(
      403,
      "MEDIA_RESTRICTED",
      "Ce média est soumis à une restriction géographique sur le réseau du serveur.",
    );
  }

  return new AppError(
    502,
    "ENGINE_ERROR",
    "Le moteur d'extraction n'a pas pu traiter ce lien.",
    message ? { details: { engine: message } } : undefined,
  );
}

function parseJsonOutput(output: string): YtdlpInfo {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AppError(
      502,
      "ENGINE_ERROR",
      "Le moteur d'extraction a renvoyé une réponse illisible.",
    );
  }

  try {
    return JSON.parse(output.slice(start, end + 1)) as YtdlpInfo;
  } catch {
    throw new AppError(
      502,
      "ENGINE_ERROR",
      "Le moteur d'extraction a renvoyé une réponse illisible.",
    );
  }
}

export class YtdlpService implements YtdlpRunner {
  private cached: ResolvedEngine | null = null;

  constructor(private readonly config: AppConfig) {}

  private packageRoot(): string {
    let directory = path.dirname(fileURLToPath(import.meta.url));

    for (let depth = 0; depth < 6; depth += 1) {
      const packageFile = path.join(directory, "package.json");
      if (existsSync(packageFile)) {
        try {
          const manifest = JSON.parse(readFileSync(packageFile, "utf8")) as {
            name?: string;
          };
          if (manifest.name === "@alldown/api") return directory;
        } catch {
          // Keep walking up.
        }
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }

    return process.cwd();
  }

  private localBinCandidates(name: string): string[] {
    const fileName = `${name}${extensionForPlatform()}`;
    return uniqueCandidates([
      path.join(this.packageRoot(), "bin", fileName),
      path.join(process.cwd(), "bin", fileName),
      path.join(process.cwd(), "apps", "api", "bin", fileName),
    ]);
  }

  private ffmpegStaticPath(): string | null {
    try {
      const value = require("ffmpeg-static") as unknown;
      return typeof value === "string" && existsSync(value) ? value : null;
    } catch {
      return null;
    }
  }

  private async probe(
    command: string,
    args: string[],
    timeoutMs = 8_000,
  ): Promise<string | null> {
    if (
      (command.includes("/") || command.includes("\\")) &&
      !existsSync(command)
    ) {
      return null;
    }

    try {
      const result = await runProcess(command, args, {
        timeoutMs,
        maxOutputBytes: 64 * 1024,
      });
      return result.code === 0 ? command : null;
    } catch {
      return null;
    }
  }

  private async resolveYtdlp(): Promise<{ command: string; version: string } | null> {
    const candidates = uniqueCandidates([
      this.config.ytdlpPath,
      ...this.localBinCandidates("yt-dlp"),
      "yt-dlp",
      "yt-dlp.exe",
    ]);

    for (const candidate of candidates) {
      const result = await this.probeWithOutput(candidate, ["--version"]);
      if (result) {
        return { command: candidate, version: result };
      }
    }

    return null;
  }

  private async probeWithOutput(
    command: string,
    args: string[],
  ): Promise<string | null> {
    if (
      (command.includes("/") || command.includes("\\")) &&
      !existsSync(command)
    ) {
      return null;
    }

    try {
      const result = await runProcess(command, args, {
        timeoutMs: 8_000,
        maxOutputBytes: 64 * 1024,
      });
      if (result.code !== 0) return null;
      const value = result.stdout.trim() || result.stderr.trim();
      return value ? value.split(/\r?\n/)[0] ?? null : null;
    } catch {
      return null;
    }
  }

  private async resolveFfmpeg(): Promise<string | null> {
    const candidates = uniqueCandidates([
      this.config.ffmpegPath,
      ...this.localBinCandidates("ffmpeg"),
      this.ffmpegStaticPath(),
      "ffmpeg",
      "ffmpeg.exe",
    ]);

    for (const candidate of candidates) {
      const found = await this.probe(candidate, ["-version"]);
      if (found) return candidate;
    }

    return null;
  }

  async status(): Promise<EngineStatus> {
    const now = Date.now();
    if (this.cached && now - this.cached.checkedAt < STATUS_CACHE_MS) {
      return this.toStatus(this.cached);
    }

    const [ytdlp, ffmpeg] = await Promise.all([
      this.resolveYtdlp(),
      this.resolveFfmpeg(),
    ]);

    this.cached = {
      ytdlp: ytdlp?.command ?? null,
      ytdlpVersion: ytdlp?.version ?? null,
      ffmpeg,
      checkedAt: now,
    };

    return this.toStatus(this.cached);
  }

  private toStatus(engine: ResolvedEngine): EngineStatus {
    return {
      ytdlpAvailable: Boolean(engine.ytdlp),
      ytdlpVersion: engine.ytdlpVersion,
      ffmpegAvailable: Boolean(engine.ffmpeg),
      ffmpegSource: engine.ffmpeg,
    };
  }

  private async ensureYtdlp(): Promise<string> {
    const status = await this.status();
    const engine = this.cached;
    if (!status.ytdlpAvailable || !engine?.ytdlp) {
      throw new AppError(
        503,
        "ENGINE_UNAVAILABLE",
        "Le moteur d'extraction (yt-dlp) n'est pas disponible sur le serveur.",
      );
    }
    return engine.ytdlp;
  }

  async analyze(url: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<YtdlpInfo> {
    const command = await this.ensureYtdlp();
    const timeoutMs = options.timeoutMs ?? this.config.analyzeTimeoutSeconds * 1000;
    const parsedUrl = new URL(url);
    const extractionUrl = normalizeTikTokPhotoUrl(parsedUrl)?.href ?? url;

    try {
      const result = await runProcess(
        command,
        [
          "--ignore-config",
          "--no-cache-dir",
          "--no-warnings",
          "--no-playlist",
          "--skip-download",
          "--dump-single-json",
          "--no-progress",
          "--no-color",
          "--socket-timeout",
          "20",
          "--retries",
          "3",
          "--extractor-retries",
          "2",
          "--",
          extractionUrl,
        ],
        {
          timeoutMs,
          maxOutputBytes: MAX_ANALYZE_OUTPUT,
          signal: options.signal,
        },
      );

      if (result.code !== 0) {
        throw mapEngineFailure(result.stderr, result.stdout);
      }

      return parseJsonOutput(result.stdout);
    } catch (error) {
      if (error instanceof AppError || isAbortError(error)) throw error;
      throw new AppError(
        502,
        "ENGINE_ERROR",
        "Le moteur d'extraction n'a pas pu analyser ce lien.",
        { cause: error },
      );
    }
  }

  async download(input: DownloadInput): Promise<DownloadResult> {
    const command = await this.ensureYtdlp();
    const status = await this.status();
    const ffmpeg = this.cached?.ffmpeg ?? null;

    if (input.mergeContainer && !status.ffmpegAvailable) {
      throw new AppError(
        503,
        "FFMPEG_UNAVAILABLE",
        "FFmpeg n'est pas disponible sur le serveur, la fusion vidéo est impossible.",
      );
    }

    await fs.mkdir(input.directory, { recursive: true });

    const isThumbnailDownload = input.selector === TIKTOK_COVER_FORMAT_ID;
    const parsedUrl = new URL(input.url);
    const downloadUrl = normalizeTikTokPhotoUrl(parsedUrl)?.href ?? input.url;
    const args = [
      "--ignore-config",
      "--no-cache-dir",
      "--no-warnings",
      "--no-playlist",
      "--no-progress",
      "--no-color",
      "--no-mtime",
      "--no-part",
      "--restrict-filenames",
      "--no-exec",
      "--no-write-info-json",
      "--no-write-subs",
      "--no-write-auto-subs",
      "--concurrent-fragments",
      "4",
      "--socket-timeout",
      "20",
      "--retries",
      "3",
      "--fragment-retries",
      "3",
      "--max-filesize",
      String(input.maxBytes),
      "-o",
      path.join(input.directory, "%(title).80B [%(id)s].%(ext)s"),
    ];

    if (isThumbnailDownload) {
      args.push("--skip-download", "--write-thumbnail");
    } else {
      args.push("--no-write-thumbnail", "-f", input.selector);
    }

    if (input.mergeContainer) {
      args.push("--merge-output-format", input.mergeContainer);
    }

    if (ffmpeg && (ffmpeg.includes("/") || ffmpeg.includes("\\"))) {
      args.push("--ffmpeg-location", ffmpeg);
    }

    args.push("--", downloadUrl);

    try {
      const result = await runProcess(command, args, {
        timeoutMs: input.timeoutMs,
        maxOutputBytes: 4 * 1024 * 1024,
        signal: input.signal,
      });

      if (result.code !== 0) {
        throw mapEngineFailure(result.stderr, result.stdout);
      }

      const entries = await fs.readdir(input.directory, { withFileTypes: true });
      const candidates = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            !entry.name.endsWith(".part") &&
            !entry.name.endsWith(".ytdl"),
        )
        .map((entry) => path.join(input.directory, entry.name));

      if (candidates.length === 0) {
        throw new AppError(
          502,
          "DOWNLOAD_FAILED",
          "Le fichier n'a pas pu être généré par le moteur.",
        );
      }

      let filePath = candidates[0] as string;
      let largest = 0;
      for (const candidate of candidates) {
        const stat = await fs.stat(candidate);
        if (stat.isFile() && stat.size >= largest) {
          largest = stat.size;
          filePath = candidate;
        }
      }

      if (largest <= 0) {
        throw new AppError(
          502,
          "DOWNLOAD_FAILED",
          "Le fichier généré est vide.",
        );
      }

      if (largest > input.maxBytes) {
        throw new AppError(
          413,
          "DOWNLOAD_TOO_LARGE",
          `Le fichier dépasse la limite autorisée de ${this.config.maxDownloadSizeMb} Mo.`,
        );
      }

      return {
        filePath,
        fileName: path.basename(filePath),
        sizeBytes: largest,
        container: path.extname(filePath).slice(1).toLowerCase(),
      };
    } catch (error) {
      if (error instanceof AppError || isAbortError(error)) throw error;
      throw new AppError(
        502,
        "DOWNLOAD_FAILED",
        "Le téléchargement a échoué côté serveur.",
        { cause: error },
      );
    }
  }
}
