import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, aiPredictionsTable, authorPredictionsTable } from "@workspace/db";
import {
  GetStatisticsSummaryResponse,
  GetMonthlyStatisticsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/statistics/summary", async (_req, res): Promise<void> => {
  const aiPreds = await db.select().from(aiPredictionsTable);
  const authorPreds = await db.select().from(authorPredictionsTable);

  const allPreds = [...aiPreds, ...authorPreds];
  const wins = allPreds.filter((p) => p.status === "win").length;
  const losses = allPreds.filter((p) => p.status === "lose").length;
  const refunds = allPreds.filter((p) => p.status === "refund").length;
  const pending = allPreds.filter((p) => p.status === "pending").length;
  const total = wins + losses + refunds; // только завершённые

  const settled = wins + losses;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100 * 10) / 10 : 0;

  const aiSettled = aiPreds.filter((p) => p.status === "win" || p.status === "lose");
  const aiWins = aiPreds.filter((p) => p.status === "win").length;
  const aiLosses = aiPreds.filter((p) => p.status === "lose").length;
  const aiRefunds = aiPreds.filter((p) => p.status === "refund").length;
  const aiTotal = aiWins + aiLosses + aiRefunds; // только завершённые
  const aiWinRate = aiSettled.length > 0 ? Math.round((aiWins / aiSettled.length) * 100 * 10) / 10 : 0;

  const authorSettled = authorPreds.filter((p) => p.status === "win" || p.status === "lose");
  const authorWins = authorPreds.filter((p) => p.status === "win").length;
  const authorLosses = authorPreds.filter((p) => p.status === "lose").length;
  const authorRefunds = authorPreds.filter((p) => p.status === "refund").length;
  const authorTotal = authorWins + authorLosses + authorRefunds; // только завершённые
  const authorWinRate = authorSettled.length > 0 ? Math.round((authorWins / authorSettled.length) * 100 * 10) / 10 : 0;

  const settledPreds = allPreds.filter((p) => p.status === "win" || p.status === "lose");
  const averageOdds = settledPreds.length > 0
    ? Math.round((settledPreds.reduce((sum, p) => sum + p.odds, 0) / settledPreds.length) * 100) / 100
    : 0;

  const profit = settledPreds.reduce((sum, p) => {
    if (p.status === "win") return sum + (p.odds - 1);
    return sum - 1;
  }, 0);
  const roi = settledPreds.length > 0 ? Math.round((profit / settledPreds.length) * 100 * 10) / 10 : 0;

  const allDates = allPreds.map((p) => p.matchDate.getTime()).filter(Boolean);
  const firstPredictionDate = allDates.length > 0
    ? new Date(Math.min(...allDates)).toISOString().slice(0, 10)
    : null;

  res.json(
    GetStatisticsSummaryResponse.parse({
      totalPredictions: total,
      wins,
      losses,
      refunds,
      pending,
      winRate,
      aiWinRate,
      authorWinRate,
      averageOdds,
      roi,
      aiWins,
      aiLosses,
      aiRefunds,
      aiTotal,
      authorWins,
      authorLosses,
      authorRefunds,
      authorTotal,
      firstPredictionDate,
    })
  );
});

router.get("/statistics/monthly", async (_req, res): Promise<void> => {
  const aiPreds = await db.select().from(aiPredictionsTable);
  const authorPreds = await db.select().from(authorPredictionsTable);

  const allPreds = [...aiPreds, ...authorPreds];

  const monthly = new Map<string, { total: number; wins: number; losses: number }>();

  for (const p of allPreds) {
    const month = p.matchDate.toISOString().slice(0, 7);
    if (!monthly.has(month)) {
      monthly.set(month, { total: 0, wins: 0, losses: 0 });
    }
    const entry = monthly.get(month)!;
    entry.total++;
    if (p.status === "win") entry.wins++;
    if (p.status === "lose") entry.losses++;
  }

  const result = Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      totalPredictions: data.total,
      wins: data.wins,
      losses: data.losses,
      winRate: (data.wins + data.losses) > 0
        ? Math.round((data.wins / (data.wins + data.losses)) * 100 * 10) / 10
        : 0,
    }));

  res.json(GetMonthlyStatisticsResponse.parse(result));
});

export default router;
