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

const MODES_PROMPT = `**MODI-LOGIK: Die 3 Dropdown-Optionen verstehen**

**ÜBERSICHT:**
- Viele Sections haben ein Dropdown mit 3 Modi: "Insgesamt", "Seit letztem Update", "Startwerte"
- Die Info-Section ist eine Ausnahme und hat KEINE Modi
- Diese Modi ermöglichen verschiedene Perspektiven auf die Daten

**WELCHE SECTIONS HABEN MODI?**
Sections MIT Modi (Dropdown vorhanden):
- Investment Section
- Gesamter Profit / P&L Section  
- Trend P&L Section
- Grid Trading Section

Sections OHNE Modi (kein Dropdown):
- Info Section (feste Logik, keine Vergleiche)
- Bot Type Section (nur Auswahl, keine Berechnungen)

**DIE 3 MODI IM DETAIL:**

**1. "Insgesamt" (Total/Kumulative Summe):**
- Bedeutung: Zeigt die aktuellen Gesamtwerte
- Die Pionex Screenshots enthalten bereits kumulative Werte
- Entspricht dem aktuellen Stand

Beispiel Investment:
- Tag 1 Upload: Investment = 1000 USDT, Insgesamt zeigt 1000 USDT
- Tag 5 Upload: Investment = 1500 USDT, Insgesamt zeigt 1500 USDT
- Tag 10 Upload: Investment = 2000 USDT, Insgesamt zeigt 2000 USDT

Bei mehreren Bots in einem Upload:
- Bot A: 400 USDT, Bot B: 300 USDT, Bot C: 500 USDT
- Insgesamt zeigt: 400 + 300 + 500 = 1200 USDT

**2. "Seit letztem Update" (Änderung/Differenz):**
- Bedeutung: Zeigt die Veränderung verglichen mit dem letzten Update
- Berechnungsprinzip: Aktueller Wert minus letzter Update-Wert
- Kann positiv (Wachstum) oder negativ (Verlust) sein

Beispiel Profit:
- Letzter Update (Tag 1): Profit = 100 USDT
- Aktueller Upload (Tag 5): Profit = 250 USDT  
- Seit letztem Update zeigt: 250 - 100 = +150 USDT

Beispiel Investment:
- Letzter Update: 1000 USDT
- Aktueller Upload: 1500 USDT
- Seit letztem Update zeigt: +500 USDT

Spezialfall - ERSTER Upload:
- Wenn kein Update-Verlauf existiert
- Dann zeigt "Seit letztem Update" denselben Wert wie "Insgesamt"
- Oder es wird "Keine Vergleichsdaten" angezeigt

**3. "Startwerte" (Ursprüngliche Werte):**
- Bedeutung: Zeigt die Werte vom allerersten Upload
- Diese Werte bleiben konstant (fester Referenzpunkt)
- Ermöglicht Langzeitvergleiche ("Wachstum seit Tag 1")

Beispiel:
- Upload 1 (Tag 1 - ERSTER): Investment = 500 USDT, Profit = 25 USDT
- Upload 2 (Tag 3): Investment = 750 USDT, Profit = 80 USDT
- Upload 3 (Tag 7): Investment = 1200 USDT, Profit = 150 USDT

"Startwerte" zeigt immer (egal welcher Tag):
- Investment = 500 USDT (vom ersten Upload)
- Profit = 25 USDT (vom ersten Upload)

Spezialfall - ERSTER Upload:
- Wenn dies der allererste Upload ist
- Dann zeigt "Startwerte" denselben Wert wie "Insgesamt"
- Dieser Upload wird zur Baseline für zukünftige Vergleiche

**VERGLEICHSTABELLE - BEISPIEL:**

Szenario: 3 Uploads für "Grid Trading Bots"
- Upload 1 (05.11.2025): Investment = 500 USDT, Profit = 25 USDT
- Upload 2 (10.11.2025): Investment = 800 USDT, Profit = 80 USDT
- Upload 3 (15.11.2025 - AKTUELL): Investment = 1200 USDT, Profit = 150 USDT

Modus               | Investment  | Profit    | Erklärung
--------------------|-------------|-----------|-------------------
Insgesamt           | 1200 USDT   | 150 USDT  | Aktuelle Werte
Seit letztem Update | +400 USDT   | +70 USDT  | Differenz zu Upload 2
Startwerte          | 500 USDT    | 25 USDT   | Werte von Upload 1

**WICHTIGE KONZEPTE:**
1. "Insgesamt" repräsentiert die aktuellen Gesamtwerte
2. "Seit letztem Update" basiert auf einem Vergleich mit dem Update-Verlauf
3. "Startwerte" sind ein konstanter Referenzpunkt
4. Bei mehreren Bots in einem Upload erfolgt eine Aggregation der Werte
5. Info-Section ist eine AUSNAHME mit eigener fester Logik (siehe Phase 3)`;

