import { Router, type IRouter } from "express";
import { eq, desc, lte, or, isNull, and, gte } from "drizzle-orm";
import { db, aiPredictionsTable } from "@workspace/db";
import {
  ListAiPredictionsQueryParams,
  ListAiPredictionsResponse,
  GetAiPredictionParams,
  GetAiPredictionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function kyivTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const kyivDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" });
  const start = new Date(`${kyivDateStr}T00:00:00+03:00`);
  const end = new Date(`${kyivDateStr}T23:59:59+03:00`);
  return { start, end };
}

router.get("/ai-predictions", async (req, res): Promise<void> => {
  const params = ListAiPredictionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const now = new Date();
  const publishedFilter = or(isNull(aiPredictionsTable.publishAt), lte(aiPredictionsTable.publishAt, now));

  let whereClause = publishedFilter;

  if (params.data.todayOnly) {
    const { start, end } = kyivTodayRange();
    const todayFilter = and(
      gte(aiPredictionsTable.matchDate, start),
      lte(aiPredictionsTable.matchDate, end),
    );
    whereClause = and(publishedFilter, todayFilter);
  }

  if (params.data.status) {
    whereClause = and(whereClause, eq(aiPredictionsTable.status, params.data.status));
  }

  const limit = params.data.limit ?? 20;
  const offset = params.data.offset ?? 0;

  const results = await db
    .select()
    .from(aiPredictionsTable)
    .where(whereClause)
    .orderBy(desc(aiPredictionsTable.matchDate))
    .limit(limit)
    .offset(offset);

  res.json(ListAiPredictionsResponse.parse(results));
});

router.get("/ai-predictions/:id", async (req, res): Promise<void> => {
  const params = GetAiPredictionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [prediction] = await db
    .select()
    .from(aiPredictionsTable)
    .where(eq(aiPredictionsTable.id, params.data.id));

  if (!prediction) {
    res.status(404).json({ error: "AI prediction not found" });
    return;
  }

  res.json(GetAiPredictionResponse.parse(prediction));
});

export default router;
