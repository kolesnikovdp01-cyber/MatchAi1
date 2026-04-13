import { Router, type IRouter } from "express";
import { gte, desc } from "drizzle-orm";
import { db, matchesTable } from "@workspace/db";
import {
  ListUpcomingMatchesQueryParams,
  ListUpcomingMatchesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/matches/upcoming", async (req, res): Promise<void> => {
  const params = ListUpcomingMatchesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 10;

  const results = await db
    .select()
    .from(matchesTable)
    .where(gte(matchesTable.matchDate, new Date()))
    .orderBy(matchesTable.matchDate)
    .limit(limit);

  res.json(ListUpcomingMatchesResponse.parse(results));
});

export default router;
