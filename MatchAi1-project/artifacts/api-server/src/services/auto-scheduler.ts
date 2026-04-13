/**
 * Auto-scheduler: every day at 06:00 Kyiv time, fetches today's top-league matches
 * and generates AI predictions for each. Each prediction is set to appear
 * 2 hours before its match kickoff, so users see them gradually throughout the day.
 */

import { db, aiPredictionsTable } from "@workspace/db";
import { and, gte, lte, eq } from "drizzle-orm";
import { generateAndSave } from "./prediction-generator";
import { getApiUsage } from "./stats-fetcher";

const TOP_LEAGUE_IDS = new Set([39, 140, 78, 135, 61, 2]);
const APISPORTS_KEY = process.env.APISPORTS_KEY ?? "";
const HOST = "v3.football.api-sports.io";
const MAX_MATCHES_PER_DAY = 5; // stay within 90 daily API quota
const PUBLISH_BEFORE_MS = 2 * 60 * 60 * 1000; // 2 hours
const DELAY_BETWEEN_MATCHES_MS = 5000; // 5s gap between match generations

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kyivDateStr(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Kiev" });
}

function msUntilKyivHour(hour: number): number {
  const now = new Date();
  // Get current time in Kyiv
  const kyivStr = now.toLocaleString("en-US", { timeZone: "Europe/Kiev", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  // Parse Kyiv time
  const [datePart, timePart] = kyivStr.split(", ");
  const [mon, day, yr] = datePart.split("/");
  const [h, m, s] = timePart.split(":");
  const kyivNow = new Date(`${yr}-${mon}-${day}T${h}:${m}:${s}+03:00`);
  const kyivNext = new Date(kyivNow);
  kyivNext.setHours(hour, 0, 0, 0);
  if (kyivNext.getTime() <= kyivNow.getTime()) {
    kyivNext.setDate(kyivNext.getDate() + 1);
  }
  return kyivNext.getTime() - now.getTime();
}

async function fetchTodayTopFixtures(): Promise<any[]> {
  if (!APISPORTS_KEY) { console.warn("[scheduler] APISPORTS_KEY not set"); return []; }
  const today = kyivDateStr();
  const url = `https://${HOST}/fixtures?date=${today}&status=NS`;
  const res = await fetch(url, { headers: { "x-apisports-key": APISPORTS_KEY } });
  if (!res.ok) { console.warn(`[scheduler] Fixtures fetch failed: ${res.status}`); return []; }
  const json = (await res.json()) as any;
  const all: any[] = json.response ?? [];

  // Filter: top leagues only, sort by league importance then time
  const leagueOrder = [2, 39, 140, 78, 135, 61]; // CL first, then big5
  const filtered = all
    .filter((f: any) => TOP_LEAGUE_IDS.has(f.league?.id))
    .sort((a: any, b: any) => {
      const ai = leagueOrder.indexOf(a.league?.id);
      const bi = leagueOrder.indexOf(b.league?.id);
      if (ai !== bi) return ai - bi;
      return new Date(a.fixture?.date).getTime() - new Date(b.fixture?.date).getTime();
    });

  console.log(`[scheduler] Found ${all.length} total fixtures today, ${filtered.length} in top leagues`);
  return filtered;
}

async function alreadyGeneratedToday(): Promise<Set<string>> {
  const today = kyivDateStr();
  const todayStart = new Date(`${today}T00:00:00+03:00`);
  const todayEnd = new Date(`${today}T23:59:59+03:00`);
  const rows = await db
    .select({ homeTeam: aiPredictionsTable.homeTeam, awayTeam: aiPredictionsTable.awayTeam })
    .from(aiPredictionsTable)
    .where(and(gte(aiPredictionsTable.createdAt, todayStart), lte(aiPredictionsTable.createdAt, todayEnd)));
  return new Set(rows.map(r => `${r.homeTeam}|${r.awayTeam}`));
}

// ─── Core daily run ───────────────────────────────────────────────────────────

export async function runDailyGeneration(triggeredBy: "cron" | "manual" = "cron"): Promise<void> {
  console.log(`[scheduler] Daily generation started (trigger: ${triggeredBy})`);

  try {
    const { today: usedToday, limit, canFetch } = await getApiUsage();
    if (!canFetch) {
      console.warn(`[scheduler] Daily API limit reached (${usedToday}/${limit}). Skipping.`);
      return;
    }
    console.log(`[scheduler] API usage: ${usedToday}/${limit}`);

    const fixtures = await fetchTodayTopFixtures();
    if (fixtures.length === 0) {
      console.log("[scheduler] No top-league fixtures today. Done.");
      return;
    }

    const existingKeys = await alreadyGeneratedToday();
    const toProcess = fixtures
      .filter((f: any) => {
        const key = `${f.teams?.home?.name}|${f.teams?.away?.name}`;
        if (existingKeys.has(key)) {
          console.log(`[scheduler] Already generated: ${key}`);
          return false;
        }
        return true;
      })
      .slice(0, MAX_MATCHES_PER_DAY);

    if (toProcess.length === 0) {
      console.log("[scheduler] All matches already have predictions. Done.");
      return;
    }

    console.log(`[scheduler] Will process ${toProcess.length} matches`);

    let savedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const fix = toProcess[i];
      const homeTeam: string = fix.teams?.home?.name ?? "";
      const awayTeam: string = fix.teams?.away?.name ?? "";
      const league: string = fix.league?.name ?? "";
      const matchDate = new Date(fix.fixture?.date);
      const fixtureId: number = fix.fixture?.id;

      if (!homeTeam || !awayTeam || isNaN(matchDate.getTime())) continue;

      // Skip if match starts in less than 2.5h (not enough time to prepare)
      const now = new Date();
      const timeUntilMatch = matchDate.getTime() - now.getTime();
      if (timeUntilMatch < 2.5 * 60 * 60 * 1000) {
        console.log(`[scheduler] Skipping ${homeTeam} vs ${awayTeam} — starts too soon`);
        continue;
      }

      // publishAt = 2 hours before kickoff
      const publishAt = new Date(matchDate.getTime() - PUBLISH_BEFORE_MS);
      // If publishAt is already past, publish immediately
      const finalPublishAt = publishAt <= now ? null : publishAt;

      console.log(`[scheduler] [${i + 1}/${toProcess.length}] ${homeTeam} vs ${awayTeam} | ${league} | publish at ${finalPublishAt?.toISOString() ?? "now"}`);

      const result = await generateAndSave({ homeTeam, awayTeam, league, matchDate, fixtureId, publishAt: finalPublishAt });

      if (result.saved) {
        savedCount++;
        // Notify Telegram for immediately published predictions
        if (!finalPublishAt) {
          try {
            const { notifyNewAiPrediction } = await import("./telegram-notify");
            await notifyNewAiPrediction({ homeTeam, awayTeam, league, prediction: result.prediction, odds: 0, confidence: result.confidence });
          } catch { /* ignore */ }
        }
      } else if ("skipped" in result) {
        skippedCount++;
      }

      // Small gap between matches (rate limiting is handled inside fetchStatsForMatch per-request)
      if (i < toProcess.length - 1) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_MATCHES_MS));
      }
    }

    console.log(`[scheduler] Done. Saved: ${savedCount}, Skipped by AI: ${skippedCount}`);
  } catch (err: any) {
    console.error("[scheduler] Fatal error:", err?.message);
  }
}

