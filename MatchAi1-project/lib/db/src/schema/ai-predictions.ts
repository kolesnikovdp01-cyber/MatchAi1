import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiPredictionsTable = pgTable("ai_predictions", {
  id: serial("id").primaryKey(),
  matchTitle: text("match_title").notNull(),
  league: text("league").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  prediction: text("prediction").notNull(),
  confidence: real("confidence").notNull(),
  odds: real("odds").notNull(),
  status: text("status").notNull().default("pending"),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  analysis: text("analysis").notNull(),
  scorePredict: text("score_predict"),
  scoreProbability: real("score_probability"),
  riskLevel: text("risk_level"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiPredictionSchema = createInsertSchema(aiPredictionsTable).omit({ id: true, createdAt: true });
export type InsertAiPrediction = z.infer<typeof insertAiPredictionSchema>;
export type AiPrediction = typeof aiPredictionsTable.$inferSelect;
