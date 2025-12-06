import { type User, type InsertUser, type BotEntry, type InsertBotEntry, type BotType, type InsertBotType, type BotTypeUpdate, type InsertBotTypeUpdate } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllBotTypes(): Promise<BotType[]>;
  getBotType(id: string): Promise<BotType | undefined>;
  createBotType(botType: InsertBotType): Promise<BotType>;
  updateBotType(id: string, updateData: Partial<InsertBotType>): Promise<BotType | undefined>;
  deleteBotType(id: string): Promise<boolean>;
  archiveBotType(id: string, isArchived: boolean): Promise<BotType | undefined>;
  
  getAllBotEntries(): Promise<BotEntry[]>;
  getBotEntry(id: string): Promise<BotEntry | undefined>;
  getBotEntriesByDateRange(startDate: string, endDate: string): Promise<BotEntry[]>;
  getBotEntriesByBotType(botTypeId: string): Promise<BotEntry[]>;
  createBotEntry(entry: InsertBotEntry): Promise<BotEntry>;
  updateBotEntry(id: string, updateData: Partial<InsertBotEntry>): Promise<BotEntry | undefined>;
  deleteBotEntry(id: string): Promise<boolean>;
  
  // Bot Type Updates
  getAllBotTypeUpdates(): Promise<BotTypeUpdate[]>;
  getBotTypeUpdates(botTypeId: string): Promise<BotTypeUpdate[]>;
  getLatestBotTypeUpdate(botTypeId: string): Promise<BotTypeUpdate | undefined>;
  createBotTypeUpdate(update: InsertBotTypeUpdate): Promise<BotTypeUpdate>;
  deleteBotTypeUpdate(id: string): Promise<boolean>;
  updateBotTypeUpdateNotes(updateId: string, notes: string): Promise<BotTypeUpdate | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private botTypes: Map<string, BotType>;
  private botEntries: Map<string, BotEntry>;

  constructor() {
    this.users = new Map();
    this.botTypes = new Map();
    this.botEntries = new Map();
    this.seedMockData();
  }

  private seedMockData() {
    const botType1Id = randomUUID();
    const botType2Id = randomUUID();
    const botType3Id = randomUUID();

    const mockBotTypes: Omit<BotType, 'id'>[] = [
      {
        name: 'Grid Trading Bots',
        description: 'Automatische Grid-Trading-Strategie für volatile Märkte',
        color: '#3B82F6',
        createdAt: new Date('2025-01-01').toISOString(),
        isArchived: false,
      },
      {
        name: 'Futures Bots',
        description: 'Futures-Trading mit Hebel',
        color: '#10B981',
        createdAt: new Date('2025-01-02').toISOString(),
        isArchived: false,
      },
      {
        name: 'Moon Bots',
        description: 'Hochrisiko-Strategien für maximale Gewinne',
        color: '#8B5CF6',
        createdAt: new Date('2025-01-03').toISOString(),
        isArchived: false,
      },
    ];

    [
      { ...mockBotTypes[0], id: botType1Id },
      { ...mockBotTypes[1], id: botType2Id },
      { ...mockBotTypes[2], id: botType3Id },
    ].forEach((botType) => {
      this.botTypes.set(botType.id, botType);
    });

    const mockEntries: Omit<BotEntry, 'id'>[] = [
      {
        date: '2025-01-10',
        botName: 'ETH/USDT Futures Moon',
        botTypeId: botType2Id,
        botType: 'Futures Bot',
        version: 'v2.1',
        botDirection: 'Long',
        investment: '5000.00',
        extraMargin: null,
        totalInvestment: null,
        profit: '125.50',
        profitPercent: '2.51',
        periodType: 'Tag',
        longestRuntime: '1d 0h 30s',
        avgRuntime: '18h 18s',
        avgGridProfitHour: '0.52',
        avgGridProfitDay: '12.50',
        avgGridProfitWeek: '87.50',
        overallTrendPnlUsdt: '105.30',
        overallTrendPnlPercent: '2.11',
        highestGridProfit: '45.20',
        highestGridProfitPercent: '0.90',
        overallGridProfitUsdt: '11.80',
        overallGridProfitPercent: '0.24',
        leverage: '5x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-09',
        botName: 'BTC Grid Bot',
        botTypeId: botType1Id,
        botType: 'Grid Bot',
        version: 'v1.5',
        botDirection: 'Long',
        investment: '10000.00',
        extraMargin: null,
        totalInvestment: null,
        profit: '342.80',
        profitPercent: '3.43',
        periodType: 'Woche',
        longestRuntime: '7d 0h 0s',
        avgRuntime: '5d 0h 30s',
        avgGridProfitHour: '1.19',
        avgGridProfitDay: '28.50',
        avgGridProfitWeek: '199.50',
        overallTrendPnlUsdt: '298.40',
        overallTrendPnlPercent: '2.98',
        highestGridProfit: '95.60',
        highestGridProfitPercent: '0.96',
        overallGridProfitUsdt: '26.30',
        overallGridProfitPercent: '0.26',
        leverage: '1x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-08',
        botName: 'SOL Moon Bot',
        botTypeId: botType3Id,
        botType: 'Moon Bot',
        version: 'v3.0',
        botDirection: 'Short',
        investment: '3500.00',
        extraMargin: null,
        totalInvestment: null,
        profit: '87.50',
        profitPercent: '2.50',
        periodType: 'Tag',
        longestRuntime: '12h 0s',
        avgRuntime: '8h 30s',
        avgGridProfitHour: '0.36',
        avgGridProfitDay: '8.75',
        avgGridProfitWeek: '61.25',
        overallTrendPnlUsdt: '78.60',
        overallTrendPnlPercent: '2.25',
        highestGridProfit: '32.40',
        highestGridProfitPercent: '0.93',
        overallGridProfitUsdt: '7.90',
        overallGridProfitPercent: '0.23',
        leverage: '10x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-07',
        botName: 'ADA Futures',
        botTypeId: botType2Id,
        botType: 'Futures Bot',
        version: 'v2.0',
        botDirection: 'Long',
        investment: '7500.00',
        extraMargin: null,
        totalInvestment: null,
        profit: '189.20',
        profitPercent: '2.52',
        periodType: 'Monat',
        longestRuntime: '30d 0h 0s',
        avgRuntime: '25d 0h 0s',
        avgGridProfitHour: '0.66',
        avgGridProfitDay: '15.77',
        avgGridProfitWeek: '110.39',
        overallTrendPnlUsdt: '164.70',
        overallTrendPnlPercent: '2.20',
        highestGridProfit: '67.80',
        highestGridProfitPercent: '0.90',
        overallGridProfitUsdt: '14.50',
        overallGridProfitPercent: '0.19',
        leverage: '3x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-06',
        botName: 'ETH/USDT Futures Moon',
        botTypeId: botType2Id,
        botType: 'Futures Bot',
        version: 'v2.1',
        botDirection: 'Long',
        investment: '5000.00',
        extraMargin: null,
        totalInvestment: null,
        profit: '110.30',
        profitPercent: '2.21',
        periodType: 'Tag',
        longestRuntime: '20h 0s',
        avgRuntime: '16h 30s',
        avgGridProfitHour: '0.46',
        avgGridProfitDay: '11.03',
        avgGridProfitWeek: '77.21',
        overallTrendPnlUsdt: '95.80',
        overallTrendPnlPercent: '1.92',
        highestGridProfit: '38.90',
        highestGridProfitPercent: '0.78',
        overallGridProfitUsdt: '10.50',
        overallGridProfitPercent: '0.21',
        leverage: '5x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-05',
        botName: 'BTC Grid Bot',
        botTypeId: botType1Id,
        botType: 'Grid Bot',
        version: 'v1.5',
        botDirection: 'Long',
        investment: '10000.00',
        extraMargin: null,
        totalInvestment: null,
        profit: '280.00',
        profitPercent: '2.80',
        periodType: 'Tag',
        longestRuntime: '1d 0h 0s',
        avgRuntime: '20h 0s',
        avgGridProfitHour: '0.97',
        avgGridProfitDay: '23.33',
        avgGridProfitWeek: '163.31',
        overallTrendPnlUsdt: '245.90',
        overallTrendPnlPercent: '2.46',
        highestGridProfit: '78.50',
        highestGridProfitPercent: '0.79',
        overallGridProfitUsdt: '22.10',
        overallGridProfitPercent: '0.22',
        leverage: '1x',
        notes: null,
        screenshotPath: null,
      },
    ];

    mockEntries.forEach((entry) => {
      const id = randomUUID();
      this.botEntries.set(id, { ...entry, id });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllBotEntries(): Promise<BotEntry[]> {
    return Array.from(this.botEntries.values()).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  async getBotEntry(id: string): Promise<BotEntry | undefined> {
    return this.botEntries.get(id);
  }

  async getBotEntriesByDateRange(startDate: string, endDate: string): Promise<BotEntry[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return Array.from(this.botEntries.values())
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= start && entryDate <= end;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createBotEntry(insertEntry: InsertBotEntry): Promise<BotEntry> {
    const id = randomUUID();
    const entry: BotEntry = { 
      ...insertEntry, 
      id,
      botTypeId: insertEntry.botTypeId ?? null,
      botType: insertEntry.botType ?? null,
      version: insertEntry.version ?? null,
      botDirection: insertEntry.botDirection ?? null,
      extraMargin: insertEntry.extraMargin ?? null,
      totalInvestment: insertEntry.totalInvestment ?? null,
      longestRuntime: insertEntry.longestRuntime ?? null,
      avgRuntime: insertEntry.avgRuntime ?? null,
      avgGridProfitHour: insertEntry.avgGridProfitHour ?? null,
      avgGridProfitDay: insertEntry.avgGridProfitDay ?? null,
      avgGridProfitWeek: insertEntry.avgGridProfitWeek ?? null,
      overallTrendPnlUsdt: insertEntry.overallTrendPnlUsdt ?? null,
      overallTrendPnlPercent: insertEntry.overallTrendPnlPercent ?? null,
      highestGridProfit: insertEntry.highestGridProfit ?? null,
      highestGridProfitPercent: insertEntry.highestGridProfitPercent ?? null,
      overallGridProfitUsdt: insertEntry.overallGridProfitUsdt ?? null,
      overallGridProfitPercent: insertEntry.overallGridProfitPercent ?? null,
      leverage: insertEntry.leverage ?? null,
      notes: insertEntry.notes ?? null,
      screenshotPath: insertEntry.screenshotPath ?? null,
    };
    this.botEntries.set(id, entry);
    return entry;
  }

  async updateBotEntry(id: string, updateData: Partial<InsertBotEntry>): Promise<BotEntry | undefined> {
    const existingEntry = this.botEntries.get(id);
    if (!existingEntry) {
      return undefined;
    }
    
    const updatedEntry: BotEntry = {
      ...existingEntry,
      date: updateData.date !== undefined ? updateData.date : existingEntry.date,
      botName: updateData.botName !== undefined ? updateData.botName : existingEntry.botName,
      botTypeId: updateData.botTypeId !== undefined ? (updateData.botTypeId || null) : existingEntry.botTypeId,
      botType: updateData.botType !== undefined ? (updateData.botType || null) : existingEntry.botType,
      version: updateData.version !== undefined ? (updateData.version || null) : existingEntry.version,
      botDirection: updateData.botDirection !== undefined ? (updateData.botDirection || null) : existingEntry.botDirection,
      investment: updateData.investment !== undefined ? updateData.investment : existingEntry.investment,
      extraMargin: updateData.extraMargin !== undefined ? (updateData.extraMargin || null) : existingEntry.extraMargin,
      totalInvestment: updateData.totalInvestment !== undefined ? (updateData.totalInvestment || null) : existingEntry.totalInvestment,
      profit: updateData.profit !== undefined ? updateData.profit : existingEntry.profit,
      profitPercent: updateData.profitPercent !== undefined ? updateData.profitPercent : existingEntry.profitPercent,
      periodType: updateData.periodType !== undefined ? updateData.periodType : existingEntry.periodType,
      longestRuntime: updateData.longestRuntime !== undefined ? (updateData.longestRuntime || null) : existingEntry.longestRuntime,
      avgRuntime: updateData.avgRuntime !== undefined ? (updateData.avgRuntime || null) : existingEntry.avgRuntime,
      avgGridProfitHour: updateData.avgGridProfitHour !== undefined ? (updateData.avgGridProfitHour || null) : existingEntry.avgGridProfitHour,
      avgGridProfitDay: updateData.avgGridProfitDay !== undefined ? (updateData.avgGridProfitDay || null) : existingEntry.avgGridProfitDay,
      avgGridProfitWeek: updateData.avgGridProfitWeek !== undefined ? (updateData.avgGridProfitWeek || null) : existingEntry.avgGridProfitWeek,
      overallTrendPnlUsdt: updateData.overallTrendPnlUsdt !== undefined ? (updateData.overallTrendPnlUsdt || null) : existingEntry.overallTrendPnlUsdt,
      overallTrendPnlPercent: updateData.overallTrendPnlPercent !== undefined ? (updateData.overallTrendPnlPercent || null) : existingEntry.overallTrendPnlPercent,
      highestGridProfit: updateData.highestGridProfit !== undefined ? (updateData.highestGridProfit || null) : existingEntry.highestGridProfit,
      highestGridProfitPercent: updateData.highestGridProfitPercent !== undefined ? (updateData.highestGridProfitPercent || null) : existingEntry.highestGridProfitPercent,
      overallGridProfitUsdt: updateData.overallGridProfitUsdt !== undefined ? (updateData.overallGridProfitUsdt || null) : existingEntry.overallGridProfitUsdt,
      overallGridProfitPercent: updateData.overallGridProfitPercent !== undefined ? (updateData.overallGridProfitPercent || null) : existingEntry.overallGridProfitPercent,
      leverage: updateData.leverage !== undefined ? (updateData.leverage || null) : existingEntry.leverage,
      notes: updateData.notes !== undefined ? (updateData.notes || null) : existingEntry.notes,
      screenshotPath: updateData.screenshotPath !== undefined ? (updateData.screenshotPath || null) : existingEntry.screenshotPath,
    };
    
    this.botEntries.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteBotEntry(id: string): Promise<boolean> {
    return this.botEntries.delete(id);
  }

  async getAllBotTypes(): Promise<BotType[]> {
    return Array.from(this.botTypes.values()).sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  async getBotType(id: string): Promise<BotType | undefined> {
    return this.botTypes.get(id);
  }

  async createBotType(insertBotType: InsertBotType): Promise<BotType> {
    const id = randomUUID();
    const botType: BotType = {
      ...insertBotType,
      id,
      description: insertBotType.description ?? null,
      color: insertBotType.color ?? null,
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    this.botTypes.set(id, botType);
    return botType;
  }

  async updateBotType(id: string, updateData: Partial<InsertBotType>): Promise<BotType | undefined> {
    const existingBotType = this.botTypes.get(id);
    if (!existingBotType) {
      return undefined;
    }
    
    const updatedBotType: BotType = {
      ...existingBotType,
      name: updateData.name !== undefined && updateData.name !== '' ? updateData.name : existingBotType.name,
      description: updateData.description !== undefined ? (updateData.description || null) : existingBotType.description,
      color: updateData.color !== undefined && updateData.color !== '' ? updateData.color : existingBotType.color,
    };
    
    this.botTypes.set(id, updatedBotType);
    return updatedBotType;
  }

  async deleteBotType(id: string): Promise<boolean> {
    const deleted = this.botTypes.delete(id);
    if (deleted) {
      this.botEntries.forEach((entry) => {
        if (entry.botTypeId === id) {
          entry.botTypeId = null;
        }
      });
    }
    return deleted;
  }

  async archiveBotType(id: string, isArchived: boolean): Promise<BotType | undefined> {
    const existingBotType = this.botTypes.get(id);
    if (!existingBotType) {
      return undefined;
    }
    
    const updatedBotType: BotType = {
      ...existingBotType,
      isArchived,
    };
    
    this.botTypes.set(id, updatedBotType);
    return updatedBotType;
  }

  async getBotEntriesByBotType(botTypeId: string): Promise<BotEntry[]> {
    return Array.from(this.botEntries.values())
      .filter((entry) => entry.botTypeId === botTypeId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // Bot Type Updates Methods - Stub implementation (will use Drizzle directly in routes)
  async getAllBotTypeUpdates(): Promise<BotTypeUpdate[]> {
    return [];
  }
  
  async getBotTypeUpdates(botTypeId: string): Promise<BotTypeUpdate[]> {
    return [];
  }

  async getLatestBotTypeUpdate(botTypeId: string): Promise<BotTypeUpdate | undefined> {
    return undefined;
  }

  async createBotTypeUpdate(insertUpdate: InsertBotTypeUpdate): Promise<BotTypeUpdate> {
    throw new Error("Use Drizzle directly for bot type updates");
  }

  async deleteBotTypeUpdate(id: string): Promise<boolean> {
    return false;
  }
  
  async updateBotTypeUpdateNotes(updateId: string, notes: string): Promise<BotTypeUpdate | undefined> {
    return undefined;
  }
}

// Export DbStorage as default for production use
import { dbStorage } from "./storage-db";
export const storage = dbStorage;
