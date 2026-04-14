import { db, statsCacheTable, apiRequestTrackerTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const API_KEY = process.env.APISPORTS_KEY ?? "";
const HOST = "v3.football.api-sports.io";
const DAILY_LIMIT = 90; // free plan: 100/day, we stay at 90 for safety

let SEASON = 2025;

// Mapping of European cup IDs → don't use these for team season stats
const EUROPEAN_CUP_IDS = new Set([2, 3, 848, 4, 5, 6]);

// Domestic league map: team ID → domestic league ID (populated as we discover teams)
const teamDomesticLeague = new Map<number, number>();

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

export async function fetchTeamLastFixtures(teamId: number, leagueId: number, last = 10): Promise<any[]> {
  const key = `team_fixtures:${teamId}:${leagueId}:last${last}:${SEASON}`;
  return getOrFetch(key, "team_fixtures", 6, () =>
    apiGet(`/fixtures?team=${teamId}&league=${leagueId}&season=${SEASON}&last=${last}&status=FT`)
  );
}

export async function fetchTeamLastFixturesAny(teamId: number, last = 8): Promise<any[]> {
  const key = `team_fixtures_any:${teamId}:last${last}:${SEASON}`;
  return getOrFetch(key, "team_fixtures_any", 6, () =>
    apiGet(`/fixtures?team=${teamId}&season=${SEASON}&last=${last}&status=FT`)
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

// ─── Discover team's domestic league ─────────────────────────────────────────

async function getTeamDomesticLeague(teamId: number): Promise<number> {
  if (teamDomesticLeague.has(teamId)) return teamDomesticLeague.get(teamId)!;

  try {
    const key = `team_leagues:${teamId}:${SEASON}`;
    const cached = await getCached(key, 24 * 30);
    if (cached) {
      teamDomesticLeague.set(teamId, cached);
      return cached;
    }

    const data = await apiGet(`/teams/statistics?team=${teamId}&season=${SEASON}`);
    // The response is an object (not array), so check if it has league info
    if (data && !Array.isArray(data) && data.league?.id) {
      const lgId = data.league.id;
      if (!EUROPEAN_CUP_IDS.has(lgId)) {
        teamDomesticLeague.set(teamId, lgId);
        await setCached(key, "team_domestic_league", lgId);
        return lgId;
      }
    }

    // Try fetching league list for this team
    const leaguesList = await apiGet(`/leagues?team=${teamId}&season=${SEASON}&type=League`);
    const domesticLeagues = leaguesList.filter((l: any) =>
      !EUROPEAN_CUP_IDS.has(l.league?.id) && TOP_LEAGUES.includes(l.league?.id)
    );
    if (domesticLeagues.length > 0) {
      const lgId = domesticLeagues[0].league?.id;
      teamDomesticLeague.set(teamId, lgId);
      await setCached(key, "team_domestic_league", lgId);
      return lgId;
    }
  } catch { }

  return 39; // fallback
}

// ─── Format match result line ─────────────────────────────────────────────────

function fmtMatch(m: any, teamId: number, label: string): string {
  const isHome = m.teams?.home?.id === teamId;
  const hg = m.goals?.home ?? "?";
  const ag = m.goals?.away ?? "?";
  const myGoals = isHome ? hg : ag;
  const oppGoals = isHome ? ag : hg;
  const opp = isHome ? m.teams?.away?.name : m.teams?.home?.name;
  const d = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString("ru-RU") : "?";
  const totalGoals = (typeof hg === "number" && typeof ag === "number") ? hg + ag : null;
  const btts = typeof hg === "number" && typeof ag === "number" && hg > 0 && ag > 0 ? "ОЗ✓" : "";
  const result = myGoals > oppGoals ? "W" : myGoals < oppGoals ? "L" : "D";
  return `  ${d} [${isHome ? "Д" : "Г"}][${result}] vs ${opp}: ${myGoals}:${oppGoals}${totalGoals !== null ? ` (ΣG=${totalGoals})` : ""}${btts ? " "+btts : ""}`;
}

// ─── Main: fetch rich stats for AI generation ─────────────────────────────────

export interface BookmakerOdds {
  tb25?: number;
  tm25?: number;
  tb15?: number;
  tm15?: number;
  tb35?: number;
  tm35?: number;
  cornersOver95?: number;
  cornersUnder95?: number;
  cornersOver85?: number;
  cornersUnder85?: number;
}

export interface MatchStats {
  fixtureId?: number;
  homeTeamId?: number;
  awayTeamId?: number;
  leagueId?: number;
  statsText: string;
  requestsUsed: number;
  bookmakerOdds?: BookmakerOdds;
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
  let bookmakerOdds: BookmakerOdds | undefined;

  const usageBefore = await getTodayUsage();

  try {
    // 1. Resolve teams
    const [homeResults, awayResults] = await Promise.all([
      searchTeam(homeTeam),
      searchTeam(awayTeam),
    ]);

    const home = (homeResults ?? [])[0];
    const away = (awayResults ?? [])[0];
    homeTeamId = home?.team?.id;
    awayTeamId = away?.team?.id;

    // 2. Determine league from hint
    const leagueMap: Record<string, number> = {
      "premier league": 39, "английская премьер": 39, "epl": 39,
      "la liga": 140, "испания": 140, "примера": 140,
      "bundesliga": 78, "германия": 78, "бундес": 78,
      "serie a": 135, "италия": 135, "серия а": 135,
      "ligue 1": 61, "франция": 61, "лига 1": 61,
      "champions league": 2, "лч": 2, "лига чемпионов": 2, "лига чемпіонів": 2, "cl": 2,
      "europa league": 3, "лига европы": 3, "лига європи": 3,
    };
    const hint = (leagueHint ?? "").toLowerCase();
    for (const [k, v] of Object.entries(leagueMap)) {
      if (hint.includes(k)) { leagueId = v; break; }
    }

    // 3. Try to find the fixture to get exact league
    if (homeTeamId && awayTeamId && !resolvedFixtureId) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const fixtures = await fetchFixturesByDateRange(today, nextWeek);
        const found = fixtures.find((f: any) =>
          (f.teams?.home?.id === homeTeamId && f.teams?.away?.id === awayTeamId) ||
          (f.teams?.away?.id === homeTeamId && f.teams?.home?.id === awayTeamId)
        );
        if (found) {
          resolvedFixtureId = found.fixture?.id;
          const fixtureLeagueId = found.league?.id;
          if (!leagueId) leagueId = fixtureLeagueId;
          const dateStr = found.fixture?.date ? new Date(found.fixture.date).toLocaleString("ru-RU", { timeZone: "Europe/Kiev" }) : "?";
          parts.push(`📅 ${found.teams?.home?.name} vs ${found.teams?.away?.name} | ${found.league?.name} | ${dateStr} Киев`);
        }
      } catch (e: any) {
        console.warn("[stats] fixture lookup error:", e.message);
      }
    }

    // 4. Determine DOMESTIC league for stats (even if match is in CL/EL)
    let statsLeagueHome = leagueId;
    let statsLeagueAway = leagueId;

    if (homeTeamId && (!statsLeagueHome || EUROPEAN_CUP_IDS.has(statsLeagueHome))) {
      statsLeagueHome = await getTeamDomesticLeague(homeTeamId);
    }
    if (awayTeamId && (!statsLeagueAway || EUROPEAN_CUP_IDS.has(statsLeagueAway))) {
      statsLeagueAway = await getTeamDomesticLeague(awayTeamId);
    }

    if (!leagueId) leagueId = statsLeagueHome ?? 39;

    // 5. H2H (all competitions)
    if (homeTeamId && awayTeamId) {
      try {
        const h2h = await fetchH2H(homeTeamId, awayTeamId);
        if (h2h.length > 0) {
          const recent = h2h.slice(0, 8);
          const totalGoalsList = recent.map((m: any) => {
            const hg = m.goals?.home;
            const ag = m.goals?.away;
            return typeof hg === "number" && typeof ag === "number" ? hg + ag : null;
          }).filter(x => x !== null) as number[];
          const avgGoals = totalGoalsList.length > 0 ? (totalGoalsList.reduce((a, b) => a + b, 0) / totalGoalsList.length).toFixed(1) : "?";
          const over25 = totalGoalsList.filter(g => g > 2.5).length;
          const btts = recent.filter((m: any) => (m.goals?.home ?? 0) > 0 && (m.goals?.away ?? 0) > 0).length;

          const h2hLines = recent.map((m: any) => {
            const hg = m.goals?.home ?? "?";
            const ag = m.goals?.away ?? "?";
            const d = m.fixture?.date ? new Date(m.fixture.date).toLocaleDateString("ru-RU") : "?";
            const total = typeof hg === "number" && typeof ag === "number" ? `ΣG=${hg+ag}` : "";
            return `  ${d}: ${m.teams?.home?.name} ${hg}:${ag} ${m.teams?.away?.name} ${total}`;
          });
          parts.push(`⚔️ H2H (последние ${recent.length} встреч) | Ср.голов: ${avgGoals} | ТБ2.5: ${over25}/${recent.length} | ОЗ: ${btts}/${recent.length}:\n${h2hLines.join("\n")}`);
        }
      } catch (e: any) { console.warn("[stats] H2H error:", e.message); }
    }

    // 6. Home team season stats (use domestic league)
    if (homeTeamId && statsLeagueHome) {
      try {
        const s = await fetchTeamStats(homeTeamId, statsLeagueHome);
        if (s && s.fixtures) {
          const f = s.fixtures ?? {};
          const g = s.goals ?? {};
          const played = f.played?.total ?? 0;
          const goalsFor = g.for?.total?.total ?? 0;
          const goalsAgainst = g.against?.total?.total ?? 0;
          const avgFor = played > 0 ? (goalsFor / played).toFixed(2) : "?";
          const avgAgainst = played > 0 ? (goalsAgainst / played).toFixed(2) : "?";
          const cornerFor = s.corners?.for?.average?.total ?? "?";
          const cornerAgainst = s.corners?.against?.average?.total ?? "?";
          const cleanSheets = f.wins?.home ?? 0;
          const failedToScore = s.goals?.for?.minute?.["0-15"]?.total !== undefined ? "данные есть" : "?";
          const leagueName = s.league?.name ?? `League ${statsLeagueHome}`;
          parts.push(`📊 ${homeTeam} сезон ${SEASON} [${leagueName}]: ${f.wins?.total ?? "?"}П/${f.draws?.total ?? "?"}Н/${f.loses?.total ?? "?"}Пр (из ${played}) | Голы: ${goalsFor}±${goalsAgainst} (${avgFor}/${avgAgainst} за матч) | Угл: ${cornerFor}/${cornerAgainst}`);
        }
      } catch (e: any) { console.warn("[stats] home stats error:", e.message); }
    }

    // 7. Away team season stats (use domestic league)
    if (awayTeamId && statsLeagueAway) {
      try {
        const s = await fetchTeamStats(awayTeamId, statsLeagueAway);
        if (s && s.fixtures) {
          const f = s.fixtures ?? {};
          const g = s.goals ?? {};
          const played = f.played?.total ?? 0;
          const goalsFor = g.for?.total?.total ?? 0;
          const goalsAgainst = g.against?.total?.total ?? 0;
          const avgFor = played > 0 ? (goalsFor / played).toFixed(2) : "?";
          const avgAgainst = played > 0 ? (goalsAgainst / played).toFixed(2) : "?";
          const cornerFor = s.corners?.for?.average?.total ?? "?";
          const cornerAgainst = s.corners?.against?.average?.total ?? "?";
          const leagueName = s.league?.name ?? `League ${statsLeagueAway}`;
          parts.push(`📊 ${awayTeam} сезон ${SEASON} [${leagueName}]: ${f.wins?.total ?? "?"}П/${f.draws?.total ?? "?"}Н/${f.loses?.total ?? "?"}Пр (из ${played}) | Голы: ${goalsFor}±${goalsAgainst} (${avgFor}/${avgAgainst} за матч) | Угл: ${cornerFor}/${cornerAgainst}`);
        }
      } catch (e: any) { console.warn("[stats] away stats error:", e.message); }
    }

    // 8. Home team recent form (any competition = more data)
    if (homeTeamId) {
      try {
        let fixtures = homeTeamId && statsLeagueHome ? await fetchTeamLastFixtures(homeTeamId, statsLeagueHome, 8) : [];
        if (fixtures.length < 3 && homeTeamId) {
          fixtures = await fetchTeamLastFixturesAny(homeTeamId, 8);
        }
        if (fixtures.length > 0) {
          const lines = fixtures.slice(0, 8).map((m: any) => fmtMatch(m, homeTeamId!, homeTeam));
          const totalGoals = fixtures.slice(0, 8).map((m: any) => {
            const hg = m.goals?.home; const ag = m.goals?.away;
            return typeof hg === "number" && typeof ag === "number" ? hg + ag : null;
          }).filter(x => x !== null) as number[];
          const avgG = totalGoals.length > 0 ? (totalGoals.reduce((a,b)=>a+b,0)/totalGoals.length).toFixed(1) : "?";
          const over25c = totalGoals.filter(g=>g>2.5).length;
          parts.push(`🔥 Форма ${homeTeam} (посл. ${fixtures.length} матчей) | Ср.голов: ${avgG} | ТБ2.5: ${over25c}/${totalGoals.length}:\n${lines.join("\n")}`);
        }
      } catch (e: any) { console.warn("[stats] home form error:", e.message); }
    }

    // 9. Away team recent form
    if (awayTeamId) {
      try {
        let fixtures = awayTeamId && statsLeagueAway ? await fetchTeamLastFixtures(awayTeamId, statsLeagueAway, 8) : [];
        if (fixtures.length < 3 && awayTeamId) {
          fixtures = await fetchTeamLastFixturesAny(awayTeamId, 8);
        }
        if (fixtures.length > 0) {
          const lines = fixtures.slice(0, 8).map((m: any) => fmtMatch(m, awayTeamId!, awayTeam));
          const totalGoals = fixtures.slice(0, 8).map((m: any) => {
            const hg = m.goals?.home; const ag = m.goals?.away;
            return typeof hg === "number" && typeof ag === "number" ? hg + ag : null;
          }).filter(x => x !== null) as number[];
          const avgG = totalGoals.length > 0 ? (totalGoals.reduce((a,b)=>a+b,0)/totalGoals.length).toFixed(1) : "?";
          const over25c = totalGoals.filter(g=>g>2.5).length;
          parts.push(`🔥 Форма ${awayTeam} (посл. ${fixtures.length} матчей) | Ср.голов: ${avgG} | ТБ2.5: ${over25c}/${totalGoals.length}:\n${lines.join("\n")}`);
        }
      } catch (e: any) { console.warn("[stats] away form error:", e.message); }
    }

    // 10. Bookmaker odds
    if (resolvedFixtureId) {
      try {
        const oddsData = await fetchOdds(resolvedFixtureId);
        if (oddsData.length > 0) {
          const bookmaker = oddsData[0];
          const bets: any[] = bookmaker?.bookmakers?.[0]?.bets ?? bookmaker?.bets ?? [];
          const oddsLines: string[] = [];
          const structured: BookmakerOdds = {};
          for (const bet of bets) {
            const name: string = bet.name ?? "";
            const vals: any[] = bet.values ?? [];
            if (/match winner/i.test(name) || /1x2/i.test(name)) {
              const h = vals.find((v: any) => v.value === "Home")?.odd;
              const d = vals.find((v: any) => v.value === "Draw")?.odd;
              const a = vals.find((v: any) => v.value === "Away")?.odd;
              if (h && d && a) oddsLines.push(`  1/X/2: ${h} / ${d} / ${a}`);
            } else if (/goals over\/under/i.test(name) || /total goals/i.test(name)) {
              const o25 = vals.find((v: any) => v.value === "Over 2.5")?.odd;
              const u25 = vals.find((v: any) => v.value === "Under 2.5")?.odd;
              const o15 = vals.find((v: any) => v.value === "Over 1.5")?.odd;
              const u15 = vals.find((v: any) => v.value === "Under 1.5")?.odd;
              const o35 = vals.find((v: any) => v.value === "Over 3.5")?.odd;
              const u35 = vals.find((v: any) => v.value === "Under 3.5")?.odd;
              if (o25 && u25) { oddsLines.push(`  ТБ2.5/ТМ2.5: ${o25} / ${u25}`); structured.tb25 = parseFloat(o25); structured.tm25 = parseFloat(u25); }
              if (o15 && u15) { oddsLines.push(`  ТБ1.5/ТМ1.5: ${o15} / ${u15}`); structured.tb15 = parseFloat(o15); structured.tm15 = parseFloat(u15); }
              if (o35 && u35) { oddsLines.push(`  ТБ3.5/ТМ3.5: ${o35} / ${u35}`); structured.tb35 = parseFloat(o35); structured.tm35 = parseFloat(u35); }
            } else if (/both teams score/i.test(name)) {
              const yes = vals.find((v: any) => v.value === "Yes")?.odd;
              const no = vals.find((v: any) => v.value === "No")?.odd;
              if (yes && no) oddsLines.push(`  ОЗ Да/Нет: ${yes} / ${no}`);
            } else if (/corners/i.test(name)) {
              const o95 = vals.find((v: any) => v.value === "Over 9.5")?.odd;
              const u95 = vals.find((v: any) => v.value === "Under 9.5")?.odd;
              const o85 = vals.find((v: any) => v.value === "Over 8.5")?.odd;
              const u85 = vals.find((v: any) => v.value === "Under 8.5")?.odd;
              if (o95 && u95) { oddsLines.push(`  Угловые ТБ9.5/ТМ9.5: ${o95} / ${u95}`); structured.cornersOver95 = parseFloat(o95); structured.cornersUnder95 = parseFloat(u95); }
              if (o85 && u85) { structured.cornersOver85 = parseFloat(o85); structured.cornersUnder85 = parseFloat(u85); }
            }
          }
          if (oddsLines.length > 0) {
            parts.push(`💰 Букмекеры (реальные КФ):\n${oddsLines.join("\n")}`);
          }
          if (Object.keys(structured).length > 0) bookmakerOdds = structured;
        }
      } catch (e: any) { console.warn("[stats] odds error:", e.message); }
    }

    // 11. Standings (domestic league)
    const standingsLeague = statsLeagueHome ?? leagueId;
    if (standingsLeague && !EUROPEAN_CUP_IDS.has(standingsLeague)) {
      try {
        const standings = await fetchStandings(standingsLeague);
        const allTeams: any[] = (standings[0]?.league?.standings ?? []).flat();
        const homeSt = allTeams.find((t: any) => t.team?.id === homeTeamId);
        const awaySt = allTeams.find((t: any) => t.team?.id === awayTeamId);
        if (homeSt || awaySt) {
          const leagueName = standings[0]?.league?.name ?? "Лига";
          parts.push(`📋 Таблица ${leagueName}:`);
          if (homeSt) parts.push(`  ${homeTeam}: #${homeSt.rank}, ${homeSt.points} очков, форма: ${homeSt.form ?? "—"}, Г±ПГ: ${homeSt.goals?.for ?? "?"}/${homeSt.goals?.against ?? "?"}`);
          if (awaySt) parts.push(`  ${awayTeam}: #${awaySt.rank}, ${awaySt.points} очков, форма: ${awaySt.form ?? "—"}, Г±ПГ: ${awaySt.goals?.for ?? "?"}/${awaySt.goals?.against ?? "?"}`);
        }
      } catch (e: any) { console.warn("[stats] standings error:", e.message); }
    }

  } catch (e: any) {
    console.warn("[stats] fetchStatsForMatch error:", e.message);
    parts.push(`⚠️ Частичные данные (ошибка: ${e.message})`);
  }

  const usageAfter = await getTodayUsage();
  const requestsUsed = usageAfter - usageBefore;
  parts.push(`\n[API использовано: ${usageAfter}/${DAILY_LIMIT} сегодня, для этого матча: ${requestsUsed}]`);

  return {
    fixtureId: resolvedFixtureId,
    homeTeamId,
    awayTeamId,
    leagueId,
    statsText: parts.join("\n"),
    requestsUsed,
    bookmakerOdds,
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

export async function startupFetch(): Promise<void> {
  if (!API_KEY) { console.warn("[stats] APISPORTS_KEY not set, skipping startup fetch"); return; }
  await detectActiveSeason();
  const usage = await getTodayUsage();
  const cached = await getCachedStatsCount();
  console.log(`[stats] Startup done. Requests today: ${usage}/${DAILY_LIMIT}. Cached entries: ${cached}`);
}
