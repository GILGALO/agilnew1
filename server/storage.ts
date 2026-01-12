import { db } from "./db";
import {
  signals,
  tradeHistory,
  settings,
  newsEvents,
  type Signal,
  type InsertSignal,
  type Trade,
  type InsertTrade,
  type Settings,
  type InsertSettings,
  type NewsEvent,
  type InsertNewsEvent,
} from "@shared/schema";
import { eq, desc, gte, lte, and } from "drizzle-orm";

export interface IStorage {
  getSignals(): Promise<Signal[]>;
  createSignal(signal: InsertSignal): Promise<Signal>;
  getSignal(id: number): Promise<Signal | undefined>;
  getTradeHistory(): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  updateSignal(id: number, update: Partial<Signal>): Promise<Signal>;
  getNewsEvents(currency?: string): Promise<NewsEvent[]>;
  createNewsEvent(news: InsertNewsEvent): Promise<NewsEvent>;
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

  async updateSignal(id: number, update: Partial<Signal>): Promise<Signal> {
    const [updated] = await db.update(signals).set(update).where(eq(signals.id, id)).returning();
    return updated;
  }

  async getNewsEvents(currency?: string): Promise<NewsEvent[]> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursFuture = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    if (currency) {
      return await db.select().from(newsEvents)
        .where(and(
          eq(newsEvents.currency, currency),
          gte(newsEvents.timestamp, oneHourAgo),
          lte(newsEvents.timestamp, twoHoursFuture)
        ))
        .orderBy(newsEvents.timestamp);
    }
    
    return await db.select().from(newsEvents)
      .where(and(
        gte(newsEvents.timestamp, oneHourAgo),
        lte(newsEvents.timestamp, twoHoursFuture)
      ))
      .orderBy(newsEvents.timestamp);
  }

  async createNewsEvent(news: InsertNewsEvent): Promise<NewsEvent> {
    const [event] = await db.insert(newsEvents).values(news).returning();
    return event;
  }
}

export const storage = new DatabaseStorage();
