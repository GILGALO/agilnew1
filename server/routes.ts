import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI client - Replit handles the key automatically
const openai = new OpenAI({ 
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed initial data if empty
  const existingSignals = await storage.getSignals();
  if (existingSignals.length === 0) {
    const now = new Date();
    // Create a few past signals
    await storage.createSignal({
      pair: "AUD/JPY",
      action: "BUY",
      confidence: 95,
      startTime: new Date(now.getTime() - 15 * 60000),
      endTime: new Date(now.getTime() - 10 * 60000),
      status: "completed",
      analysis: "Strong bullish momentum on M5, RSI oversold bounce."
    });
    
    // Create an active signal
    await storage.createSignal({
      pair: "EUR/USD",
      action: "SELL",
      confidence: 88,
      startTime: new Date(now.getTime()),
      endTime: new Date(now.getTime() + 5 * 60000),
      status: "active",
      analysis: "Bearish divergence on MACD, resistance at 1.0850."
    });
  }

  app.get(api.signals.list.path, async (req, res) => {
    const signals = await storage.getSignals();
    res.json(signals);
  });

  app.post(api.signals.create.path, async (req, res) => {
    try {
      const input = api.signals.create.input.parse(req.body);
      const signal = await storage.createSignal(input);
      res.status(201).json(signal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.signals.generate.path, async (req, res) => {
    const { pair } = req.body;
    
    try {
      // Mock market data context - in a real app, fetch from an API
      const marketContext = `
        Current ${pair} market analysis:
        - Short term trend: Bullish
        - RSI (14): 65
        - Moving Averages: Price above MA50 and MA200
        - Recent volume: High
        - Support levels holding strong
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert forex trading AI. Analyze the provided market context and generate a trading signal for a 5-minute (M5) timeframe. Respond with JSON only."
          },
          {
            role: "user",
            content: `Analyze ${pair} for the next 5 minutes based on this context: ${marketContext}. 
            Generate a signal with:
            - Action (BUY or SELL)
            - Confidence (0-100)
            - Reasoning
            
            Return JSON format: { "action": "BUY/SELL", "confidence": number, "reasoning": "string" }`
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from AI");
      
      const analysis = JSON.parse(content);
      
      const now = new Date();
      // Round up to next 5 minute block for start
      const startTime = new Date(Math.ceil(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
      const endTime = new Date(startTime.getTime() + 5 * 60 * 1000); // Add 5 minutes

      const signal = await storage.createSignal({
        pair,
        action: analysis.action,
        confidence: analysis.confidence,
        startTime,
        endTime,
        analysis: analysis.reasoning
      });

      res.json(signal);
    } catch (error) {
      console.error("AI Generation failed:", error);
      res.status(500).json({ message: "Failed to generate signal" });
    }
  });

  app.get(api.signals.get.path, async (req, res) => {
    const signal = await storage.getSignal(Number(req.params.id));
    if (!signal) {
      return res.status(404).json({ message: 'Signal not found' });
    }
    res.json(signal);
  });

  return httpServer;
}
