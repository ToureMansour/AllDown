import { promises as fs } from "node:fs";
import path from "node:path";

export async function ensureTempDir(base: string): Promise<string> {
  await fs.mkdir(base, { recursive: true });
  return base;
}

export async function createJobDir(base: string): Promise<string> {
  await ensureTempDir(base);
  return fs.mkdtemp(path.join(base, "job-"));
}

export async function removeDir(directory: string): Promise<void> {
  try {
    await fs.rm(directory, { recursive: true, force: true });
  } catch {
    // Cleanup is best-effort; stale directories are also swept on startup.
  }
}

export async function cleanupStaleDirs(
  base: string,
  maxAgeMs = 6 * 60 * 60 * 1000,
): Promise<number> {
  let removed = 0;
  let entries: string[] = [];

  try {
    entries = await fs.readdir(base);
  } catch {
    return 0;
  }

  const now = Date.now();
  for (const entry of entries) {
    if (!entry.startsWith("job-")) continue;
    const fullPath = path.join(base, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
        await fs.rm(fullPath, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // Ignore entries removed concurrently.
    }
  }

  return removed;
}
