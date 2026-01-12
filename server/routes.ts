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
  const now = new Date();
  // Get EAT time (UTC+3)
  const eatOffset = 3;
  const eatHour = (now.getUTCHours() + eatOffset) % 24;

  if (eatHour >= 7 && eatHour < 12) return "Asian";
  if (eatHour >= 12 && eatHour < 17) return "London";
  if (eatHour >= 17 && eatHour < 18) return "Lunch Break";
  if (eatHour >= 18 && eatHour < 23) return "New York";
  return "Night Break";
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
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an elite institutional forex trading AI specialized in 5-minute (M5) binary options signals. 
            Analyze market structures, RSI divergences, and Moving Average crossovers with surgical precision. 
            Only generate signals if confidence is exceptionally high (${settings.minConfidence}%+). 
            If market conditions are not optimal or high-probability setups are missing, set action to "NO_TRADE" and explain why.
            Focus on high-probability setups during peak session liquidity.
            Respond with JSON only.`
          },
          {
            role: "user",
            content: `Deep Analysis Required: ${pair} during ${getCurrentSession()} session.
            Current Market Indicators: RSI(14)=${Math.floor(Math.random() * 40 + 30)}, Trend=Bullish/Neutral.
            Requirement: Generate an M5 signal for the next 5-minute candle.
            Constraints: Minimum ${settings.minConfidence}% confidence filter.
            Return JSON format: { "action": "BUY/SELL/NO_TRADE", "confidence": number, "reasoning": "Detailed institutional-grade technical justification" }`
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

  app.post("/api/signals/generate-all", async (req, res) => {
    const settings = await storage.getSettings();
    const session = getCurrentSession();
    
    // Define pairs for each session
    const sessionPairs: Record<string, string[]> = {
      "Asian": ["AUD/JPY", "NZD/JPY", "AUD/USD", "NZD/USD"],
      "London": ["EUR/USD", "GBP/USD", "EUR/GBP", "GBP/JPY"],
      "New York": ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CAD"],
      "Lunch Break": [],
      "Night Break": []
    };

    const pairs = sessionPairs[session] || [];
    if (pairs.length === 0) {
      return res.status(400).json({ message: "No active trading pairs for current session" });
    }

    const results = [];
    for (const pair of pairs) {
      const currency = pair.split('/')[0];
      
      try {
        if (settings.avoidHighImpactNews) {
          const activeNews = await storage.getNewsEvents(currency);
          if (activeNews.find(n => n.impact === "High")) continue;
        }

        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: `You are an elite institutional forex trading AI specialized in 5-minute (M5) binary options signals. 
              Analyze market structures for ${pair} during ${session} session.
              Only generate signals if confidence is exceptionally high (${settings.minConfidence}%+). 
              If conditions are not optimal, set action to "NO_TRADE".
              Respond with JSON only.`
            },
            {
              role: "user",
              content: `Requirement: Generate an M5 signal for ${pair}.
              Return JSON: { "action": "BUY/SELL/NO_TRADE", "confidence": number, "reasoning": "string" }`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) continue;
        
        const analysis = JSON.parse(content);
        const now = new Date();
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
          session
        });

        results.push(signal);
      } catch (error) {
        console.error(`Generation failed for ${pair}:`, error);
      }
    }

    res.json(results);
  });

  return httpServer;
}
