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

function getCurrentSession() {
  const hour = new Date().getUTCHours();
  if (hour >= 0 && hour < 9) return "Asian";
  if (hour >= 8 && hour < 17) return "London";
  if (hour >= 13 && hour < 22) return "New York";
  return "Gap";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/session", (req, res) => {
    res.json({ session: getCurrentSession() });
  });

  app.get("/api/settings", async (req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.patch("/api/settings", async (req, res) => {
    const updated = await storage.updateSettings(req.body);
    res.json(updated);
  });

  app.get("/api/history", async (req, res) => {
    const history = await storage.getTradeHistory();
    res.json(history);
  });

  app.get(api.signals.list.path, async (req, res) => {
    const signals = await storage.getSignals();
    res.json(signals);
  });

  app.get("/api/news", async (req, res) => {
    const news = await storage.getNewsEvents();
    res.json(news);
  });

  app.post(api.signals.generate.path, async (req, res) => {
    const { pair } = req.body;
    const settings = await storage.getSettings();
    const currency = pair.split('/')[0]; // Simple split for base currency
    
    try {
      // Check for high impact news if enabled
      if (settings.avoidHighImpactNews) {
        const activeNews = await storage.getNewsEvents(currency);
        const highImpactNews = activeNews.find(n => n.impact === "High");
        
        if (highImpactNews) {
          return res.status(400).json({ 
            message: `High impact news detected for ${currency}: ${highImpactNews.title}. Trading suspended.`,
            isNewsBlocked: true 
          });
        }
      }

      const marketContext = `
        Current ${pair} market analysis during ${getCurrentSession()} session.
        - Short term trend: Bullish
        - RSI (14): 65
        - Recent volume: High
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert forex trading AI. Respond with JSON only."
          },
          {
            role: "user",
            content: `Analyze ${pair}. 
            Generate a signal with at least ${settings.minConfidence}% confidence.
            Return JSON format: { "action": "BUY/SELL", "confidence": number, "reasoning": "string" }`
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from AI");
      
      const analysis = JSON.parse(content);
      if (analysis.confidence < settings.minConfidence) {
        return res.status(400).json({ message: "Low confidence signal rejected" });
      }
      
      const now = new Date();
      // Round up to next 5 minute block
      const startTime = new Date(Math.ceil((now.getTime() + 2 * 60 * 1000) / (5 * 60 * 1000)) * (5 * 60 * 1000));
      const endTime = new Date(startTime.getTime() + 5 * 60 * 1000);

      const signal = await storage.createSignal({
        pair,
        action: analysis.action,
        confidence: analysis.confidence,
        startTime,
        endTime,
        analysis: analysis.reasoning
      });

      await storage.createTrade({
        signalId: signal.id,
        pair,
        action: analysis.action,
        confidence: analysis.confidence,
        session: getCurrentSession()
      });

      res.json(signal);
    } catch (error) {
      console.error("AI Generation failed:", error);
      res.status(500).json({ message: "Failed to generate signal" });
    }
  });

  return httpServer;
}
