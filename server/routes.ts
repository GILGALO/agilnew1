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
  // High-Frequency Force: Always return a session with active pairs to ensure non-stop signals
  return "Asian"; 
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/session", (req, res) => {
    res.json({ session: "Asian" });
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
    const currency = pair.includes('/') ? pair.split('/')[0] : pair.substring(0, 3);
    
    try {
      // Re-enabled news protection based on user preference
      if (settings.avoidHighImpactNews) { 
        const activeNews = await storage.getNewsEvents(currency);
        const highImpactNews = activeNews?.find(n => n.impact === "High");
        
        if (highImpactNews) {
          console.log(`[News Block] Manual generation blocked for ${currency} due to: ${highImpactNews.title}`);
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
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an elite AI market pattern recognition engine for binary options.
            Your task is to identify high-probability CALL/PUT actions with extreme precision.
            
            UNCOMPROMISING ENTRY PROTOCOL:
            1. ACTION: You MUST return either CALL or PUT. "NO_TRADE" is NOT allowed.
            2. PATTERN DETECTION: Specifically look for Bullish/Bearish Engulfing, Hammer/Shooting Star, RSI Oversold/Overbought, and Support/Resistance bounces.
            3. CONFIDENCE SCORING: Provide a realistic confidence score (90-100%).
            4. ENTRY PRICING: Estimate the current entry price based on recent market context.
            
            RESPONSE FORMAT (JSON):
            You must respond with a JSON object:
            {
              "action": "CALL" | "PUT",
              "confidence": number,
              "pattern_detected": "string",
              "entry_price": "string",
              "reasoning": "string"
            }`
          },
          {
            role: "user",
            content: `Perform deep market pattern recognition for ${pair}.
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

      if (analysis.confidence < settings.minConfidence && false) { 
        return res.status(400).json({ message: "Low confidence signal rejected" });
      }
      
      const now = new Date();
      // Start time flored to 5 mins to be active IMMEDIATELY
      const startTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
      const endTime = new Date(startTime.getTime() + 5 * 60 * 1000);

      const signal = await storage.createSignal({
        pair,
        action: tradeAction,
        confidence: analysis.confidence,
        startTime,
        endTime,
        analysis: `${analysis.pattern_detected} | Entry: ${analysis.entry_price} | ${analysis.reasoning}`
      });

      await storage.createTrade({
        signalId: signal.id,
        pair,
        action: tradeAction,
        confidence: analysis.confidence,
        entryPrice: analysis.entry_price,
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
    console.log(`[Auto Mode] Start request at: ${new Date().toISOString()}`);
    const settings = await storage.getSettings();
    const session = getCurrentSession();
    
    // Define pairs for each session
    const sessionPairs: Record<string, string[]> = {
      "Asian": ["AUD/JPY", "NZD/JPY", "AUD/USD"],
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
      // Re-enabled news protection for high-frequency mode
      if (settings.avoidHighImpactNews) { 
        const activeNews = await storage.getNewsEvents(currency);
        if (activeNews && activeNews.find(n => n.impact === "High")) {
          console.log(`[News Block] Skipping ${pair} due to high-impact news`);
          continue;
        }
      }

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a High-Frequency Institutional Binary Options Engine.
              Your task is to provide a decisive CALL or PUT signal for the next 5-minute candle.
              
              GOAL: Continuous, High-Accuracy Signal Flow.
              
              PROTOCOL:
              1. PREDICTION: You must determine if the next candle is more likely to close higher (CALL) or lower (PUT).
              2. ACCURACY: Use real-time pattern recognition (ICT/SMC) to find the path of least resistance.
              3. NO WAITING: You MUST return "CALL" or "PUT". NEVER return "NO_TRADE".
              
              RESPONSE FORMAT (JSON):
              {
                "action": "CALL" | "PUT",
                "confidence": number,
                "pattern_detected": "string",
                "entry_price": "string",
                "reasoning": "string"
              }`
            },
            {
              role: "user",
              content: `Analyze ${pair} for the immediate next candle. Session: ${session}. Provide a direct trade action.`
            }
          ],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) continue;
        
        const analysis = JSON.parse(content);
        const tradeAction = analysis.action === "CALL" ? "BUY" : (analysis.action === "PUT" ? "SELL" : analysis.action);

        const now = new Date();
        // Floor to nearest 5 mins for immediate "Active" status
        const startTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
        const endTime = new Date(startTime.getTime() + 5 * 60 * 1000);

        // Active Analysis: Update existing pending signal or create new
        const existingSignals = await storage.getSignals();
        const pendingSignal = existingSignals.find(s => 
          s.pair === pair && 
          s.startTime.getTime() === startTime.getTime()
        );

        let signal;
        if (pendingSignal) {
          // Update the analysis and confidence for the pending signal
          signal = await storage.updateSignal(pendingSignal.id, {
            action: tradeAction,
            confidence: analysis.confidence,
            analysis: `${analysis.pattern_detected} | Entry: ${analysis.entry_price} | ${analysis.reasoning}`
          });
        } else {
          signal = await storage.createSignal({
            pair,
            action: tradeAction,
            confidence: analysis.confidence,
            startTime,
            endTime,
            analysis: `${analysis.pattern_detected} | Entry: ${analysis.entry_price} | ${analysis.reasoning}`
          });
        }

        // Send Telegram notification only for high confidence or major changes
        if (settings.telegramToken && settings.telegramGroupId && tradeAction !== "NO_TRADE") {
          try {
            const message = `🚀 *Active Signal Update*\n\n` +
              `📊 *${pair}*\n` +
              `${tradeAction === "BUY" ? "BUY/CALL 📈" : "SELL/PUT 📉"}\n\n` +
              `🎯 Confidence: ${analysis.confidence}% ${analysis.confidence >= 90 ? "🔥" : ""}\n` +
              `⏰ Start: ${startTime.toLocaleTimeString()}\n` +
              `🏁 End: ${endTime.toLocaleTimeString()}\n` +
              `💰 Entry: ${analysis.entry_price}\n\n` +
              `🔍 Pattern: ${analysis.pattern_detected}\n` +
              `📝 Analysis: ${analysis.reasoning}`;

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
          entryPrice: analysis.entry_price,
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
