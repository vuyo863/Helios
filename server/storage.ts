import { type User, type InsertUser, type BotEntry, type InsertBotEntry } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllBotEntries(): Promise<BotEntry[]>;
  getBotEntry(id: string): Promise<BotEntry | undefined>;
  getBotEntriesByDateRange(startDate: string, endDate: string): Promise<BotEntry[]>;
  createBotEntry(entry: InsertBotEntry): Promise<BotEntry>;
  deleteBotEntry(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private botEntries: Map<string, BotEntry>;

  constructor() {
    this.users = new Map();
    this.botEntries = new Map();
    this.seedMockData();
  }

  private seedMockData() {
    const mockEntries: Omit<BotEntry, 'id'>[] = [
      {
        date: '2025-01-10',
        botName: 'ETH/USDT Futures Moon',
        investment: '5000.00',
        profit: '125.50',
        profitPercent: '2.51',
        periodType: 'Tag',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-09',
        botName: 'BTC Grid Bot',
        investment: '10000.00',
        profit: '342.80',
        profitPercent: '3.43',
        periodType: 'Woche',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-08',
        botName: 'SOL Moon Bot',
        investment: '3500.00',
        profit: '87.50',
        profitPercent: '2.50',
        periodType: 'Tag',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-07',
        botName: 'ADA Futures',
        investment: '7500.00',
        profit: '189.20',
        profitPercent: '2.52',
        periodType: 'Monat',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-06',
        botName: 'ETH/USDT Futures Moon',
        investment: '5000.00',
        profit: '110.30',
        profitPercent: '2.21',
        periodType: 'Tag',
        notes: null,
        screenshotPath: null,
      },
      {
        date: '2025-01-05',
        botName: 'BTC Grid Bot',
        investment: '10000.00',
        profit: '280.00',
        profitPercent: '2.80',
        periodType: 'Tag',
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
      notes: insertEntry.notes ?? null,
      screenshotPath: insertEntry.screenshotPath ?? null,
    };
    this.botEntries.set(id, entry);
    return entry;
  }

  async deleteBotEntry(id: string): Promise<boolean> {
    return this.botEntries.delete(id);
  }
}

export const storage = new MemStorage();
