import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, integer, timestamp, boolean } from "drizzle-orm/pg-core";
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
  isArchived: boolean("is_archived").default(false),
  isActive: boolean("is_active").default(false),
  wontLiqBudget: text("wont_liq_budget"),
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
  botType: text("bot_type"),
  version: text("version"),
  botDirection: text("bot_direction"),
  investment: numeric("investment", { precision: 12, scale: 2 }).notNull(),
  extraMargin: numeric("extra_margin", { precision: 12, scale: 2 }),
  totalInvestment: numeric("total_investment", { precision: 12, scale: 2 }),
  profit: numeric("profit", { precision: 12, scale: 2 }).notNull(),
  profitPercent: numeric("profit_percent", { precision: 8, scale: 2 }).notNull(),
  periodType: text("period_type").notNull(),
  longestRuntime: text("longest_runtime"),
  avgRuntime: text("avg_runtime"),
  avgGridProfitHour: numeric("avg_grid_profit_hour", { precision: 12, scale: 2 }),
  avgGridProfitDay: numeric("avg_grid_profit_day", { precision: 12, scale: 2 }),
  avgGridProfitWeek: numeric("avg_grid_profit_week", { precision: 12, scale: 2 }),
  overallTrendPnlUsdt: numeric("overall_trend_pnl_usdt", { precision: 12, scale: 2 }),
  overallTrendPnlPercent: numeric("overall_trend_pnl_percent", { precision: 8, scale: 2 }),
  highestGridProfit: numeric("highest_grid_profit", { precision: 12, scale: 2 }),
  highestGridProfitPercent: numeric("highest_grid_profit_percent", { precision: 8, scale: 2 }),
  overallGridProfitUsdt: numeric("overall_grid_profit_usdt", { precision: 12, scale: 2 }),
  overallGridProfitPercent: numeric("overall_grid_profit_percent", { precision: 8, scale: 2 }),
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
  botType: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  botDirection: z.string().optional().nullable(),
  extraMargin: z.string().optional().nullable(),
  totalInvestment: z.string().optional().nullable(),
  longestRuntime: z.string().optional().nullable(),
  avgRuntime: z.string().optional().nullable(),
  avgGridProfitHour: z.string().optional().nullable(),
  avgGridProfitDay: z.string().optional().nullable(),
  avgGridProfitWeek: z.string().optional().nullable(),
  overallTrendPnlUsdt: z.string().optional().nullable(),
  overallTrendPnlPercent: z.string().optional().nullable(),
  highestGridProfit: z.string().optional().nullable(),
  highestGridProfitPercent: z.string().optional().nullable(),
  overallGridProfitUsdt: z.string().optional().nullable(),
  overallGridProfitPercent: z.string().optional().nullable(),
  leverage: z.string().optional().nullable(),
});

export type InsertBotEntry = z.infer<typeof insertBotEntrySchema>;
export type BotEntry = typeof botEntries.$inferSelect;

