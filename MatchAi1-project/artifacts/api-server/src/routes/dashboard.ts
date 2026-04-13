import { Router, type IRouter } from "express";
import { gte, desc, eq } from "drizzle-orm";
import { db, aiPredictionsTable, authorPredictionsTable, matchesTable } from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const todayMatches = await db
    .select()
    .from(matchesTable)
    .where(gte(matchesTable.matchDate, todayStart));
  const todayCount = todayMatches.filter(
    (m) => m.matchDate < todayEnd
  ).length;

  const aiPreds = await db.select().from(aiPredictionsTable);
  const authorPreds = await db.select().from(authorPredictionsTable);
  const allPreds = [...aiPreds, ...authorPreds];

  const activePredictions = allPreds.filter((p) => p.status === "pending").length;

  const settled = allPreds.filter((p) => p.status === "win" || p.status === "lose");
  const wins = allPreds.filter((p) => p.status === "win").length;
  const overallWinRate = settled.length > 0 ? Math.round((wins / settled.length) * 100 * 10) / 10 : 0;

  const sortedSettled = settled.sort(
    (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
  );

  let recentStreak = 0;
  if (sortedSettled.length > 0) {
    const firstStatus = sortedSettled[0].status;
    for (const p of sortedSettled) {
      if (p.status === firstStatus) recentStreak++;
      else break;
    }
    if (firstStatus === "lose") recentStreak = -recentStreak;
  }

  const totalProfit = settled.reduce((sum, p) => {
    if (p.status === "win") return sum + (p.odds - 1);
    return sum - 1;
  }, 0);

  const recentPredictions = allPreds
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      type: ("confidence" in p ? "ai" : "author") as "ai" | "author",
      matchTitle: p.matchTitle,
      league: p.league,
      prediction: p.prediction,
      odds: p.odds,
      status: p.status,
      matchDate: p.matchDate,
      createdAt: p.createdAt,
    }));

  res.json(
    GetDashboardResponse.parse({
      todayMatches: todayCount,
      activePredictions,
      overallWinRate,
      recentStreak: Math.round(totalProfit * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      recentPredictions,
    })
  );
});

export default router;
