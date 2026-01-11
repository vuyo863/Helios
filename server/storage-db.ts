import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { 
  users, 
  botTypes, 
  botEntries, 
  botTypeUpdates,
  graphSettings,
  activeAlarms,
  notificationWatchlist,
  notificationThresholds,
  notificationAlarmLevels,
  type User, 
  type InsertUser, 
  type BotEntry, 
  type InsertBotEntry, 
  type BotType, 
  type InsertBotType,
  type BotTypeUpdate,
  type InsertBotTypeUpdate,
  type GraphSettings,
  type InsertGraphSettings,
  type ActiveAlarm,
  type InsertActiveAlarm,
  type WatchlistItem,
  type InsertWatchlistItem,
  type Threshold,
  type InsertThreshold,
  type AlarmLevel as AlarmLevelRow,
  type InsertAlarmLevel
} from "@shared/schema";
import type { IStorage } from "./storage";

export class DbStorage implements IStorage {
  
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllBotTypes(): Promise<BotType[]> {
    return await db.select().from(botTypes).orderBy(desc(botTypes.createdAt));
  }

  async getBotType(id: string): Promise<BotType | undefined> {
    const result = await db.select().from(botTypes).where(eq(botTypes.id, id));
    return result[0];
  }

  async createBotType(insertBotType: InsertBotType): Promise<BotType> {
    const result = await db.insert(botTypes).values({
      ...insertBotType,
      createdAt: new Date().toISOString(),
    }).returning();
    return result[0];
  }

  async updateBotType(id: string, updateData: Partial<InsertBotType>): Promise<BotType | undefined> {
    const result = await db
      .update(botTypes)
      .set(updateData)
      .where(eq(botTypes.id, id))
      .returning();
    return result[0];
  }

  async deleteBotType(id: string): Promise<boolean> {
    const result = await db.delete(botTypes).where(eq(botTypes.id, id)).returning();
    return result.length > 0;
  }

  async archiveBotType(id: string, isArchived: boolean): Promise<BotType | undefined> {
    const result = await db
      .update(botTypes)
      .set({ isArchived })
      .where(eq(botTypes.id, id))
      .returning();
    return result[0];
  }

  async getAllBotEntries(): Promise<BotEntry[]> {
    return await db.select().from(botEntries).orderBy(desc(botEntries.date));
  }

  async getBotEntry(id: string): Promise<BotEntry | undefined> {
    const result = await db.select().from(botEntries).where(eq(botEntries.id, id));
    return result[0];
  }

  async getBotEntriesByDateRange(startDate: string, endDate: string): Promise<BotEntry[]> {
    return await db
      .select()
      .from(botEntries)
      .where(and(gte(botEntries.date, startDate), lte(botEntries.date, endDate)))
      .orderBy(desc(botEntries.date));
  }

  async getBotEntriesByBotType(botTypeId: string): Promise<BotEntry[]> {
    return await db
      .select()
      .from(botEntries)
      .where(eq(botEntries.botTypeId, botTypeId))
      .orderBy(desc(botEntries.date));
  }

  async createBotEntry(entry: InsertBotEntry): Promise<BotEntry> {
    const result = await db.insert(botEntries).values(entry).returning();
    return result[0];
  }

  async updateBotEntry(id: string, updateData: Partial<InsertBotEntry>): Promise<BotEntry | undefined> {
    const result = await db
      .update(botEntries)
      .set(updateData)
      .where(eq(botEntries.id, id))
      .returning();
    return result[0];
  }

  async deleteBotEntry(id: string): Promise<boolean> {
    const result = await db.delete(botEntries).where(eq(botEntries.id, id)).returning();
    return result.length > 0;
  }

  // Bot Type Updates Methods
  async getAllBotTypeUpdates(): Promise<BotTypeUpdate[]> {
    return await db
      .select()
      .from(botTypeUpdates)
      .orderBy(desc(botTypeUpdates.version));
  }
  
