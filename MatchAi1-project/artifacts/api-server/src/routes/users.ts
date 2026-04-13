import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, count, sql, desc } from "drizzle-orm";

const SUPER_ADMIN_ID = process.env["ADMIN_ID"] ?? "8589717818";

async function isAdmin(telegramId: string): Promise<boolean> {
  if (telegramId === SUPER_ADMIN_ID) return true;
  try {
    const { admins } = await import("@workspace/db");
    const result = await db.select().from(admins).where(eq(admins.telegramId, telegramId)).limit(1);
    return result.length > 0;
  } catch { return false; }
}

const router: IRouter = Router();

// POST /api/users/register — upsert user + return notification prefs
router.post("/users/register", async (req: Request, res: Response) => {
  const { telegramId, firstName, username } = req.body as {
    telegramId: number;
    firstName?: string;
    username?: string;
  };

  if (!telegramId) {
    res.status(400).json({ error: "telegramId required" });
    return;
  }

  try {
    await db.insert(usersTable)
      .values({ telegramId, firstName: firstName ?? null, username: username ?? null, coins: 0 })
      .onConflictDoUpdate({
        target: usersTable.telegramId,
        set: {
          firstName: firstName ?? null,
          username: username ?? null,
        },
      });

    const [user] = await db.select({
      notificationsAi: usersTable.notificationsAi,
      notificationsAuthor: usersTable.notificationsAuthor,
    }).from(usersTable).where(eq(usersTable.telegramId, telegramId));

    res.json({ notificationsAi: user?.notificationsAi ?? true, notificationsAuthor: user?.notificationsAuthor ?? true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/users/notifications — update notification preferences
router.patch("/users/notifications", async (req: Request, res: Response) => {
  const { telegramId, notificationsAi, notificationsAuthor } = req.body as {
    telegramId: number;
    notificationsAi?: boolean;
    notificationsAuthor?: boolean;
  };

  if (!telegramId) {
    res.status(400).json({ error: "telegramId required" });
    return;
  }

  try {
    const updateData: Record<string, boolean> = {};
    if (notificationsAi !== undefined) updateData["notificationsAi"] = notificationsAi;
    if (notificationsAuthor !== undefined) updateData["notificationsAuthor"] = notificationsAuthor;

    await db.update(usersTable).set(updateData).where(eq(usersTable.telegramId, telegramId));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/users/stats — full user statistics for admin panel
router.get("/admin/users/stats", async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !await isAdmin(adminId)) { res.status(403).json({ error: "forbidden" }); return; }

  try {
    // Kyiv offset: UTC+3
    const kyivOffsetMs = 3 * 60 * 60 * 1000;
    const nowKyiv = new Date(Date.now() + kyivOffsetMs);
    const todayKyiv = new Date(nowKyiv);
    todayKyiv.setUTCHours(0, 0, 0, 0);

    const weekStart = new Date(todayKyiv);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const monthStart = new Date(todayKyiv);
    monthStart.setUTCDate(monthStart.getUTCDate() - 30);

    // Convert back to UTC for DB comparison
    const todayUTC = new Date(todayKyiv.getTime() - kyivOffsetMs);
    const weekUTC = new Date(weekStart.getTime() - kyivOffsetMs);
    const monthUTC = new Date(monthStart.getTime() - kyivOffsetMs);

    const [row] = await db.select({
      total: count(),
      notifyAi: sql<number>`SUM(CASE WHEN ${usersTable.notificationsAi} = true THEN 1 ELSE 0 END)::int`,
      notifyAuthor: sql<number>`SUM(CASE WHEN ${usersTable.notificationsAuthor} = true THEN 1 ELSE 0 END)::int`,
      notifyBoth: sql<number>`SUM(CASE WHEN ${usersTable.notificationsAi} = true AND ${usersTable.notificationsAuthor} = true THEN 1 ELSE 0 END)::int`,
      notifyNone: sql<number>`SUM(CASE WHEN ${usersTable.notificationsAi} = false AND ${usersTable.notificationsAuthor} = false THEN 1 ELSE 0 END)::int`,
      newToday: sql<number>`SUM(CASE WHEN ${usersTable.createdAt} >= ${todayUTC.toISOString()} THEN 1 ELSE 0 END)::int`,
      newWeek: sql<number>`SUM(CASE WHEN ${usersTable.createdAt} >= ${weekUTC.toISOString()} THEN 1 ELSE 0 END)::int`,
      newMonth: sql<number>`SUM(CASE WHEN ${usersTable.createdAt} >= ${monthUTC.toISOString()} THEN 1 ELSE 0 END)::int`,
    }).from(usersTable);

    const topCoins = await db.select({
      telegramId: usersTable.telegramId,
      firstName: usersTable.firstName,
      username: usersTable.username,
      coins: usersTable.coins,
    }).from(usersTable).orderBy(desc(usersTable.coins)).limit(5);

    res.json({
      total: row?.total ?? 0,
      notifyAi: row?.notifyAi ?? 0,
      notifyAuthor: row?.notifyAuthor ?? 0,
      notifyBoth: row?.notifyBoth ?? 0,
      notifyNone: row?.notifyNone ?? 0,
      newToday: row?.newToday ?? 0,
      newWeek: row?.newWeek ?? 0,
      newMonth: row?.newMonth ?? 0,
      topCoins,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/users/list — paginated user list
router.get("/admin/users/list", async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !await isAdmin(adminId)) { res.status(403).json({ error: "forbidden" }); return; }

  const limit = Math.min(Number(req.query["limit"] ?? 30), 100);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    const users = await db.select().from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
