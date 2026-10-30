import { describe, expect, it } from "vitest";

import {
  buildFormatOptions,
  mediaTypeForOptions,
  selectFormat,
} from "../src/services/formatSelection";
import type { YtdlpInfo } from "../src/types";

const info: YtdlpInfo = {
  _type: "video",
  id: "abc123",
  title: "Sample video",
  duration: 60,
  webpage_url: "https://www.youtube.com/watch?v=abc123",
  extractor_key: "Youtube",
  formats: [
    {
      format_id: "137",
      ext: "mp4",
      width: 1920,
      height: 1080,
      fps: 30,
      vcodec: "avc1.640028",
      acodec: "none",
      filesize: 50_000_000,
      protocol: "https",
    },
    {
      format_id: "248",
      ext: "webm",
      width: 1920,
      height: 1080,
      fps: 30,
      vcodec: "vp9",
      acodec: "none",
      filesize: 45_000_000,
      protocol: "https",
    },
    {
      format_id: "140",
      ext: "m4a",
      vcodec: "none",
      acodec: "mp4a.40.2",
      abr: 128,
      filesize: 3_000_000,
      protocol: "https",
    },
    {
      format_id: "18",
      ext: "mp4",
      width: 640,
      height: 360,
      fps: 30,
      vcodec: "avc1.42001E",
      acodec: "mp4a.40.2",
      filesize: 8_000_000,
      protocol: "https",
    },
    {
      format_id: "251",
      ext: "webm",
      vcodec: "none",
      acodec: "opus",
      abr: 160,
      protocol: "https",
    },
  ],
};

describe("buildFormatOptions", () => {
  it("builds merged video options when FFmpeg is available", () => {
    const { options, hasVideoOnlyFormats } = buildFormatOptions(info, true);
    const merged = options.find((option) => option.id === "137+140");

    expect(hasVideoOnlyFormats).toBe(true);
    expect(merged).toMatchObject({
      kind: "video",
      label: "1080p",
      container: "mp4",
      requiresMerge: true,
      requiresFfmpeg: true,
      hasAudio: true,
      fileSizeBytes: 53_000_000,
    });
  });

  it("omits merged video options when FFmpeg is unavailable", () => {
    const { options } = buildFormatOptions(info, false);

    expect(options.some((option) => option.requiresMerge)).toBe(false);
    expect(options.find((option) => option.id === "18")).toMatchObject({
      kind: "video",
      label: "360p",
      hasAudio: true,
    });
  });

  it("lists direct audio formats and sorts video by resolution", () => {
    const { options } = buildFormatOptions(info, true);
    const audio = options.filter((option) => option.kind === "audio");
    const video = options.filter((option) => option.kind === "video");

    expect(audio.map((option) => option.id)).toEqual(["140", "251"]);
    expect(video[0]?.height).toBe(1080);
    expect(video.at(-1)?.height).toBe(360);
  });

  it("uses the generic fallback for an extractor without formats", () => {
    const { options } = buildFormatOptions(
      {
        extractor_key: "Generic",
        ext: "jpg",
        filesize: 123_456,
      },
      false,
    );

    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({
      id: "best",
      kind: "image",
      container: "jpg",
      fileSizeBytes: 123_456,
    });
  });

  it("returns no options when nothing can be extracted", () => {
    const { options } = buildFormatOptions({ extractor_key: "Youtube" }, true);
    expect(options).toEqual([]);
  });
});

describe("selectFormat", () => {
  it("accepts an exact allowed format id", () => {
    const selected = selectFormat(info, "137+140", true);
    expect(selected?.selector).toBe("137+140");
    expect(selected?.option.requiresMerge).toBe(true);
  });

  it("rejects unknown or forged format ids", () => {
    expect(selectFormat(info, "bestvideo+bestaudio", true)).toBeNull();
    expect(selectFormat(info, "137+999", true)).toBeNull();
    expect(selectFormat(info, "137+140", false)).toBeNull();
  });
});

describe("mediaTypeForOptions", () => {
  it("prioritizes video, then image, then audio", () => {
    expect(
      mediaTypeForOptions([{ kind: "audio" } as never]),
    ).toBe("audio");
    expect(
      mediaTypeForOptions([
        { kind: "audio" } as never,
        { kind: "image" } as never,
      ]),
    ).toBe("image");
    expect(
      mediaTypeForOptions([
        { kind: "image" } as never,
        { kind: "video" } as never,
      ]),
    ).toBe("video");
  });
});
