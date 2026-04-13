import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, and, gte, lte, or, isNull } from "drizzle-orm";
import { db, authorPredictionsTable } from "@workspace/db";
import { notifyNewAuthorPrediction } from "../services/telegram-notify";
import {
  ListAuthorPredictionsQueryParams,
  ListAuthorPredictionsResponse,
  CreateAuthorPredictionBody,
  GetAuthorPredictionParams,
  GetAuthorPredictionResponse,
  UpdateAuthorPredictionParams,
  UpdateAuthorPredictionBody,
  UpdateAuthorPredictionResponse,
} from "@workspace/api-zod";

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

function adminGuard(req: Request, res: Response, next: NextFunction): void {
  const id = req.headers["x-admin-id"] as string | undefined;
  if (!id) { res.status(403).json({ error: "Forbidden" }); return; }
  isAdmin(id).then(ok => {
    if (!ok) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
  }).catch(() => { res.status(403).json({ error: "Forbidden" }); });
}

// ── Public: list published predictions ────────────────────────────────────────
router.get("/author-predictions", async (req, res): Promise<void> => {
  const params = ListAuthorPredictionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(authorPredictionsTable).orderBy(desc(authorPredictionsTable.matchDate)).$dynamic();

  const now = new Date();
  // Only show predictions that are published (publishAt is null = immediate, or publishAt <= now)
  const publishedFilter = or(isNull(authorPredictionsTable.publishAt), lte(authorPredictionsTable.publishAt, now));
  let whereClause: any = publishedFilter;

  if (params.data.todayOnly) {
    const kyivDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" });
    const start = new Date(`${kyivDateStr}T00:00:00+03:00`);
    const end = new Date(`${kyivDateStr}T23:59:59+03:00`);
    whereClause = and(
      publishedFilter,
      gte(authorPredictionsTable.matchDate, start),
      lte(authorPredictionsTable.matchDate, end),
    );
  }

  if (params.data.status) {
    whereClause = and(whereClause, eq(authorPredictionsTable.status, params.data.status));
  }

  if (whereClause) {
    query = query.where(whereClause);
  }

  const limit = params.data.limit ?? 20;
  const offset = params.data.offset ?? 0;
  const results = await query.limit(limit).offset(offset);

  res.json(ListAuthorPredictionsResponse.parse(results));
});

// ── Admin: list ALL predictions (ignores publishAt, includes scheduled) ────────
router.get("/admin/author-predictions-all", adminGuard, async (_req, res): Promise<void> => {
  try {
    const results = await db
      .select()
      .from(authorPredictionsTable)
      .orderBy(desc(authorPredictionsTable.createdAt))
      .limit(200);
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public: get single prediction ─────────────────────────────────────────────
router.get("/author-predictions/:id", async (req, res): Promise<void> => {
  const params = GetAuthorPredictionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [prediction] = await db
    .select()
    .from(authorPredictionsTable)
    .where(eq(authorPredictionsTable.id, params.data.id));

  if (!prediction) {
    res.status(404).json({ error: "Author prediction not found" });
    return;
  }

  res.json(GetAuthorPredictionResponse.parse(prediction));
});

// ── Admin: create prediction ───────────────────────────────────────────────────
router.post("/author-predictions", adminGuard, async (req, res): Promise<void> => {
  const parsed = CreateAuthorPredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [prediction] = await db
    .insert(authorPredictionsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(GetAuthorPredictionResponse.parse(prediction));

  // Notify users only for immediately published predictions
  if (!parsed.data.publishAt) {
    notifyNewAuthorPrediction({
      homeTeam: prediction.homeTeam,
      awayTeam: prediction.awayTeam,
      league: prediction.league,
      prediction: prediction.prediction,
      odds: prediction.odds,
      stake: prediction.stake,
    }).catch(() => {});
  }
});

// ── Admin: update prediction status / publishAt ────────────────────────────────
router.patch("/author-predictions/:id", adminGuard, async (req, res): Promise<void> => {
  const params = UpdateAuthorPredictionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAuthorPredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Build update object — only include fields that were actually provided
  const updateData: Record<string, any> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.publishAt !== undefined) updateData.publishAt = parsed.data.publishAt;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [prediction] = await db
    .update(authorPredictionsTable)
    .set(updateData)
    .where(eq(authorPredictionsTable.id, params.data.id))
    .returning();

  if (!prediction) {
    res.status(404).json({ error: "Author prediction not found" });
    return;
  }

  res.json(UpdateAuthorPredictionResponse.parse(prediction));
});

export default router;