// Bot Type Updates - Speichert alle Phase 4 Berechnungen pro Upload
export const botTypeUpdates = pgTable("bot_type_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  botTypeId: varchar("bot_type_id").notNull(),
  version: integer("version").notNull(), // Version number (1, 2, 3, ...)
  status: text("status").notNull(), // "Update Metrics" oder "Closed Bots"
  createdAt: timestamp("created_at").defaultNow(), // Automatisch gespeichert
  
  // Info Section (keine Modi)
  date: text("date"), // Ältestes Datum aus Screenshots
  botDirection: text("bot_direction"),
  leverage: text("leverage"),
  longestRuntime: text("longest_runtime"),
  avgRuntime: text("avg_runtime"),
  uploadRuntime: text("upload_runtime"), // Zeitdifferenz: This Upload - Last Upload
  lastUpload: text("last_upload"), // Datum/Uhrzeit des letzten Uploads
  thisUpload: text("this_upload"), // Datum/Uhrzeit des aktuellen Uploads
  
  // Investment Section
  investment: text("investment"),
  extraMargin: text("extra_margin"),
  totalInvestment: text("total_investment"),
  
  // Profit Section
  profit: text("profit"),
  profitPercent_gesamtinvestment: text("profit_percent_gesamtinvestment"),
  profitPercent_investitionsmenge: text("profit_percent_investitionsmenge"),
  
  // Trend P&L Section
  overallTrendPnlUsdt: text("overall_trend_pnl_usdt"),
  overallTrendPnlPercent_gesamtinvestment: text("overall_trend_pnl_percent_gesamtinvestment"),
  overallTrendPnlPercent_investitionsmenge: text("overall_trend_pnl_percent_investitionsmenge"),
  
  // Grid Trading Section
  overallGridProfitUsdt: text("overall_grid_profit_usdt"),
  overallGridProfitPercent_gesamtinvestment: text("overall_grid_profit_percent_gesamtinvestment"),
  overallGridProfitPercent_investitionsmenge: text("overall_grid_profit_percent_investitionsmenge"),
  highestGridProfit: text("highest_grid_profit"),
  highestGridProfitPercent_gesamtinvestment: text("highest_grid_profit_percent_gesamtinvestment"),
  highestGridProfitPercent_investitionsmenge: text("highest_grid_profit_percent_investitionsmenge"),
  avgGridProfitUsdt: text("avg_grid_profit_usdt"), // Durchschnitt = Gesamter Grid Profit / Anzahl Screenshots
  avgGridProfitHour: text("avg_grid_profit_hour"),
  avgGridProfitDay: text("avg_grid_profit_day"),
  avgGridProfitWeek: text("avg_grid_profit_week"),
  
  // Last Grid Profit Durchschnitt (vom vorherigen Upload)
  lastAvgGridProfitHour: text("last_avg_grid_profit_hour"),
  lastAvgGridProfitDay: text("last_avg_grid_profit_day"),
  lastAvgGridProfitWeek: text("last_avg_grid_profit_week"),
  
  // Last Ø Grid Profit (USDT) und Change für Ø Grid Profit
  lastAvgGridProfitUsdt: text("last_avg_grid_profit_usdt"),
  avgGridProfitChangeDollar: text("avg_grid_profit_change_dollar"),
  avgGridProfitChangePercent: text("avg_grid_profit_change_percent"),
  
  // Ø Grid Profit (%) - beide Basen
  avgGridProfitPercent_gesamtinvestment: text("avg_grid_profit_percent_gesamtinvestment"),
  avgGridProfitPercent_investitionsmenge: text("avg_grid_profit_percent_investitionsmenge"),
  
  // Change-Werte (6 Kombinationen: 3 Zeiträume × 2 Einheiten)
  changeHourDollar: text("change_hour_dollar"),
  changeHourPercent: text("change_hour_percent"),
  changeDayDollar: text("change_day_dollar"),
  changeDayPercent: text("change_day_percent"),
  changeWeekDollar: text("change_week_dollar"),
  changeWeekPercent: text("change_week_percent"),
  
  // Screenshot-Anzahl
  screenshotCount: text("screenshot_count"),
  
  // Berechnungsmodus (Normal oder Startmetrik - für manuell ausgewählten Startmetrik-Modus)
  calculationMode: text("calculation_mode"),
  
  // Notizen Section (wird NICHT an AI gesendet, keine Modi)
  notes: text("notes"),
  
  // ABSOLUTE WERTE (bei Vergleichsmodus werden hier die kompletten Werte gespeichert)
  // Bei Neu-Modus sind diese gleich den normalen Feldern
  // Bei Vergleichsmodus: normale Felder = Differenz, absolute Felder = kompletter Wert
  investmentAbsolute: text("investment_absolute"),
  extraMarginAbsolute: text("extra_margin_absolute"),
  totalInvestmentAbsolute: text("total_investment_absolute"),
  profitAbsolute: text("profit_absolute"),
  profitPercent_gesamtinvestment_absolute: text("profit_percent_gesamtinvestment_absolute"),
  profitPercent_investitionsmenge_absolute: text("profit_percent_investitionsmenge_absolute"),
  overallTrendPnlUsdtAbsolute: text("overall_trend_pnl_usdt_absolute"),
  overallTrendPnlPercent_gesamtinvestment_absolute: text("overall_trend_pnl_percent_gesamtinvestment_absolute"),
  overallTrendPnlPercent_investitionsmenge_absolute: text("overall_trend_pnl_percent_investitionsmenge_absolute"),
  overallGridProfitUsdtAbsolute: text("overall_grid_profit_usdt_absolute"),
  overallGridProfitPercent_gesamtinvestment_absolute: text("overall_grid_profit_percent_gesamtinvestment_absolute"),
  overallGridProfitPercent_investitionsmenge_absolute: text("overall_grid_profit_percent_investitionsmenge_absolute"),
  avgGridProfitHourAbsolute: text("avg_grid_profit_hour_absolute"),
  avgGridProfitDayAbsolute: text("avg_grid_profit_day_absolute"),
  avgGridProfitWeekAbsolute: text("avg_grid_profit_week_absolute"),
});