  async getBotTypeUpdates(botTypeId: string): Promise<BotTypeUpdate[]> {
    return await db
      .select()
      .from(botTypeUpdates)
      .where(eq(botTypeUpdates.botTypeId, botTypeId))
      .orderBy(desc(botTypeUpdates.version));
  }

  async getLatestBotTypeUpdate(botTypeId: string): Promise<BotTypeUpdate | undefined> {
    const result = await db
      .select()
      .from(botTypeUpdates)
      .where(eq(botTypeUpdates.botTypeId, botTypeId))
      .orderBy(desc(botTypeUpdates.version))
      .limit(1);
    return result[0];
  }

  async createBotTypeUpdate(insertUpdate: InsertBotTypeUpdate): Promise<BotTypeUpdate> {
    const result = await db.insert(botTypeUpdates).values(insertUpdate).returning();
    return result[0];
  }

  async deleteBotTypeUpdate(id: string): Promise<boolean> {
    const result = await db.delete(botTypeUpdates).where(eq(botTypeUpdates.id, id)).returning();
    return result.length > 0;
  }
  
  async updateBotTypeUpdateNotes(updateId: string, notes: string): Promise<BotTypeUpdate | undefined> {
    const result = await db
      .update(botTypeUpdates)
      .set({ notes })
      .where(eq(botTypeUpdates.id, updateId))
      .returning();
    return result[0];
  }

  // Graph Settings Methods
  async getAllGraphSettings(): Promise<GraphSettings[]> {
    return await db
      .select()
      .from(graphSettings)
      .orderBy(desc(graphSettings.createdAt));
  }
  
  async getGraphSettings(id: string): Promise<GraphSettings | undefined> {
    const result = await db.select().from(graphSettings).where(eq(graphSettings.id, id));
    return result[0];
  }
  
  async getDefaultGraphSettings(): Promise<GraphSettings | undefined> {
    const result = await db
      .select()
      .from(graphSettings)
      .where(eq(graphSettings.isDefault, true))
      .limit(1);
    return result[0];
  }
  
  async createGraphSettings(settings: InsertGraphSettings): Promise<GraphSettings> {
    // Wenn isDefault true ist, setze alle anderen auf false
    if (settings.isDefault) {
      await db.update(graphSettings).set({ isDefault: false });
    }
    const result = await db.insert(graphSettings).values(settings).returning();
    return result[0];
  }
  
