import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const botTypes = pgTable("bot_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: text("created_at").notNull(),
});

export const insertBotTypeSchema = createInsertSchema(botTypes).omit({
  id: true,
  createdAt: true,
});

export type InsertBotType = z.infer<typeof insertBotTypeSchema>;
export type BotType = typeof botTypes.$inferSelect;

export const botEntries = pgTable("bot_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  botName: text("bot_name").notNull(),
  botTypeId: varchar("bot_type_id"),
  botDirection: text("bot_direction"),
  investment: numeric("investment", { precision: 12, scale: 2 }).notNull(),
  profit: numeric("profit", { precision: 12, scale: 2 }).notNull(),
  profitPercent: numeric("profit_percent", { precision: 8, scale: 2 }).notNull(),
  periodType: text("period_type").notNull(),
  longestRuntime: numeric("longest_runtime", { precision: 10, scale: 2 }),
  avgRuntime: numeric("avg_runtime", { precision: 10, scale: 2 }),
  avgGridProfit: numeric("avg_grid_profit", { precision: 12, scale: 2 }),
  highestGridProfit: numeric("highest_grid_profit", { precision: 12, scale: 2 }),
  highestGridProfitPercent: numeric("highest_grid_profit_percent", { precision: 8, scale: 2 }),
  overallAvgGridProfit: numeric("overall_avg_grid_profit", { precision: 12, scale: 2 }),
  leverage: text("leverage"),
  notes: text("notes"),
  screenshotPath: text("screenshot_path"),
});

export const insertBotEntrySchema = createInsertSchema(botEntries).omit({
  id: true,
}).extend({
  screenshotPath: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  botTypeId: z.string().optional().nullable(),
  botDirection: z.string().optional().nullable(),
  longestRuntime: z.string().optional().nullable(),
  avgRuntime: z.string().optional().nullable(),
  avgGridProfit: z.string().optional().nullable(),
  highestGridProfit: z.string().optional().nullable(),
  highestGridProfitPercent: z.string().optional().nullable(),
  overallAvgGridProfit: z.string().optional().nullable(),
  leverage: z.string().optional().nullable(),
});

export type InsertBotEntry = z.infer<typeof insertBotEntrySchema>;
export type BotEntry = typeof botEntries.$inferSelect;
