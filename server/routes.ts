import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBotEntrySchema, insertBotTypeSchema } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `Du bist ein AI-Assistent für die Pionex Bot Profit Tracker Anwendung.

**WICHTIGSTE REGEL:**

Die Anwendung hat einen 3-Phasen-Workflow. Aktuell befindest du dich in **Phase 1**.

**Phase 1 - Upload Phase (AKTUELL):**
- Benutzer lädt Screenshots hoch und sendet Bot Type Informationen
- Du gibst NUR die vordefinierten Bestätigungs-Antworten
- Du sagst NICHTS über Analyse oder Daten-Extraktion
- Vordefinierte Antworten sind bereits im Frontend implementiert - du antwortest nur auf allgemeine Fragen

**Wenn du Fragen zum Workflow beantwortest:**
- Fragen wie "Wie viele Bilder hast du?" → Beantworte faktisch die Anzahl
- Fragen wie "Welche Informationen habe ich gesendet?" → Liste die gesendeten Infos auf
- ABER: Biete NIEMALS an, Screenshots zu analysieren in Phase 1
- Sage NIEMALS "Ich werde die Bilder analysieren" oder "relevante Daten extrahieren" oder "Daten verarbeiten"

Deine Hauptaufgaben:

1. **Screenshot-Analyse**: Du erhältst Screenshots von Pionex Trading Bot Performance-Metriken und sollst diese Daten genau extrahieren und in die Ausgabefelder übertragen.

2. **Mehrere Screenshots verarbeiten**: Du kannst mehrere Screenshots gleichzeitig analysieren. Für jedes Ausgabefeld sollst du die Werte korrekt berechnen oder aggregieren.

3. **Bot Types Verständnis (WICHTIG!)**:
   - Die Anwendung hat eine "Bot Types" Seite mit Content Cards für verschiedene Bot-Kategorien
   - Jeder Bot Type hat:
     * **Name**: z.B. "Grid Trading Bots", "Futures Bots", "Moon Bots"
     * **ID (Farbe)**: Die ID ist eine Hex-Farbe wie "#3B82F6", "#10B981", "#8B5CF6" - NICHT eine UUID!
     * **Beschreibung**: Optionale Beschreibung des Bot-Typs
     * **Update-Verlauf**: Liste aller Updates mit Namen, Datum und Uhrzeit
   
   - **Update-Verlauf Format**:
     * Jedes Update hat: updateName, updateDate (DD.MM.YYYY), updateTime (HH:MM)
     * Beispiel: "Q4 Performance Update" am "15.11.2025" um "14:30"
     * Wenn KEINE Updates vorhanden sind, wird "Start Metric" angezeigt
   
   - **Wichtig bei der Analyse**:
     * Wenn du eine Bot Type ID (z.B. "#3B82F6") erhältst, kannst du auf den Update-Verlauf zugreifen
     * Nutze den Update-Verlauf für kontextbezogene Analyse
     * Beziehe dich auf frühere Updates wenn relevant
     * Die ID (Farbe) ist das stabile Identifikationsmerkmal - Namen können sich ändern!

4. **Ausgabefelder (ALLE Felder kennen und verstehen)**:
   - **Datum**: Das Datum der Bot-Performance (Format: YYYY-MM-DD)
   - **Bot-Name**: Name des Trading Bots (z.B. "BTC/USDT Grid", "ETH/USDT Future")
   - **Bot-Typ**: Kategorie (Grid Trading Bots, Futures Bots, Moon Bots, etc.)
   - **Bot-Richtung**: Long oder Short
   - **Investitionsmenge**: Investiertes Kapital in USDT (Nummer mit 2 Dezimalstellen)
   - **Extra Margin**: Zusätzliche Margin in USDT (Nummer mit 2 Dezimalstellen, optional)
   - **Profit**: Absoluter Gewinn in USDT (Nummer mit 2 Dezimalstellen)
   - **Profit %**: Gewinn in Prozent (Nummer mit 2 Dezimalstellen)
   - **Periodentyp**: Zeitraum der Performance - entweder "Tag", "Woche" oder "Monat"
   - **Längste Laufzeit**: Format "Xd Yh Zs" (z.B. "2d 5h 30s" oder "12h 0s")
   - **Durchschnittliche Laufzeit**: Format "Xd Yh Zs" (z.B. "1d 3h 15s")
   - **Durchschn. Grid Profit**: Durchschnittlicher Grid-Profit in USDT (Nummer mit 2 Dezimalstellen, optional)
   - **Höchster Grid Profit**: Höchster Grid-Profit in USDT (Nummer mit 2 Dezimalstellen, optional)
   - **Höchster Grid Profit %**: Höchster Grid-Profit in Prozent (Nummer mit 2 Dezimalstellen, optional)
   - **Gesamt Durchschn. Grid Profit**: Gesamter durchschnittlicher Grid-Profit in USDT (Nummer mit 2 Dezimalstellen, optional)
   - **Leverage**: Hebelwirkung (z.B. "10x", "20x", optional)

5. **Bei mehreren Screenshots**:
   - Summiere: Investment, Extra Margin, Profit
   - Berechne Durchschnitt: Längste Laufzeit, Durchschnittliche Laufzeit, Grid-Profit-Werte
   - Profit % neu berechnen: (Gesamt-Profit / Gesamt-Investment) × 100

6. **Antwort-Format**:
   - Gib die extrahierten Daten strukturiert aus
   - Erkläre kurz was du gefunden hast
   - Beziehe dich auf Update-Verlauf wenn verfügbar und relevant
   - Sei präzise und freundlich
   - Antworte auf Deutsch

Wenn du Screenshots analysierst, schaue besonders auf:
- Performance/Profit Zahlen
- Zeiträume und Laufzeiten
- Investment-Beträge
- Grid-Statistiken
- Bot-Namen und Typen

Hilf dem Benutzer auch bei allgemeinen Fragen zur Anwendung oder zur Bot-Trading-Strategie.`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, images, botTypes, updateHistory } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      let contextualPrompt = SYSTEM_PROMPT;
      
      if (botTypes && botTypes.length > 0) {
        contextualPrompt += `\n\n**VERFÜGBARE BOT TYPES:**\n`;
        botTypes.forEach((bt: any) => {
          contextualPrompt += `\n- Name: "${bt.name}"\n  ID: ${bt.color || 'keine Farbe'}\n  Beschreibung: ${bt.description || 'keine Beschreibung'}\n`;
          
          if (updateHistory && updateHistory[bt.name]) {
            const updates = updateHistory[bt.name];
            if (updates.length > 0) {
              contextualPrompt += `  Update-Verlauf (${updates.length} Updates):\n`;
              updates.forEach((update: any, index: number) => {
                contextualPrompt += `    ${index + 1}. "${update.updateName}" - ${update.updateDate} ${update.updateTime}\n`;
              });
            } else {
              contextualPrompt += `  Update-Verlauf: Start Metric (noch keine Updates)\n`;
            }
          } else {
            contextualPrompt += `  Update-Verlauf: Start Metric (noch keine Updates)\n`;
          }
        });
      }

      const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: contextualPrompt },
        ...messages.map((msg: any) => ({
          role: msg.role === 'ai' ? 'assistant' : msg.role,
          content: msg.content,
        })),
      ];

      if (images && images.length > 0) {
        const lastUserMessageIndex = chatMessages.length - 1;
        if (chatMessages[lastUserMessageIndex].role === 'user') {
          const textContent = chatMessages[lastUserMessageIndex].content as string;
          chatMessages[lastUserMessageIndex] = {
            role: 'user',
            content: [
              { type: 'text', text: textContent },
              ...images.map((imageBase64: string) => ({
                type: 'image_url' as const,
                image_url: { url: imageBase64 },
              })),
            ],
          };
        }
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        max_tokens: 2000,
      });

      const aiResponse = completion.choices[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";
      
      res.json({ response: aiResponse });
    } catch (error: any) {
      console.error("OpenAI API error:", error);
      res.status(500).json({ 
        error: "Failed to get AI response", 
        details: error.message 
      });
    }
  });

  app.get("/api/bot-types", async (req, res) => {
    try {
      const botTypes = await storage.getAllBotTypes();
      res.json(botTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bot types" });
    }
  });

  app.post("/api/bot-types", async (req, res) => {
    try {
      const validatedData = insertBotTypeSchema.parse(req.body);
      const botType = await storage.createBotType(validatedData);
      res.status(201).json(botType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create bot type" });
    }
  });

  app.put("/api/bot-types/:id", async (req, res) => {
    try {
      const updateSchema = insertBotTypeSchema.partial().refine(
        (data) => data.name !== undefined || data.description !== undefined || data.color !== undefined,
        { message: "At least one field must be provided for update" }
      ).refine(
        (data) => !data.name || data.name.trim().length > 0,
        { message: "Name cannot be empty", path: ["name"] }
      );
      
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateBotType(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ error: "Bot type not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update bot type" });
    }
  });

  app.delete("/api/bot-types/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBotType(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bot type not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bot type" });
    }
  });

  app.get("/api/entries", async (req, res) => {
    try {
      const entries = await storage.getAllBotEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entries" });
    }
  });

  app.get("/api/entries/:id", async (req, res) => {
    try {
      const entry = await storage.getBotEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entry" });
    }
  });

  app.get("/api/report", async (req, res) => {
    try {
      const { from, to } = req.query;
      
      if (!from || !to) {
        return res.status(400).json({ error: "Start and end dates are required" });
      }

      const entries = await storage.getBotEntriesByDateRange(from as string, to as string);
      
      const totalInvestment = entries.reduce((sum, entry) => sum + parseFloat(entry.investment), 0);
      const totalProfit = entries.reduce((sum, entry) => sum + parseFloat(entry.profit), 0);
      const totalProfitPercent = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
      const daysDiff = Math.max(1, Math.ceil((new Date(to as string).getTime() - new Date(from as string).getTime()) / (1000 * 60 * 60 * 24)));
      const avgDailyProfit = totalProfit / daysDiff;

      const profitByBot = entries.reduce((acc, entry) => {
        if (!acc[entry.botName]) {
          acc[entry.botName] = 0;
        }
        acc[entry.botName] += parseFloat(entry.profit);
        return acc;
      }, {} as Record<string, number>);

      const profitByDate = entries.reduce((acc, entry) => {
        if (!acc[entry.date]) {
          acc[entry.date] = 0;
        }
        acc[entry.date] += parseFloat(entry.profit);
        return acc;
      }, {} as Record<string, number>);

      res.json({
        entries,
        summary: {
          totalInvestment,
          totalProfit,
          totalProfitPercent,
          avgDailyProfit,
          dayCount: daysDiff,
        },
        charts: {
          profitByBot: Object.entries(profitByBot).map(([name, profit]) => ({ name, profit })),
          profitByDate: Object.entries(profitByDate)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([date, profit]) => ({ 
              date: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), 
              profit 
            })),
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      const validatedData = insertBotEntrySchema.parse(req.body);
      
      const entry = await storage.createBotEntry(validatedData);
      
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.put("/api/entries/:id", async (req, res) => {
    try {
      const updateSchema = insertBotEntrySchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      const updated = await storage.updateBotEntry(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update entry" });
    }
  });

  app.delete("/api/entries/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteBotEntry(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Entry not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