export const insertBotTypeUpdateSchema = createInsertSchema(botTypeUpdates).omit({
  id: true,
});

export type InsertBotTypeUpdate = z.infer<typeof insertBotTypeUpdateSchema>;
export type BotTypeUpdate = typeof botTypeUpdates.$inferSelect;

// ===== GRAPH SETTINGS =====
// Speichert die kompletten Graph-Einstellungen (Zeitraum, Sequenz, Custom-Werte, Kalender)
// Eine Zeile pro gespeicherte Einstellung (kann mehrere Presets geben)
export const graphSettings = pgTable("graph_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Name des Presets (z.B. "Standard", "Letzte 7 Tage")
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // Zeitraum-Einstellungen
  timeRange: text("time_range"), // "First-Last Update", "1h", "24h", "7 Days", "30 Days", "Custom"
  sequence: text("sequence"), // "hours", "days", "weeks", "months"
  
  // Custom D/H/M Felder (wenn Custom mit manueller Eingabe)
  customDays: text("custom_days"),
  customHours: text("custom_hours"),
  customMinutes: text("custom_minutes"),
  
  // Kalender-Daten (wenn Custom mit Kalender-Auswahl)
  customFromDate: text("custom_from_date"), // ISO String
  customToDate: text("custom_to_date"), // ISO String
  
  // Optional: Welche Bot-Types ausgewählt sind (JSON Array von IDs)
  selectedBotTypes: text("selected_bot_types"), // JSON Array
  
  // Optional: Welche Metrik-Cards aktiv sind (JSON Array)
  activeMetricCards: text("active_metric_cards"), // JSON Array
  
  // Ist dies das aktive/Standard-Preset?
  isDefault: boolean("is_default").default(false),
});

export const insertGraphSettingsSchema = createInsertSchema(graphSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGraphSettings = z.infer<typeof insertGraphSettingsSchema>;
export type GraphSettings = typeof graphSettings.$inferSelect;

// ===== ACTIVE ALARMS (for cross-device synchronization) =====
// Stored in PostgreSQL for persistence across server restarts

export const activeAlarms = pgTable("active_alarms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trendPriceName: text("trend_price_name").notNull(),
  threshold: text("threshold").notNull(),
  alarmLevel: text("alarm_level").notNull(), // 'harmlos', 'achtung', 'gefährlich', 'sehr_gefährlich'
  triggeredAt: text("triggered_at").notNull(), // ISO date string
  message: text("message").notNull(),
  note: text("note").notNull(),
  requiresApproval: boolean("requires_approval").notNull(),
  repetitionsCompleted: integer("repetitions_completed"),
  repetitionsTotal: integer("repetitions_total"),
  autoDismissAt: text("auto_dismiss_at"), // ISO date string
  lastNotifiedAt: text("last_notified_at"), // ISO date string
  sequenceMs: integer("sequence_ms"),
  channels: text("channels"), // JSON string for channels object
  pairId: text("pair_id"), // For threshold reference
  thresholdId: text("threshold_id"), // For threshold reference
});

// Zod schema for validation (keeps existing API compatibility)
export const activeAlarmSchema = z.object({
  id: z.string(),
  trendPriceName: z.string(),
  threshold: z.string(),
  alarmLevel: z.enum(['harmlos', 'achtung', 'gefährlich', 'sehr_gefährlich']),
  triggeredAt: z.string(), // ISO date string
  message: z.string(),
  note: z.string(),
  requiresApproval: z.boolean(),
  repetitionsCompleted: z.number().optional(),
  repetitionsTotal: z.number().optional(),
  autoDismissAt: z.string().optional(), // ISO date string
  lastNotifiedAt: z.string().optional(), // ISO date string
  sequenceMs: z.number().optional(),
  channels: z.object({
    push: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
    webPush: z.boolean(),
    nativePush: z.boolean(),
  }).optional(),
  pairId: z.string().optional(),
  thresholdId: z.string().optional(),
});

