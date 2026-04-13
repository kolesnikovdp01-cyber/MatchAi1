import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, admins, statsCacheTable, apiRequestTrackerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { startupFetch, getApiUsage, getCachedStatsCount, resetApiBlock } from "../services/stats-fetcher";

const router: IRouter = Router();
const SUPER_ADMIN = process.env.ADMIN_ID ?? "8589717818";

async function adminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminId = String(req.headers["x-admin-id"] ?? "").trim();
  if (!adminId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (adminId === SUPER_ADMIN) { next(); return; }
  const [row] = await db.select().from(admins).where(eq(admins.telegramId, adminId));
  if (!row) { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.get("/admin/stats-cache/status", adminGuard, async (_req, res): Promise<void> => {
  try {
    const usage = await getApiUsage();
    const count = await getCachedStatsCount();

    const trackerRows = await db.select().from(apiRequestTrackerTable);

    res.json({ usage, cachedEntries: count, history: trackerRows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/stats-cache/reset-block", adminGuard, async (_req, res): Promise<void> => {
  resetApiBlock();
  res.json({ ok: true, message: "API block reset. Retry will happen on next refresh." });
});

router.post("/admin/stats-cache/refresh", adminGuard, async (_req, res): Promise<void> => {
  try {
    await startupFetch();
    const usage = await getApiUsage();
    const count = await getCachedStatsCount();
    res.json({ ok: true, usage, cachedEntries: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/admin/stats-cache/entries", adminGuard, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({ id: statsCacheTable.id, key: statsCacheTable.key, type: statsCacheTable.type, fetchedAt: statsCacheTable.fetchedAt })
      .from(statsCacheTable);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