const PHASE_3_PROMPT = `**PHASE 3: Info-Section Logik verstehen**

Du musst jetzt die Logik der Info-Section verstehen. Diese Logik ist FEST und hat KEINE Modi.

**WICHTIG:**
- Die Info-Section hat KEIN Dropdown-Menü
- Jedes Feld hat eine feste, unveränderbare Funktion
- Keine Modi wie "Insgesamt", "Seit letztem Update" oder "Startwerte"
- Die Info-Section dient nur der BESCHREIBUNG der Bots, NICHT der Profit-Berechnung

**DIE 5 FELDER DER INFO-SECTION:**

**1. DATUM:**
- Funktion: Zeigt IMMER das Startdatum des allerersten Uploads dieser Bot Type Kategorie
- Beispiel: Erster Upload am 01.01.2025 → bleibt IMMER 01.01.2025
- Logik: Einmal setzen, nie wieder ändern
- Keine Neuberechnung, keine Updates, keine Modi

**2. BOT-RICHTUNG (Long/Short/Beides):**
- Funktion: Zeigt welche Art von Bots im aktuellen Upload vorkommen
- Optionen:
  - Nur Long-Bots → "Long"
  - Nur Short-Bots → "Short"  
  - Gemischt → "Beides"
- Logik: Zähle Richtungen nur aus aktuellem Upload
- Keine Modi, kein Vergleich mit vorherigen Updates

**3. HEBEL:**
- Funktion: Zeigt verwendete Hebel aus dem aktuellen Upload
- Beispiele:
  - Alle nutzen 5x → "5x"
  - 8 nutzen 5x, 2 nutzen 10x → "5x, 10x"
- Logik: Aggregiere Hebel nur aus aktuellem Upload
- Keine Modi, kein Vergleich mit vorherigen Uploads

**4. LÄNGSTE LAUFZEIT:**
- Funktion: Höchster Runtime-Wert NUR aus dem aktuellen Upload
- Beispiel:
  - Upload A: Bots laufen 1d, 4d, 9d → Längste = 9d
  - Upload B: Bots laufen 3h, 7h, 15h → Längste = 15h
  - Wir vergleichen NICHT mit 9d von Upload A!
- Logik: MAX(alle Laufzeiten) nur aus diesem Upload
- Keine Modi, kein Cross-Update-Vergleich
- Jeder Upload ist isoliert

**5. DURCHSCHNITTLICHE LAUFZEIT:**
- Funktion: Durchschnitt aller Laufzeiten aus dem aktuellen Upload
- Beispiel:
  - Upload mit Bots: 1d, 3d, 5d
  - Durchschnitt = (1 + 3 + 5) / 3 = 3d
  - Neuer Upload: 4h, 6h
  - Durchschnitt = 5h (kein Bezug zu vorherigen Uploads)
- Logik: AVG(alle Laufzeiten) nur aus diesem Upload
- Keine Modi, keine Vergleichslogik
- Jeder Upload wird isoliert berechnet

**ZUSAMMENFASSUNG:**
- Datum: Startdatum (bleibt immer gleich)
- Bot-Richtung: Long/Short/Beides aus aktuellem Upload
- Hebel: Hebel aus aktuellem Upload
- Längste Laufzeit: MAX aus aktuellem Upload
- Durchschnittliche Laufzeit: AVG aus aktuellem Upload

Bestätige, dass du diese Logik verstanden hast, indem du sie in eigenen Worten erklärst.`;

