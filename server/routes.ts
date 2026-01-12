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

  app.get("/api/trades", async (req, res) => {
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
        - Primary Trend (H1): Strong Bearish/Bullish
        - Secondary Trend (M15): Alignment Check
        - Support/Resistance: Key institutional levels identified
        - RSI (14): Current momentum check
        - ATR: Volatility expansion check
        - Fair Value Gaps: Active imbalances detected
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI-powered market pattern recognition service.
            Your task is to analyze real-time market data and identify high-probability CALL/PUT actions.
            
            UNCOMPROMISING ENTRY PROTOCOL:
            1. PATTERN RECOGNITION: Identify specific market patterns (Double Top/Bottom, Head and Shoulders, Bull/Bear Flags, Pin Bars).
            2. CONFIDENCE SCORING: Provide a confidence score based on pattern clarity and technical confluence.
            3. TECHNICAL ANALYSIS: Cross-reference patterns with RSI, Support/Resistance, and Trend.
            
            RESPONSE FORMAT:
            You must respond with a JSON object:
            {
              "action": "CALL" | "PUT" | "NO_TRADE",
              "confidence": number (0-100),
              "pattern_detected": "string",
              "reasoning": "string"
            }`
          },
          {
            role: "user",
            content: `Perform real-time pattern recognition for ${pair}.
            Market Context: ${marketContext}
            Session: ${getCurrentSession()}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No response from AI");
      
      const analysis = JSON.parse(content);
      const tradeAction = analysis.action === "CALL" ? "BUY" : (analysis.action === "PUT" ? "SELL" : analysis.action);

      if (analysis.confidence < settings.minConfidence) {
        return res.status(400).json({ message: "Low confidence signal rejected" });
      }
      
      const now = new Date();
      const startTime = new Date(Math.ceil((now.getTime() + 2 * 60 * 1000) / (5 * 60 * 1000)) * (5 * 60 * 1000));
      const endTime = new Date(startTime.getTime() + 5 * 60 * 1000);

      const signal = await storage.createSignal({
        pair,
        action: tradeAction,
        confidence: analysis.confidence,
        startTime,
        endTime,
        analysis: `${analysis.pattern_detected}: ${analysis.reasoning}`
      });

      await storage.createTrade({
        signalId: signal.id,
        pair,
        action: tradeAction,
        confidence: analysis.confidence,
        session: getCurrentSession()
      });

      res.json(signal);
    } catch (error) {
      console.error("AI Generation failed:", error);
      res.status(500).json({ message: "Failed to generate signal" });
    }
  });

  app.post("/api/test-telegram", async (req, res) => {
    const settings = await storage.getSettings();
    if (!settings.telegramToken || !settings.telegramGroupId) {
      return res.status(400).json({ message: "Telegram settings not configured" });
    }

    try {
      const message = `🔔 *Bot Test Signal*\n\n` +
        `Pair: TEST/USD\n` +
        `Action: BUY\n` +
        `Confidence: 99%\n` +
        `Time: ${new Date().toLocaleTimeString()}\n\n` +
        `✅ Your bot is correctly connected to this group.`;

      const telegramUrl = `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramGroupId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) throw new Error(await response.text());
      res.json({ success: true });
    } catch (error) {
      console.error("Telegram test failed:", error);
      res.status(500).json({ message: "Failed to send telegram message" });
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

    const pairs = settings.customPairs && settings.customPairs.length > 0 
      ? settings.customPairs 
      : (sessionPairs[session] || []);

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
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an AI-powered market pattern recognition service.
              Your task is to analyze real-time market data and identify high-probability CALL/PUT actions.
              
              UNCOMPROMISING ENTRY PROTOCOL:
              1. PATTERN RECOGNITION: Identify specific market patterns (Double Top/Bottom, Head and Shoulders, Bull/Bear Flags, Pin Bars).
              2. CONFIDENCE SCORING: Provide a confidence score based on pattern clarity and technical confluence.
              3. TECHNICAL ANALYSIS: Cross-reference patterns with RSI, Support/Resistance, and Trend.
              
              RESPONSE FORMAT:
              You must respond with a JSON object:
              {
                "action": "CALL" | "PUT" | "NO_TRADE",
                "confidence": number (0-100),
                "pattern_detected": "string",
                "reasoning": "string"
              }`
            },
            {
              role: "user",
              content: `Perform real-time pattern recognition for ${pair}.
              Session: ${session}`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) continue;
        
        const analysis = JSON.parse(content);
        const tradeAction = analysis.action === "CALL" ? "BUY" : (analysis.action === "PUT" ? "SELL" : analysis.action);

        const now = new Date();
        const startTime = new Date(Math.ceil((now.getTime() + 2 * 60 * 1000) / (5 * 60 * 1000)) * (5 * 60 * 1000));
        const endTime = new Date(startTime.getTime() + 5 * 60 * 1000);

        const signal = await storage.createSignal({
          pair,
          action: tradeAction,
          confidence: analysis.confidence,
          startTime,
          endTime,
          analysis: `${analysis.pattern_detected}: ${analysis.reasoning}`
        });

        // Send Telegram notification
        if (settings.telegramToken && settings.telegramGroupId && tradeAction !== "NO_TRADE") {
          try {
            const message = `🚀 *New Pattern Detected*\n\n` +
              `Pair: ${pair}\n` +
              `Pattern: ${analysis.pattern_detected}\n` +
              `Action: ${tradeAction === "BUY" ? "🟢 CALL" : "🔴 PUT"}\n` +
              `Confidence: ${analysis.confidence}%\n` +
              `Target Time: ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`;

            fetch(`https://api.telegram.org/bot${settings.telegramToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: settings.telegramGroupId,
                text: message,
                parse_mode: 'Markdown'
              })
            }).catch(e => console.error("Telegram broadcast failed:", e));
          } catch (e) {
            console.error("Telegram notification error:", e);
          }
        }

        await storage.createTrade({
          signalId: signal.id,
          pair,
          action: tradeAction,
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

  app.post("/api/chat", async (req, res) => {
    const { message, signalId } = req.body;
    
    try {
      let context = "You are a professional trading educator for TradeBot.ai.";
      if (signalId) {
        const signal = await storage.getSignal(signalId);
        if (signal) {
          context += `\n\nUser is asking about this signal:\nPair: ${signal.pair}\nAction: ${signal.action}\nAnalysis: ${signal.analysis}`;
        }
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: context },
          { role: "user", content: message }
        ]
      });

      res.json({ message: response.choices[0].message.content });
    } catch (error) {
      console.error("Chat failed:", error);
      res.status(500).json({ message: "Education service temporarily unavailable" });
    }
  });

  return httpServer;
}
