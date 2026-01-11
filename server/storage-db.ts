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
  type InsertActiveAlarm
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
}

export const dbStorage = new DbStorage();