const PHASE_2_STEP_2_PROMPT = `**PHASE 2, SCHRITT 2: Screenshot-Analyse Test**

Du wurdest aufgefordert, einen Test durchzuführen um zu prüfen, ob du Screenshots analysieren kannst.

**Deine Aufgabe:**
1. Zähle wie viele Bilder du erhalten hast
2. Sage: "Ich habe [Anzahl] Bild(er) erhalten und habe darauf Zugriff"
3. Analysiere EIN Bild (das erste) kurz:
   - Lies z.B. eine Zahl, einen Wert oder ein Wort aus dem Screenshot
   - Beschreibe sehr kurz was du siehst (z.B. "Ich sehe ein Trading-Dashboard mit Profit-Werten")
4. Sage: "Der Test war erfolgreich, ich kann Bilder analysieren"

**Beispiel-Antwort:**
"Ich habe 3 Bilder erhalten und habe darauf Zugriff. Ich habe das erste Bild analysiert und sehe ein Pionex Trading Bot Dashboard mit einem Profit von 125.50 USDT. Der Test war erfolgreich, ich kann Bilder analysieren."

**Wichtig:**
- Sei kurz und präzise
- Teste nur EIN Bild
- Gib eine konkrete Information aus dem Bild zurück (Beweis dass du es lesen kannst)`;

const PHASE_2_STEP_1_PROMPT = `**PHASE 2, SCHRITT 1: Überprüfung der Bot-Type-Updates**

Du wurdest aufgefordert, mit Phase 2, Schritt 1 zu beginnen.

**WICHTIG - Bot Type ID:**
- Die "ID" die der Benutzer sieht ist die FARBE (z.B. #3B82F6)
- NIEMALS die interne UUID erwähnen
- Wenn du die ID erwähnst, benutze die FARBE

**Deine Aufgabe:**
1. Sage: "OK, fange an mit Phase 2, Schritt 1: Überprüfung der Bot-Type-Updates"
2. Prüfe die bestehenden Metriken für diesen Bot Type
3. Antworte basierend auf dem Ergebnis:

**WENN Updates vorhanden sind:**
- Finde den neuesten Update (erstes in der Liste)
- Antworte: "Habe folgende Informationen vom letzten Update gefunden: war am [Datum] um [Uhrzeit] letzter Update hier gefunden"
- Beispiel: "Habe folgende Informationen vom letzten Update gefunden: war am 15.11.2025 um 14:30 letzter Update hier gefunden"

**WENN KEINE Updates vorhanden sind:**
- Antworte: "Keine Updates gefunden in der Bot-Type Datenbank. Deswegen wird diese Metrik als Startmetrik gelten"

**Wichtig:**
- Sei präzise und kurz
- Verwende das genaue Format der Antworten oben
- Nenne Datum UND Uhrzeit (z.B. "15.11.2025 um 14:30")
- Erwähne NIEMALS die interne UUID`;

