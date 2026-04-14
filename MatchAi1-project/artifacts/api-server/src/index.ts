import app from "./app";
  import { logger } from "./lib/logger";
  import { startupFetch } from "./services/stats-fetcher";
  import { startDailyScheduler } from "./services/auto-scheduler";

  export default app;

  const rawPort = process.env["PORT"];
  if (rawPort) {
    const port = Number(rawPort);
    app.listen(port, (err) => {
      if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
      logger.info({ port }, "Server listening");
      setTimeout(() => {
        startupFetch().catch((e) => logger.warn({ err: e }, "stats startup fetch failed"));
        startDailyScheduler();
      }, 3000);
    });
  }
  