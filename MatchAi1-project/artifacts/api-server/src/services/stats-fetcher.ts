import { db, statsCacheTable, apiRequestTrackerTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const API_KEY = process.env.APISPORTS_KEY ?? "";
const HOST = "v3.football.api-sports.io";
const DAILY_LIMIT = 90; // free plan: 100/day, we stay at 90 for safety

let SEASON = 2025;

export async function detectActiveSeason(): Promise<number> {
  try {
    const url = `https://${HOST}/leagues?id=39&current=true`;
    const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
    if (!res.ok) return SEASON;
    const json = (await res.json()) as any;
    const season = json.response?.[0]?.seasons?.find((s: any) => s.current)?.year;
    if (season) { SEASON = season; console.log(`[stats] Active season: ${SEASON}`); }
  } catch { }
  return SEASON;
}

export const TOP_LEAGUES = [39, 140, 78, 135, 61, 2];

// ─── Rate limiter ─────────────────────────────────────────────────────────────

async function getTodayUsage(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(apiRequestTrackerTable)
    .where(and(eq(apiRequestTrackerTable.date, today), eq(apiRequestTrackerTable.provider, "apisports")));
  return row?.count ?? 0;
}

async function incrementUsage(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select()
    .from(apiRequestTrackerTable)
    .where(and(eq(apiRequestTrackerTable.date, today), eq(apiRequestTrackerTable.provider, "apisports")));
  if (row) {
    await db.update(apiRequestTrackerTable).set({ count: row.count + 1 }).where(eq(apiRequestTrackerTable.id, row.id));
  } else {
    await db.insert(apiRequestTrackerTable).values({ date: today, provider: "apisports", count: 1 });
  }
}

async function canMakeRequest(needed = 1): Promise<boolean> {
  const used = await getTodayUsage();
  return used + needed <= DAILY_LIMIT;
}

let apiAccessBlocked = false;
let lastApiCallAt = 0;
const API_RATE_DELAY_MS = 7000; // 7s between requests → safely under 10 req/min (free tier)

async function apiGet(path: string): Promise<any> {
  if (!API_KEY) throw new Error("APISPORTS_KEY not set");
  if (apiAccessBlocked) throw new Error("API access blocked (403). Check APISPORTS_KEY.");
  if (!(await canMakeRequest())) throw new Error("Daily API limit reached");

  // Per-minute rate limiting: free plan = 10 req/min, we use 1 per 7s (~8/min)
  const now = Date.now();
  const wait = API_RATE_DELAY_MS - (now - lastApiCallAt);
  if (wait > 0) {
    console.log(`[stats] Rate limit pause: ${Math.round(wait / 1000)}s...`);
    await new Promise(r => setTimeout(r, wait));
  }
  lastApiCallAt = Date.now();

  const url = `https://${HOST}${path}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  await incrementUsage();

  if (res.status === 403) {
    apiAccessBlocked = true;
    throw new Error("API access denied (403). Check APISPORTS_KEY.");
  }
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  const json = (await res.json()) as any;
  return json.response ?? [];
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────

async function getCached(key: string, ttlHours = 24): Promise<any | null> {
  const [row] = await db.select().from(statsCacheTable).where(eq(statsCacheTable.key, key));
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.fetchedAt).getTime();
  if (ageMs > ttlHours * 60 * 60 * 1000) return null;
  return JSON.parse(row.data);
}

async function setCached(key: string, type: string, data: any): Promise<void> {
  const payload = JSON.stringify(data);
  const existing = await db.select({ id: statsCacheTable.id }).from(statsCacheTable).where(eq(statsCacheTable.key, key));
  if (existing.length > 0) {
    await db.update(statsCacheTable).set({ data: payload, fetchedAt: new Date() }).where(eq(statsCacheTable.key, key));
  } else {
    await db.insert(statsCacheTable).values({ key, type, data: payload });
  }
}

async function getOrFetch(key: string, type: string, ttlHours: number, fetcher: () => Promise<any>): Promise<any> {
  const cached = await getCached(key, ttlHours);
  if (cached !== null) return cached;
  const data = await fetcher();
  await setCached(key, type, data);
  return data;
}

// ─── API fetchers ──────────────────────────────────────────────────────────────

export async function fetchTodayFixtures(leagueId?: number): Promise<any[]> {
  const today = new Date().toISOString().slice(0, 10);
  const leagueFilter = leagueId ? `&league=${leagueId}&season=${SEASON}` : "";
  // Cache today's fixtures for 30 minutes
  const key = `fixtures:date:${today}${leagueId ? `:${leagueId}` : ""}`;
  return getOrFetch(key, "fixtures", 0.5, () => apiGet(`/fixtures?date=${today}${leagueFilter}`));
}

export async function fetchFixturesByDateRange(from: string, to: string, leagueId?: number): Promise<any[]> {
  const leagueFilter = leagueId ? `&league=${leagueId}&season=${SEASON}` : "";
  const key = `fixtures:range:${from}:${to}${leagueId ? `:${leagueId}` : ""}`;
  return getOrFetch(key, "fixtures_range", 0.5, () => apiGet(`/fixtures?from=${from}&to=${to}${leagueFilter}`));
}

export async function fetchStandings(leagueId: number): Promise<any[]> {
  const key = `standings:${leagueId}:${SEASON}`;
  return getOrFetch(key, "standings", 24, () => apiGet(`/standings?league=${leagueId}&season=${SEASON}`));
}

export async function fetchTeamStats(teamId: number, leagueId: number): Promise<any> {
  const key = `team_stats:${teamId}:${leagueId}:${SEASON}`;
  return getOrFetch(key, "team_stats", 24, () => apiGet(`/teams/statistics?team=${teamId}&league=${leagueId}&season=${SEASON}`));
}

export async function fetchH2H(team1: number, team2: number): Promise<any[]> {
  const key = `h2h:${Math.min(team1, team2)}:${Math.max(team1, team2)}`;
  return getOrFetch(key, "h2h", 12, () => apiGet(`/fixtures/headtohead?h2h=${team1}-${team2}&last=10`));
}

export async function fetchFixtureById(fixtureId: number): Promise<any> {
  const key = `fixture:${fixtureId}`;
  return getOrFetch(key, "fixture", 0.5, async () => {
    const data = await apiGet(`/fixtures?id=${fixtureId}`);
    return data[0] ?? null;
  });
}

export async function fetchFixtureStats(fixtureId: number): Promise<any[]> {
  const key = `fixture_stats:${fixtureId}`;
  return getOrFetch(key, "fixture_stats", 12, () => apiGet(`/fixtures/statistics?fixture=${fixtureId}`));
}

export async function fetchTeamLastFixtures(teamId: number, leagueId: number, last = 10): Promise<any[]> {
  const key = `team_fixtures:${teamId}:${leagueId}:last${last}`;
  return getOrFetch(key, "team_fixtures", 6, () =>
    apiGet(`/fixtures?team=${teamId}&league=${leagueId}&season=${SEASON}&last=${last}&status=FT`)
  );
}

export async function searchTeam(name: string): Promise<any[]> {
  const key = `search_team:${name.toLowerCase().replace(/\s+/g, "_")}`;
  return getOrFetch(key, "team_search", 24 * 7, () => apiGet(`/teams?search=${encodeURIComponent(name)}`));
}

export async function fetchOdds(fixtureId: number): Promise<any[]> {
  const key = `odds:${fixtureId}`;
  return getOrFetch(key, "odds", 1, () => apiGet(`/odds?fixture=${fixtureId}`));
}

export async function fetchEvents(fixtureId: number): Promise<any[]> {
  const key = `events:${fixtureId}`;
  return getOrFetch(key, "events", 1, () => apiGet(`/fixtures/events?fixture=${fixtureId}`));
}

// ─── Main: fetch rich stats for AI generation ─────────────────────────────────

export interface MatchStats {
  fixtureId?: number;
  homeTeamId?: number;
  awayTeamId?: number;
  leagueId?: number;
  statsText: string;
  requestsUsed: number;
}

export async function fetchStatsForMatch(
  homeTeam: string,
  awayTeam: string,
  leagueHint?: string,
  fixtureId?: number
): Promise<MatchStats> {
  const parts: string[] = [];
  let homeTeamId: number | undefined;
  let awayTeamId: number | undefined;
  let leagueId: number | undefined;
  let resolvedFixtureId: number | undefined = fixtureId;

  const usageBefore = await getTodayUsage();

  try {
    // 1. Resolve teams (sequential to respect per-minute rate limit)
    const homeResults = await searchTeam(homeTeam);
    const awayResults = await searchTeam(awayTeam);

    const home = (homeResults ?? [])[0];
    const away = (awayResults ?? [])[0];
    homeTeamId = home?.team?.id;
    awayTeamId = away?.team?.id;

    // 2. Try to find the fixture in top leagues
    if (homeTeamId && awayTeamId && !resolvedFixtureId) {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      try {
        const fixtures = await fetchFixturesByDateRange(today, nextWeek);
        const found = fixtures.find((f: any) =>
          (f.teams?.home?.id === homeTeamId && f.teams?.away?.id === awayTeamId) ||
          (f.teams?.home?.name?.toLowerCase().includes(homeTeam.toLowerCase().split(" ")[0]) &&
           f.teams?.away?.name?.toLowerCase().includes(awayTeam.toLowerCase().split(" ")[0]))
        );
        if (found) {
          resolvedFixtureId = found.fixture?.id;
          leagueId = found.league?.id;
          const dateStr = found.fixture?.date ? new Date(found.fixture.date).toLocaleString("ru-RU", { timeZone: "Europe/Kiev" }) : "?";
          parts.push(`📅 Матч: ${found.teams?.home?.name} vs ${found.teams?.away?.name} | ${found.league?.name} | ${dateStr} (КВ)`);
        }
      } catch (e: any) {
        console.warn("[stats] fixture lookup error:", e.message);
      }
    }

    // 3. Determine league
    if (!leagueId && homeTeamId) {
      leagueId = home?.statistics?.[0]?.league?.id;
    }
    if (!leagueId) {
      // Try to match league hint to known leagues
      const leagueMap: Record<string, number> = {
        "premier league": 39, "английская премьер": 39,
        "la liga": 140, "испания": 140,
        "bundesliga": 78, "германия": 78,
        "serie a": 135, "италия": 135,
        "ligue 1": 61, "франция": 61,
        "champions league": 2, "лч": 2, "лига чемпионов": 2,
      };
      const hint = (leagueHint ?? "").toLowerCase();
      for (const [k, v] of Object.entries(leagueMap)) {
        if (hint.includes(k)) { leagueId = v; break; }
      }
      if (!leagueId) leagueId = 39; // fallback Premier League
    }

    // 4. Fetch H2H
    if (homeTeamId && awayTeamId) {
      try {
        const h2h = await fetchH2H(homeTeamId, awayTeamId);
        if (h2h.length > 0) {
          const recent = h2h.slice(0, 8);
          const h2hLines = recent.map((m: any) => {
            const hg = m.goals?.home ?? "?";
            const ag = m.goals?.away ?? "?";
            const d = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString("ru-RU") : "?";
            return `  ${d}: ${m.teams?.home?.name} ${hg}:${ag} ${m.teams?.away?.name}`;
          });
          parts.push(`⚔️ H2H (последние ${recent.length} встреч):\n${h2hLines.join("\n")}`);
        }
      } catch (e: any) { console.warn("[stats] H2H error:", e.message); }
    }

    // 5. Fetch team stats (season)
    if (homeTeamId && leagueId) {
      try {
        const s = await fetchTeamStats(homeTeamId, leagueId);
        if (s) {
          const f = s.fixtures ?? {};
          const g = s.goals ?? {};
          const cards = s.cards ?? {};
          const cornerFor = s.corners?.for?.average?.total ?? "?";
          const cornerAgainst = s.corners?.against?.average?.total ?? "?";
          const yellowTotal = Object.values(cards.yellow ?? {}).reduce((a: any, b: any) => a + (b?.total ?? 0), 0);
          parts.push(`📊 ${homeTeam} (сезон ${SEASON}): ${f.wins?.total ?? "?"}П/${f.draws?.total ?? "?"}Н/${f.loses?.total ?? "?"}П | Голы: ${g.for?.total?.total ?? "?"} забито / ${g.against?.total?.total ?? "?"} пропущено | Ср.угл за: ${cornerFor} / против: ${cornerAgainst} | ЖК всего: ${yellowTotal}`);
        }
      } catch (e: any) { console.warn("[stats] home team stats error:", e.message); }
    }

    if (awayTeamId && leagueId) {
      try {
        const s = await fetchTeamStats(awayTeamId, leagueId);
        if (s) {
          const f = s.fixtures ?? {};
          const g = s.goals ?? {};
          const cards = s.cards ?? {};
          const cornerFor = s.corners?.for?.average?.total ?? "?";
          const cornerAgainst = s.corners?.against?.average?.total ?? "?";
          const yellowTotal = Object.values(cards.yellow ?? {}).reduce((a: any, b: any) => a + (b?.total ?? 0), 0);
          parts.push(`📊 ${awayTeam} (сезон ${SEASON}): ${f.wins?.total ?? "?"}П/${f.draws?.total ?? "?"}Н/${f.loses?.total ?? "?"}П | Голы: ${g.for?.total?.total ?? "?"} забито / ${g.against?.total?.total ?? "?"} пропущено | Ср.угл за: ${cornerFor} / против: ${cornerAgainst} | ЖК всего: ${yellowTotal}`);
        }
      } catch (e: any) { console.warn("[stats] away team stats error:", e.message); }
    }

    // 6. Last 5 matches form
    if (homeTeamId && leagueId) {
      try {
        const fixtures = await fetchTeamLastFixtures(homeTeamId, leagueId, 8);
        if (fixtures.length > 0) {
          const lines = fixtures.slice(0, 8).map((m: any) => {
            const isHome = m.teams?.home?.id === homeTeamId;
            const hg = m.goals?.home ?? "?";
            const ag = m.goals?.away ?? "?";
            const opp = isHome ? m.teams?.away?.name : m.teams?.home?.name;
            const result = isHome ? `${hg}:${ag}` : `${ag}:${hg}`;
            const d = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString("ru-RU") : "?";
            return `  ${d} ${isHome ? "Д" : "Г"} vs ${opp}: ${result}`;
          });
          parts.push(`🔥 Форма ${homeTeam} (последние матчи):\n${lines.join("\n")}`);
        }
      } catch (e: any) { console.warn("[stats] home form error:", e.message); }
    }

    if (awayTeamId && leagueId) {
      try {
        const fixtures = await fetchTeamLastFixtures(awayTeamId, leagueId, 8);
        if (fixtures.length > 0) {
          const lines = fixtures.slice(0, 8).map((m: any) => {
            const isAway = m.teams?.away?.id === awayTeamId;
            const hg = m.goals?.home ?? "?";
            const ag = m.goals?.away ?? "?";
            const opp = isAway ? m.teams?.home?.name : m.teams?.away?.name;
            const result = isAway ? `${ag}:${hg}` : `${hg}:${ag}`;
            const d = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString("ru-RU") : "?";
            return `  ${d} ${isAway ? "Г" : "Д"} vs ${opp}: ${result}`;
          });
          parts.push(`🔥 Форма ${awayTeam} (последние матчи):\n${lines.join("\n")}`);
        }
      } catch (e: any) { console.warn("[stats] away form error:", e.message); }
    }

    // 7. Bookmaker odds (if fixtureId is known)
    if (resolvedFixtureId) {
      try {
        const oddsData = await fetchOdds(resolvedFixtureId);
        if (oddsData.length > 0) {
          const bookmaker = oddsData[0];
          const bets: any[] = bookmaker?.bookmakers?.[0]?.bets ?? bookmaker?.bets ?? [];
          const oddsLines: string[] = [];
          for (const bet of bets) {
            const name: string = bet.name ?? "";
            const vals: any[] = bet.values ?? [];
            if (/match winner/i.test(name) || /1x2/i.test(name)) {
              const h = vals.find((v: any) => v.value === "Home")?.odd;
              const d = vals.find((v: any) => v.value === "Draw")?.odd;
              const a = vals.find((v: any) => v.value === "Away")?.odd;
              if (h && d && a) oddsLines.push(`  П1/X/П2: ${h} / ${d} / ${a}`);
            } else if (/goals over\/under/i.test(name) || /total goals/i.test(name)) {
              const o25 = vals.find((v: any) => v.value === "Over 2.5")?.odd;
              const u25 = vals.find((v: any) => v.value === "Under 2.5")?.odd;
              const o15 = vals.find((v: any) => v.value === "Over 1.5")?.odd;
              const u15 = vals.find((v: any) => v.value === "Under 1.5")?.odd;
              if (o25 && u25) oddsLines.push(`  ТБ/ТМ 2.5 голов: ${o25} / ${u25}`);
              if (o15 && u15) oddsLines.push(`  ТБ/ТМ 1.5 голов: ${o15} / ${u15}`);
            } else if (/both teams score/i.test(name)) {
              const yes = vals.find((v: any) => v.value === "Yes")?.odd;
              const no = vals.find((v: any) => v.value === "No")?.odd;
              if (yes && no) oddsLines.push(`  ОЗ Да/Нет: ${yes} / ${no}`);
            } else if (/corners/i.test(name)) {
              const o95 = vals.find((v: any) => v.value === "Over 9.5")?.odd;
              const u95 = vals.find((v: any) => v.value === "Under 9.5")?.odd;
              if (o95 && u95) oddsLines.push(`  Угловые ТБ/ТМ 9.5: ${o95} / ${u95}`);
            }
          }
          if (oddsLines.length > 0) {
            parts.push(`💰 Коэффициенты букмекеров:\n${oddsLines.join("\n")}`);
          }
        }
      } catch (e: any) { console.warn("[stats] odds error:", e.message); }
    }

    // 8. Standings position
    if (leagueId && TOP_LEAGUES.includes(leagueId)) {
      try {
        const standings = await fetchStandings(leagueId);
        const allTeams: any[] = (standings[0]?.league?.standings ?? []).flat();
        const homeSt = allTeams.find((t: any) => t.team?.id === homeTeamId);
        const awaySt = allTeams.find((t: any) => t.team?.id === awayTeamId);
        if (homeSt || awaySt) {
          const leagueName = standings[0]?.league?.name ?? "Лига";
          parts.push(`📋 Таблица ${leagueName}:`);
          if (homeSt) parts.push(`  ${homeTeam}: ${homeSt.rank}-е место, ${homeSt.points} очков, форма: ${homeSt.form ?? "—"}, голы: ${homeSt.goals?.for ?? "?"} / ${homeSt.goals?.against ?? "?"}`);
          if (awaySt) parts.push(`  ${awayTeam}: ${awaySt.rank}-е место, ${awaySt.points} очков, форма: ${awaySt.form ?? "—"}, голы: ${awaySt.goals?.for ?? "?"} / ${awaySt.goals?.against ?? "?"}`);
        }
      } catch (e: any) { console.warn("[stats] standings error:", e.message); }
    }

  } catch (e: any) {
    console.warn("[stats] fetchStatsForMatch error:", e.message);
    parts.push(`⚠️ Частичные данные (ошибка: ${e.message})`);
  }

  const usageAfter = await getTodayUsage();
  const requestsUsed = usageAfter - usageBefore;
  parts.push(`\n[API-Football: использовано ${usageAfter}/${DAILY_LIMIT} запросов сегодня, из них для этого матча: ${requestsUsed}]`);

  return {
    fixtureId: resolvedFixtureId,
    homeTeamId,
    awayTeamId,
    leagueId,
    statsText: parts.join("\n"),
    requestsUsed,
  };
}

export async function getApiUsage(): Promise<{ today: number; limit: number; canFetch: boolean; blocked: boolean }> {
  const today = await getTodayUsage();
  return { today, limit: DAILY_LIMIT, canFetch: !apiAccessBlocked && today < DAILY_LIMIT, blocked: apiAccessBlocked };
}

export function resetApiBlock(): void {
  apiAccessBlocked = false;
}

export async function getCachedStatsCount(): Promise<number> {
  const rows = await db.select({ id: statsCacheTable.id }).from(statsCacheTable);
  return rows.length;
}

// ─── Startup: light warmup (detect season only, no heavy fetching) ─────────────

export async function startupFetch(): Promise<void> {
  if (!API_KEY) { console.warn("[stats] APISPORTS_KEY not set, skipping startup fetch"); return; }
  await detectActiveSeason();
  const usage = await getTodayUsage();
  const cached = await getCachedStatsCount();
  console.log(`[stats] Startup done. Requests today: ${usage}/${DAILY_LIMIT}. Cached entries: ${cached}`);
}
