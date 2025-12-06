import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { 
  users, 
  botTypes, 
  botEntries, 
  botTypeUpdates,
  type User, 
  type InsertUser, 
  type BotEntry, 
  type InsertBotEntry, 
  type BotType, 
  type InsertBotType,
  type BotTypeUpdate,
  type InsertBotTypeUpdate
} from "@shared/schema";
import type { IStorage } from "./storage";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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
}

export const dbStorage = new DbStorage();
