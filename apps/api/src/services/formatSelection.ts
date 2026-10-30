import type {
  MediaFormatOption,
  MediaKind,
  SelectedFormat,
  YtdlpFormat,
  YtdlpInfo,
} from "../types";

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mkv", "mov", "flv", "avi"]);
const AUDIO_EXTENSIONS = new Set([
  "m4a",
  "mp3",
  "opus",
  "ogg",
  "oga",
  "aac",
  "flac",
  "wav",
]);
const AUDIO_CONTAINER_EXTENSIONS = new Set([...AUDIO_EXTENSIONS, "webm"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

function present(value: string | null | undefined): boolean {
  return Boolean(value && value !== "none");
}

function hasVideo(format: YtdlpFormat): boolean {
  return present(format.vcodec);
}

function hasAudio(format: YtdlpFormat): boolean {
  return present(format.acodec);
}

function extension(format: YtdlpFormat): string {
  return (format.ext ?? "").toLowerCase();
}

function fileSize(format: YtdlpFormat): number | null {
  const value = format.filesize ?? format.filesize_approx ?? null;
  return typeof value === "number" && value > 0 ? value : null;
}

function isHttpSource(format: YtdlpFormat): boolean {
  const protocol = (format.protocol ?? "").toLowerCase();
  if (protocol.startsWith("http")) return true;
  if (protocol.includes("m3u8") || protocol.includes("dash")) return false;
  if (!protocol && format.url) {
    try {
      const url = new URL(format.url);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

function mediaKindForExtension(ext: string): MediaKind {
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "file";
}

function videoScore(format: YtdlpFormat): number {
  const ext = extension(format);
  const codec = (format.vcodec ?? "").toLowerCase();
  let score = 0;

  if (ext === "mp4") score += 10;
  if (ext === "webm") score += 6;
  if (codec.startsWith("avc") || codec.startsWith("h264")) score += 5;
  if (codec.startsWith("vp9")) score += 3;
  if (codec.startsWith("av01")) score += 2;
  if ((format.protocol ?? "").toLowerCase() === "https") score += 2;
  if ((format.fps ?? 0) >= 50) score += 1;

  return score;
}

function audioScore(format: YtdlpFormat): number {
  const ext = extension(format);
  let score = format.abr ?? 0;
  if ((format.protocol ?? "").toLowerCase() === "https") score += 50;
  if (ext === "m4a") score += 20;
  if (ext === "webm") score += 10;
  return score;
}

function dedupeById(options: MediaFormatOption[]): MediaFormatOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

function directOptions(info: YtdlpInfo): MediaFormatOption[] {
  const formats = info.formats ?? [];
  const options: MediaFormatOption[] = [];

  for (const format of formats) {
    const ext = extension(format);
    if (!ext || ext === "mhtml") continue;
    if (!isHttpSource(format)) continue;

    const isImage = IMAGE_EXTENSIONS.has(ext);

    if (isImage) {
      options.push({
        id: format.format_id ?? ext,
        kind: "image",
        label: "Image originale",
        container: ext,
        width: format.width ?? null,
        height: format.height ?? null,
        fps: null,
        fileSizeBytes: fileSize(format),
        requiresMerge: false,
        requiresFfmpeg: false,
        hasAudio: false,
        note: null,
      });
      continue;
    }

    if (hasVideo(format) && hasAudio(format) && VIDEO_EXTENSIONS.has(ext)) {
      const height = format.height ?? null;
      options.push({
        id: format.format_id ?? `direct-${ext}`,
        kind: "video",
        label: height ? `${height}p` : format.format_note || "Vidéo",
        container: ext,
        width: format.width ?? null,
        height,
        fps: format.fps ?? null,
        fileSizeBytes: fileSize(format),
        requiresMerge: false,
        requiresFfmpeg: false,
        hasAudio: true,
        note: null,
      });
      continue;
    }

    if (!hasVideo(format) && hasAudio(format) && AUDIO_CONTAINER_EXTENSIONS.has(ext)) {
      const abr = format.abr ? Math.round(format.abr) : null;
      options.push({
        id: format.format_id ?? `audio-${ext}`,
        kind: "audio",
        label: abr ? `Audio ${abr} kbps` : "Audio",
        container: ext,
        width: null,
        height: null,
        fps: null,
        fileSizeBytes: fileSize(format),
        requiresMerge: false,
        requiresFfmpeg: false,
        hasAudio: true,
        note: abr ? `${ext.toUpperCase()} · ${abr} kbps` : ext.toUpperCase(),
      });
    }
  }

  return dedupeById(options);
}

function mergedOptions(info: YtdlpInfo): MediaFormatOption[] {
  const formats = info.formats ?? [];

  const videoCandidates = formats.filter(
    (format) =>
      hasVideo(format) &&
      !hasAudio(format) &&
      (format.height ?? 0) >= 144 &&
      ["mp4", "webm"].includes(extension(format)) &&
      isHttpSource(format),
  );

  const audioCandidates = formats.filter(
    (format) =>
      !hasVideo(format) &&
      hasAudio(format) &&
      ["m4a", "webm"].includes(extension(format)) &&
      isHttpSource(format),
  );

  if (!videoCandidates.length || !audioCandidates.length) return [];

  const bestByHeight = new Map<number, YtdlpFormat>();
  for (const format of videoCandidates) {
    const height = format.height as number;
    const current = bestByHeight.get(height);
    if (!current || videoScore(format) > videoScore(current)) {
      bestByHeight.set(height, format);
    }
  }

  const options: MediaFormatOption[] = [];

  for (const [height, video] of bestByHeight) {
    const videoExt = extension(video);
    const wantedAudioExt = videoExt === "mp4" ? "m4a" : "webm";
    const audible = audioCandidates
      .filter((format) => extension(format) === wantedAudioExt)
      .sort((a, b) => audioScore(b) - audioScore(a))[0];

    if (!audible) continue;

    const videoId = video.format_id;
    const audioId = audible.format_id;
    if (!videoId || !audioId) continue;

    const container = videoExt === "mp4" ? "mp4" : "webm";
    const fps = video.fps ?? null;
    const videoBytes = fileSize(video);
    const audioBytes = fileSize(audible);

    options.push({
      id: `${videoId}+${audioId}`,
      kind: "video",
      label: `${height}p${fps && fps >= 50 ? "60" : ""}`,
      container,
      width: video.width ?? null,
      height,
      fps,
      fileSizeBytes:
        videoBytes !== null && audioBytes !== null
          ? videoBytes + audioBytes
          : null,
      requiresMerge: true,
      requiresFfmpeg: true,
      hasAudio: true,
      note: "Vidéo et audio fusionnés",
    });
  }

  return options.sort((a, b) => (b.height ?? 0) - (a.height ?? 0)).slice(0, 8);
}

function genericFallback(info: YtdlpInfo): MediaFormatOption[] {
  const format = info.formats?.[0];
  const ext = (info.ext ?? format?.ext ?? "").toLowerCase();
  if (!ext) return [];

  const kind = mediaKindForExtension(ext);
  const size =
    fileSize(format ?? {}) ??
    (typeof info.filesize === "number"
      ? info.filesize
      : typeof info.filesize_approx === "number"
        ? info.filesize_approx
        : null);

  return [
    {
      id: format?.format_id || "best",
      kind,
      label: kind === "image" ? "Image originale" : "Fichier original",
      container: ext,
      width: null,
      height: null,
      fps: null,
      fileSizeBytes: size,
      requiresMerge: false,
      requiresFfmpeg: false,
      hasAudio: false,
      note: "Fichier fourni par la source",
    },
  ];
}

export interface FormatBuildResult {
  options: MediaFormatOption[];
  hasVideoOnlyFormats: boolean;
}

export function buildFormatOptions(
  info: YtdlpInfo,
  ffmpegAvailable: boolean,
): FormatBuildResult {
  const direct = directOptions(info);
  const merged = ffmpegAvailable ? mergedOptions(info) : [];
  let options = dedupeById([...merged, ...direct]);

  const hasVideoOnlyFormats = (info.formats ?? []).some(
    (format) =>
      hasVideo(format) &&
      !hasAudio(format) &&
      (format.height ?? 0) >= 144 &&
      ["mp4", "webm"].includes(extension(format)),
  );

  if (
    options.length === 0 &&
    (info.extractor_key ?? info.extractor ?? "").toLowerCase().includes("generic")
  ) {
    options = genericFallback(info);
  }

  const kindOrder: Record<MediaKind, number> = {
    video: 0,
    audio: 1,
    image: 2,
    file: 3,
  };

  options.sort((a, b) => {
    const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDiff !== 0) return kindDiff;
    if (a.kind === "video") return (b.height ?? 0) - (a.height ?? 0);
    return (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0);
  });

  return {
    options: options.slice(0, 20),
    hasVideoOnlyFormats,
  };
}

export function selectFormat(
  info: YtdlpInfo,
  formatId: string,
  ffmpegAvailable: boolean,
): SelectedFormat | null {
  const { options } = buildFormatOptions(info, ffmpegAvailable);
  const option = options.find((candidate) => candidate.id === formatId);
  if (!option) return null;

  return { option, selector: option.id };
}

export function mediaTypeForOptions(
  options: MediaFormatOption[],
): MediaKind {
  if (options.some((option) => option.kind === "video")) return "video";
  if (options.some((option) => option.kind === "image")) return "image";
  if (options.some((option) => option.kind === "audio")) return "audio";
  return options[0]?.kind ?? "file";
}
