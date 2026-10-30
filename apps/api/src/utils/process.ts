import { spawn } from "node:child_process";

import { AbortError, AppError } from "./errors";

export interface RunProcessOptions {
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ProcessResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function killProcessTree(pid: number | undefined): void {
  if (!pid) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    }).on("error", () => undefined);
    return;
  }

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Process already exited.
    }
  }
}

export function createEngineEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const allowed = [
    "PATH",
    "Path",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "LANG",
    "LC_ALL",
    "LOCALAPPDATA",
  ];
  const env: NodeJS.ProcessEnv = { NO_COLOR: "1" };

  for (const key of allowed) {
    const value = process.env[key];
    if (value) env[key] = value;
  }

  return { ...env, ...overrides };
}

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      cwd: options.cwd,
      env: options.env ?? createEngineEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
      callback();
    };

    const fail = (error: Error) => {
      finish(() => reject(error));
      killProcessTree(child.pid);
    };

    const timeout = setTimeout(() => {
      fail(
        new AppError(
          504,
          "ENGINE_TIMEOUT",
          "Le moteur d'extraction a dépassé le délai autorisé.",
        ),
      );
    }, options.timeoutMs);

    const onAbort = () => {
      fail(new AbortError());
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > options.maxOutputBytes) {
        fail(
          new AppError(
            502,
            "ENGINE_ERROR",
            "La réponse du moteur d'extraction est trop volumineuse.",
          ),
        );
        return;
      }
      stdout.push(chunk);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= options.maxOutputBytes) {
        stderr.push(chunk);
      }
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        fail(
          new AppError(
            503,
            "ENGINE_UNAVAILABLE",
            "Le moteur d'extraction (yt-dlp) n'est pas disponible sur le serveur.",
          ),
        );
        return;
      }
      fail(
        new AppError(
          502,
          "ENGINE_ERROR",
          "Impossible de démarrer le moteur d'extraction.",
          { cause: error },
        ),
      );
    });

    child.on("close", (code) => {
      finish(() =>
        resolve({
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          code,
        }),
      );
    });
  });
}
