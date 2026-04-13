import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const predictionButtonsTable = pgTable("prediction_buttons", {
  id: serial("id").primaryKey(),
  predictionType: text("prediction_type").notNull(),
  predictionId: integer("prediction_id").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PredictionButton = typeof predictionButtonsTable.$inferSelect;
