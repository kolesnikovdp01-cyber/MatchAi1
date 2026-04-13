import { pgTable, bigint, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  firstName: text("first_name"),
  username: text("username"),
  coins: integer("coins").notNull().default(0),
  notificationsAi: boolean("notifications_ai").notNull().default(true),
  notificationsAuthor: boolean("notifications_author").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
