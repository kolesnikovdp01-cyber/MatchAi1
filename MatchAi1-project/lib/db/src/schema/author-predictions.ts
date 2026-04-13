import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const authorPredictionsTable = pgTable("author_predictions", {
  id: serial("id").primaryKey(),
  matchTitle: text("match_title").notNull(),
  league: text("league").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  prediction: text("prediction").notNull(),
  odds: real("odds").notNull(),
  stake: integer("stake").notNull(),
  status: text("status").notNull().default("pending"),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuthorPredictionSchema = createInsertSchema(authorPredictionsTable).omit({ id: true, createdAt: true });
export type InsertAuthorPrediction = z.infer<typeof insertAuthorPredictionSchema>;
export type AuthorPrediction = typeof authorPredictionsTable.$inferSelect;
