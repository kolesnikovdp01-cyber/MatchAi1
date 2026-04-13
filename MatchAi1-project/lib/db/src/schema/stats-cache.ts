import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const statsCacheTable = pgTable("stats_cache", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  type: text("type").notNull(),
  data: text("data").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiRequestTrackerTable = pgTable("api_request_tracker", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  provider: text("provider").notNull(),
  count: integer("count").notNull().default(0),
});

export type StatsCache = typeof statsCacheTable.$inferSelect;
export type ApiRequestTracker = typeof apiRequestTrackerTable.$inferSelect;
