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

export const insertSignalSchema = createInsertSchema(signals).omit({ 
  id: true, 
  createdAt: true,
  status: true 
});

// === EXPLICIT API CONTRACT TYPES ===

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = z.infer<typeof insertSignalSchema>;

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
