import { type User, type InsertUser, type BotEntry, type InsertBotEntry, type BotType, type InsertBotType } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllBotTypes(): Promise<BotType[]>;
  getBotType(id: string): Promise<BotType | undefined>;
  createBotType(botType: InsertBotType): Promise<BotType>;
  deleteBotType(id: string): Promise<boolean>;
  
  getAllBotEntries(): Promise<BotEntry[]>;
  getBotEntry(id: string): Promise<BotEntry | undefined>;
  getBotEntriesByDateRange(startDate: string, endDate: string): Promise<BotEntry[]>;
  getBotEntriesByBotType(botTypeId: string): Promise<BotEntry[]>;
  createBotEntry(entry: InsertBotEntry): Promise<BotEntry>;
  deleteBotEntry(id: string): Promise<boolean>;
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
      },
      {
        name: 'Futures Bots',
        description: 'Futures-Trading mit Hebel',
        color: '#10B981',
        createdAt: new Date('2025-01-02').toISOString(),
      },
      {
        name: 'Moon Bots',
        description: 'Hochrisiko-Strategien für maximale Gewinne',
        color: '#8B5CF6',
        createdAt: new Date('2025-01-03').toISOString(),
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
        botDirection: 'Long',
        investment: '5000.00',
        profit: '125.50',
        profitPercent: '2.51',
        periodType: 'Tag',
        longestRuntime: '24.50',
        avgRuntime: '18.30',
        avgGridProfit: '12.50',
        highestGridProfit: '45.20',
        highestGridProfitPercent: '0.90',
        overallAvgGridProfit: '11.80',
        leverage: '5x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-09',
        botName: 'BTC Grid Bot',
        botTypeId: botType1Id,
        botDirection: 'Long',
        investment: '10000.00',
        profit: '342.80',
        profitPercent: '3.43',
        periodType: 'Woche',
        longestRuntime: '168.00',
        avgRuntime: '120.50',
        avgGridProfit: '28.50',
        highestGridProfit: '95.60',
        highestGridProfitPercent: '0.96',
        overallAvgGridProfit: '26.30',
        leverage: '1x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-08',
        botName: 'SOL Moon Bot',
        botTypeId: botType3Id,
        botDirection: 'Short',
        investment: '3500.00',
        profit: '87.50',
        profitPercent: '2.50',
        periodType: 'Tag',
        longestRuntime: '12.00',
        avgRuntime: '8.50',
        avgGridProfit: '8.75',
        highestGridProfit: '32.40',
        highestGridProfitPercent: '0.93',
        overallAvgGridProfit: '7.90',
        leverage: '10x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-07',
        botName: 'ADA Futures',
        botTypeId: botType2Id,
        botDirection: 'Long',
        investment: '7500.00',
        profit: '189.20',
        profitPercent: '2.52',
        periodType: 'Monat',
        longestRuntime: '720.00',
        avgRuntime: '600.00',
        avgGridProfit: '15.77',
        highestGridProfit: '67.80',
        highestGridProfitPercent: '0.90',
        overallAvgGridProfit: '14.50',
        leverage: '3x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-06',
        botName: 'ETH/USDT Futures Moon',
        botTypeId: botType2Id,
        botDirection: 'Long',
        investment: '5000.00',
        profit: '110.30',
        profitPercent: '2.21',
        periodType: 'Tag',
        longestRuntime: '20.00',
        avgRuntime: '16.50',
        avgGridProfit: '11.03',
        highestGridProfit: '38.90',
        highestGridProfitPercent: '0.78',
        overallAvgGridProfit: '10.50',
        leverage: '5x',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-05',
        botName: 'BTC Grid Bot',
        botTypeId: botType1Id,
        botDirection: 'Long',
        investment: '10000.00',
        profit: '280.00',
        profitPercent: '2.80',
        periodType: 'Tag',
        longestRuntime: '24.00',
        avgRuntime: '20.00',
        avgGridProfit: '23.33',
        highestGridProfit: '78.50',
        highestGridProfitPercent: '0.79',
        overallAvgGridProfit: '22.10',
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
      botDirection: insertEntry.botDirection ?? null,
      longestRuntime: insertEntry.longestRuntime ?? null,
      avgRuntime: insertEntry.avgRuntime ?? null,
      avgGridProfit: insertEntry.avgGridProfit ?? null,
      highestGridProfit: insertEntry.highestGridProfit ?? null,
      highestGridProfitPercent: insertEntry.highestGridProfitPercent ?? null,
      overallAvgGridProfit: insertEntry.overallAvgGridProfit ?? null,
      leverage: insertEntry.leverage ?? null,
      notes: insertEntry.notes ?? null,
      screenshotPath: insertEntry.screenshotPath ?? null,
    };
    this.botEntries.set(id, entry);
    return entry;
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
    };
    this.botTypes.set(id, botType);
    return botType;
  }

  async deleteBotType(id: string): Promise<boolean> {
    return this.botTypes.delete(id);
  }

  async getBotEntriesByBotType(botTypeId: string): Promise<BotEntry[]> {
    return Array.from(this.botEntries.values())
      .filter((entry) => entry.botTypeId === botTypeId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export const storage = new MemStorage();
