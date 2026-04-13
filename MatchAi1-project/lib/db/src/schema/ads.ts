import { pgTable, serial, text, integer, boolean, timestamp, bigint } from "drizzle-orm/pg-core";

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  mediaType: text("media_type").default("image"),
  linkUrl: text("link_url").notNull(),
  rewardCoins: integer("reward_coins").notNull().default(5),
  durationSeconds: integer("duration_seconds").notNull().default(15),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adViewsTable = pgTable("ad_views", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
  adId: integer("ad_id").notNull(),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ad = typeof adsTable.$inferSelect;
export type AdView = typeof adViewsTable.$inferSelect;
