import type {
  AppConfig,
  EngineStatus,
  MediaFormatOption,
  MediaKind,
  SelectedFormat,
  YtdlpInfo,
  YtdlpRunner,
} from "../types";
import { AppError } from "../utils/errors";
import { sanitizeFileName, sanitizeText } from "../utils/sanitize";
import { createJobDir, removeDir } from "../utils/temp";
import { detectPlatform } from "../config/platforms";
import {
  buildFormatOptions,
  mediaTypeForOptions,
  selectFormat,
} from "./formatSelection";
import {
  normalizeTikTokPhotoUrl,
  TIKTOK_COVER_FORMAT_ID,
} from "./tiktok";
import type { UrlSafety } from "./urlSafety";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

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
    status: string;
    note: string;
  };
}

export interface AnalyzeResponse {
  media: AnalyzedMedia;
  formats: MediaFormatOption[];
  warnings: string[];
  limits: {
    maxDownloadSizeMb: number;
  };
}

export interface DownloadPreparation {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  container: string;
  cleanup: () => Promise<void>;
}

export interface ResolvedFormat {
  url: URL;
  info: YtdlpInfo;
  status: EngineStatus;
  selected: SelectedFormat;
  platform: AnalyzedMedia["platform"];
}

function isLive(info: YtdlpInfo): boolean {
  return Boolean(
    info.is_live ||
      info.live_status === "is_live" ||
      info.live_status === "is_upcoming",
  );
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function durationSeconds(info: YtdlpInfo): number | null {
  if (typeof info.duration !== "number" || !Number.isFinite(info.duration)) {
    return null;
  }
  return info.duration > 0 ? Math.round(info.duration) : null;
}

function addTikTokCoverFormat(info: YtdlpInfo): YtdlpInfo {
  const thumbnailUrl = safeHttpUrl(info.thumbnail);
  if (!thumbnailUrl) return info;

  const hasImageFormat = (info.formats ?? []).some((format) =>
    IMAGE_EXTENSIONS.has((format.ext ?? "").toLowerCase()),
  );
  if (hasImageFormat) return info;

  const thumbnail = new URL(thumbnailUrl);
  const extension =
    thumbnail.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "jpg";

  return {
    ...info,
    formats: [
      ...(info.formats ?? []),
      {
        format_id: TIKTOK_COVER_FORMAT_ID,
        ext: IMAGE_EXTENSIONS.has(extension) ? extension : "jpg",
        vcodec: "none",
        acodec: "none",
        protocol: thumbnail.protocol.slice(0, -1),
        url: thumbnailUrl,
      },
    ],
  };
}

export class MediaService {
  constructor(
    private readonly config: AppConfig,
    private readonly runner: YtdlpRunner,
    private readonly urlSafety: UrlSafety,
  ) {}

  private async validateOptionUrls(
    info: YtdlpInfo,
    options: MediaFormatOption[],
    original: URL,
  ): Promise<void> {
    const formatsById = new Map(
      (info.formats ?? [])
        .filter((format) => format.format_id)
        .map((format) => [format.format_id as string, format]),
    );
    const checkedOrigins = new Set([
      `${original.origin}|${original.username}`,
    ]);

    for (const option of options) {
      for (const formatId of option.id.split("+")) {
        const formatUrl = formatsById.get(formatId)?.url;
        if (!formatUrl) continue;

        let candidate: URL;
        try {
          candidate = new URL(formatUrl);
        } catch {
          continue;
        }

        if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
          continue;
        }

        const originKey = `${candidate.origin}|${candidate.username}`;
        if (checkedOrigins.has(originKey)) continue;
        checkedOrigins.add(originKey);
        await this.urlSafety.validateAdditionalUrl(candidate.href, original);
      }
    }
  }

  private async loadInfo(rawUrl: string, signal?: AbortSignal) {
    const url = await this.urlSafety.validate(rawUrl);
    const tiktokPhotoUrl = normalizeTikTokPhotoUrl(url);
    const status = await this.runner.status();

    if (!status.ytdlpAvailable) {
      throw new AppError(
        503,
        "ENGINE_UNAVAILABLE",
        "Le moteur d'extraction (yt-dlp) n'est pas disponible sur le serveur.",
      );
    }

    const extractedInfo = await this.runner.analyze(
      tiktokPhotoUrl?.href ?? url.href,
      { signal },
    );
    const info = tiktokPhotoUrl
      ? addTikTokCoverFormat(extractedInfo)
      : extractedInfo;

    if (info._type === "playlist") {
      throw new AppError(
        422,
        "PLAYLIST_NOT_SUPPORTED",
        "Les playlists ne sont pas prises en charge. Collez le lien d'un média individuel.",
      );
    }

    if (info.webpage_url) {
      await this.urlSafety.validateAdditionalUrl(info.webpage_url, url);
    }
    if (info.url) {
      await this.urlSafety.validateAdditionalUrl(info.url, url);
    }

    return { url, status, info };
  }

  async analyze(rawUrl: string, signal?: AbortSignal): Promise<AnalyzeResponse> {
    const { url, status, info } = await this.loadInfo(rawUrl, signal);
    const isTikTokPhoto = normalizeTikTokPhotoUrl(url) !== null;
    const { options, hasVideoOnlyFormats } = buildFormatOptions(
      info,
      status.ffmpegAvailable,
    );

    await this.validateOptionUrls(info, options, url);

    const live = isLive(info);
    const webpageUrl = isTikTokPhoto
      ? url.href
      : safeHttpUrl(info.webpage_url) ?? url.href;
    let platformHost = url.hostname;
    try {
      platformHost = new URL(webpageUrl).hostname;
    } catch {
      // Keep the original hostname.
    }
    const platform = detectPlatform(platformHost);

    const warnings: string[] = [];
    if (isTikTokPhoto) {
      if (options.some((option) => option.id === TIKTOK_COVER_FORMAT_ID)) {
        warnings.push(
          "Seule l’image de couverture de cette publication photo est proposée.",
        );
      } else if (!options.some((option) => option.kind === "image")) {
        warnings.push(
          "L’image de couverture de cette publication photo n’est pas disponible au téléchargement.",
        );
      }
    }
    if (live) {
      warnings.push(
        "Les diffusions en direct ne sont pas prises en charge par AllDown.",
      );
    }
    if (options.length === 0) {
      if (hasVideoOnlyFormats && !status.ffmpegAvailable) {
        warnings.push(
          "FFmpeg est absent du serveur : les flux vidéo séparés ne peuvent pas être fusionnés.",
        );
      } else {
        warnings.push(
          "Aucun format téléchargeable n'a été trouvé pour ce média.",
        );
      }
    } else if (hasVideoOnlyFormats && !status.ffmpegAvailable) {
      warnings.push(
        "FFmpeg est absent du serveur : seuls les formats déjà combinés ou audio sont proposés.",
      );
    }

    const title =
      sanitizeText(info.title, 300) ??
      sanitizeText(info.id, 120) ??
      "Média sans titre";

    return {
      media: {
        title,
        description: sanitizeText(info.description, 600),
        durationSeconds: live ? null : durationSeconds(info),
        thumbnailUrl: safeHttpUrl(info.thumbnail),
        webpageUrl,
        uploader: sanitizeText(info.uploader, 160),
        isLive: live,
        mediaType:
          options.length > 0
            ? mediaTypeForOptions(options)
            : durationSeconds(info) !== null
              ? "video"
              : "file",
        platform: {
          id: platform.id,
          label: platform.label,
          status: platform.status,
          note: platform.note,
        },
      },
      formats: options,
      warnings,
      limits: {
        maxDownloadSizeMb: this.config.maxDownloadSizeMb,
      },
    };
  }

  async resolveFormat(
    rawUrl: string,
    formatId: string,
    signal?: AbortSignal,
  ): Promise<ResolvedFormat> {
    const { url, status, info } = await this.loadInfo(rawUrl, signal);

    if (isLive(info)) {
      throw new AppError(
        422,
        "LIVE_NOT_SUPPORTED",
        "Les diffusions en direct ne sont pas prises en charge.",
      );
    }

    const selected = selectFormat(info, formatId, status.ffmpegAvailable);
    if (!selected) {
      throw new AppError(
        422,
        "FORMAT_NOT_AVAILABLE",
        "Ce format n'est pas disponible pour ce média. Relancez l'analyse.",
      );
    }

    if (selected.option.requiresFfmpeg && !status.ffmpegAvailable) {
      throw new AppError(
        503,
        "FFMPEG_UNAVAILABLE",
        "FFmpeg n'est pas disponible sur le serveur, la fusion vidéo est impossible.",
      );
    }

    await this.validateOptionUrls(info, [selected.option], url);

    const webpageUrl = safeHttpUrl(info.webpage_url) ?? url.href;
    let host = url.hostname;
    try {
      host = new URL(webpageUrl).hostname;
    } catch {
      // Keep original hostname.
    }
    const platform = detectPlatform(host);

    return {
      url,
      info,
      status,
      selected,
      platform: {
        id: platform.id,
        label: platform.label,
        status: platform.status,
        note: platform.note,
      },
    };
  }

  suggestedFileName(info: YtdlpInfo, format: MediaFormatOption): string {
    const base = sanitizeText(info.title, 120) ?? sanitizeText(info.id, 80) ?? "media";
    const extension = format.container ? `.${format.container}` : "";
    return sanitizeFileName(`${base}${extension}`);
  }

  async prepareDownload(
    rawUrl: string,
    formatId: string,
    signal?: AbortSignal,
  ): Promise<DownloadPreparation> {
    const resolved = await this.resolveFormat(rawUrl, formatId, signal);
    const directory = await createJobDir(this.config.tempDir);

    try {
      const result = await this.runner.download({
        url: resolved.url.href,
        selector: resolved.selected.selector,
        directory,
        maxBytes: this.config.maxDownloadSizeMb * 1024 * 1024,
        timeoutMs: this.config.downloadTimeoutSeconds * 1000,
        mergeContainer: resolved.selected.option.requiresMerge
          ? resolved.selected.option.container
          : null,
        signal,
      });

      return {
        filePath: result.filePath,
        fileName: sanitizeFileName(result.fileName),
        sizeBytes: result.sizeBytes,
        container: result.container,
        cleanup: () => removeDir(directory),
      };
    } catch (error) {
      await removeDir(directory);
      throw error;
    }
  }
}
