import { promises as fs } from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { createTestConfig } from "../src/config/env";
import { UrlSafety, type LookupFn } from "../src/services/urlSafety";
import type {
  DownloadInput,
  EngineStatus,
  YtdlpInfo,
  YtdlpRunner,
} from "../src/types";

const lookup: LookupFn = async () => [
  { address: "93.184.216.34", family: 4 },
];

const sampleInfo: YtdlpInfo = {
  _type: "video",
  id: "abc123",
  title: "Sample video",
  duration: 125,
  thumbnail: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
  webpage_url: "https://www.youtube.com/watch?v=abc123",
  uploader: "Test channel",
  extractor_key: "Youtube",
  formats: [
    {
      format_id: "137",
      ext: "mp4",
      width: 1920,
      height: 1080,
      fps: 30,
      vcodec: "avc1",
      acodec: "none",
      filesize: 50_000_000,
      protocol: "https",
    },
    {
      format_id: "140",
      ext: "m4a",
      vcodec: "none",
      acodec: "mp4a",
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
      vcodec: "avc1",
      acodec: "mp4a",
      filesize: 8_000_000,
      protocol: "https",
    },
  ],
};

function createRunner(
  overrides: {
    status?: Partial<EngineStatus>;
    info?: YtdlpInfo;
  } = {},
): YtdlpRunner & { download: ReturnType<typeof vi.fn> } {
  const engineStatus: EngineStatus = {
    ytdlpAvailable: true,
    ytdlpVersion: "2026.10.26",
    ffmpegAvailable: true,
    ffmpegSource: "/usr/bin/ffmpeg",
    ...overrides.status,
  };

  const download = vi.fn(async (input: DownloadInput) => {
    const filePath = path.join(input.directory, "sample-video.mp4");
    await fs.writeFile(filePath, "fake-media");
    return {
      filePath,
      fileName: "sample-video.mp4",
      sizeBytes: 10,
      container: "mp4",
    };
  });

  return {
    status: vi.fn(async () => engineStatus),
    analyze: vi.fn(async (url: string) => ({
      ...(overrides.info ?? sampleInfo),
      webpage_url: url,
    })),
    download,
  };
}

function createTestApp(
  runner: YtdlpRunner,
  lookupFn: LookupFn = lookup,
) {
  return createApp({
    config: createTestConfig(),
    runner,
    urlSafety: new UrlSafety({ lookup: lookupFn }),
  });
}

const mediaUrl = "https://www.youtube.com/watch?v=abc123";
const tiktokPhotoUrl =
  "https://www.tiktok.com/@hkf.staff/photo/7665893420707138848?is_from_webapp=1";
const tiktokVideoUrl =
  "https://www.tiktok.com/@hkf.staff/video/7665893420707138848?is_from_webapp=1";

describe("system endpoints", () => {
  it("reports a healthy engine", async () => {
    const response = await request(createTestApp(createRunner()))
      .get("/health")
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      status: "ok",
      checks: {
        ytdlp: { available: true, version: "2026.10.26" },
        ffmpeg: { available: true },
      },
    });
  });

  it("reports a degraded engine with HTTP 503", async () => {
    const runner = createRunner({
      status: { ytdlpAvailable: false, ytdlpVersion: null },
    });
    const response = await request(createTestApp(runner))
      .get("/health")
      .expect(503);

    expect(response.body).toMatchObject({
      ok: false,
      status: "degraded",
      checks: { ytdlp: { available: false } },
    });
  });

  it("lists platforms with real engine status", async () => {
    const response = await request(createTestApp(createRunner()))
      .get("/api/v1/platforms")
      .expect(200);

    expect(response.body.data.engine).toMatchObject({
      ytdlpAvailable: true,
      ytdlpVersion: "2026.10.26",
      ffmpegAvailable: true,
    });
    expect(response.body.data.platforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "youtube", status: "supported" }),
        expect.objectContaining({ id: "tiktok", status: "experimental" }),
        expect.objectContaining({ id: "generic", status: "supported" }),
      ]),
    );
  });
});

