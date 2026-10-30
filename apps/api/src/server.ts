import "dotenv/config";

import { loadConfig } from "./config/env";
import { createApp } from "./app";
import { createLogger } from "./utils/logger";
import { cleanupStaleDirs, ensureTempDir } from "./utils/temp";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config);

  try {
    await ensureTempDir(config.tempDir);
    const removed = await cleanupStaleDirs(config.tempDir);
    if (removed > 0) {
      logger.info({ removed }, "removed stale temporary download directories");
    }
  } catch (error) {
    logger.warn(
      { err: error },
      "temporary directory could not be prepared; downloads may fail",
    );
  }

  const app = createApp({ config });
  const server = app.listen(config.port, () => {
    logger.info(
      {
        port: config.port,
        environment: config.nodeEnv,
        allowedOrigins: config.frontendOrigins,
      },
      "AllDown API listening",
    );
  });

  server.on("error", (error) => {
    logger.fatal({ err: error }, "HTTP server error");
    process.exitCode = 1;
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    const force = setTimeout(() => {
      logger.warn("forcing shutdown after timeout");
      process.exit(1);
    }, 10_000);
    force.unref();

    server.close((error) => {
      clearTimeout(force);
      if (error) {
        logger.error({ err: error }, "error while closing server");
        process.exitCode = 1;
      }
      process.exit();
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "unhandled promise rejection");
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "uncaught exception");
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Failed to start AllDown API:", error);
  process.exit(1);
});
