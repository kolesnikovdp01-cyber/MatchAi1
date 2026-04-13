import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, aiPredictionsTable, admins } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { generateAndSave } from "../services/prediction-generator";
import { runDailyGeneration } from "../services/auto-scheduler";

const router: IRouter = Router();
const SUPER_ADMIN = "8589717818";

async function adminGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminId = String(req.headers["x-admin-id"] ?? "").trim();
  if (!adminId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (adminId === SUPER_ADMIN) { next(); return; }
  const [row] = await db.select().from(admins).where(eq(admins.telegramId, adminId));
  if (!row) { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

// Admin-only: get ALL predictions including scheduled future ones
router.get("/admin/ai-predictions", adminGuard, async (req, res): Promise<void> => {
  const results = await db
    .select()
    .from(aiPredictionsTable)
    .orderBy(desc(aiPredictionsTable.matchDate));
  res.json(results);
});

// Admin: manually generate a single prediction for a specific match
router.post("/admin/generate-prediction", adminGuard, async (req, res): Promise<void> => {
  const { homeTeam, awayTeam, league, matchDate, fixtureId } = req.body;

  if (!homeTeam || !awayTeam) {
    res.status(400).json({ error: "homeTeam and awayTeam are required" });
    return;
  }
  if (!matchDate) {
    res.status(400).json({ error: "matchDate is required" });
    return;
  }

  const matchDateObj = new Date(matchDate);
  if (isNaN(matchDateObj.getTime())) {
    res.status(400).json({ error: "Некорректная дата матча" });
    return;
  }
  if (matchDateObj <= new Date()) {
    res.status(400).json({ error: "🚫 Live-матч заблокирован. ИИ работает только с предстоящими матчами." });
    return;
  }

  // Manual generation: publish 2h before match (or immediately if too soon)
  const PUBLISH_BEFORE_MS = 2 * 60 * 60 * 1000;
  const now = new Date();
  const desiredPublish = new Date(matchDateObj.getTime() - PUBLISH_BEFORE_MS);
  const publishAt = desiredPublish <= now ? null : desiredPublish;

  const result = await generateAndSave({
    homeTeam,
    awayTeam,
    league: league ?? "",
    matchDate: matchDateObj,
    fixtureId: fixtureId ? Number(fixtureId) : undefined,
    publishAt,
  });

  if ("error" in result) {
    res.status(500).json({ error: "AI generation failed", details: result.error });
    return;
  }

  if ("skipped" in result) {
    res.status(200).json({ skipped: true, reason: result.reason });
    return;
  }

  // Return the saved prediction
  const [saved] = await db
    .select()
    .from(aiPredictionsTable)
    .where(eq(aiPredictionsTable.id, result.id));

  res.json(saved);

  // Telegram notification for immediately published
  if (!publishAt) {
    const { notifyNewAiPrediction } = await import("../services/telegram-notify");
    notifyNewAiPrediction({
      homeTeam,
      awayTeam,
      league: league || "Неизвестная лига",
      prediction: result.prediction,
      odds: saved?.odds ?? 0,
      confidence: result.confidence,
    }).catch(() => {});
  }
});

// Admin: manually trigger the full daily auto-generation (for testing / catch-up)
router.post("/admin/auto-generate", adminGuard, async (req, res): Promise<void> => {
  res.json({ ok: true, message: "Auto-generation started in background" });
  // Run in background so response returns immediately
  runDailyGeneration("manual").catch(e => console.error("[auto-generate] error:", e?.message));
});

export default router;