  async updateGraphSettings(id: string, settings: Partial<InsertGraphSettings>): Promise<GraphSettings | undefined> {
    // Wenn isDefault auf true gesetzt wird, setze alle anderen auf false
    if (settings.isDefault) {
      await db.update(graphSettings).set({ isDefault: false });
    }
    const result = await db
      .update(graphSettings)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(graphSettings.id, id))
      .returning();
    return result[0];
  }
  
  async deleteGraphSettings(id: string): Promise<boolean> {
    const result = await db.delete(graphSettings).where(eq(graphSettings.id, id)).returning();
    return result.length > 0;
  }
  
  async setDefaultGraphSettings(id: string): Promise<GraphSettings | undefined> {
    // Setze alle auf false
    await db.update(graphSettings).set({ isDefault: false });
    // Setze das angegebene auf true
    const result = await db
      .update(graphSettings)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(graphSettings.id, id))
      .returning();
    return result[0];
  }
  
  // Active Alarms Methods (PostgreSQL for persistence across server restarts)
  async getAllActiveAlarms(): Promise<ActiveAlarm[]> {
    const result = await db.select().from(activeAlarms).orderBy(desc(activeAlarms.triggeredAt));
    console.log(`[ACTIVE-ALARMS] getAllActiveAlarms called, count: ${result.length}`);
    
    // Convert DB rows to ActiveAlarm objects (parse JSON channels)
    return result.map(row => this.dbRowToActiveAlarm(row));
  }
  
  async getActiveAlarm(id: string): Promise<ActiveAlarm | undefined> {
    console.log(`[ACTIVE-ALARMS] getActiveAlarm called for id: ${id}`);
    const result = await db.select().from(activeAlarms).where(eq(activeAlarms.id, id));
    if (result.length === 0) return undefined;
    return this.dbRowToActiveAlarm(result[0]);
  }
  
  async createActiveAlarm(insertAlarm: InsertActiveAlarm): Promise<ActiveAlarm> {
    const id = insertAlarm.id || randomUUID();
    
    // Prepare data for DB (serialize channels to JSON)
    const dbData = {
      id,
      trendPriceName: insertAlarm.trendPriceName,
      threshold: insertAlarm.threshold,
      alarmLevel: insertAlarm.alarmLevel,
      triggeredAt: insertAlarm.triggeredAt,
      message: insertAlarm.message,
      note: insertAlarm.note,
      requiresApproval: insertAlarm.requiresApproval,
      repetitionsCompleted: insertAlarm.repetitionsCompleted ?? null,
      repetitionsTotal: insertAlarm.repetitionsTotal ?? null,
      autoDismissAt: insertAlarm.autoDismissAt ?? null,
      lastNotifiedAt: insertAlarm.lastNotifiedAt ?? null,
      sequenceMs: insertAlarm.sequenceMs ?? null,
      channels: insertAlarm.channels ? JSON.stringify(insertAlarm.channels) : null,
      pairId: insertAlarm.pairId ?? null,
      thresholdId: insertAlarm.thresholdId ?? null,
    };
    
    const result = await db.insert(activeAlarms).values(dbData).returning();
    console.log(`[ACTIVE-ALARMS] Created alarm: ${id} for ${insertAlarm.trendPriceName}`);
    return this.dbRowToActiveAlarm(result[0]);
  }
  
  async updateActiveAlarm(id: string, updateData: Partial<InsertActiveAlarm>): Promise<ActiveAlarm | undefined> {
    // Prepare update data (serialize channels if present)
    const dbUpdateData: Record<string, unknown> = {};
    
    if (updateData.trendPriceName !== undefined) dbUpdateData.trendPriceName = updateData.trendPriceName;
    if (updateData.threshold !== undefined) dbUpdateData.threshold = updateData.threshold;
    if (updateData.alarmLevel !== undefined) dbUpdateData.alarmLevel = updateData.alarmLevel;
    if (updateData.triggeredAt !== undefined) dbUpdateData.triggeredAt = updateData.triggeredAt;
    if (updateData.message !== undefined) dbUpdateData.message = updateData.message;
    if (updateData.note !== undefined) dbUpdateData.note = updateData.note;
    if (updateData.requiresApproval !== undefined) dbUpdateData.requiresApproval = updateData.requiresApproval;
    if (updateData.repetitionsCompleted !== undefined) dbUpdateData.repetitionsCompleted = updateData.repetitionsCompleted;
    if (updateData.repetitionsTotal !== undefined) dbUpdateData.repetitionsTotal = updateData.repetitionsTotal;
    if (updateData.autoDismissAt !== undefined) dbUpdateData.autoDismissAt = updateData.autoDismissAt;
    if (updateData.lastNotifiedAt !== undefined) dbUpdateData.lastNotifiedAt = updateData.lastNotifiedAt;
    if (updateData.sequenceMs !== undefined) dbUpdateData.sequenceMs = updateData.sequenceMs;
    if (updateData.channels !== undefined) dbUpdateData.channels = JSON.stringify(updateData.channels);
    if (updateData.pairId !== undefined) dbUpdateData.pairId = updateData.pairId;
    if (updateData.thresholdId !== undefined) dbUpdateData.thresholdId = updateData.thresholdId;
    
    const result = await db
      .update(activeAlarms)
      .set(dbUpdateData)
      .where(eq(activeAlarms.id, id))
      .returning();
    
    if (result.length === 0) {
      console.log(`[ACTIVE-ALARMS] Update failed - alarm not found: ${id}`);
      return undefined;
    }
    
    console.log(`[ACTIVE-ALARMS] Updated alarm: ${id}`);
    return this.dbRowToActiveAlarm(result[0]);
  }
  
  async deleteActiveAlarm(id: string): Promise<boolean> {
    const result = await db.delete(activeAlarms).where(eq(activeAlarms.id, id)).returning();
    const deleted = result.length > 0;
    console.log(`[ACTIVE-ALARMS] Delete alarm ${id}: ${deleted ? 'success (APPROVED)' : 'not found'}`);
    return deleted;
  }
  
  async deleteAllActiveAlarms(): Promise<boolean> {
    const countBefore = await db.select().from(activeAlarms);
    await db.delete(activeAlarms);
    console.log(`[ACTIVE-ALARMS] Deleted all ${countBefore.length} alarms`);
    return true;
  }
  
  // Helper: Convert DB row to ActiveAlarm object
  private dbRowToActiveAlarm(row: typeof activeAlarms.$inferSelect): ActiveAlarm {
    return {
      id: row.id,
      trendPriceName: row.trendPriceName,
      threshold: row.threshold,
      alarmLevel: row.alarmLevel as 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich',
      triggeredAt: row.triggeredAt,
      message: row.message,
      note: row.note,
      requiresApproval: row.requiresApproval,
      repetitionsCompleted: row.repetitionsCompleted ?? undefined,
      repetitionsTotal: row.repetitionsTotal ?? undefined,
      autoDismissAt: row.autoDismissAt ?? undefined,
      lastNotifiedAt: row.lastNotifiedAt ?? undefined,
      sequenceMs: row.sequenceMs ?? undefined,
      channels: row.channels ? JSON.parse(row.channels) : undefined,
      pairId: row.pairId ?? undefined,
      thresholdId: row.thresholdId ?? undefined,
    };
  }

  // ===== NOTIFICATION WATCHLIST =====
  
  async getAllWatchlistItems(): Promise<WatchlistItem[]> {
    return await db.select().from(notificationWatchlist).orderBy(desc(notificationWatchlist.createdAt));
  }
  
  async createWatchlistItem(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const result = await db.insert(notificationWatchlist).values({
      symbol: item.symbol,
      marketType: item.marketType,
      displayName: item.displayName ?? null,
    }).returning();
    console.log(`[WATCHLIST] Created: ${item.symbol} (${item.marketType})`);
    return result[0];
  }
  
  async deleteWatchlistItem(symbol: string, marketType: string): Promise<boolean> {
    const result = await db.delete(notificationWatchlist)
      .where(and(
        eq(notificationWatchlist.symbol, symbol),
        eq(notificationWatchlist.marketType, marketType)
      ))
      .returning();
    console.log(`[WATCHLIST] Deleted: ${symbol} (${marketType}) - ${result.length > 0 ? 'success' : 'not found'}`);
    return result.length > 0;
  }
  
  async syncWatchlist(items: InsertWatchlistItem[]): Promise<WatchlistItem[]> {
    // Clear all and re-insert (full sync from frontend)
    await db.delete(notificationWatchlist);
    if (items.length === 0) return [];
    
    const result = await db.insert(notificationWatchlist)
      .values(items.map(item => ({
        symbol: item.symbol,
        marketType: item.marketType,
        displayName: item.displayName ?? null,
      })))
      .returning();
    console.log(`[WATCHLIST] Synced ${result.length} items`);
    return result;
  }

  // ===== NOTIFICATION THRESHOLDS =====
  
  async getAllThresholds(): Promise<Threshold[]> {
    return await db.select().from(notificationThresholds).orderBy(desc(notificationThresholds.createdAt));
  }
  
  async getThresholdsByPairId(pairId: string): Promise<Threshold[]> {
    return await db.select().from(notificationThresholds)
      .where(eq(notificationThresholds.pairId, pairId))
      .orderBy(desc(notificationThresholds.createdAt));
  }
  
  async createThreshold(threshold: InsertThreshold): Promise<Threshold> {
    const result = await db.insert(notificationThresholds).values({
      pairId: threshold.pairId,
      thresholdId: threshold.thresholdId,
      threshold: threshold.threshold,
      notifyOnIncrease: threshold.notifyOnIncrease,
      notifyOnDecrease: threshold.notifyOnDecrease,
      increaseFrequency: threshold.increaseFrequency,
      decreaseFrequency: threshold.decreaseFrequency,
      alarmLevel: threshold.alarmLevel,
      note: threshold.note,
      isActive: threshold.isActive ?? true,
      triggerCount: threshold.triggerCount ?? 0,
      activeAlarmId: threshold.activeAlarmId ?? null,
    }).returning();
    console.log(`[THRESHOLDS] Created: ${threshold.pairId} - ${threshold.threshold}`);
    return result[0];
  }
  
  async updateThreshold(pairId: string, thresholdId: string, updateData: Partial<InsertThreshold>): Promise<Threshold | undefined> {
    const dbUpdateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (updateData.threshold !== undefined) dbUpdateData.threshold = updateData.threshold;
    if (updateData.notifyOnIncrease !== undefined) dbUpdateData.notifyOnIncrease = updateData.notifyOnIncrease;
    if (updateData.notifyOnDecrease !== undefined) dbUpdateData.notifyOnDecrease = updateData.notifyOnDecrease;
    if (updateData.increaseFrequency !== undefined) dbUpdateData.increaseFrequency = updateData.increaseFrequency;
    if (updateData.decreaseFrequency !== undefined) dbUpdateData.decreaseFrequency = updateData.decreaseFrequency;
    if (updateData.alarmLevel !== undefined) dbUpdateData.alarmLevel = updateData.alarmLevel;
    if (updateData.note !== undefined) dbUpdateData.note = updateData.note;
    if (updateData.isActive !== undefined) dbUpdateData.isActive = updateData.isActive;
    if (updateData.triggerCount !== undefined) dbUpdateData.triggerCount = updateData.triggerCount;
    if (updateData.activeAlarmId !== undefined) dbUpdateData.activeAlarmId = updateData.activeAlarmId;
    
    const result = await db.update(notificationThresholds)
      .set(dbUpdateData)
      .where(and(
        eq(notificationThresholds.pairId, pairId),
        eq(notificationThresholds.thresholdId, thresholdId)
      ))
      .returning();
    
    if (result.length > 0) {
      console.log(`[THRESHOLDS] Updated: ${pairId} - ${thresholdId}`);
    }
    return result[0];
  }
  
  async deleteThreshold(pairId: string, thresholdId: string): Promise<boolean> {
    const result = await db.delete(notificationThresholds)
      .where(and(
        eq(notificationThresholds.pairId, pairId),
        eq(notificationThresholds.thresholdId, thresholdId)
      ))
      .returning();
    console.log(`[THRESHOLDS] Deleted: ${pairId} - ${thresholdId} - ${result.length > 0 ? 'success' : 'not found'}`);
    return result.length > 0;
  }
  
  async deleteAllThresholdsByPairId(pairId: string): Promise<boolean> {
    const result = await db.delete(notificationThresholds)
      .where(eq(notificationThresholds.pairId, pairId))
      .returning();
    console.log(`[THRESHOLDS] Deleted all for ${pairId}: ${result.length} items`);
    return result.length > 0;
  }
  
  async syncThresholds(thresholds: InsertThreshold[]): Promise<Threshold[]> {
    // Clear all and re-insert (full sync from frontend)
    await db.delete(notificationThresholds);
    if (thresholds.length === 0) return [];
    
    const result = await db.insert(notificationThresholds)
      .values(thresholds.map(t => ({
        pairId: t.pairId,
        thresholdId: t.thresholdId,
        threshold: t.threshold,
        notifyOnIncrease: t.notifyOnIncrease,
        notifyOnDecrease: t.notifyOnDecrease,
        increaseFrequency: t.increaseFrequency,
        decreaseFrequency: t.decreaseFrequency,
        alarmLevel: t.alarmLevel,
        note: t.note,
        isActive: t.isActive ?? true,
        triggerCount: t.triggerCount ?? 0,
        activeAlarmId: t.activeAlarmId ?? null,
      })))
      .returning();
    console.log(`[THRESHOLDS] Synced ${result.length} items`);
    return result;
  }

  // ===== NOTIFICATION ALARM LEVELS =====
  
  async getAllAlarmLevels(): Promise<AlarmLevelRow[]> {
    return await db.select().from(notificationAlarmLevels);
  }
  
  async getAlarmLevel(level: string): Promise<AlarmLevelRow | undefined> {
    const result = await db.select().from(notificationAlarmLevels)
      .where(eq(notificationAlarmLevels.level, level));
    return result[0];
  }
  
  async upsertAlarmLevel(config: InsertAlarmLevel): Promise<AlarmLevelRow> {
    // Check if exists
    const existing = await this.getAlarmLevel(config.level);
    
    if (existing) {
      // Update
      const result = await db.update(notificationAlarmLevels)
        .set({
          pushEnabled: config.pushEnabled ?? false,
          emailEnabled: config.emailEnabled ?? false,
          smsEnabled: config.smsEnabled ?? false,
          webPushEnabled: config.webPushEnabled ?? false,
          nativePushEnabled: config.nativePushEnabled ?? false,
          requiresApproval: config.requiresApproval ?? false,
          repeatCount: config.repeatCount ?? '1',
          sequenceHours: config.sequenceHours ?? 0,
          sequenceMinutes: config.sequenceMinutes ?? 0,
          sequenceSeconds: config.sequenceSeconds ?? 0,
          restwartezeitHours: config.restwartezeitHours ?? 0,
          restwartezeitMinutes: config.restwartezeitMinutes ?? 0,
          restwartezeitSeconds: config.restwartezeitSeconds ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(notificationAlarmLevels.level, config.level))
        .returning();
      console.log(`[ALARM-LEVELS] Updated: ${config.level}`);
      return result[0];
    } else {
      // Insert
      const result = await db.insert(notificationAlarmLevels)
        .values({
          level: config.level,
          pushEnabled: config.pushEnabled ?? false,
          emailEnabled: config.emailEnabled ?? false,
          smsEnabled: config.smsEnabled ?? false,
          webPushEnabled: config.webPushEnabled ?? false,
          nativePushEnabled: config.nativePushEnabled ?? false,
          requiresApproval: config.requiresApproval ?? false,
          repeatCount: config.repeatCount ?? '1',
          sequenceHours: config.sequenceHours ?? 0,
          sequenceMinutes: config.sequenceMinutes ?? 0,
          sequenceSeconds: config.sequenceSeconds ?? 0,
          restwartezeitHours: config.restwartezeitHours ?? 0,
          restwartezeitMinutes: config.restwartezeitMinutes ?? 0,
          restwartezeitSeconds: config.restwartezeitSeconds ?? 0,
        })
        .returning();
      console.log(`[ALARM-LEVELS] Created: ${config.level}`);
      return result[0];
    }
  }
  
  async syncAlarmLevels(configs: InsertAlarmLevel[]): Promise<AlarmLevelRow[]> {
    const results: AlarmLevelRow[] = [];
    for (const config of configs) {
      const result = await this.upsertAlarmLevel(config);
      results.push(result);
    }
    console.log(`[ALARM-LEVELS] Synced ${results.length} levels`);
    return results;
  }
}

export const dbStorage = new DbStorage();
