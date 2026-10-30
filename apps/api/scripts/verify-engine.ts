import "dotenv/config";

import { loadConfig } from "../src/config/env";
import { buildFormatOptions } from "../src/services/formatSelection";
import { YtdlpService } from "../src/services/ytdlp";
import { createJobDir, removeDir } from "../src/utils/temp";

const DEFAULT_URL = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

async function main() {
  const analyzeOnly = process.argv.includes("--analyze-only");
  const url =
    process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
    DEFAULT_URL;
  const maxSizeMb = Math.max(
    1,
    Number(process.env.VERIFY_MAX_MB ?? 50) || 50,
  );

  const baseConfig = loadConfig();
  const config = {
    ...baseConfig,
    maxDownloadSizeMb: maxSizeMb,
    downloadTimeoutSeconds: Math.max(
      baseConfig.downloadTimeoutSeconds,
      180,
    ),
  };
  const engine = new YtdlpService(config);

  const status = await engine.status();
  console.log("Engine status:", status);

  if (!status.ytdlpAvailable) {
    throw new Error(
      "yt-dlp is unavailable. Run `npm run setup:engine` from the repository root.",
    );
  }

  console.log(`\nAnalyzing ${url}…`);
  const info = await engine.analyze(url);
  const { options, hasVideoOnlyFormats } = buildFormatOptions(
    info,
    status.ffmpegAvailable,
  );

  console.log(`Title: ${info.title ?? "(unknown)"}`);
  console.log(
    `Formats: ${options.length} (separate video-only streams: ${hasVideoOnlyFormats ? "yes" : "no"})`,
  );
  console.table(
    options.map((option) => ({
      id: option.id,
      kind: option.kind,
      label: option.label,
      container: option.container,
      sizeMb: option.fileSizeBytes
        ? Math.round((option.fileSizeBytes / 1024 / 1024) * 10) / 10
        : null,
      merge: option.requiresMerge,
    })),
  );

  if (analyzeOnly) {
    console.log("\nAnalyze-only mode: no file was downloaded.");
    return;
  }

  const maxBytes = maxSizeMb * 1024 * 1024;
  const candidate =
    options
      .filter(
        (option) =>
          option.kind === "video" &&
          (option.fileSizeBytes === null || option.fileSizeBytes <= maxBytes),
      )
      .sort((a, b) => (a.height ?? 0) - (b.height ?? 0))[0] ??
    options.find((option) => option.kind === "audio");

  if (!candidate) {
    throw new Error("No downloadable format was found for this media.");
  }

  const directory = await createJobDir(config.tempDir);

  try {
    console.log(`\nDownloading format ${candidate.id} (${candidate.label})…`);
    const result = await engine.download({
      url: info.webpage_url ?? url,
      selector: candidate.id,
      directory,
      maxBytes,
      timeoutMs: config.downloadTimeoutSeconds * 1000,
      mergeContainer: candidate.requiresMerge ? candidate.container : null,
    });

    console.log("Download succeeded:", {
      fileName: result.fileName,
      sizeMb: Math.round((result.sizeBytes / 1024 / 1024) * 10) / 10,
      container: result.container,
    });
  } finally {
    await removeDir(directory);
  }
}

main().catch((error) => {
  console.error("\nEngine verification failed:", error);
  process.exit(1);
});
