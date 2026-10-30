import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatFileSize,
  mediaTypeLabel,
  platformStatusLabel,
} from "@/lib/format";

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("returns null for missing or invalid values", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("uses French units", () => {
    expect(formatFileSize(512)).toBe("1 Ko");
    expect(formatFileSize(1024 * 1024)).toBe("1 Mo");
    expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe("2,5 Go");
  });

  it("returns null for missing or invalid values", () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(-1)).toBeNull();
  });
});

describe("labels", () => {
  it("maps media kinds", () => {
    expect(mediaTypeLabel("video")).toBe("Vidéo");
    expect(mediaTypeLabel("audio")).toBe("Audio");
    expect(mediaTypeLabel("image")).toBe("Image");
    expect(mediaTypeLabel("file")).toBe("Fichier");
  });

  it("maps platform statuses", () => {
    expect(platformStatusLabel("supported")).toBe("Pris en charge");
    expect(platformStatusLabel("experimental")).toBe("Expérimental");
    expect(platformStatusLabel("restricted")).toBe("Accès restreint");
  });
});
