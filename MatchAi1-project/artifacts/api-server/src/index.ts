import app from "./app";
import { logger } from "./lib/logger";
import { startupFetch } from "./services/stats-fetcher";
import { startDailyScheduler } from "./services/auto-scheduler";

// Prevent unhandled rejections from crashing the process
process.on("unhandledRejection", (reason) => {
  logger.warn({ reason }, "Unhandled promise rejection (ignored)");
});

process.on("uncaughtException", (err) => {
  logger.warn({ err }, "Uncaught exception (ignored)");
});

const rawPort = process.env["PORT"] ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Startup: detect season, then start daily auto-scheduler
  setTimeout(() => {
    startupFetch().catch((e) => logger.warn({ err: e }, "stats startup fetch failed"));
    try {
      startDailyScheduler();
    } catch (e) {
      logger.warn({ err: e }, "auto-scheduler start failed");
    }
  }, 3000);
});