// ─── Publish-watcher: makes scheduled predictions live ────────────────────────
// The DB query in the public route already filters by publishAt <= now, so
// predictions automatically become visible when their time arrives.
// This watcher just sends Telegram notifications when they go live.

let publishWatcherStarted = false;

export function startPublishWatcher(): void {
  if (publishWatcherStarted) return;
  publishWatcherStarted = true;

  const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes
  const notifiedIds = new Set<number>();

  async function checkAndNotify() {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - CHECK_INTERVAL_MS);

      // Find predictions that just became visible (publishAt in last 5 min)
      const justPublished = await db
        .select()
        .from(aiPredictionsTable)
        .where(and(
          gte(aiPredictionsTable.publishAt, fiveMinAgo),
          lte(aiPredictionsTable.publishAt, now),
          eq(aiPredictionsTable.status, "pending")
        ));

      for (const pred of justPublished) {
        if (notifiedIds.has(pred.id)) continue;
        notifiedIds.add(pred.id);
        console.log(`[scheduler] Prediction ${pred.id} now live: ${pred.homeTeam} vs ${pred.awayTeam}`);
        try {
          const { notifyNewAiPrediction } = await import("./telegram-notify");
          await notifyNewAiPrediction({
            homeTeam: pred.homeTeam,
            awayTeam: pred.awayTeam,
            league: pred.league,
            prediction: pred.prediction,
            odds: pred.odds,
            confidence: pred.confidence,
          });
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  setInterval(checkAndNotify, CHECK_INTERVAL_MS);
  console.log("[scheduler] Publish watcher started (checks every 5 min)");
}

// ─── Daily cron scheduler ─────────────────────────────────────────────────────

let schedulerStarted = false;

export function startDailyScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  startPublishWatcher();

  async function schedule() {
    const KYIV_RUN_HOUR = 6; // 06:00 Kyiv time
    const msUntilRun = msUntilKyivHour(KYIV_RUN_HOUR);
    const runAt = new Date(Date.now() + msUntilRun);
    console.log(`[scheduler] Next run at ${runAt.toISOString()} (${Math.round(msUntilRun / 60000)} min from now)`);

    setTimeout(async () => {
      await runDailyGeneration("cron");
      // Schedule next day
      schedule();
    }, msUntilRun);
  }

  // Also check if we should run today (server started after 6 AM and no predictions yet)
  async function maybeRunNow() {
    const kyivHour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Kiev", hour: "numeric", hour12: false }));
    if (kyivHour >= 6 && kyivHour < 20) {
      const existingKeys = await alreadyGeneratedToday().catch(() => new Set<string>());
      if (existingKeys.size === 0) {
        console.log("[scheduler] Server started after 6 AM with no predictions today — running now");
        await runDailyGeneration("cron");
      } else {
        console.log(`[scheduler] Server started, ${existingKeys.size} predictions already exist today`);
      }
    }
  }

  // Start the recurring schedule + check if we should run right now
  schedule();
  setTimeout(maybeRunNow, 5000); // slight delay to let DB settle
}
