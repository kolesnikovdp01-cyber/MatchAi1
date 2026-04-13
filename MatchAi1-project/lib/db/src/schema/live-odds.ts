import { pgTable, serial, text, real, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const liveOddsTable = pgTable("live_odds", {
  id: serial("id").primaryKey(),
  fixtureId: text("fixture_id").notNull().unique(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  league: text("league").notNull(),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  oddsHome: real("odds_home"),
  oddsDraw: real("odds_draw"),
  oddsAway: real("odds_away"),
  bookmaker: text("bookmaker"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LiveOdds = typeof liveOddsTable.$inferSelect;
