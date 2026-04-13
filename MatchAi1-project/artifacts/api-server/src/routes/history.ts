import { Router, type IRouter } from "express";
import { desc, eq, lte, or, isNull, and } from "drizzle-orm";
import { db, aiPredictionsTable, authorPredictionsTable } from "@workspace/db";
import {
  ListHistoryQueryParams,
  ListHistoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/history", async (req, res): Promise<void> => {
  const params = ListHistoryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 50;
  const offset = params.data.offset ?? 0;

  const now = new Date();
  const publishedFilter = or(isNull(aiPredictionsTable.publishAt), lte(aiPredictionsTable.publishAt, now));

  let aiResults: any[] = [];
  let authorResults: any[] = [];

  if (!params.data.type || params.data.type === "ai") {
    const aiWhere = params.data.status
      ? and(publishedFilter, eq(aiPredictionsTable.status, params.data.status))
      : publishedFilter;

    const rawAi = await db.select().from(aiPredictionsTable).where(aiWhere).orderBy(desc(aiPredictionsTable.matchDate));
    aiResults = rawAi.map((p) => ({
      id: p.id,
      type: "ai" as const,
      matchTitle: p.matchTitle,
      league: p.league,
      prediction: p.prediction,
      odds: p.odds,
      status: p.status,
      matchDate: p.matchDate,
      createdAt: p.createdAt,
    }));
  }

  if (!params.data.type || params.data.type === "author") {
    const authorWhere = params.data.status
      ? eq(authorPredictionsTable.status, params.data.status)
      : undefined;

    const authorQuery = db.select().from(authorPredictionsTable).orderBy(desc(authorPredictionsTable.matchDate));
    const rawAuthor = authorWhere
      ? await authorQuery.where(authorWhere)
      : await authorQuery;

    authorResults = rawAuthor.map((p) => ({
      id: p.id,
      type: "author" as const,
      matchTitle: p.matchTitle,
      league: p.league,
      prediction: p.prediction,
      odds: p.odds,
      status: p.status,
      matchDate: p.matchDate,
      createdAt: p.createdAt,
    }));
  }

  const all = [...aiResults, ...authorResults]
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())
    .slice(offset, offset + limit);

  res.json(ListHistoryResponse.parse(all));
});

export default router;
