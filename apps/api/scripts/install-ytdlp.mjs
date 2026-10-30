#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const version = (process.env.YTDLP_VERSION ?? "2026.10.26").trim();
const force = process.argv.includes("--force");

function assetForPlatform() {
  const { platform, arch } = process;

  if (platform === "win32" && arch === "x64") {
    return { asset: "yt-dlp.exe", fileName: "yt-dlp.exe" };
  }
  if (platform === "darwin") {
    return { asset: "yt-dlp_macos", fileName: "yt-dlp" };
  }
  if (platform === "linux" && arch === "x64") {
    return { asset: "yt-dlp_linux", fileName: "yt-dlp" };
  }
  if (platform === "linux" && arch === "arm64") {
    return { asset: "yt-dlp_linux_aarch64", fileName: "yt-dlp" };
  }
  if (platform === "linux" && arch === "arm") {
    return { asset: "yt-dlp_linux_armv7l", fileName: "yt-dlp" };
  }

  throw new Error(
    `No pinned yt-dlp binary is configured for ${platform}/${arch}. Set YTDLP_PATH to an existing executable.`,
  );
}

async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function existingVersion(target) {
  if (!existsSync(target)) return null;
  const result = spawnSync(target, ["--version"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function main() {
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(version)) {
    throw new Error(
      `YTDLP_VERSION must be a pinned release such as 2026.10.26 (received "${version}").`,
    );
  }

  const { asset, fileName } = assetForPlatform();
  const binDirectory = path.join(packageRoot, "bin");
  const target = path.join(binDirectory, fileName);
  const currentVersion = existingVersion(target);

  if (!force && currentVersion === version) {
    console.log(`yt-dlp ${version} is already installed at ${target}`);
    return;
  }

  const releaseBase = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`;
  console.log(
    `${currentVersion ? `Updating yt-dlp ${currentVersion}` : "Installing yt-dlp"} to ${version} (${asset})…`,
  );

  const sums = (await download(`${releaseBase}/SHA2-256SUMS`)).toString("utf8");
  const expected = sums
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i))
    .find((match) => match?.[2] === asset)?.[1]
    ?.toLowerCase();

  if (!expected) {
    throw new Error(`No SHA-256 checksum found for ${asset} in release ${version}.`);
  }

  const binary = await download(`${releaseBase}/${asset}`);
  const actual = createHash("sha256").update(binary).digest("hex");

  if (actual !== expected) {
    throw new Error(
      `Checksum mismatch for ${asset}: expected ${expected}, received ${actual}.`,
    );
  }

  await fs.mkdir(binDirectory, { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await fs.writeFile(temporary, binary, { mode: 0o755 });
  await fs.rm(target, { force: true });
  await fs.rename(temporary, target);

  if (process.platform !== "win32") {
    await fs.chmod(target, 0o755);
  }

  const installedVersion = existingVersion(target);
  if (installedVersion !== version) {
    throw new Error(
      `Installed binary did not report the expected version (${installedVersion ?? "no output"}).`,
    );
  }

  console.log(`yt-dlp ${installedVersion} installed at ${target}`);
}

main().catch((error) => {
  console.error(`Unable to install yt-dlp: ${error.message}`);
  process.exit(1);
});