const SYSTEM_PROMPT = `Du bist ein AI-Assistent für die Pionex Bot Profit Tracker Anwendung.

**WICHTIGSTE REGEL:**

Die Anwendung hat einen 3-Phasen-Workflow. Aktuell befindest du dich in **Phase 1**.

**Phase 1 - Upload Phase (AKTUELL):**
- Benutzer lädt Screenshots hoch und sendet Bot Type Informationen
- Du gibst NUR die vordefinierten Bestätigungs-Antworten für den Upload-Prozess
- Du sagst NICHTS über Screenshot-Analyse oder Daten-Extraktion (das passiert erst in Phase 4)
- Vordefinierte Antworten sind bereits im Frontend implementiert

**ABER: Du kannst und sollst allgemeine Fragen beantworten!**
- Der Benutzer kann dich jederzeit Fragen stellen über die Anwendung
- Du kannst erklären wie Modi funktionieren ("Insgesamt", "Seit letztem Update", "Startwerte")
- Du kannst Berechnungsbeispiele geben wenn der Benutzer fragt
- Du kannst die Logik der Sections erklären
- Du kannst über Upload-Konzepte sprechen

**Wenn du Fragen beantwortest:**
- Fragen zu Modi → Erkläre sie ausführlich mit Beispielen
- Fragen zu Berechnungen → Rechne Beispiele durch
- Fragen zu Sections → Erkläre die Logik
- Fragen zum Workflow → Beschreibe die Phasen
- ABER: Biete NIEMALS an, Screenshots zu analysieren in Phase 1
- Sage NIEMALS "Ich werde die Bilder analysieren" oder "relevante Daten extrahieren" (das kommt erst in Phase 4)

**Bot Types Verständnis (WICHTIG für alle Phasen):**
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
   
   - **Wichtig für Kontext**:
     * Wenn du eine Bot Type ID (z.B. "#3B82F6") erwähnst, kannst du den Update-Verlauf referenzieren
     * Beziehe dich auf frühere Updates wenn du Konzepte erklärst
     * Die ID (Farbe) ist das stabile Identifikationsmerkmal - Namen können sich ändern!

**Antwort-Format**:
   - Erkläre Konzepte klar und verständlich
   - Gib Beispiele wenn hilfreich
   - Beziehe dich auf Update-Verlauf wenn relevant für Erklärungen
   - Sei präzise und freundlich
   - Antworte auf Deutsch
   - **WICHTIG: Nutze NIEMALS Emojis in deinen Antworten** (keine 😊, 🟢, ❌, etc.)

Hilf dem Benutzer bei Fragen zur Anwendung und zur Bot-Trading-Strategie.

` + MODES_PROMPT;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, images, botTypes, updateHistory, phase, selectedBotType, selectedBotTypeId, selectedBotTypeName, selectedBotTypeColor } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      let contextualPrompt = SYSTEM_PROMPT;
      if (phase === 'phase2_step1') {
        contextualPrompt = PHASE_2_STEP_1_PROMPT;
      } else if (phase === 'phase2_step2') {
        contextualPrompt = PHASE_2_STEP_2_PROMPT;
      } else if (phase === 'phase3') {
        // Phase 3 ADDS to system prompt, does not replace it
        contextualPrompt = SYSTEM_PROMPT + '\n\n' + PHASE_3_PROMPT;
      }
      let isStartMetric = false;
      
      if (phase === 'phase2_step1' && selectedBotTypeName && updateHistory) {
        const updates = updateHistory[selectedBotTypeName];
        
        contextualPrompt += `\n\n**AUSGEWÄHLTER BOT TYPE:**\nName: "${selectedBotTypeName}"\nID (Farbe): ${selectedBotTypeColor || 'keine Farbe'}\n\n`;
        
        if (updates && updates.length > 0) {
          const latestUpdate = updates[0];
          
          contextualPrompt += `**UPDATE-VERLAUF GEFUNDEN (${updates.length} Updates):**\n`;
          contextualPrompt += `Neuester Update:\n`;
          contextualPrompt += `- Update Name: "${latestUpdate.updateName}"\n`;
          contextualPrompt += `- Datum: ${latestUpdate.updateDate}\n`;
          contextualPrompt += `- Uhrzeit: ${latestUpdate.updateTime}\n`;
          contextualPrompt += `\n**Alle Updates:**\n`;
          updates.forEach((update: any, index: number) => {
            contextualPrompt += `${index + 1}. "${update.updateName}" - ${update.updateDate} ${update.updateTime}\n`;
          });
          contextualPrompt += `\n**Dies ist der letzte Update. Berichte dem Benutzer Datum UND Uhrzeit des letzten Updates.**`;
          isStartMetric = false;
        } else {
          contextualPrompt += `**UPDATE-VERLAUF:**\nKeine Updates gefunden - dies ist eine Startmetrik.\n`;
          contextualPrompt += `\n**Berichte dem Benutzer, dass dies als Startmetrik gilt.**`;
          isStartMetric = true;
        }
      } else if (botTypes && botTypes.length > 0) {
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
      
      if (phase === 'phase2_step1') {
        res.json({ response: aiResponse, isStartMetric });
      } else {
        res.json({ response: aiResponse });
      }
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