export const insertActiveAlarmSchema = activeAlarmSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});

export type ActiveAlarm = z.infer<typeof activeAlarmSchema>;
export type InsertActiveAlarm = z.infer<typeof insertActiveAlarmSchema>;

// ===== NOTIFICATION SETTINGS (for cross-device synchronization) =====

// Watchlist - which trading pairs are being watched
export const notificationWatchlist = pgTable("notification_watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(), // e.g. "BTCUSDT"
  marketType: text("market_type").notNull(), // "spot" or "futures"
  displayName: text("display_name"), // e.g. "BTC/USDT"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWatchlistSchema = z.object({
  symbol: z.string(),
  marketType: z.enum(['spot', 'futures']),
  displayName: z.string().optional(),
});

export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type WatchlistItem = typeof notificationWatchlist.$inferSelect;

// Threshold Settings - per trading pair thresholds
export const notificationThresholds = pgTable("notification_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pairId: text("pair_id").notNull(), // e.g. "BTCUSDT_spot"
  thresholdId: text("threshold_id").notNull(), // unique ID within the pair
  threshold: text("threshold").notNull(), // the price value
  notifyOnIncrease: boolean("notify_on_increase").notNull(),
  notifyOnDecrease: boolean("notify_on_decrease").notNull(),
  increaseFrequency: text("increase_frequency").notNull(), // 'einmalig' | 'wiederholend'
  decreaseFrequency: text("decrease_frequency").notNull(), // 'einmalig' | 'wiederholend'
  alarmLevel: text("alarm_level").notNull(), // 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich'
  note: text("note").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  triggerCount: integer("trigger_count").default(0),
  activeAlarmId: text("active_alarm_id"), // for wiederholend re-trigger prevention
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertThresholdSchema = z.object({
  pairId: z.string(),
  thresholdId: z.string(),
  threshold: z.string(),
  notifyOnIncrease: z.boolean(),
  notifyOnDecrease: z.boolean(),
  increaseFrequency: z.enum(['einmalig', 'wiederholend']),
  decreaseFrequency: z.enum(['einmalig', 'wiederholend']),
  alarmLevel: z.enum(['harmlos', 'achtung', 'gefährlich', 'sehr_gefährlich']),
  note: z.string(),
  isActive: z.boolean().default(true),
  triggerCount: z.number().default(0),
  activeAlarmId: z.string().optional(),
});

export type InsertThreshold = z.infer<typeof insertThresholdSchema>;
export type Threshold = typeof notificationThresholds.$inferSelect;

// Alarm Level Configs - settings for each alarm level
export const notificationAlarmLevels = pgTable("notification_alarm_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: text("level").notNull().unique(), // 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich'
  pushEnabled: boolean("push_enabled").notNull().default(false),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  webPushEnabled: boolean("web_push_enabled").notNull().default(false),
  nativePushEnabled: boolean("native_push_enabled").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  repeatCount: text("repeat_count").notNull().default('1'), // number or 'infinite'
  sequenceHours: integer("sequence_hours").notNull().default(0),
  sequenceMinutes: integer("sequence_minutes").notNull().default(0),
  sequenceSeconds: integer("sequence_seconds").notNull().default(0),
  restwartezeitHours: integer("restwartezeit_hours").notNull().default(0),
  restwartezeitMinutes: integer("restwartezeit_minutes").notNull().default(0),
  restwartezeitSeconds: integer("restwartezeit_seconds").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAlarmLevelSchema = z.object({
  level: z.enum(['harmlos', 'achtung', 'gefährlich', 'sehr_gefährlich']),
  pushEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  webPushEnabled: z.boolean().default(false),
  nativePushEnabled: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  repeatCount: z.string().default('1'),
  sequenceHours: z.number().default(0),
  sequenceMinutes: z.number().default(0),
  sequenceSeconds: z.number().default(0),
  restwartezeitHours: z.number().default(0),
  restwartezeitMinutes: z.number().default(0),
  restwartezeitSeconds: z.number().default(0),
});

export type InsertAlarmLevel = z.infer<typeof insertAlarmLevelSchema>;
export type AlarmLevel = typeof notificationAlarmLevels.$inferSelect;
