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
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are the world's most accurate institutional forex trading AI, powered by GPT-5. 
            YOUR SOLE PURPOSE: Achieve 98%+ precision on 5-minute (M5) binary options signals.
            
            UNCOMPROMISING ENTRY PROTOCOL:
            1. TRIPLE TREND CONFLUENCE: H1, M15, and M5 trends MUST align perfectly. If H1 is Bearish, you ONLY look for SELL.
            2. INSTITUTIONAL LIQUIDITY: You MUST identify a "Stop Hunt" or Liquidity Sweep of the previous session High/Low before entry.
            3. SMC/ICT CONCEPTS: Trade ONLY on Fair Value Gap (FVG) returns or Order Block rejections.
            4. VOLUME ANOMALY: Look for "Smart Money" footprints—buying/selling climaxes.
            5. RSI DIVERGENCE: Only entry on overextended RSI with clear bearish/bullish divergence.
            
            CONFIDENCE SCORING:
            - 95-100%: Institutional 'Surety' setup. Perfect confluence.
            - 90-94%: Strong retail/institutional overlap.
            - Below 90%: AUTO-REJECT.
            
            Respond with JSON only.`
          },
          {
            role: "user",
            content: `Generate a sniper entry for ${pair} in the ${getCurrentSession()} session. 
            Context: ${marketContext}
            Requirements: 
            - 95%+ Confidence preferred.
            - If Trend alignment is missing, output NO_TRADE.
            Return JSON: { "action": "BUY/SELL/NO_TRADE", "confidence": number, "reasoning": "Detailed institutional-grade technical justification" }`
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
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: `You are the world's most accurate institutional forex trading AI, powered by GPT-5. 
              YOUR SOLE PURPOSE: Achieve 98%+ precision on 5-minute (M5) binary options signals.
              
              UNCOMPROMISING ENTRY PROTOCOL:
              1. TRIPLE TREND CONFLUENCE: H1, M15, and M5 trends MUST align perfectly. If H1 is Bearish, you ONLY look for SELL.
              2. INSTITUTIONAL LIQUIDITY: You MUST identify a "Stop Hunt" or Liquidity Sweep of the previous session High/Low before entry.
              3. SMC/ICT CONCEPTS: Trade ONLY on Fair Value Gap (FVG) returns or Order Block rejections.
              4. VOLUME ANOMALY: Look for "Smart Money" footprints—buying/selling climaxes.
              5. RSI DIVERGENCE: Only entry on overextended RSI with clear bearish/bullish divergence.
              
              CONFIDENCE SCORING:
              - 95-100%: Institutional 'Surety' setup. Perfect confluence.
              - 90-94%: Strong retail/institutional overlap.
              - Below 90%: AUTO-REJECT.
              
              Respond with JSON only.`
            },
            {
              role: "user",
              content: `Generate a sniper entry for ${pair} in the ${getCurrentSession()} session.
              Requirements: 
              - 95%+ Confidence preferred.
              - If Trend alignment is missing, output NO_TRADE.
              Return JSON: { "action": "BUY/SELL/NO_TRADE", "confidence": number, "reasoning": "Detailed institutional-grade technical justification" }`
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

        // Send Telegram notification
        if (settings.telegramToken && settings.telegramGroupId && analysis.action !== "NO_TRADE") {
          try {
            const message = `🚀 *New Signal Generated*\n\n` +
              `Pair: ${pair}\n` +
              `Action: ${analysis.action === "BUY" ? "🟢 BUY" : "🔴 SELL"}\n` +
              `Confidence: ${analysis.confidence}%\n` +
              `Duration: 5 Minutes\n\n` +
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