describe("POST /api/v1/media/analyze", () => {
  it("analyzes a public media URL and returns allowed formats", async () => {
    const runner = createRunner();
    const response = await request(createTestApp(runner))
      .post("/api/v1/media/analyze")
      .send({ url: mediaUrl })
      .expect(200);

    expect(runner.analyze).toHaveBeenCalledWith(
      mediaUrl,
      expect.objectContaining({ signal: undefined }),
    );
    expect(response.body.data.media).toMatchObject({
      title: "Sample video",
      durationSeconds: 125,
      isLive: false,
      platform: { id: "youtube", status: "supported" },
    });
    expect(response.body.data.formats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "137+140", requiresMerge: true }),
        expect.objectContaining({ id: "18", kind: "video" }),
      ]),
    );
    expect(response.body.data.limits.maxDownloadSizeMb).toBe(50);
  });

  it("recognizes TikTok photo posts and offers their cover image", async () => {
    const runner = createRunner({
      info: {
        _type: "video",
        id: "7665893420707138848",
        title: "TikTok photo post",
        thumbnail: "https://p16-sign.tiktokcdn.com/cover.jpeg",
        extractor_key: "TikTok",
        formats: [
          {
            format_id: "audio",
            ext: "m4a",
            vcodec: "none",
            acodec: "aac",
            protocol: "https",
          },
        ],
      },
    });

    const response = await request(createTestApp(runner))
      .post("/api/v1/media/analyze")
      .send({ url: tiktokPhotoUrl })
      .expect(200);

    expect(runner.analyze).toHaveBeenCalledWith(
      tiktokVideoUrl,
      expect.objectContaining({ signal: undefined }),
    );
    expect(response.body.data.media).toMatchObject({
      mediaType: "image",
      webpageUrl: tiktokPhotoUrl,
    });
    expect(response.body.data.formats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "alldown-tiktok-cover",
          kind: "image",
          container: "jpeg",
        }),
      ]),
    );
    expect(response.body.data.warnings).toContain(
      "Seule l’image de couverture de cette publication photo est proposée.",
    );
  });

  it("rejects an empty or malformed body", async () => {
    const response = await request(createTestApp(createRunner()))
      .post("/api/v1/media/analyze")
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(response.body.error.details.fields[0].path).toBe("url");
  });

  it("rejects a URL resolving to a private address", async () => {
    const privateLookup: LookupFn = async () => [
      { address: "10.0.0.5", family: 4 },
    ];
    const response = await request(
      createTestApp(createRunner(), privateLookup),
    )
      .post("/api/v1/media/analyze")
      .send({ url: mediaUrl })
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN_URL");
  });

  it("rejects exposed format URLs that point to private hosts", async () => {
    const runner = createRunner({
      info: {
        ...sampleInfo,
        formats: [
          ...(sampleInfo.formats ?? []),
          {
            format_id: "999",
            ext: "mp4",
            width: 320,
            height: 240,
            vcodec: "avc1",
            acodec: "mp4a",
            protocol: "https",
            url: "http://127.0.0.1/internal-video",
          },
        ],
      },
    });
    const response = await request(createTestApp(runner))
      .post("/api/v1/media/analyze")
      .send({ url: mediaUrl })
      .expect(403);

    expect(response.body.error.code).toBe("DOMAIN_NOT_ALLOWED");
  });

  it("rejects playlists", async () => {
    const runner = createRunner({
      info: { ...sampleInfo, _type: "playlist" },
    });
    const response = await request(createTestApp(runner))
      .post("/api/v1/media/analyze")
      .send({ url: mediaUrl })
      .expect(422);

    expect(response.body.error.code).toBe("PLAYLIST_NOT_SUPPORTED");
  });

  it("returns 503 when yt-dlp is unavailable", async () => {
    const runner = createRunner({
      status: { ytdlpAvailable: false, ytdlpVersion: null },
    });
    const response = await request(createTestApp(runner))
      .post("/api/v1/media/analyze")
      .send({ url: mediaUrl })
      .expect(503);

    expect(response.body.error.code).toBe("ENGINE_UNAVAILABLE");
  });
});

