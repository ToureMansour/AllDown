"use client";

import { useState } from "react";
import {
  AlertCircle,
  CircleCheck,
  Clock3,
  Download,
  Film,
  Image as ImageIcon,
  Info,
  Loader2,
  Music2,
  TriangleAlert,
} from "lucide-react";

import {
  absoluteApiUrl,
  ApiError,
  createDownload,
  type AnalyzeResponse,
  type MediaFormat,
} from "@/lib/api";
import { formatDuration, formatFileSize } from "@/lib/format";

interface DownloadAction {
  key: "original" | "quality" | "audio";
  title: string;
  description: string;
  format: MediaFormat;
  icon: typeof Film;
}

function byVideoQuality(a: MediaFormat, b: MediaFormat): number {
  return (
    (b.height ?? 0) - (a.height ?? 0) ||
    (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0)
  );
}

function byFileSize(a: MediaFormat, b: MediaFormat): number {
  return (b.fileSizeBytes ?? 0) - (a.fileSizeBytes ?? 0);
}

function buildActions(result: AnalyzeResponse): DownloadAction[] {
  const { media, formats } = result;
  const videoFormats = formats
    .filter((format) => format.kind === "video")
    .sort(byVideoQuality);
  const directVideo = videoFormats.find((format) => !format.requiresMerge);
  const bestVideo = videoFormats[0] ?? null;
  const bestImage = formats
    .filter((format) => format.kind === "image")
    .sort(byFileSize)[0];
  const bestAudio = formats
    .filter((format) => format.kind === "audio")
    .sort(byFileSize)[0];
  const actions: DownloadAction[] = [];

  if (media.mediaType === "image" && bestImage) {
    actions.push({
      key: "original",
      title: "Photo d'origine",
      description: "Fichier exact fourni par la source",
      format: bestImage,
      icon: ImageIcon,
    });
  } else if (media.mediaType === "audio" && bestAudio) {
    actions.push({
      key: "original",
      title: "Audio d'origine",
      description: "Fichier exact fourni par la source",
      format: bestAudio,
      icon: Music2,
    });
  } else {
    const originalVideo = directVideo ?? bestVideo;
    if (originalVideo) {
      actions.push({
        key: "original",
        title: directVideo ? "Fichier d'origine" : "Vidéo",
        description: directVideo
          ? "Format exact fourni par la source"
          : "Meilleure vidéo disponible",
        format: originalVideo,
        icon: Download,
      });
    }

    if (
      bestVideo &&
      originalVideo &&
      bestVideo.id !== originalVideo.id
    ) {
      actions.push({
        key: "quality",
        title: "Meilleure qualité",
        description: "Vidéo la plus haute disponible",
        format: bestVideo,
        icon: Film,
      });
    }

    if (bestAudio && originalVideo) {
      actions.push({
        key: "audio",
        title: "Audio seul",
        description: "Format audio exact fourni par la source",
        format: bestAudio,
        icon: Music2,
      });
    }
  }

  if (actions.length === 0) {
    const fallback = formats[0];
    if (fallback) {
      actions.push({
        key: "original",
        title:
          fallback.kind === "image"
            ? "Photo d'origine"
            : fallback.kind === "audio"
              ? "Audio d'origine"
              : "Fichier d'origine",
        description: "Fichier exact fourni par la source",
        format: fallback,
        icon: Download,
      });
    }
  }

  return actions.filter(
    (action, index, list) =>
      list.findIndex((candidate) => candidate.format.id === action.format.id) ===
      index,
  );
}

function Preview({ media }: { media: AnalyzeResponse["media"] }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === media.thumbnailUrl;
  const isImage = media.mediaType === "image";
  const PlaceholderIcon = isImage ? ImageIcon : Film;

  if (!media.thumbnailUrl || failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-line bg-field">
        <PlaceholderIcon className="size-10 text-line" aria-hidden="true" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.thumbnailUrl}
      alt={`Aperçu de ${media.title}`}
      width={960}
      height={540}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(media.thumbnailUrl)}
      className={
        isImage
          ? "mx-auto max-h-[420px] w-auto max-w-full rounded-xl border border-line bg-field object-contain"
          : "aspect-video w-full rounded-xl border border-line bg-field object-cover"
      }
    />
  );
}

export function MediaResult({
  result,
  sourceUrl,
}: {
  result: AnalyzeResponse;
  sourceUrl: string;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { media, warnings } = result;
  const duration = formatDuration(media.durationSeconds);
  const actions = buildActions(result);

  const handleDownload = async (action: DownloadAction) => {
    setDownloadingId(action.format.id);
    setError(null);
    setNotice(null);

    try {
      const data = await createDownload(sourceUrl, action.format.id);
      const link = document.createElement("a");
      link.href = absoluteApiUrl(data.downloadUrl);
      link.download = data.fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice(
        `Le téléchargement de « ${action.format.label} » a été lancé.`,
      );
    } catch (downloadError) {
      setError(
        downloadError instanceof ApiError
          ? downloadError.message
          : "Le téléchargement n'a pas pu démarrer. Réessayez.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <section
      aria-labelledby="result-title"
      className="mt-6 animate-rise overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="space-y-5 p-5 sm:p-6">
        <Preview media={media} />

        <div>
          <h2
            id="result-title"
            className="text-xl font-semibold leading-snug tracking-[-0.02em] text-cream sm:text-2xl"
          >
            {media.title}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            {media.uploader ? <span>{media.uploader}</span> : null}
            {duration ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {duration}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="mx-5 mb-5 rounded-xl border border-brand/25 bg-brand/8 p-4 sm:mx-6">
          <div className="flex gap-2.5">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-brand-soft"
              aria-hidden="true"
            />
            <div className="space-y-1 text-sm leading-6 text-brand-soft">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-line px-5 py-5 sm:px-6">
        <h3 className="text-sm font-semibold text-cream">
          Choisissez votre téléchargement
        </h3>

        {actions.length === 0 ? (
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted">
            <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
            La source n&apos;expose aucun fichier téléchargeable pour ce média.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => {
              const Icon = action.icon;
              const size = formatFileSize(action.format.fileSizeBytes);
              const downloading = downloadingId === action.format.id;

              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleDownload(action)}
                  disabled={downloadingId !== null}
                  aria-label={`Télécharger ${action.title} (${action.format.label})`}
                  className="group flex min-h-44 flex-col rounded-xl border border-line bg-field p-4 text-left transition-colors hover:border-brand/50 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-cream">
                    <Icon className="size-4 text-brand" aria-hidden="true" />
                    {action.title}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {action.format.label}
                    {action.format.container
                      ? ` · ${action.format.container.toUpperCase()}`
                      : ""}
                    {size ? ` · ${size}` : ""}
                  </span>
                  <span className="mt-1 text-xs leading-5 text-muted">
                    {action.description}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-semibold text-brand">
                    {downloading ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                        Préparation…
                      </>
                    ) : (
                      <>
                        <Download className="size-4" aria-hidden="true" />
                        Télécharger
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {notice ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 flex items-start gap-2 rounded-xl border border-success/25 bg-success/10 p-3 text-sm leading-6 text-success"
          >
            <CircleCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm leading-6 text-danger"
          >
            <AlertCircle className="mt-1 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

      </div>
    </section>
  );
}
