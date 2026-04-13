import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, liveOddsTable, admins } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const router: IRouter = Router();
const SUPER_ADMIN = process.env.ADMIN_ID ?? "8589717818";
const API_KEY = process.env.APISPORTS_KEY ?? "";

let lastFetchDate: string | null = null;

async function adminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminId = String(req.headers["x-admin-id"] ?? "").trim();
  if (!adminId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (adminId === SUPER_ADMIN) { next(); return; }
  const [row] = await db.select().from(admins).where(eq(admins.telegramId, adminId));
  if (!row) { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" });
}

async function fetchAndStoreOdds() {
  const today = todayStr();

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  await db.delete(liveOddsTable).where(lt(liveOddsTable.fetchedAt, cutoff));

  const fixturesUrl = `https://v3.football.api-sports.io/fixtures?date=${today}&status=NS`;
  const fixturesRes = await fetch(fixturesUrl, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  if (!fixturesRes.ok) {
    throw new Error(`Fixtures API error: ${fixturesRes.status}`);
  }

  const fixturesData = (await fixturesRes.json()) as any;
  const fixtures = (fixturesData.response ?? []).slice(0, 20);

  if (fixtures.length === 0) return [];

  // Only fetch fixtures (1 request total) — no per-match odds calls to preserve daily quota
  const rows: any[] = [];
  for (const fix of fixtures) {
    const fid = String(fix.fixture?.id ?? "");
    const homeTeam = fix.teams?.home?.name ?? "";
    const awayTeam = fix.teams?.away?.name ?? "";
    const league = fix.league?.name ?? "";
    const matchDate = new Date(fix.fixture?.date ?? Date.now());
    rows.push({ fixtureId: fid, homeTeam, awayTeam, league, matchDate, oddsHome: null, oddsDraw: null, oddsAway: null, bookmaker: "" });
  }

  if (rows.length > 0) {
    for (const row of rows) {
      await db.insert(liveOddsTable).values(row).onConflictDoNothing();
    }
  }

  lastFetchDate = today;
  return rows;
}

router.get("/live-odds", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(liveOddsTable);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list fixtures available for AI prediction generation
// Only returns NOT-STARTED matches (matchDate > now) — live/finished matches are excluded
router.get("/admin/live-odds/fixtures", adminGuard, async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const rows = await db.select().from(liveOddsTable);
    // Filter out any match that has already started
    const upcoming = rows.filter(r => new Date(r.matchDate) > now);
    res.json(upcoming);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/live-odds/refresh", adminGuard, async (req, res): Promise<void> => {
  try {
    const rows = await fetchAndStoreOdds();
    res.json({ fetched: rows.length, date: todayStr() });
  } catch (err: any) {
    console.error("live-odds refresh error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/admin/live-odds", adminGuard, async (req, res): Promise<void> => {
  await db.delete(liveOddsTable);
  res.json({ cleared: true });
});

// No auto-fetch on startup — manual refresh only via admin panel to preserve daily quota

export default router;
