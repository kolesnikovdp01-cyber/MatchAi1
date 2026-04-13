import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { adsTable, adViewsTable, usersTable } from "@workspace/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const router: IRouter = Router();

const SUPER_ADMIN_ID = process.env["ADMIN_ID"] ?? "8589717818";

async function isAdmin(telegramId: string): Promise<boolean> {
  if (telegramId === SUPER_ADMIN_ID) return true;
  try {
    const { admins } = await import("@workspace/db");
    const result = await db.select().from(admins).where(eq(admins.telegramId, telegramId)).limit(1);
    return result.length > 0;
  } catch { return false; }
}

async function upsertUser(telegramId: number, firstName?: string, username?: string) {
  await db.insert(usersTable).values({ telegramId, firstName: firstName ?? null, username: username ?? null, coins: 0 })
    .onConflictDoNothing();
}

// GET /api/ads/active — get one active ad
router.get("/ads/active", async (_req: Request, res: Response): Promise<void> => {
  try {
    const ads = await db.select().from(adsTable).where(eq(adsTable.isActive, true)).orderBy(desc(adsTable.createdAt)).limit(1);
    if (ads.length === 0) { res.json(null); return; }
    res.json(ads[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ads/user-coins?telegramId=...
router.get("/ads/user-coins", async (req: Request, res: Response): Promise<void> => {
  const telegramId = Number(req.query["telegramId"]);
  if (!telegramId) { res.json({ coins: 0 }); return; }
  try {
    await upsertUser(telegramId);
    const users = await db.select({ coins: usersTable.coins }).from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    res.json({ coins: users[0]?.coins ?? 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ads/view — record view + award coins
router.post("/ads/view", async (req: Request, res: Response): Promise<void> => {
  const { telegramId, adId, firstName, username } = req.body as { telegramId: number; adId: number; firstName?: string; username?: string };
  if (!telegramId || !adId) { res.status(400).json({ error: "telegramId and adId required" }); return; }

  try {
    await upsertUser(telegramId, firstName, username);

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const kyivOffset = 3 * 60 * 60 * 1000;
    const kyivDayStart = new Date(todayStart.getTime() - kyivOffset);

    const existing = await db.select().from(adViewsTable)
      .where(and(
        eq(adViewsTable.telegramId, telegramId),
        eq(adViewsTable.adId, adId),
        gte(adViewsTable.viewedAt, kyivDayStart)
      )).limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "already_viewed_today", coins: null });
      return;
    }

    const ads = await db.select({ rewardCoins: adsTable.rewardCoins }).from(adsTable).where(eq(adsTable.id, adId)).limit(1);
    if (ads.length === 0) { res.status(404).json({ error: "ad not found" }); return; }
    const reward = ads[0].rewardCoins;

    await db.insert(adViewsTable).values({ telegramId, adId });
    await db.execute(`UPDATE users SET coins = coins + ${reward} WHERE telegram_id = ${telegramId}`);

    const users = await db.select({ coins: usersTable.coins }).from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    res.json({ success: true, coinsEarned: reward, coins: users[0]?.coins ?? reward });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin routes ────────────────────────────────────────────────────

// GET /api/admin/ads
router.get("/admin/ads", async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !await isAdmin(adminId)) { res.status(403).json({ error: "forbidden" }); return; }
  try {
    const ads = await db.select().from(adsTable).orderBy(desc(adsTable.createdAt));
    res.json(ads);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/ads
router.post("/admin/ads", async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !await isAdmin(adminId)) { res.status(403).json({ error: "forbidden" }); return; }
  const { title, description, imageUrl, mediaType, linkUrl, rewardCoins, durationSeconds } = req.body;
  if (!title || !linkUrl) { res.status(400).json({ error: "title and linkUrl required" }); return; }
  try {
    const inserted = await db.insert(adsTable).values({
      title,
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      mediaType: mediaType ?? "image",
      linkUrl,
      rewardCoins: rewardCoins ?? 5,
      durationSeconds: durationSeconds ?? 15,
      isActive: true,
    }).returning();
    res.json(inserted[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/ads/:id — toggle active
router.patch("/admin/ads/:id", async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !await isAdmin(adminId)) { res.status(403).json({ error: "forbidden" }); return; }
  const id = Number(req.params["id"]);
  const { isActive } = req.body;
  try {
    const updated = await db.update(adsTable).set({ isActive }).where(eq(adsTable.id, id)).returning();
    res.json(updated[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/ads/:id
router.delete("/admin/ads/:id", async (req: Request, res: Response): Promise<void> => {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !await isAdmin(adminId)) { res.status(403).json({ error: "forbidden" }); return; }
  const id = Number(req.params["id"]);
  try {
    await db.delete(adsTable).where(eq(adsTable.id, id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
