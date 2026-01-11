import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  pair: text("pair").notNull(),
  action: text("action").notNull(), // BUY, SELL, CALL, PUT
  confidence: integer("confidence").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("active"), // active, completed
  analysis: text("analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tradeHistory = pgTable("trade_history", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").references(() => signals.id),
  pair: text("pair").notNull(),
  action: text("action").notNull(),
  entryPrice: text("entry_price"),
  exitPrice: text("exit_price"),
  result: text("result"), // win, loss
  confidence: integer("confidence").notNull(),
  session: text("session").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  telegramToken: text("telegram_token"),
  telegramGroupId: text("telegram_group_id"),
  minConfidence: integer("min_confidence").default(90).notNull(),
  autoTrading: boolean("auto_trading").default(false).notNull(),
  avoidHighImpactNews: boolean("avoid_high_impact_news").default(true).notNull(),
});

export const newsEvents = pgTable("news_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  impact: text("impact").notNull(), // High, Medium, Low
  currency: text("currency").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSignalSchema = createInsertSchema(signals).omit({ 
  id: true, 
  createdAt: true,
  status: true 
});

export const insertTradeSchema = createInsertSchema(tradeHistory).omit({ id: true, timestamp: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });
export const insertNewsSchema = createInsertSchema(newsEvents).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Trade = typeof tradeHistory.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type NewsEvent = typeof newsEvents.$inferSelect;
export type InsertNewsEvent = z.infer<typeof insertNewsSchema>;

export type CreateSignalRequest = InsertSignal;
export type UpdateSignalRequest = Partial<InsertSignal>;

// Response types
export type SignalResponse = Signal;
export type SignalsListResponse = Signal[];

// AI Analysis Request
export interface AnalysisRequest {
  pair: string;
}

// AI Analysis Response
export interface AnalysisResponse {
  pair: string;
  action: "BUY" | "SELL";
  confidence: number;
  reasoning: string;
}
