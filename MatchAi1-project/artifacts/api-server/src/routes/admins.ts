import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, admins } from "@workspace/db";

const router: IRouter = Router();

const SUPER_ADMIN_ID = process.env["ADMIN_ID"] ?? "8589717818";

// Ensure super admin exists on startup
(async () => {
  try {
    await db.insert(admins).values({
      telegramId: SUPER_ADMIN_ID,
      addedBy: null,
      isSuperAdmin: true,
    }).onConflictDoNothing();
  } catch { /* ignore */ }
})();

async function isAdminId(telegramId: string): Promise<boolean> {
  if (telegramId === SUPER_ADMIN_ID) return true;
  const result = await db.select().from(admins).where(eq(admins.telegramId, telegramId)).limit(1);
  return result.length > 0;
}

async function isSuperAdminId(telegramId: string): Promise<boolean> {
  if (telegramId === SUPER_ADMIN_ID) return true;
  const result = await db.select().from(admins).where(eq(admins.telegramId, telegramId)).limit(1);
  return result.length > 0 && result[0].isSuperAdmin === true;
}

// GET /api/admins/check?id=... — check if a telegram user is admin
router.get("/check", async (req: Request, res: Response): Promise<void> => {
  const { id } = req.query;
  if (!id || typeof id !== "string") {
    res.json({ isAdmin: false, isSuperAdmin: false });
    return;
  }
  try {
    const adminCheck = await isAdminId(id);
    const superCheck = adminCheck ? await isSuperAdminId(id) : false;
    res.json({ isAdmin: adminCheck, isSuperAdmin: superCheck });
  } catch {
    res.json({ isAdmin: false, isSuperAdmin: false });
  }
});

// Admin guard middleware
async function adminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !(await isAdminId(adminId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

async function superAdminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminId = req.headers["x-admin-id"] as string;
  if (!adminId || !(await isSuperAdminId(adminId))) {
    res.status(403).json({ error: "Forbidden — super admin only" });
    return;
  }
  next();
}

// GET /api/admins — list all admins (admin only)
router.get("/", adminGuard as any, async (_req: Request, res: Response): Promise<void> => {
  try {
    const all = await db.select().from(admins).orderBy(admins.createdAt);
    res.json(all);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admins — add new admin (super admin only)
router.post("/", superAdminGuard as any, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req.body;
  const addedBy = req.headers["x-admin-id"] as string;
  if (!telegramId || typeof telegramId !== "string") {
    res.status(400).json({ error: "telegramId is required" });
    return;
  }
  if (telegramId === SUPER_ADMIN_ID) {
    res.status(400).json({ error: "Cannot add super admin this way" });
    return;
  }
  try {
    const [newAdmin] = await db.insert(admins).values({
      telegramId,
      addedBy,
      isSuperAdmin: false,
    }).onConflictDoNothing().returning();
    if (!newAdmin) {
      res.status(409).json({ error: "Admin already exists" });
      return;
    }
    res.status(201).json(newAdmin);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admins/:telegramId — remove admin (super admin only, cannot remove super admin)
router.delete("/:telegramId", superAdminGuard as any, async (req: Request, res: Response): Promise<void> => {
  const { telegramId } = req.params;
  if (telegramId === SUPER_ADMIN_ID) {
    res.status(403).json({ error: "Cannot remove super admin" });
    return;
  }
  try {
    await db.execute(sql`DELETE FROM admins WHERE telegram_id = ${telegramId}`);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
