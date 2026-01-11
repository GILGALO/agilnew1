import { db } from "./db";
import {
  signals,
  tradeHistory,
  settings,
  type Signal,
  type InsertSignal,
  type Trade,
  type InsertTrade,
  type Settings,
  type InsertSettings,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getSignals(): Promise<Signal[]>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  getSignal(id: number): Promise<Signal | undefined>;
  getTradeHistory(): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async getSignals(): Promise<Signal[]> {
    return await db.select().from(signals).orderBy(desc(signals.createdAt));
  }

  async createSignal(insertSignal: InsertSignal): Promise<Signal> {
    const [signal] = await db
      .insert(signals)
      .values(insertSignal)
      .returning();
    return signal;
  }

  async getSignal(id: number): Promise<Signal | undefined> {
    const [signal] = await db.select().from(signals).where(eq(signals.id, id));
    return signal;
  }

  async getTradeHistory(): Promise<Trade[]> {
    return await db.select().from(tradeHistory).orderBy(desc(tradeHistory.timestamp));
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db.insert(tradeHistory).values(insertTrade).returning();
    return trade;
  }

  async getSettings(): Promise<Settings> {
    const [s] = await db.select().from(settings);
    if (!s) {
      const [newSettings] = await db.insert(settings).values({}).returning();
      return newSettings;
    }
    return s;
  }

  async updateSettings(update: Partial<InsertSettings>): Promise<Settings> {
    const s = await this.getSettings();
    const [updated] = await db.update(settings).set(update).where(eq(settings.id, s.id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
