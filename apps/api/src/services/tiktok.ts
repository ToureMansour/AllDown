import { hostMatches } from "../config/platforms";

const TIKTOK_PHOTO_PATH = /^\/@[^/]+\/photo\/\d+\/?$/i;

export const TIKTOK_COVER_FORMAT_ID = "alldown-tiktok-cover";

export function normalizeTikTokPhotoUrl(url: URL): URL | null {
  if (
    !hostMatches(url.hostname, "tiktok.com") ||
    !TIKTOK_PHOTO_PATH.test(url.pathname)
  ) {
    return null;
  }

  const normalized = new URL(url.href);
  normalized.pathname = normalized.pathname.replace(/\/photo\//i, "/video/");
  return normalized;
}