describe("download flow", () => {
  it("issues a signed token and streams the prepared file", async () => {
    const runner = createRunner();
    const app = createTestApp(runner);

    const tokenResponse = await request(app)
      .post("/api/v1/media/download")
      .send({ url: mediaUrl, formatId: "137+140" })
      .expect(200);

    const { downloadUrl, fileName, expiresInSeconds } =
      tokenResponse.body.data;
    expect(downloadUrl).toMatch(/^\/api\/v1\/media\/file\//);
    expect(fileName).toBe("Sample video.mp4");
    expect(expiresInSeconds).toBeGreaterThan(0);

    const fileResponse = await request(app)
      .get(downloadUrl)
      .expect(200)
      .expect("Content-Type", /video\/mp4/)
      .expect("Content-Length", "10");

    expect(fileResponse.headers["content-disposition"]).toContain(
      "attachment;",
    );
    expect(fileResponse.headers["cache-control"]).toBe("no-store");
    expect(runner.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: mediaUrl,
        selector: "137+140",
        mergeContainer: "mp4",
        maxBytes: 50 * 1024 * 1024,
      }),
    );
  });

  it("downloads the TikTok photo post cover using its photo URL", async () => {
    const runner = createRunner({
      info: {
        _type: "video",
        id: "7665893420707138848",
        title: "TikTok photo post",
        thumbnail: "https://p16-sign.tiktokcdn.com/cover.jpeg",
        extractor_key: "TikTok",
        formats: [],
      },
    });
    const app = createTestApp(runner);
    const tokenResponse = await request(app)
      .post("/api/v1/media/download")
      .send({ url: tiktokPhotoUrl, formatId: "alldown-tiktok-cover" })
      .expect(200);

    await request(app)
      .get(tokenResponse.body.data.downloadUrl)
      .expect(200);

    expect(runner.analyze).toHaveBeenCalledWith(
      tiktokVideoUrl,
      expect.objectContaining({ signal: undefined }),
    );
    expect(runner.download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: tiktokPhotoUrl,
        selector: "alldown-tiktok-cover",
        mergeContainer: null,
      }),
    );
  });

  it("rejects a format that is not in the allowed list", async () => {
    const response = await request(createTestApp(createRunner()))
      .post("/api/v1/media/download")
      .send({ url: mediaUrl, formatId: "bestvideo+bestaudio" })
      .expect(422);

    expect(response.body.error.code).toBe("FORMAT_NOT_AVAILABLE");
  });

  it("rejects invalid or expired download tokens", async () => {
    const response = await request(createTestApp(createRunner()))
      .get("/api/v1/media/file/not-a-real-token")
      .expect(401);

    expect(response.body.error.code).toBe("INVALID_TOKEN");
  });

  it("cleans up the temporary directory after preparing a download", async () => {
    const runner = createRunner();
    const { MediaService } = await import("../src/services/mediaService");
    const service = new MediaService(
      createTestConfig(),
      runner,
      new UrlSafety({ lookup }),
    );

    const prepared = await service.prepareDownload(mediaUrl, "18");
    const directory = path.dirname(prepared.filePath);

    await expect(fs.readFile(prepared.filePath, "utf8")).resolves.toBe(
      "fake-media",
    );
    await prepared.cleanup();
    await expect(fs.stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("unknown routes", () => {
  it("returns a structured 404", async () => {
    const response = await request(createTestApp(createRunner()))
      .get("/api/v1/unknown")
      .expect(404);

    expect(response.body).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(response.body.requestId).toEqual(expect.any(String));
  });
});
