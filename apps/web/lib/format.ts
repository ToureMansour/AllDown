import type { MediaKind, PlatformStatus } from "./api";

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) return null;

  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 1) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  if (megabytes < 1024) {
    return `${numberFormatter.format(megabytes)} Mo`;
  }
  return `${numberFormatter.format(megabytes / 1024)} Go`;
}

export function mediaTypeLabel(kind: MediaKind): string {
  switch (kind) {
    case "video":
      return "Vidéo";
    case "audio":
      return "Audio";
    case "image":
      return "Image";
    default:
      return "Fichier";
  }
}

export function platformStatusLabel(status: PlatformStatus): string {
  switch (status) {
    case "supported":
      return "Pris en charge";
    case "restricted":
      return "Accès restreint";
    default:
      return "Expérimental";
  }
}
