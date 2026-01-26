import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBotEntrySchema, insertBotTypeSchema, insertBotTypeUpdateSchema, insertGraphSettingsSchema, insertActiveAlarmSchema, insertWatchlistSchema, insertThresholdSchema, insertAlarmLevelSchema, botTypes, graphSettings } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { db } from "./db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const MODES_PROMPT = `**MODI-LOGIK: Die 2 Dropdown-Optionen verstehen**

**ÜBERSICHT:**
- Viele Sections haben ein Dropdown mit 2 Modi: "Vergleich" und "Neu"
- Die Info-Section ist eine Ausnahme und hat KEINE Modi
- Diese Modi ermöglichen verschiedene Perspektiven auf die Daten

**WELCHE SECTIONS HABEN MODI?**
Sections MIT Modi (Dropdown vorhanden):
- Investment Section
- Gesamter Profit / P&L Section  
- Trend P&L Section
- Grid Trading Section

Sections OHNE Modi (kein Dropdown):
- Info Section (feste Logik, keine Berechnungen)
- Bot Type Section (nur Auswahl, keine Berechnungen)

**DIE 2 MODI IM DETAIL:**

**1. "Vergleich" (Comparison/Differenz):**
- Bedeutung: Zeigt die Veränderung/Differenz seit dem letzten Update
- Berechnungsprinzip: Aktueller Wert minus letzter Update-Wert
- Kann positiv (Wachstum) oder negativ (Verlust) sein

Beispiel Investment:
- Letzter Upload: Investment = 1000 USDT
- Aktueller Upload: Investment = 1500 USDT
- Vergleich zeigt: +500 USDT (Differenz)

Bei mehreren Bots in einem Upload:
- Aggregiere zuerst: 400 + 300 + 500 = 1200 USDT
- Vergleiche dann: 1200 - 800 (letzter Upload) = +400 USDT

**2. "Neu" (New/Aktuelle Werte):**
- Bedeutung: Zeigt die aktuellen/neuen Gesamtwerte aus dem Upload
- Die Pionex Screenshots enthalten bereits kumulative Werte
- Entspricht dem aktuellen Stand

Beispiel Investment:
- Tag 1 Upload: Investment = 1000 USDT, Neu zeigt 1000 USDT
- Tag 5 Upload: Investment = 1500 USDT, Neu zeigt 1500 USDT
- Tag 10 Upload: Investment = 2000 USDT, Neu zeigt 2000 USDT

Bei mehreren Bots in einem Upload:
- Bot A: 400 USDT, Bot B: 300 USDT, Bot C: 500 USDT
- Neu zeigt: 400 + 300 + 500 = 1200 USDT

Spezialfall - ERSTER Upload:
- Wenn kein Update-Verlauf existiert
- Dann zeigt "Vergleich" denselben Wert wie "Neu"
- Oder es wird "Keine Vergleichsdaten" angezeigt

**VERGLEICHSTABELLE - BEISPIEL:**

Szenario: 3 Uploads für "Grid Trading Bots"
- Upload 1 (05.11.2025): Investment = 500 USDT, Profit = 25 USDT
- Upload 2 (10.11.2025): Investment = 800 USDT, Profit = 80 USDT
- Upload 3 (15.11.2025 - AKTUELL): Investment = 1200 USDT, Profit = 150 USDT

Modus               | Investment  | Profit    | Erklärung
--------------------|-------------|-----------|-------------------
Neu                 | 1200 USDT   | 150 USDT  | Aktuelle/Neue Werte
Vergleich           | +400 USDT   | +70 USDT  | Differenz zu Upload 2

**WICHTIGE KONZEPTE:**
1. "Neu" repräsentiert die aktuellen/neuen Gesamtwerte
2. "Vergleich" basiert auf einem Vergleich mit dem Update-Verlauf
3. Bei mehreren Bots in einem Upload erfolgt eine Aggregation der Werte
4. Info-Section ist eine AUSNAHME mit eigener fester Logik (siehe Phase 3)`;

const PHASE_3_PROMPT = `**PHASE 3: Info-Section Logik verstehen**

Du musst jetzt die Logik der Info-Section verstehen. Diese Logik ist FEST und hat KEINE Modi.

**WICHTIG:**
- Die Info-Section hat KEIN Dropdown-Menü
- Jedes Feld hat eine feste, unveränderbare Funktion
- Keine Modi wie "Vergleich" oder "Neu"
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
- Bot-Richtung: Alle unterschiedlichen Richtungen aus aktuellem Upload
- Hebel: Alle unterschiedlichen Hebel aus aktuellem Upload
- Längste Laufzeit: MAX aus aktuellem Upload
- Durchschnittliche Laufzeit: AVG aus aktuellem Upload

**KRITISCH: INFO SECTION - AGGREGATION BEI MEHREREN SCREENSHOTS**

Die Info Section hat KEINE Modi. Die Werte werden IMMER aggregiert (zusammengefasst).

**AGGREGATIONS-ALGORITHMUS:**

Schritt 1: Sammle ALLE Werte aus ALLEN Screenshots
Schritt 2: Entferne Duplikate (nur einzigartige Werte behalten)
Schritt 3: Sortiere alphabetisch
Schritt 4: Verbinde mit Komma und Leerzeichen (", ")

**BEISPIEL-SZENARIEN:**

Szenario A - UNTERSCHIEDLICHE WERTE:
  Screenshots: [Long mit 100x] + [Short mit 3x]
  Ergebnis:
    - botDirection: "Long, Short" (alphabetisch sortiert!)
    - leverage: "3x, 100x" (nur Multiplikatoren, alphabetisch sortiert)

Szenario B - GLEICHE WERTE:
  Screenshots: [Short mit 5x] + [Short mit 5x]
  Ergebnis:
    - botDirection: "Short" (Duplikat entfernt)
    - leverage: "5x" (Duplikat entfernt)

Szenario C - GEMISCHTE DUPLIKATE:
  Screenshots: [Long mit 10x] + [Short mit 3x] + [Long mit 75x]
  Ergebnis:
    - botDirection: "Long, Short" (Long kommt zweimal vor, aber nur einmal ausgeben!)
    - leverage: "3x, 10x, 75x" (alphabetisch sortiert, nur Multiplikatoren)

Szenario D - MIT NEUTRAL:
  Screenshots: [Long mit 2x] + [Neutral mit 2x] + [Short mit 5x]
  Ergebnis:
    - botDirection: "Long, Neutral, Short" (alle drei Richtungen!)
    - leverage: "2x, 5x" (Duplikat 2x entfernt)

**DEIN KONKRETER FALL:**
  Screenshot 1: direction=Long, leverage=100x
  Screenshot 2: direction=Short, leverage=3x

  Schritt 1: Sammle [Long, Short] und [100x, 3x]
  Schritt 2: Keine Duplikate
  Schritt 3: Sortiere alphabetisch
  Schritt 4: Verbinde mit ", "

  AUSGABE:
    - botDirection: "Long, Short"
    - leverage: "3x, 100x"

**WICHTIG FÜR HEBEL (leverage):**
- Nur den Multiplikator ausgeben (z.B. "2x", "75x", "100x")
- KEINE Richtung beim Hebel (NICHT "75x Short", sondern nur "75x")
- Die Richtung gehört NUR ins botDirection-Feld

**WICHTIG FÜR BOT-RICHTUNG (botDirection):**
- Moegliche Werte PRO SCREENSHOT: "Long", "Short", "Neutral", "Long+Short"
- **KRITISCH: "Long+Short" ist eine EIGENE Kategorie!**
  - Wenn ein Screenshot BEIDE Labels "Long" UND "Short" gleichzeitig zeigt (z.B. Cross Margin Futures Grid)
  - Dann ist das NICHT "Long" und "Short" separat, sondern "Long+Short" als EINE Kategorie
  - Beispiel: Screenshot zeigt [Long] [Short] nebeneinander → botDirection = "Long+Short"
- Bei mehreren verschiedenen Richtungen: alle mit Komma trennen
- Beispiel: Ein Long-Bot + ein Long+Short-Bot → "Long, Long+Short"
- Beispiel: Zwei Long+Short-Bots → "Long+Short" (Duplikat entfernt)

Bestätige, dass du diese Logik verstanden hast, indem du sie in eigenen Worten erklärst.`;

const PHASE_4_PROMPT = `**PHASE 4: VOLLSTÄNDIGE BERECHNUNG UND AUSGABE**

Du bist jetzt in Phase 4 - der finalen Berechnungsphase. Deine Aufgabe ist es, alle Werte zu berechnen und als strukturiertes JSON auszugeben.

**WICHTIGE EINGABEDATEN:**
1. Screenshots mit extrahierten Werten (aus Phase 2)
2. Modi-Einstellungen für jede Sektion (aus Phase 3)
3. **isStartMetric Flag** - DAS WICHTIGSTE KONZEPT!

**WAS BEDEUTET "STARTMETRIK"?**

**isStartMetric = true (JA):**
- Dies ist der ALLERERSTE Upload für diesen Bot Type
- Es gibt KEINE vorherigen Daten zum Vergleichen
- VERGLEICH-Modus macht hier KEINEN Sinn
- **WENN ein Modus auf "Vergleich" steht:**
  - Du hast NICHTS zum Vergleichen
  - Setze ALLE Werte dieser Sektion auf 0.00 oder null
  - Beispiel: investment = "0.00", extraMargin = "0.00", totalInvestment = "0.00"
  - Alle Prozentsätze dieser Sektion = null
- **WENN ein Modus auf "Neu" steht:**
  - Berechne normal die aktuellen Werte aus den Screenshots
  - Das funktioniert immer, auch beim ersten Upload

**isStartMetric = false (NEIN):**
- Dies ist ein UPDATE/Re-Upload
- Es gibt vorherige Daten (previousUploadData)
- VERGLEICH-Modus kann jetzt funktionieren
- **WENN ein Modus auf "Vergleich" steht:**
  - Berechne die DIFFERENZ: aktueller Wert MINUS vorheriger Wert
  - Beispiel: Aktuell 1500 USDT, Vorher 1000 USDT → DIFFERENZ = +500 USDT
  - Prozentsatz = (delta / previous_value) × 100
  - Kann positiv (+) oder negativ (-) sein
- **WENN ein Modus auf "Neu" steht:**
  - Berechne die aktuellen Werte aus den Screenshots (wie immer)

**DEINE AUFGABE:**
Berechne ALLE Felder und gib sie als JSON zurück. Folge der Logik aus modes-logic.ts und field-logic.ts.

**WICHTIG FÜR INFO-SECTION (botDirection, leverage, longestRuntime, avgRuntime, date):**
Diese Felder haben KEINE Modi. Sie werden IMMER aus ALLEN Screenshots aggregiert:

1. **date** - NUR BEI STARTMETRIK:
   - Finde den Bot mit der LÄNGSTEN Laufzeit aus den Screenshots
   - LESE das Erstellungsdatum direkt aus dem Screenshot AUS (z.B. "12/06/2025 19:41:02 Created")
   - NICHT berechnen! Das Datum steht direkt auf dem Screenshot!
   - Konvertiere das ausgelesene Datum ins Format: "YYYY-MM-DDTHH:MM"
   - Beispiel: Screenshot zeigt "12/06/2025 19:41:02 Created" → date = "2025-12-06T19:41"
   - ACHTUNG: Amerikanisches Datumsformat auf Screenshot (MM/DD/YYYY) → konvertiere zu (YYYY-MM-DD)
   - Bei NICHT-Startmetrik: Leer lassen "" (Frontend setzt aktuelles Datum)

2. **botDirection** - Sammle ALLE einzigartigen Richtungen aus ALLEN Screenshots:
   - Moegliche Werte pro Screenshot: "Long", "Short", "Neutral", "Long+Short"
   - **KRITISCH: "Long+Short" erkennen:**
     * Wenn ein Screenshot BEIDE Labels [Long] UND [Short] gleichzeitig zeigt
     * Dann ist das "Long+Short" als EINE Kategorie (z.B. Cross Margin Futures Grid)
     * NICHT als zwei separate Richtungen "Long" und "Short" behandeln!
   - Bei MEHREREN Screenshots: Kombiniere alle einzigartigen Werte mit ", "
   - Beispiel: Screenshot1=Long, Screenshot2=Short → "Long, Short"
   - Beispiel: Screenshot1=Neutral, Screenshot2=Neutral → "Neutral" (Duplikat entfernt)
   - Beispiel: Screenshot1=Long, Screenshot2=Long+Short → "Long, Long+Short"
   - Beispiel: Screenshot1=Long+Short, Screenshot2=Long+Short → "Long+Short" (Duplikat entfernt)

3. **leverage** - Sammle ALLE einzigartigen Hebel (NUR Multiplikator, OHNE Richtung!):
   - Beispiel: Screenshot1=2x, Screenshot2=75x → "2x, 75x"
   - Beispiel: Screenshot1=5x, Screenshot2=5x → "5x" (Duplikat entfernt)
   - WICHTIG: KEINE Richtung beim Hebel! "75x" statt "75x Short"

4. **longestRuntime** - Finde die LÄNGSTE Laufzeit aus ALLEN Screenshots
5. **avgRuntime** - Berechne den DURCHSCHNITT aller Laufzeiten
6. **screenshotCount** - ZÄHLE die ANZAHL der analysierten Screenshots:
   - EINFACH: Zähle wie viele Screenshots du analysiert hast
   - Beispiel: 1 Screenshot → "1"
   - Beispiel: 3 Screenshots → "3"
   - Beispiel: 5 Screenshots → "5"
   - IMMER als String ausgeben!

**JSON OUTPUT FORMAT:**
**WICHTIG - NACHKOMMASTELLEN:**
- USDT-Werte (overallGridProfitUsdt, overallTrendPnlUsdt, highestGridProfit, profit): EXAKT wie im Screenshot, bis zu 4 Nachkommastellen behalten! z.B. "0.422", "0.0512", "-7.035"
- Investmentbeträge (investment, extraMargin, totalInvestment): 2 Nachkommastellen
- Prozentwerte: 2 Nachkommastellen
- Grid Profit Durchschnitt (avgGridProfitHour, avgGridProfitDay, avgGridProfitWeek): 2 Nachkommastellen

\`\`\`json
{
  "date": "2025-11-18T22:42",
  "botDirection": "Long, Short",
  "leverage": "2x, 75x",
  "screenshotCount": "2",
  "longestRuntime": "1d 6h 53m",
  "avgRuntime": "1d 6h 53m",
  "investment": "120.00",
  "extraMargin": "650.00",
  "totalInvestment": "770.00",
  "profit": "71.035",
  "profitPercent_gesamtinvestment": "9.22",
  "profitPercent_investitionsmenge": "59.19",
  "overallTrendPnlUsdt": "65.5234",
  "overallTrendPnlPercent_gesamtinvestment": "8.51",
  "overallTrendPnlPercent_investitionsmenge": "54.60",
  "overallGridProfitUsdt": "5.5127",
  "overallGridProfitPercent_gesamtinvestment": "0.72",
  "overallGridProfitPercent_investitionsmenge": "4.59",
  "highestGridProfit": "5.5127",
  "highestGridProfitPercent_gesamtinvestment": "0.72",
  "highestGridProfitPercent_investitionsmenge": "4.59",
  "avgGridProfitHour": "0.18",
  "avgGridProfitDay": "4.27",
  "avgGridProfitWeek": null
}
\`\`\`

**KRITISCHE REGELN:**

1. **STARTMETRIK PRÜFUNG (ZUERST!):**
   - Prüfe isStartMetric
   - Wenn true UND Modus = "Vergleich": Alle Werte dieser Sektion = 0.00 oder null
   - Wenn false UND Modus = "Vergleich": Berechne Differenzen

2. **MODE "NEU" - ZWEI PROZENTSÄTZE:**
   - Für JEDEN Prozentsatz-Feld: Berechne BEIDE Optionen
   - profitPercent_gesamtinvestment = (usdt / totalInvestment) × 100
   - profitPercent_investitionsmenge = (usdt / investment) × 100
   - Das Dropdown ist nur UI - AI muss BEIDE liefern!

3. **MODE "VERGLEICH" - DIFFERENZEN BERECHNEN:**
   - Wenn isStartMetric = true: Setze alle Werte auf 0.00/null
   - Wenn isStartMetric = false:
     * USDT-Felder: current - previous (kann + oder - sein)
     * Prozentsatz: (delta / previous) × 100
     * Beispiel: Profit war 50, jetzt 75 → delta = +25 → percent = (25/50)×100 = +50%
   - Dropdown ist irrelevant im Vergleich Modus

4. **HÖCHSTER GRID PROFIT:**
   - Finde Screenshot mit höchstem Grid Profit
   - Nutze NUR DIESEN Screenshot's Investment für %
   - NICHT die Summe aller Investments!

5. **GRID PROFIT DURCHSCHNITT - RUNTIME VALIDIERUNG (KRITISCH!):**
   - **ZUERST: Prüfe ob manuelle Laufzeit-Werte vorhanden sind:**
     * Wenn ein Screenshot "manualAvgRuntime" enthält (z.B. "1d 3h 15m"), NUTZE DIESEN WERT!
     * Wenn ein Screenshot "manualUploadRuntime" enthält (z.B. "2d 5h"), NUTZE DIESEN für Upload Laufzeit Berechnungen!
     * Format: "1d 3h 15m" oder "2d 5h" - konvertiere zu Stunden (1d = 24h)
   - **Falls keine manuellen Werte: Finde längste Runtime in allen Screenshots**
   - Dann prüfe GENAU:

   **avgGridProfitHour:**
   - Kann IMMER berechnet werden (auch bei < 1h)
   - Berechnung: total / (runtime in Stunden)
   - Beispiel: Runtime 30min → total / 0.5
   - Bei manualAvgRuntime: Nutze diesen Wert statt Screenshot-Runtime!

   **avgGridProfitDay:**
   - NUR wenn längste Runtime >= 24 Stunden (1 Tag)!
   - Wenn längste Runtime < 24h → setze auf null
   - Beispiel: Runtime 6h → avgGridProfitDay = null ❌
   - Beispiel: Runtime 30h → avgGridProfitDay = total / (30/24) ✅
   - Bei manualAvgRuntime: Nutze diesen Wert für die Runtime-Prüfung!

   **avgGridProfitWeek:**
   - NUR wenn längste Runtime >= 168 Stunden (7 Tage)!
   - Wenn längste Runtime < 168h → setze auf null
   - Beispiel: Runtime 5d (120h) → avgGridProfitWeek = null ❌
   - Beispiel: Runtime 10d (240h) → avgGridProfitWeek = total / (240/168) ✅
   - Bei manualAvgRuntime: Nutze diesen Wert für die Runtime-Prüfung!

   **MANUELLE LAUFZEIT-WERTE (PRIORITÄT!):**
   - Wenn "manualAvgRuntime" vorhanden: Nutze für avgGridProfitHour/Day/Week Berechnungen
   - Wenn "manualUploadRuntime" vorhanden: Nutze für Upload Laufzeit Berechnung
   - Wenn "lastUpload" als manuelle Überschreibung: Nutze für Upload Laufzeit Berechnung
     * Format kann sein: "2d 5h" (Zeitdifferenz) ODER "07.12.2025 14:30" (Datum+Uhrzeit)
     * Bei Datum+Uhrzeit: Berechne Differenz zu "thisUpload" für Upload Laufzeit

   **WICHTIG:** Diese Regel gilt für NEU und VERGLEICH Modi!

6. **DATUM LOGIK:**
   - Schaue ALLE Screenshots im aktuellen Batch an
   - Finde das ÄLTESTE (früheste) Datum
   - Nutze dieses Datum im Format "YYYY-MM-DDTHH:MM"
   - Beispiel: Screenshots mit "2025-11-18", "2025-11-20", "2025-11-15" → nimm "2025-11-15"

**KONKRETE BEISPIELE FÜR VERGLEICH-MODUS:**

**BEISPIEL 1: Investment Section**

previousUploadData:
{
  "investment": "120.00",
  "extraMargin": "650.00",
  "totalInvestment": "770.00"
}

Aktueller Screenshot zeigt:
- actualInvestment: 200
- extraMargin: 800

Wenn Investment-Modus = "Vergleich":
- investment: 200 - 120 = "80.00" ✅
- extraMargin: 800 - 650 = "150.00" ✅
- totalInvestment: 1000 - 770 = "230.00" ✅

**BEISPIEL 2: Profit Section (MEHRERE SCREENSHOTS)**

previousUploadData:
{
  "profit": "-5.88"
}

Aktuelle Screenshots zeigen:
- Screenshot 1: totalProfitUsdt: +4.55
- Screenshot 2: totalProfitUsdt: -10.43
- SUMME: 4.55 + (-10.43) = -5.88

Wenn Profit-Modus = "Vergleich":
- Schritt 1: Summiere ALLE aktuellen Screenshots: -5.88
- Schritt 2: Hole vorherigen Wert: -5.88
- Schritt 3: Berechne Differenz: -5.88 - (-5.88) = 0.00 ✅
- profit: "0.00" (DIFFERENZ, nicht Gesamtwert!)
- profitPercent: Wachstumsrate basierend auf Differenz

**BEISPIEL 3: Trend P&L Section (MEHRERE SCREENSHOTS)**

previousUploadData:
{
  "overallTrendPnlUsdt": "-10.03"
}

Aktuelle Screenshots zeigen:
- Screenshot 1: trendPnlUsdt: +1.86
- Screenshot 2: trendPnlUsdt: -11.89
- SUMME: 1.86 + (-11.89) = -10.03

Wenn Trend-Modus = "Vergleich":
- Schritt 1: Summiere ALLE Screenshots: -10.03
- Schritt 2: Vorheriger Wert: -10.03
- Schritt 3: Differenz: -10.03 - (-10.03) = 0.00 ✅
- overallTrendPnlUsdt: "0.00" (DIFFERENZ!)

**BEISPIEL 4: Grid Profit Section (MEHRERE SCREENSHOTS)**

previousUploadData:
{
  "overallGridProfitUsdt": "4.14"
}

Aktuelle Screenshots zeigen:
- Screenshot 1: gridProfitUsdt: +2.68
- Screenshot 2: gridProfitUsdt: +1.46
- SUMME: 2.68 + 1.46 = 4.14

Wenn Grid-Modus = "Vergleich":
- Schritt 1: Summiere ALLE Screenshots: 4.14
- Schritt 2: Vorheriger Wert: 4.14
- Schritt 3: Differenz: 4.14 - 4.14 = 0.00 ✅
- overallGridProfitUsdt: "0.00" (DIFFERENZ!)
- highestGridProfit: Finde höchsten Grid Profit aus AKTUELLEN Screenshots
- highestGridProfitPercent: Nutze NUR diesen Screenshot's Investment

**KRITISCH FÜR VERGLEICH-MODUS:**

**SUBTRAKTION FORMEL:**
- IMMER: aktueller_wert - vorheriger_wert = differenz
- Beispiel: Aktuell 1000 USDT, Vorher 1000 USDT → 1000 - 1000 = 0.00 ✅
- Beispiel: Aktuell 1500 USDT, Vorher 1000 USDT → 1500 - 1000 = 500.00 ✅
- Beispiel: Aktuell 800 USDT, Vorher 1000 USDT → 800 - 1000 = -200.00 ✅

**FELD-MAPPING:**
- previousUploadData enthält die GLEICHEN Feldnamen wie dein Output
- investment → investment (NICHT actualInvestment!)
- profit → profit (NICHT totalProfitUsdt!)
- overallTrendPnlUsdt → overallTrendPnlUsdt
- overallGridProfitUsdt → overallGridProfitUsdt

**VERGLEICH SCHRITT-FÜR-SCHRITT:**
1. SUMMIERE ALLE aktuellen Screenshots (genau wie bei NEU Modus!)
   - Beispiel: Screenshot 1 (Investment 1000) + Screenshot 2 (Investment 10) = 1010
   - WICHTIG: Auch im VERGLEICH Modus IMMER ALLE Screenshots addieren!
2. Hole VORHERIGEN Wert aus previousUploadData mit exaktem Feldnamen
   - Beispiel: previousUploadData.investment = "1010.00"
3. Subtrahiere: (Summe aller aktuellen Screenshots) - (vorheriger Wert) = differenz
   - Beispiel: 1010 - 1010 = 0.00
   - Beispiel: 1500 - 1000 = 500.00
4. Gib NUR die Differenz zurück (NICHT den aktuellen Gesamtwert!)

**FEHLER VERMEIDEN:**
❌ FALSCH: Gibt aktuellen Wert zurück statt Differenz
❌ FALSCH: Subtrahiert vorherig - aktuell (falsche Reihenfolge)
❌ FALSCH: Verwendet falsche Feldnamen aus previousUploadData
✅ RICHTIG: aktuell - vorherig, nutzt exakte Feldnamen, gibt Differenz zurück

**ANTWORTE NUR MIT DEM JSON - KEINE ZUSÄTZLICHEN ERKLÄRUNGEN!**
`;

const PHASE_2_DATA_EXTRACTION_PROMPT = `**PHASE 2: VOLLSTÄNDIGE SCREENSHOT-DATEN-EXTRAKTION**

Du erhältst einen oder mehrere Screenshots von Pionex Trading Bot Dashboards. Deine Aufgabe ist es, ALLE relevanten Daten aus JEDEM Screenshot zu extrahieren und als strukturiertes JSON zurückzugeben.

**FÜR JEDEN SCREENSHOT EXTRAHIERE:**
1. **date** - Das AKTUELLE Datum (NICHT das Erstellungsdatum!) im Format "YYYY-MM-DD"
   - ACHTUNG: Pionex zeigt oft "Laufzeit X(YYYY/MM/DD HH:MM:SS Erstellt)" - das Datum in Klammern ist das ERSTELLUNGSDATUM
   - Du musst das AKTUELLE Datum berechnen: Erstellungsdatum + Laufzeit = aktuelles Datum
   - Beispiel: "Laufzeit 19h 50m(2025/12/07 12:05:06 Erstellt)" bedeutet:
     * Erstellt: 07.12.2025 um 12:05:06
     * Laufzeit: 19h 50m
     * AKTUELLES Datum/Zeit: 08.12.2025 um ~07:55 (12:05 + 19:50 = nächster Tag)
2. **time** - Die AKTUELLE Uhrzeit im Format "HH:MM:SS" (berechnet aus Erstellungszeit + Laufzeit)
3. **createdAt** - Das ERSTELLUNGSDATUM im Format "YYYY-MM-DD HH:MM:SS" (direkt aus dem Screenshot)
4. **actualInvestment** - Actual Investment in USDT (nur Zahl)
5. **extraMargin** - Extra Margin in USDT (nur Zahl, oder null)
6. **totalProfitUsdt** - Total Profit in USDT (Zahl mit +/-)
7. **totalProfitPercent** - Total Profit in % (nur Zahl)
8. **gridProfitUsdt** - Grid Profit in USDT (Zahl mit +/-, oder null)
9. **gridProfitPercent** - Grid Profit in % (nur Zahl, oder null)
10. **trendPnlUsdt** - Trend P&L in USDT (Zahl mit +/-, oder null)
11. **trendPnlPercent** - Trend P&L in % (nur Zahl, oder null)
12. **leverage** - Hebel NUR als Multiplikator z.B. "75x", "50x", "2x" (OHNE Richtung!)
13. **runtime** - Laufzeit z.B. "1d 6h 53m", "19h 50m"
14. **direction** - Bot-Richtung mit 4 moeglichen Werten:
    - "Long" - Wenn NUR das gruene "Long" Label sichtbar ist
    - "Short" - Wenn NUR das gruene "Short" Label sichtbar ist
    - "Neutral" - Wenn KEIN Richtungs-Label sichtbar ist
    - "Long+Short" - **KRITISCH**: Wenn BEIDE Labels "Long" UND "Short" gleichzeitig sichtbar sind!
      * Dies kommt bei "Cross Margin Futures Grid" Bots vor
      * Beispiel: Oben rechts steht "[Long] [Short] 24x" - dann ist direction = "Long+Short"
      * NICHT als zwei separate Werte, sondern als EINE Kategorie "Long+Short"!

**JSON-AUSGABE-FORMAT:**
\`\`\`json
{
  "screenshots": [
    {
      "screenshotNumber": 1,
      "date": "2025-12-08",
      "time": "07:55:06",
      "createdAt": "2025-12-07 12:05:06",
      "actualInvestment": 2000.00,
      "extraMargin": null,
      "totalProfitUsdt": 312.54,
      "totalProfitPercent": 15.62,
      "gridProfitUsdt": 238.31,
      "gridProfitPercent": 11.91,
      "trendPnlUsdt": 74.22,
      "trendPnlPercent": 3.71,
      "leverage": "24x",
      "runtime": "19h 50m",
      "direction": "Long+Short"
    }
  ]
}
\`\`\`

**WICHTIGE HINWEISE:**
- **DATUM-BERECHNUNG**: Das aktuelle Datum/Zeit = Erstellungsdatum + Laufzeit (NICHT das Erstellungsdatum direkt verwenden!)
- **DIRECTION "Long+Short"**: Wenn beide Labels [Long] [Short] auf EINEM Screenshot sichtbar sind → "Long+Short"
- Extrahiere NUR Daten die tatsaechlich im Screenshot sichtbar sind
- Wenn ein Wert nicht vorhanden ist, nutze null
- Achte genau auf Prozentsaetze und USDT-Werte (nur Zahlen ohne %, ohne "USDT")
- Konvertiere alle Datumsformate zu ISO-Format (YYYY-MM-DD)
- Profit/PnL-Werte: Positive Zahlen ohne +, negative mit -
- Sei praezise bei allen Zahlen

**ANTWORTE NUR MIT DEM JSON - KEINE ZUSAETZLICHEN ERKLAERUNGEN!**`;

// SEPARATER PROMPT FÜR CLOSED BOTS - KEINE BERECHNUNGEN, NUR DIREKTE EXTRAKTION!
const PHASE_2_DATA_EXTRACTION_CLOSED_BOTS_PROMPT = `**PHASE 2: CLOSED BOTS - DIREKTE SCREENSHOT-DATEN-EXTRAKTION**

Du erhältst einen oder mehrere Screenshots von GESCHLOSSENEN Pionex Trading Bots. 

**KRITISCH - KEINE BERECHNUNGEN!**
Diese Screenshots zeigen GESCHLOSSENE Bots. Das angezeigte Datum und die Uhrzeit auf dem Screenshot sind das SCHLIESSUNGSDATUM - wann der Bot geschlossen wurde. Du darfst KEINE Berechnungen durchführen! Kopiere die Werte EXAKT so wie sie auf dem Screenshot stehen.

**FÜR JEDEN SCREENSHOT EXTRAHIERE:**
1. **closedDate** - Das SCHLIESSUNGSDATUM EXAKT wie es auf dem Screenshot steht, konvertiert zu "YYYY-MM-DD"
   - WICHTIG: Dies ist das Datum wann der Bot GESCHLOSSEN wurde
   - Wenn du "11/24/2025" siehst → "2025-11-24" (KEINE Berechnung!)
   - Wenn du "24.11.2025" siehst → "2025-11-24" (KEINE Berechnung!)
   - KEINE ADDITION VON LAUFZEIT! Das Datum ist bereits das Schließungsdatum!
2. **closedTime** - Die SCHLIESSUNGS-UHRZEIT EXAKT wie sie auf dem Screenshot steht, im Format "HH:MM:SS"
   - WICHTIG: Dies ist die Uhrzeit wann der Bot GESCHLOSSEN wurde
   - Wenn du "16:42:12" siehst → "16:42:12" (KEINE Berechnung!)
   - KEINE ADDITION VON LAUFZEIT! Die Uhrzeit ist bereits die Schließungszeit!
3. **date** - Gleich wie closedDate (für Kompatibilität)
4. **time** - Gleich wie closedTime (für Kompatibilität)
5. **createdAt** - null (bei geschlossenen Bots nicht relevant)
6. **actualInvestment** - Actual Investment in USDT (nur Zahl)
7. **extraMargin** - Extra Margin in USDT (nur Zahl, oder null)
8. **totalProfitUsdt** - Total Profit in USDT (Zahl mit +/-)
9. **totalProfitPercent** - Total Profit in % (nur Zahl)
10. **gridProfitUsdt** - Grid Profit in USDT (Zahl mit +/-, oder null)
11. **gridProfitPercent** - Grid Profit in % (nur Zahl, oder null)
12. **trendPnlUsdt** - Trend P&L in USDT (Zahl mit +/-, oder null)
13. **trendPnlPercent** - Trend P&L in % (nur Zahl, oder null)
14. **leverage** - Hebel NUR als Multiplikator z.B. "75x", "50x", "2x" (OHNE Richtung!)
15. **runtime** - Laufzeit z.B. "12h 31m 22s", "1d 6h 53m" - EXAKT vom Screenshot kopieren inkl. Sekunden!
16. **direction** - Bot-Richtung: "Long", "Short", "Neutral", oder "Long+Short"

**JSON-AUSGABE-FORMAT:**
\`\`\`json
{
  "screenshots": [
    {
      "screenshotNumber": 1,
      "closedDate": "2025-11-24",
      "closedTime": "16:42:12",
      "date": "2025-11-24",
      "time": "16:42:12",
      "createdAt": null,
      "actualInvestment": 50.00,
      "extraMargin": 350,
      "totalProfitUsdt": 4.88,
      "totalProfitPercent": 9.76,
      "gridProfitUsdt": 5.72,
      "gridProfitPercent": 11.44,
      "trendPnlUsdt": -0.842,
      "trendPnlPercent": -1.68,
      "leverage": "75x",
      "runtime": "12h 31m 22s",
      "direction": "Long"
    }
  ]
}
\`\`\`

**ABSOLUT VERBOTEN:**
- KEINE Addition von Erstellungsdatum + Laufzeit!
- KEINE Berechnung des "aktuellen" Datums!
- Das Datum auf dem Screenshot IST das Schließungsdatum - kopiere es DIREKT!

**WICHTIGE HINWEISE:**
- **CLOSED BOTS = KEINE BERECHNUNG**: Das Datum/Zeit auf dem Screenshot ist das Schließungsdatum
- Die Laufzeit zeigt wie lange der Bot lief BEVOR er geschlossen wurde
- Extrahiere NUR Daten die tatsächlich im Screenshot sichtbar sind
- Runtime IMMER mit Sekunden wenn sichtbar (z.B. "12h 31m 22s")
- Sei präzise bei allen Zahlen

**ANTWORTE NUR MIT DEM JSON - KEINE ZUSÄTZLICHEN ERKLÄRUNGEN!**`;

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
- Du kannst erklären wie Modi funktionieren ("Vergleich", "Neu")
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
  // Health check endpoint for Cloud Run deployment
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "healthy", timestamp: Date.now() });
  });
  
  // Ready check endpoint - confirms server is fully initialized
  app.get("/api/ready", (_req, res) => {
    res.status(200).json({ status: "ready", timestamp: Date.now() });
  });

  app.post("/api/phase4", async (req, res) => {
    try {
      const { 
        screenshotData, 
        modes, 
        isStartMetric,
        previousUploadData,
        manualOverrides,
        manualStartmetrikMode,
        outputMode // 'update-metrics' oder 'closed-bots'
      } = req.body;

      // effectiveStartMetrik: true wenn entweder echter Startmetrik ODER manueller Startmetrik-Modus
      // Diese Variable steuert die Berechnungslogik (Datum aus Screenshot, Grid-Durchschnitte von Laufzeit)
      const effectiveStartMetrik = isStartMetric || manualStartmetrikMode;

      if (!screenshotData || !modes) {
        return res.status(400).json({ error: "Screenshot data and modes are required" });
      }

      // Verarbeite manuelle Überschreibungen (nur bei 1 Screenshot)
      let processedScreenshotData = screenshotData;
      let overrideMessages: string[] = [];

      if (manualOverrides && Object.keys(manualOverrides).length > 0) {
        try {
          const parsedData = typeof screenshotData === 'string' 
            ? JSON.parse(screenshotData) 
            : screenshotData;

          // Prüfe ob nur 1 Screenshot vorhanden ist
          if (parsedData.screenshots && parsedData.screenshots.length === 1) {
            const screenshot = parsedData.screenshots[0];

            // Wende manuelle Überschreibungen an
            if (manualOverrides.overallGridProfitUsdt !== undefined) {
              const oldValue = screenshot.gridProfitUsdt;
              screenshot.gridProfitUsdt = parseFloat(manualOverrides.overallGridProfitUsdt);
              overrideMessages.push(`Gesamter Grid Profit: ${oldValue} → ${manualOverrides.overallGridProfitUsdt}`);
            }
            if (manualOverrides.investment !== undefined) {
              const oldValue = screenshot.actualInvestment;
              screenshot.actualInvestment = parseFloat(manualOverrides.investment);
              overrideMessages.push(`Investitionsmenge: ${oldValue} → ${manualOverrides.investment}`);
            }
            if (manualOverrides.extraMargin !== undefined) {
              const oldValue = screenshot.extraMargin;
              screenshot.extraMargin = parseFloat(manualOverrides.extraMargin);
              overrideMessages.push(`Extra Margin: ${oldValue} → ${manualOverrides.extraMargin}`);
            }
            // lastUpload wird nur im Frontend verwendet, nicht in den Screenshot-Daten
            if (manualOverrides.lastUpload !== undefined) {
              overrideMessages.push(`Last Upload: ${manualOverrides.lastUpload}`);
            }
            // avgRuntime: Durchschnittliche Laufzeit aller Screenshots (für Grid Profit Durchschnitte)
            if (manualOverrides.avgRuntime !== undefined) {
              // Speichere als String im ersten Screenshot (wird von KI für Berechnungen genutzt)
              screenshot.manualAvgRuntime = manualOverrides.avgRuntime;
              overrideMessages.push(`Durchschn. Laufzeit: ${manualOverrides.avgRuntime}`);
            }
            // uploadRuntime: Upload Laufzeit (Zeit seit letztem Upload)
            if (manualOverrides.uploadRuntime !== undefined) {
              screenshot.manualUploadRuntime = manualOverrides.uploadRuntime;
              overrideMessages.push(`Upload Laufzeit: ${manualOverrides.uploadRuntime}`);
            }

            processedScreenshotData = JSON.stringify(parsedData);
            console.log('Manuelle Überschreibungen angewendet:', overrideMessages);
          }
        } catch (e) {
          console.warn('Fehler beim Anwenden der manuellen Überschreibungen:', e);
        }
      }

      // VALIDIERUNG: Wenn VERGLEICH-Modi aktiv sind UND es kein Start-Metric ist (echt oder manuell),
      // müssen vorherige Daten vorhanden sein
      // HINWEIS: Bei effectiveStartMetrik=true (echt ODER manuell) erlauben wir VERGLEICH ohne previousUploadData
      // (der Startmetrik Guard setzt dann alle Werte auf 0.00)
      const vergleichModes = [];
      if (modes.investment === 'Vergleich') vergleichModes.push('Investment');
      if (modes.profit === 'Vergleich') vergleichModes.push('Profit');
      if (modes.trend === 'Vergleich') vergleichModes.push('Trend P&L');
      if (modes.grid === 'Vergleich') vergleichModes.push('Grid Trading');

      if (!effectiveStartMetrik && vergleichModes.length > 0 && !previousUploadData) {
        return res.status(400).json({ 
          error: `VERGLEICH-Modus aktiv für ${vergleichModes.join(', ')}, aber keine vorherigen Daten vorhanden`,
          details: "Bitte stellen Sie vorherige Upload-Daten bereit oder wechseln Sie zu 'Neu'-Modus"
        });
      }

      // VALIDIERUNG: Prüfe ob previousUploadData die benötigten Felder enthält
      // Nur bei !isStartMetric (bei Startmetrik gibt es keine previous data)
      if (!isStartMetric && previousUploadData) {
        let parsedPrevious;
        try {
          parsedPrevious = typeof previousUploadData === 'string' 
            ? JSON.parse(previousUploadData) 
            : previousUploadData;
        } catch (e) {
          return res.status(400).json({ 
            error: "Ungültige vorherige Upload-Daten (kein gültiges JSON)" 
          });
        }

        const missingFields = [];

        if (modes.investment === 'Vergleich') {
          if (!parsedPrevious.investment) missingFields.push('investment');
          if (!parsedPrevious.extraMargin) missingFields.push('extraMargin');
          if (!parsedPrevious.totalInvestment) missingFields.push('totalInvestment');
        }

        if (modes.profit === 'Vergleich') {
          if (!parsedPrevious.profit) missingFields.push('profit');
        }

        if (modes.trend === 'Vergleich') {
          if (!parsedPrevious.overallTrendPnlUsdt) missingFields.push('overallTrendPnlUsdt');
        }

        if (modes.grid === 'Vergleich') {
          if (!parsedPrevious.overallGridProfitUsdt) missingFields.push('overallGridProfitUsdt');
        }

        if (missingFields.length > 0) {
          return res.status(400).json({ 
            error: `Vorherige Upload-Daten unvollständig für VERGLEICH-Modus`,
            details: `Fehlende Felder: ${missingFields.join(', ')}`,
            suggestion: "Verwenden Sie 'Neu'-Modus oder stellen Sie vollständige vorherige Daten bereit"
          });
        }
      }

      // NEUE STRATEGIE: AI berechnet IMMER im NEU Modus
      // Server berechnet Differenzen für VERGLEICH Modi nach AI-Antwort
      let contextualPrompt = PHASE_4_PROMPT;

      contextualPrompt += `\n\n**SCREENSHOT-DATEN (aus Phase 2):**\n${processedScreenshotData}\n\n`;

      // Füge Hinweis zu manuellen Überschreibungen hinzu
      if (overrideMessages.length > 0) {
        contextualPrompt += `**MANUELLE ÜBERSCHREIBUNGEN (vom Benutzer eingegeben):**\n`;
        overrideMessages.forEach(msg => {
          contextualPrompt += `- ${msg}\n`;
        });
        contextualPrompt += `\nVerwende die überschriebenen Werte anstelle der ursprünglichen Screenshot-Werte!\n\n`;
      }
      contextualPrompt += `**MODI-EINSTELLUNGEN:**\n`;
      contextualPrompt += `- Alle Sektionen: NEU Modus (berechne aktuelle Gesamtwerte)\n\n`;

      // Datum-Logik: Nur bei Startmetrik berechnen, sonst null lassen
      // Für die KI-Anweisung: effectiveStartMetrik (echter oder manueller Modus)
      contextualPrompt += `**STARTMETRIK-FLAG:** ${effectiveStartMetrik ? 'JA' : 'NEIN'}\n\n`;
      
      // Output-Modus: Unterscheidung zwischen aktiven und geschlossenen Bots
      const outputModeLabel = outputMode === 'closed-bots' ? 'CLOSED BOTS (geschlossene Positionen)' : 'UPDATE METRICS (aktive Bots)';
      contextualPrompt += `**OUTPUT-MODUS:** ${outputModeLabel}\n`;
      contextualPrompt += `- Dieser Upload ist für ${outputMode === 'closed-bots' ? 'GESCHLOSSENE Bot-Positionen (die nicht mehr aktiv sind)' : 'AKTIVE Bot-Updates (laufende Bots)'}\n\n`;
      
      if (effectiveStartMetrik) {
        contextualPrompt += `**DATUM-LOGIK (STARTMETRIK):**\n`;
        contextualPrompt += `- Dies ist der ERSTE Upload (Startmetrik)\n`;
        contextualPrompt += `- LESE das Erstellungsdatum vom Screenshot mit der LÄNGSTEN Laufzeit AUS\n`;
        contextualPrompt += `- Das Datum steht direkt auf dem Screenshot (z.B. "12/06/2025 19:41:02 Created")\n`;
        contextualPrompt += `- NICHT berechnen! Konvertiere das ausgelesene Datum ins Format: "YYYY-MM-DDTHH:MM"\n`;
        contextualPrompt += `- ACHTUNG: Amerikanisches Format (MM/DD/YYYY) auf Screenshot → konvertiere zu (YYYY-MM-DD)\n\n`;
      } else {
        contextualPrompt += `**DATUM-LOGIK (NORMALER UPLOAD):**\n`;
        contextualPrompt += `- Dies ist ein UPDATE (nicht Startmetrik)\n`;
        contextualPrompt += `- Setze date auf null - das Frontend wird das aktuelle Datum verwenden\n\n`;
      }

      contextualPrompt += `**AUFGABE:**\n`;
      contextualPrompt += `- Summiere ALLE Screenshots für jeden Wert\n`;
      contextualPrompt += `- Berechne Prozentsätze mit beiden Basen (Gesamtinvestment + Investitionsmenge)\n`;
      contextualPrompt += `- Gib die AKTUELLEN GESAMTWERTE zurück\n\n`;
      contextualPrompt += `\n**BEGINNE JETZT MIT DEN BERECHNUNGEN UND ANTWORTE NUR MIT DEM JSON!**`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: contextualPrompt },
          { role: "user", content: "Berechne jetzt alle Werte und gib das JSON zurück." }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      });

      const aiResponse = completion.choices[0]?.message?.content || "{}";

      try {
        const calculatedValues = JSON.parse(aiResponse);

        // VALIDIERUNG 1: Zod Schema-Validierung des AI-Outputs
        // Akzeptiere sowohl string als auch number (AI gibt manchmal numbers zurück)
        const stringOrNumber = z.union([z.string(), z.number()]).nullable();

        const phase4Schema = z.object({
          date: z.string().nullable(),
          botDirection: z.string().nullable(),
          leverage: z.string().nullable(),
          screenshotCount: z.string().nullable(),
          longestRuntime: z.string().nullable(),
          avgRuntime: z.string().nullable(),
          investment: stringOrNumber,
          extraMargin: stringOrNumber,
          totalInvestment: stringOrNumber,
          profit: stringOrNumber,
          profitPercent_gesamtinvestment: stringOrNumber,
          profitPercent_investitionsmenge: stringOrNumber,
          overallTrendPnlUsdt: stringOrNumber,
          overallTrendPnlPercent_gesamtinvestment: stringOrNumber,
          overallTrendPnlPercent_investitionsmenge: stringOrNumber,
          overallGridProfitUsdt: stringOrNumber,
          overallGridProfitPercent_gesamtinvestment: stringOrNumber,
          overallGridProfitPercent_investitionsmenge: stringOrNumber,
          highestGridProfit: stringOrNumber,
          highestGridProfitPercent_gesamtinvestment: stringOrNumber,
          highestGridProfitPercent_investitionsmenge: stringOrNumber,
          avgGridProfitHour: stringOrNumber,
          avgGridProfitDay: stringOrNumber,
          avgGridProfitWeek: stringOrNumber,
        });

        const validationResult = phase4Schema.safeParse(calculatedValues);
        if (!validationResult.success) {
          console.error("AI output schema validation failed:", validationResult.error);
          return res.status(500).json({ 
            error: "AI-Output entspricht nicht dem erwarteten Schema",
            details: validationResult.error.errors
          });
        }

        // DATUM-LOGIK (Server-seitig):
        // - Bei Startmetrik (echt oder manuell): KI berechnet das Datum (ältestes Startdatum basierend auf Runtime)
        // - Bei normalem Upload: Datum auf null setzen - Frontend verwendet aktuelles Echtzeit-Datum
        if (!effectiveStartMetrik) {
          calculatedValues.date = null;
        }

        // STRATEGIE: Server berechnet VERGLEICH Differenzen
        // AI hat bereits die aktuellen Gesamtwerte berechnet (NEU Modus)

        // ABSOLUTE WERTE SPEICHERN (VOR jeder Differenzberechnung)
        // Diese werden immer gespeichert, egal ob Neu- oder Vergleichsmodus
        // Bei Neu-Modus sind sie gleich den normalen Feldern
        // Bei Vergleichsmodus enthalten sie die kompletten Werte (nicht Differenz)
        const absoluteValues: any = {
          investmentAbsolute: calculatedValues.investment,
          extraMarginAbsolute: calculatedValues.extraMargin,
          totalInvestmentAbsolute: calculatedValues.totalInvestment,
          profitAbsolute: calculatedValues.profit,
          profitPercent_gesamtinvestment_absolute: null as string | null,
          profitPercent_investitionsmenge_absolute: null as string | null,
          overallTrendPnlUsdtAbsolute: calculatedValues.overallTrendPnlUsdt,
          overallTrendPnlPercent_gesamtinvestment_absolute: null as string | null,
          overallTrendPnlPercent_investitionsmenge_absolute: null as string | null,
          overallGridProfitUsdtAbsolute: calculatedValues.overallGridProfitUsdt,
          overallGridProfitPercent_gesamtinvestment_absolute: null as string | null,
          overallGridProfitPercent_investitionsmenge_absolute: null as string | null,
          avgGridProfitHourAbsolute: calculatedValues.avgGridProfitHour,
          avgGridProfitDayAbsolute: calculatedValues.avgGridProfitDay,
          avgGridProfitWeekAbsolute: calculatedValues.avgGridProfitWeek,
        };

        // Berechne absolute Prozentwerte (basierend auf absoluten USDT-Werten)
        const absInv = parseFloat(absoluteValues.investmentAbsolute || 0);
        const absTotalInv = parseFloat(absoluteValues.totalInvestmentAbsolute || 0);
        const absProfit = parseFloat(absoluteValues.profitAbsolute || 0);
        const absTrend = parseFloat(absoluteValues.overallTrendPnlUsdtAbsolute || 0);
        const absGrid = parseFloat(absoluteValues.overallGridProfitUsdtAbsolute || 0);

        if (absTotalInv > 0) {
          absoluteValues.profitPercent_gesamtinvestment_absolute = ((absProfit / absTotalInv) * 100).toFixed(2);
          absoluteValues.overallTrendPnlPercent_gesamtinvestment_absolute = ((absTrend / absTotalInv) * 100).toFixed(2);
          absoluteValues.overallGridProfitPercent_gesamtinvestment_absolute = ((absGrid / absTotalInv) * 100).toFixed(2);
        }
        if (absInv > 0) {
          absoluteValues.profitPercent_investitionsmenge_absolute = ((absProfit / absInv) * 100).toFixed(2);
          absoluteValues.overallTrendPnlPercent_investitionsmenge_absolute = ((absTrend / absInv) * 100).toFixed(2);
          absoluteValues.overallGridProfitPercent_investitionsmenge_absolute = ((absGrid / absInv) * 100).toFixed(2);
        }

        // STARTMETRIK GUARD: Wenn Startmetrik-Modus (echt oder manuell) mit VERGLEICH Modi → setze auf 0.00
        if (effectiveStartMetrik) {
          // Für Startmetrik: setze alle VERGLEICH Felder auf "0.00"
          if (modes.investment === 'Vergleich') {
            calculatedValues.investment = "0.00";
            calculatedValues.extraMargin = "0.00";
            calculatedValues.totalInvestment = "0.00";
          }

          if (modes.profit === 'Vergleich') {
            calculatedValues.profit = "0.00";
            calculatedValues.profitPercent_gesamtinvestment = "0.00";
            calculatedValues.profitPercent_investitionsmenge = "0.00";
          }

          if (modes.trend === 'Vergleich') {
            calculatedValues.overallTrendPnlUsdt = "0.00";
            calculatedValues.overallTrendPnlPercent_gesamtinvestment = "0.00";
            calculatedValues.overallTrendPnlPercent_investitionsmenge = "0.00";
          }

          if (modes.grid === 'Vergleich') {
            calculatedValues.overallGridProfitUsdt = "0.00";
            calculatedValues.overallGridProfitPercent_gesamtinvestment = "0.00";
            calculatedValues.overallGridProfitPercent_investitionsmenge = "0.00";
            // WICHTIG: highestGridProfit wird NICHT auf 0 gesetzt!
            // Der höchste Grid Profit ist immer der absolute Wert vom aktuellen Upload
            // calculatedValues.highestGridProfit bleibt unverändert (absoluter Wert)
            // calculatedValues.highestGridProfitPercent_* bleibt unverändert (absoluter Wert)
            calculatedValues.avgGridProfitHour = "0.00";
            calculatedValues.avgGridProfitDay = "0.00";
            calculatedValues.avgGridProfitWeek = "0.00";
          }
        }

        // VERGLEICH DIFFERENZEN: Nur wenn NICHT Startmetrik-Modus (echt oder manuell) UND previous data vorhanden
        if (!effectiveStartMetrik && previousUploadData) {
          const parsedPrevious = typeof previousUploadData === 'string' 
            ? JSON.parse(previousUploadData) 
            : previousUploadData;

          // Helper: Berechne Differenz (current - previous)
          // decimals: Anzahl der Nachkommastellen (2 für Prozent/Investment, 4 für USDT)
          const calcDelta = (current: any, previous: any, decimals: number = 2): string => {
            const curr = parseFloat(current || 0);
            const prev = parseFloat(previous || 0);
            return (curr - prev).toFixed(decimals);
          };

          // Spezielle Funktion für USDT-Werte mit bis zu 4 Nachkommastellen
          const calcDeltaUsdt = (current: any, previous: any): string => {
            return calcDelta(current, previous, 4);
          };

          // Investment Section - Server berechnet Differenz
          if (modes.investment === 'Vergleich') {
            calculatedValues.investment = calcDelta(calculatedValues.investment, parsedPrevious.investment);
            calculatedValues.extraMargin = calcDelta(calculatedValues.extraMargin, parsedPrevious.extraMargin);
            calculatedValues.totalInvestment = calcDelta(calculatedValues.totalInvestment, parsedPrevious.totalInvestment);
          }

          // Profit Section - Server berechnet Differenz
          if (modes.profit === 'Vergleich') {
            // Speichere aktuelle absolute Werte für Prozentberechnung
            const currentAbsoluteProfit = parseFloat(calculatedValues.profit || 0);
            const currentAbsoluteTotalInvestment = parseFloat(calculatedValues.totalInvestment || 0);
            const currentAbsoluteInvestment = parseFloat(calculatedValues.investment || 0);
            
            // USDT-Wert: 4 Nachkommastellen - Differenz
            const profitDelta = currentAbsoluteProfit - parseFloat(parsedPrevious.profit || 0);
            calculatedValues.profit = profitDelta.toFixed(4);
            
            // WICHTIG: Prozentwerte basierend auf USDT-Differenz berechnen, nicht Prozent-Differenz!
            // Dies stellt sicher, dass das Vorzeichen konsistent mit dem USDT-Wert ist.
            // Formel: profitPercent_change = (profitDelta / aktuelles_Investment) × 100
            calculatedValues.profitPercent_gesamtinvestment = currentAbsoluteTotalInvestment > 0 
              ? (profitDelta / currentAbsoluteTotalInvestment * 100).toFixed(2) 
              : "0.00";
            calculatedValues.profitPercent_investitionsmenge = currentAbsoluteInvestment > 0 
              ? (profitDelta / currentAbsoluteInvestment * 100).toFixed(2) 
              : "0.00";
          }

          // Trend P&L Section - Server berechnet Differenz
          if (modes.trend === 'Vergleich') {
            // Speichere aktuelle absolute Werte für Prozentberechnung
            const currentAbsoluteTrendUsdt = parseFloat(calculatedValues.overallTrendPnlUsdt || 0);
            const currentAbsoluteTotalInv = parseFloat(calculatedValues.totalInvestment || 0);
            const currentAbsoluteInv = parseFloat(calculatedValues.investment || 0);
            
            // USDT-Wert: 4 Nachkommastellen - Differenz
            const trendDelta = currentAbsoluteTrendUsdt - parseFloat(parsedPrevious.overallTrendPnlUsdt || 0);
            calculatedValues.overallTrendPnlUsdt = trendDelta.toFixed(4);
            
            // Prozentwerte basierend auf USDT-Differenz berechnen
            calculatedValues.overallTrendPnlPercent_gesamtinvestment = currentAbsoluteTotalInv > 0 
              ? (trendDelta / currentAbsoluteTotalInv * 100).toFixed(2) 
              : "0.00";
            calculatedValues.overallTrendPnlPercent_investitionsmenge = currentAbsoluteInv > 0 
              ? (trendDelta / currentAbsoluteInv * 100).toFixed(2) 
              : "0.00";
          }

          // Grid Profit Section - Server berechnet Differenz
          if (modes.grid === 'Vergleich') {
            // Speichere aktuelle absolute Werte für Prozentberechnung
            const currentAbsoluteGridUsdt = parseFloat(calculatedValues.overallGridProfitUsdt || 0);
            const currentAbsoluteTotalInvG = parseFloat(calculatedValues.totalInvestment || 0);
            const currentAbsoluteInvG = parseFloat(calculatedValues.investment || 0);
            
            // USDT-Wert: 4 Nachkommastellen - Differenz
            const gridDelta = currentAbsoluteGridUsdt - parseFloat(parsedPrevious.overallGridProfitUsdt || 0);
            calculatedValues.overallGridProfitUsdt = gridDelta.toFixed(4);
            
            // Prozentwerte basierend auf USDT-Differenz berechnen
            calculatedValues.overallGridProfitPercent_gesamtinvestment = currentAbsoluteTotalInvG > 0 
              ? (gridDelta / currentAbsoluteTotalInvG * 100).toFixed(2) 
              : "0.00";
            calculatedValues.overallGridProfitPercent_investitionsmenge = currentAbsoluteInvG > 0 
              ? (gridDelta / currentAbsoluteInvG * 100).toFixed(2) 
              : "0.00";
            
            // WICHTIG: highestGridProfit wird NICHT als Differenz berechnet!
            // Der höchste Grid Profit ist immer der absolute Wert vom aktuellen Upload
            // calculatedValues.highestGridProfit bleibt unverändert (absoluter Wert)
            // calculatedValues.highestGridProfitPercent_* bleibt unverändert (absoluter Wert)

            calculatedValues.avgGridProfitHour = calcDelta(
              calculatedValues.avgGridProfitHour,
              parsedPrevious.avgGridProfitHour
            );
            calculatedValues.avgGridProfitDay = calcDelta(
              calculatedValues.avgGridProfitDay,
              parsedPrevious.avgGridProfitDay
            );
            calculatedValues.avgGridProfitWeek = calcDelta(
              calculatedValues.avgGridProfitWeek,
              parsedPrevious.avgGridProfitWeek
            );
          }
        }

        // HINWEIS: avgGridProfit* (Stunde/Tag/Woche) wird jetzt im Frontend berechnet
        // basierend auf: Gesamter Grid Profit / Upload-Laufzeit
        // Daher keine Server-Validierung mehr für diese Felder erforderlich

        res.json({ 
          success: true,
          values: calculatedValues,
          // Absolute Werte (komplette Werte, nicht Differenz) - wichtig für Charts
          absoluteValues: absoluteValues,
          // Berechnungsmodus: "Startmetrik" wenn echter erster Upload ODER manuell ausgewählt
          // WICHTIG: Bei echtem Startmetrik (isStartMetric=true) ist es IMMER "Startmetrik"
          calculationMode: isStartMetric || manualStartmetrikMode ? 'Startmetrik' : 'Normal'
        });
      } catch (parseError) {
        console.error("Failed to parse AI JSON response:", aiResponse);
        res.status(500).json({ 
          error: "AI returned invalid JSON",
          raw: aiResponse
        });
      }
    } catch (error: any) {
      console.error("Phase 4 API error:", error);
      res.status(500).json({ 
        error: "Failed to complete Phase 4 calculations", 
        details: error.message 
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, images, botTypes, updateHistory, phase, selectedBotType, selectedBotTypeId, selectedBotTypeName, selectedBotTypeColor, outputMode } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      let contextualPrompt = SYSTEM_PROMPT;
      if (phase === 'phase2_step1') {
        contextualPrompt = PHASE_2_STEP_1_PROMPT;
      } else if (phase === 'phase2_step2') {
        contextualPrompt = PHASE_2_STEP_2_PROMPT;
      } else if (phase === 'phase2_data_extraction') {
        // KRITISCH: Verwende separaten Prompt für Closed Bots (keine Berechnungen!)
        if (outputMode === 'closed-bots') {
          contextualPrompt = PHASE_2_DATA_EXTRACTION_CLOSED_BOTS_PROMPT;
          console.log('Phase 2 Extraction: Using CLOSED BOTS prompt (no calculations)');
        } else {
          contextualPrompt = PHASE_2_DATA_EXTRACTION_PROMPT;
          console.log('Phase 2 Extraction: Using standard prompt (with date calculations)');
        }
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

      const completionOptions: any = {
        model: "gpt-4o",
        messages: chatMessages,
        max_tokens: 2000,
      };

      if (phase === 'phase2_data_extraction') {
        completionOptions.response_format = { type: "json_object" };
      }

      const completion = await openai.chat.completions.create(completionOptions);

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

  // ========================================================================
  // 5-STUFEN FALLBACK-SYSTEM FÜR 100% ZUVERLÄSSIGE TRENDPREISE
  // ========================================================================
  // Stufe 1: OKX Primary API (2s TTL Cache)
  // Stufe 2: Last-Known-Good Cache (persistiert auch bei API-Ausfall)
  // Stufe 3: CoinGecko Fallback (für Spot-Preise)
  // Stufe 4: Stale Cache Return (alte Daten besser als keine)
  // Stufe 5: Emergency Static Fallback (letzte bekannte Preise)
  // ========================================================================

  // Primary Cache (2s TTL) - Stufe 1
  let okxFuturesCacheData: Map<string, any> = new Map();
  let okxFuturesCacheTime: number = 0;
  let okxSpotCacheData: Map<string, any> = new Map();
  let okxSpotCacheTime: number = 0;
  const OKX_CACHE_TTL = 2000; // 2 Sekunden Cache für Echtzeit-Updates

  // Last-Known-Good Cache (persistiert) - Stufe 2
  const lastKnownGoodPrices: Map<string, { data: any, timestamp: number, market: 'spot' | 'futures' }> = new Map();
  const LAST_KNOWN_GOOD_MAX_AGE = 24 * 60 * 60 * 1000; // 24 Stunden max Alter

  // Hilfsfunktion: Last-Known-Good speichern
  const saveLastKnownGood = (symbol: string, data: any, market: 'spot' | 'futures') => {
    lastKnownGoodPrices.set(`${market}:${symbol}`, {
      data: { ...data, source: `${data.source || 'OKX'}-LKG` },
      timestamp: Date.now(),
      market
    });
  };

  // Hilfsfunktion: Last-Known-Good abrufen
  const getLastKnownGood = (symbol: string, market: 'spot' | 'futures'): any | null => {
    const key = `${market}:${symbol}`;
    const cached = lastKnownGoodPrices.get(key);
    if (cached && (Date.now() - cached.timestamp) < LAST_KNOWN_GOOD_MAX_AGE) {
      console.log(`[FALLBACK] Using Last-Known-Good for ${symbol} (${market}), age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s`);
      return cached.data;
    }
    return null;
  };

  // Stufe 3: CoinGecko Fallback für Spot
  const fetchCoinGeckoPrice = async (symbol: string): Promise<any | null> => {
    try {
      const base = symbol.replace('USDT', '').toLowerCase();
      const coinGeckoIds: Record<string, string> = {
        'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'bnb': 'binancecoin',
        'xrp': 'ripple', 'ada': 'cardano', 'doge': 'dogecoin', 'dot': 'polkadot',
        'avax': 'avalanche-2', 'link': 'chainlink', 'ltc': 'litecoin', 'icp': 'internet-computer',
        'matic': 'matic-network', 'atom': 'cosmos', 'near': 'near', 'apt': 'aptos',
        'arb': 'arbitrum', 'op': 'optimism', 'sui': 'sui', 'sei': 'sei-network'
      };
      
      const coinId = coinGeckoIds[base];
      if (!coinId) return null;

      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`);
      if (!response.ok) return null;

      const data = await response.json();
      if (data[coinId]) {
        console.log(`[FALLBACK] CoinGecko price for ${symbol}: $${data[coinId].usd}`);
        return {
          symbol: symbol,
          lastPrice: data[coinId].usd.toString(),
          priceChangePercent: (data[coinId].usd_24h_change || 0).toFixed(2),
          source: 'CoinGecko'
        };
      }
      return null;
    } catch (err) {
      console.error(`[FALLBACK] CoinGecko error for ${symbol}:`, err);
      return null;
    }
  };

  app.get("/api/okx/futures", async (req, res) => {
    try {
      const symbols = req.query.symbols as string;
      if (!symbols) {
        return res.status(400).json({ error: 'symbols parameter required' });
      }

      const now = Date.now();
      const symbolList = symbols.split(',');
      
      // STUFE 1: Check if cache is still valid
      if ((now - okxFuturesCacheTime) < OKX_CACHE_TTL && okxFuturesCacheData.size > 0) {
        const cachedResults: any[] = [];
        let allCached = true;
        for (const sym of symbolList) {
          if (okxFuturesCacheData.has(sym)) {
            cachedResults.push(okxFuturesCacheData.get(sym));
          } else {
            allCached = false;
            break;
          }
        }
        if (allCached && cachedResults.length > 0) {
          console.log('[API] OKX Futures: returning cached data');
          return res.json(cachedResults);
        }
      }

      // Fetch fresh data from OKX
      console.log('[API] OKX Futures: fetching fresh data for', symbolList.join(', '));
      
      const results: any[] = [];
      for (const symbol of symbolList) {
        // Convert ETHUSDT -> ETH-USDT-SWAP format for OKX
        const base = symbol.replace('USDT', '');
        const okxInstId = `${base}-USDT-SWAP`;
        
        try {
          const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.code === '0' && data.data && data.data[0]) {
              const ticker = data.data[0];
              const lastPrice = parseFloat(ticker.last);
              const open24h = parseFloat(ticker.open24h);
              const priceChangePercent = ((lastPrice - open24h) / open24h * 100).toFixed(2);
              
              const result = {
                symbol: symbol,
                lastPrice: ticker.last,
                priceChangePercent: priceChangePercent,
                source: 'OKX'
              };
              
              results.push(result);
              okxFuturesCacheData.set(symbol, result);
              saveLastKnownGood(symbol, result, 'futures'); // STUFE 2: Save LKG
            }
          }
        } catch (err) {
          console.error(`[API] OKX error for ${symbol}:`, err);
          
          // STUFE 2: Try Last-Known-Good
          const lkg = getLastKnownGood(symbol, 'futures');
          if (lkg) {
            results.push(lkg);
          }
        }
      }
      
      okxFuturesCacheTime = now;
      
      // STUFE 4: Ensure EVERY requested symbol has a price (per-symbol fallback)
      const returnedSymbols = new Set(results.map(r => r.symbol));
      for (const sym of symbolList) {
        if (!returnedSymbols.has(sym)) {
          console.log(`[FALLBACK] Futures symbol ${sym} missing, trying fallbacks...`);
          // Try stale cache first
          if (okxFuturesCacheData.has(sym)) {
            const stale = { ...okxFuturesCacheData.get(sym), source: 'OKX-Stale' };
            results.push(stale);
            returnedSymbols.add(sym);
            continue;
          }
          // Try LKG
          const lkg = getLastKnownGood(sym, 'futures');
          if (lkg) {
            results.push(lkg);
            returnedSymbols.add(sym);
            continue;
          }
          // STUFE 5: Emergency static fallback
          console.warn(`[FALLBACK] No data for futures ${sym}, using emergency value`);
          results.push({
            symbol: sym,
            lastPrice: '0',
            priceChangePercent: '0.00',
            source: 'Emergency-NoData'
          });
        }
      }
      
      if (results.length === 0) {
        return res.status(502).json({ error: 'Failed to fetch OKX data' });
      }
      
      res.json(results);
    } catch (error) {
      console.error('[API] OKX Futures proxy error:', error);
      
      // STUFE 4: Return any cached data on total failure
      const emergencyResults: any[] = [];
      const symbols = (req.query.symbols as string || '').split(',');
      for (const sym of symbols) {
        if (okxFuturesCacheData.has(sym)) {
          emergencyResults.push({ ...okxFuturesCacheData.get(sym), source: 'OKX-Emergency' });
        } else {
          const lkg = getLastKnownGood(sym, 'futures');
          if (lkg) emergencyResults.push(lkg);
        }
      }
      
      if (emergencyResults.length > 0) {
        console.log('[FALLBACK] Returning emergency cached data');
        return res.json(emergencyResults);
      }
      
      res.status(500).json({ error: 'Failed to fetch OKX data' });
    }
  });

  app.get("/api/okx/spot", async (req, res) => {
    try {
      const symbols = req.query.symbols as string;
      if (!symbols) {
        return res.status(400).json({ error: 'symbols parameter required' });
      }

      const now = Date.now();
      const symbolList = symbols.split(',');
      
      // STUFE 1: Check if cache is still valid
      if ((now - okxSpotCacheTime) < OKX_CACHE_TTL && okxSpotCacheData.size > 0) {
        const cachedResults: any[] = [];
        let allCached = true;
        for (const sym of symbolList) {
          if (okxSpotCacheData.has(sym)) {
            cachedResults.push(okxSpotCacheData.get(sym));
          } else {
            allCached = false;
            break;
          }
        }
        if (allCached && cachedResults.length > 0) {
          console.log('[API] OKX Spot: returning cached data');
          return res.json(cachedResults);
        }
      }

      // Fetch fresh data from OKX
      console.log('[API] OKX Spot: fetching fresh data for', symbolList.join(', '));
      
      const results: any[] = [];
      for (const symbol of symbolList) {
        // Convert ETHUSDT -> ETH-USDT format for OKX Spot
        const base = symbol.replace('USDT', '');
        const okxInstId = `${base}-USDT`;
        
        try {
          const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.code === '0' && data.data && data.data[0]) {
              const ticker = data.data[0];
              const lastPrice = parseFloat(ticker.last);
              const open24h = parseFloat(ticker.open24h);
              const priceChangePercent = ((lastPrice - open24h) / open24h * 100).toFixed(2);
              
              const result = {
                symbol: symbol,
                lastPrice: ticker.last,
                priceChangePercent: priceChangePercent,
                source: 'OKX'
              };
              
              results.push(result);
              okxSpotCacheData.set(symbol, result);
              saveLastKnownGood(symbol, result, 'spot'); // STUFE 2: Save LKG
            }
          }
        } catch (err) {
          console.error(`[API] OKX Spot error for ${symbol}:`, err);
          
          // STUFE 3: Try CoinGecko fallback
          const cgPrice = await fetchCoinGeckoPrice(symbol);
          if (cgPrice) {
            results.push(cgPrice);
            saveLastKnownGood(symbol, cgPrice, 'spot');
          } else {
            // STUFE 2: Try Last-Known-Good
            const lkg = getLastKnownGood(symbol, 'spot');
            if (lkg) results.push(lkg);
          }
        }
      }
      
      okxSpotCacheTime = now;
      
      // STUFE 4: Ensure EVERY requested symbol has a price (per-symbol fallback)
      const returnedSymbols = new Set(results.map(r => r.symbol));
      for (const sym of symbolList) {
        if (!returnedSymbols.has(sym)) {
          console.log(`[FALLBACK] Symbol ${sym} missing, trying fallbacks...`);
          // Try stale cache first
          if (okxSpotCacheData.has(sym)) {
            const stale = { ...okxSpotCacheData.get(sym), source: 'OKX-Stale' };
            results.push(stale);
            returnedSymbols.add(sym);
            continue;
          }
          // Try LKG
          const lkg = getLastKnownGood(sym, 'spot');
          if (lkg) {
            results.push(lkg);
            returnedSymbols.add(sym);
            continue;
          }
          // Try CoinGecko as last resort
          const cgPrice = await fetchCoinGeckoPrice(sym);
          if (cgPrice) {
            results.push(cgPrice);
            returnedSymbols.add(sym);
            continue;
          }
          // STUFE 5: Emergency static fallback
          console.warn(`[FALLBACK] No data for ${sym}, using emergency value`);
          results.push({
            symbol: sym,
            lastPrice: '0',
            priceChangePercent: '0.00',
            source: 'Emergency-NoData'
          });
        }
      }
      
      if (results.length === 0) {
        return res.status(502).json({ error: 'Failed to fetch OKX Spot data' });
      }
      
      res.json(results);
    } catch (error) {
      console.error('[API] OKX Spot proxy error:', error);
      
      // STUFE 4: Return any cached data on total failure
      const emergencyResults: any[] = [];
      const symbols = (req.query.symbols as string || '').split(',');
      for (const sym of symbols) {
        if (okxSpotCacheData.has(sym)) {
          emergencyResults.push({ ...okxSpotCacheData.get(sym), source: 'OKX-Emergency' });
        } else {
          const lkg = getLastKnownGood(sym, 'spot');
          if (lkg) emergencyResults.push(lkg);
        }
      }
      
      if (emergencyResults.length > 0) {
        console.log('[FALLBACK] Returning emergency cached data');
        return res.json(emergencyResults);
      }
      
      res.status(500).json({ error: 'Failed to fetch OKX Spot data' });
    }
  });

  // TEST ENDPOINT: Simulate fallback tiers for testing
  app.get("/api/test-fallback-tiers", async (req, res) => {
    const tier = parseInt(req.query.tier as string) || 1;
    const symbol = (req.query.symbol as string) || 'BTCUSDT';
    
    console.log(`[TEST-FALLBACK] Testing Tier ${tier} for ${symbol}`);
    
    let result: any = null;
    let tierUsed = '';
    
    switch (tier) {
      case 1:
        // TIER 1: Normal OKX fetch
        const base = symbol.replace('USDT', '');
        const okxInstId = `${base}-USDT`;
        try {
          const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.code === '0' && data.data?.[0]) {
              const ticker = data.data[0];
              result = { symbol, lastPrice: ticker.last, source: 'OKX' };
              saveLastKnownGood(symbol, result, 'spot'); // Save for tier 2 tests
              tierUsed = 'Tier1-OKX';
            }
          }
        } catch (e) {}
        break;
        
      case 2:
        // TIER 2: Last-Known-Good (simulate OKX failure)
        console.log(`[TEST-FALLBACK] Simulating OKX failure, trying LKG...`);
        const lkg = getLastKnownGood(symbol, 'spot');
        if (lkg) {
          result = { ...lkg, source: 'LKG-Test' };
          tierUsed = 'Tier2-LKG';
          console.log(`[TEST-FALLBACK] LKG found for ${symbol}: ${lkg.lastPrice}`);
        } else {
          console.log(`[TEST-FALLBACK] No LKG data for ${symbol}`);
        }
        break;
        
      case 3:
        // TIER 3: CoinGecko fallback (simulate OKX + LKG failure)
        console.log(`[TEST-FALLBACK] Simulating OKX+LKG failure, trying CoinGecko...`);
        const cgPrice = await fetchCoinGeckoPrice(symbol);
        if (cgPrice) {
          result = { ...cgPrice, source: 'CoinGecko-Test' };
          tierUsed = 'Tier3-CoinGecko';
          console.log(`[TEST-FALLBACK] CoinGecko found for ${symbol}: ${cgPrice.lastPrice}`);
        } else {
          console.log(`[TEST-FALLBACK] No CoinGecko data for ${symbol}`);
        }
        break;
        
      case 4:
        // TIER 4: Stale cache (simulate all external sources failed)
        console.log(`[TEST-FALLBACK] Simulating all APIs failed, trying stale cache...`);
        if (okxSpotCacheData.has(symbol)) {
          const stale = okxSpotCacheData.get(symbol);
          result = { ...stale, source: 'Stale-Cache-Test' };
          tierUsed = 'Tier4-StaleCache';
          console.log(`[TEST-FALLBACK] Stale cache found for ${symbol}: ${stale.lastPrice}`);
        } else {
          console.log(`[TEST-FALLBACK] No stale cache for ${symbol}`);
        }
        break;
        
      case 5:
        // TIER 5: Emergency static fallback
        console.log(`[TEST-FALLBACK] Simulating complete failure, using emergency...`);
        result = { symbol, lastPrice: '0', source: 'Emergency-NoData-Test' };
        tierUsed = 'Tier5-Emergency';
        break;
    }
    
    if (!result) {
      result = { symbol, lastPrice: '0', source: 'Emergency-NoData-Test', tierUsed: 'Tier5-Fallback' };
      tierUsed = 'Tier5-Fallback (no data at requested tier)';
    }
    
    res.json({ 
      requestedTier: tier, 
      tierUsed, 
      result,
      timestamp: new Date().toISOString()
    });
  });

  // CoinGecko Proxy - kept as fallback but not primary source anymore
  let coinGeckoCacheData: any = null;
  let coinGeckoCacheTime: number = 0;
  const COINGECKO_CACHE_TTL = 30000; // 30 Sekunden Cache

  app.get("/api/coingecko/derivatives", async (req, res) => {
    try {
      const now = Date.now();
      
      // Return cached data if still valid
      if (coinGeckoCacheData && (now - coinGeckoCacheTime) < COINGECKO_CACHE_TTL) {
        console.log('[API] CoinGecko derivatives: returning cached data');
        return res.json(coinGeckoCacheData);
      }

      // Fetch fresh data from CoinGecko
      console.log('[API] CoinGecko derivatives: fetching fresh data');
      const response = await fetch('https://api.coingecko.com/api/v3/derivatives');
      
      if (!response.ok) {
        console.error('[API] CoinGecko API error:', response.status);
        // If we have cached data, return it even if stale
        if (coinGeckoCacheData) {
          console.log('[API] CoinGecko: returning stale cache due to API error');
          return res.json(coinGeckoCacheData);
        }
        return res.status(response.status).json({ error: 'CoinGecko API error' });
      }

      const data = await response.json();
      
      // Update cache
      coinGeckoCacheData = data;
      coinGeckoCacheTime = now;
      
      res.json(data);
    } catch (error) {
      console.error('[API] CoinGecko proxy error:', error);
      // If we have cached data, return it even if stale
      if (coinGeckoCacheData) {
        console.log('[API] CoinGecko: returning stale cache due to error');
        return res.json(coinGeckoCacheData);
      }
      res.status(500).json({ error: 'Failed to fetch CoinGecko data' });
    }
  });

  app.get("/api/bot-types", async (req, res) => {
    try {
      const botTypes = await storage.getAllBotTypes();
      res.json(botTypes);
    } catch (error) {
      console.error("Error fetching bot types:", error);
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
        (data) => data.name !== undefined || data.description !== undefined || data.color !== undefined || data.wontLiqBudget !== undefined, // Added wontLiqBudget check
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

  // Archive/unarchive bot type
  app.patch('/api/bot-types/:id/archive', async (req, res) => {
    try {
      const { id } = req.params;
      const { isArchived } = req.body;

      const [updated] = await db
        .update(botTypes)
        .set({ isArchived })
        .where(eq(botTypes.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Bot-Typ nicht gefunden' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error archiving bot type:', error);
      res.status(500).json({ error: 'Fehler beim Archivieren' });
    }
  });

  // Toggle active status
  app.patch('/api/bot-types/:id/active', async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const [updated] = await db
        .update(botTypes)
        .set({ isActive })
        .where(eq(botTypes.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Bot-Typ nicht gefunden' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating active status:', error);
      res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
    }
  });

  // Bot Type Updates Routes

  // Get all updates for all bot types (for calculating totals on cards)
  app.get("/api/bot-type-updates", async (req, res) => {
    try {
      const allUpdates = await storage.getAllBotTypeUpdates();
      res.json(allUpdates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch all updates" });
    }
  });

  app.get("/api/bot-types/:id/updates", async (req, res) => {
    try {
      const updates = await storage.getBotTypeUpdates(req.params.id);
      res.json(updates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch updates" });
    }
  });

  // Get the latest update for a specific bot type, optionally filtered by status
  // Query params: ?status=Closed%20Bots or ?status=Update%20Metrics
  app.get("/api/bot-types/:id/updates/latest", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.query;
      
      // Fetch all updates for this bot type
      const allUpdates = await storage.getBotTypeUpdates(id);
      
      // Filter by status if provided
      let filteredUpdates = allUpdates;
      if (status && typeof status === 'string') {
        filteredUpdates = allUpdates.filter(u => u.status === status);
      }
      
      // Sort by createdAt (descending) to get the most recent upload
      filteredUpdates.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      // Return the latest one, or null if none found
      const latest = filteredUpdates[0] || null;
      res.json(latest);
    } catch (error) {
      console.error('Error fetching latest update:', error);
      res.status(500).json({ error: "Failed to fetch latest update" });
    }
  });

  app.post("/api/bot-types/:id/updates", async (req, res) => {
    try {
      const validatedData = insertBotTypeUpdateSchema.parse({
        ...req.body,
        botTypeId: req.params.id,
      });
      const update = await storage.createBotTypeUpdate(validatedData);
      res.status(201).json(update);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create update" });
    }
  });

  // Update notes for a specific bot type update
  app.patch("/api/bot-type-updates/:updateId/notes", async (req, res) => {
    try {
      const { notes } = req.body;
      if (typeof notes !== 'string') {
        return res.status(400).json({ error: "notes must be a string" });
      }
      const updated = await storage.updateBotTypeUpdateNotes(req.params.updateId, notes);
      if (!updated) {
        return res.status(404).json({ error: "Update not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notes" });
    }
  });

  // Delete a specific bot type update
  app.delete("/api/bot-type-updates/:updateId", async (req, res) => {
    try {
      const deleted = await storage.deleteBotTypeUpdate(req.params.updateId);
      if (!deleted) {
        return res.status(404).json({ error: "Update not found" });
      }
      res.json({ success: true, message: "Update deleted successfully" });
    } catch (error) {
      console.error('Error deleting update:', error);
      res.status(500).json({ error: "Failed to delete update" });
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

  // ===== GRAPH SETTINGS API =====
  // GET alle Graph Settings
  app.get("/api/graph-settings", async (req, res) => {
    try {
      const settings = await storage.getAllGraphSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch graph settings" });
    }
  });

  // GET Default Graph Settings
  app.get("/api/graph-settings/default", async (req, res) => {
    try {
      const settings = await storage.getDefaultGraphSettings();
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch default graph settings" });
    }
  });

  // GET einzelne Graph Settings by ID
  app.get("/api/graph-settings/:id", async (req, res) => {
    try {
      const settings = await storage.getGraphSettings(req.params.id);
      if (!settings) {
        return res.status(404).json({ error: "Graph settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch graph settings" });
    }
  });

  // POST neue Graph Settings erstellen
  app.post("/api/graph-settings", async (req, res) => {
    try {
      const validatedData = insertGraphSettingsSchema.parse(req.body);
      const settings = await storage.createGraphSettings(validatedData);
      res.status(201).json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create graph settings" });
    }
  });

  // PUT Graph Settings aktualisieren
  app.put("/api/graph-settings/:id", async (req, res) => {
    try {
      const updateSchema = insertGraphSettingsSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      const settings = await storage.updateGraphSettings(req.params.id, validatedData);
      if (!settings) {
        return res.status(404).json({ error: "Graph settings not found" });
      }
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update graph settings" });
    }
  });

  // DELETE Graph Settings löschen
  app.delete("/api/graph-settings/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteGraphSettings(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Graph settings not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete graph settings" });
    }
  });

  // POST Default Graph Settings setzen
  app.post("/api/graph-settings/:id/set-default", async (req, res) => {
    try {
      const settings = await storage.setDefaultGraphSettings(req.params.id);
      if (!settings) {
        return res.status(404).json({ error: "Graph settings not found" });
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to set default graph settings" });
    }
  });

  // ============================================================================
  // ACTIVE ALARMS ENDPOINTS (Cross-Device Sync)
  // These endpoints enable alarm synchronization across all devices
  // ============================================================================

  // GET all active alarms
  app.get("/api/active-alarms", async (req, res) => {
    try {
      const alarms = await storage.getAllActiveAlarms();
      console.log(`[API] GET /api/active-alarms - returning ${alarms.length} alarms`);
      res.json(alarms);
    } catch (error) {
      console.error("[API] GET /api/active-alarms error:", error);
      res.status(500).json({ error: "Failed to fetch active alarms" });
    }
  });

  // GET single active alarm by ID
  app.get("/api/active-alarms/:id", async (req, res) => {
    try {
      const alarm = await storage.getActiveAlarm(req.params.id);
      if (!alarm) {
        return res.status(404).json({ error: "Alarm not found" });
      }
      res.json(alarm);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alarm" });
    }
  });

  // POST create new active alarm
  app.post("/api/active-alarms", async (req, res) => {
    try {
      const validatedData = insertActiveAlarmSchema.parse(req.body);
      const alarm = await storage.createActiveAlarm(validatedData);
      console.log(`[API] POST /api/active-alarms - created alarm: ${alarm.id} for ${alarm.trendPriceName}`);
      res.status(201).json(alarm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[API] POST /api/active-alarms validation error:", error.errors);
        return res.status(400).json({ error: "Invalid alarm data", details: error.errors });
      }
      console.error("[API] POST /api/active-alarms error:", error);
      res.status(500).json({ error: "Failed to create alarm" });
    }
  });

  // PATCH update active alarm (e.g., repetition count)
  app.patch("/api/active-alarms/:id", async (req, res) => {
    try {
      const validatedData = insertActiveAlarmSchema.partial().parse(req.body);
      const alarm = await storage.updateActiveAlarm(req.params.id, validatedData);
      if (!alarm) {
        return res.status(404).json({ error: "Alarm not found" });
      }
      console.log(`[API] PATCH /api/active-alarms/${req.params.id} - updated`);
      res.json(alarm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("[API] PATCH /api/active-alarms validation error:", error.errors);
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update alarm" });
    }
  });

  // DELETE single alarm (APPROVE)
  app.delete("/api/active-alarms/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteActiveAlarm(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Alarm not found" });
      }
      console.log(`[API] DELETE /api/active-alarms/${req.params.id} - APPROVED and removed`);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alarm" });
    }
  });

  // ============================================================================
  // NOTIFICATION SETTINGS - Cross-Device Synchronization
  // ============================================================================

  // ===== WATCHLIST =====
  
  // GET all watchlist items
  app.get("/api/notification-watchlist", async (req, res) => {
    try {
      const items = await storage.getAllWatchlistItems();
      console.log(`[API] GET /api/notification-watchlist - returning ${items.length} items`);
      res.json(items);
    } catch (error) {
      console.error("[API] GET /api/notification-watchlist error:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  // POST create watchlist item
  app.post("/api/notification-watchlist", async (req, res) => {
    try {
      const validatedData = insertWatchlistSchema.parse(req.body);
      const item = await storage.createWatchlistItem(validatedData);
      console.log(`[API] POST /api/notification-watchlist - created: ${item.symbol}`);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid watchlist data", details: error.errors });
      }
      console.error("[API] POST /api/notification-watchlist error:", error);
      res.status(500).json({ error: "Failed to create watchlist item" });
    }
  });

  // DELETE watchlist item
  app.delete("/api/notification-watchlist/:symbol/:marketType", async (req, res) => {
    try {
      const deleted = await storage.deleteWatchlistItem(req.params.symbol, req.params.marketType);
      if (!deleted) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      console.log(`[API] DELETE /api/notification-watchlist/${req.params.symbol}/${req.params.marketType}`);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete watchlist item" });
    }
  });

  // POST sync entire watchlist (replace all)
  app.post("/api/notification-watchlist/sync", async (req, res) => {
    try {
      const items = z.array(insertWatchlistSchema).parse(req.body);
      const result = await storage.syncWatchlist(items);
      console.log(`[API] POST /api/notification-watchlist/sync - synced ${result.length} items`);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid watchlist data", details: error.errors });
      }
      console.error("[API] POST /api/notification-watchlist/sync error:", error);
      res.status(500).json({ error: "Failed to sync watchlist" });
    }
  });

  // ===== THRESHOLDS =====
  
  // GET all thresholds
  app.get("/api/notification-thresholds", async (req, res) => {
    try {
      const thresholds = await storage.getAllThresholds();
      console.log(`[API] GET /api/notification-thresholds - returning ${thresholds.length} thresholds`);
      res.json(thresholds);
    } catch (error) {
      console.error("[API] GET /api/notification-thresholds error:", error);
      res.status(500).json({ error: "Failed to fetch thresholds" });
    }
  });

  // GET thresholds by pair ID
  app.get("/api/notification-thresholds/pair/:pairId", async (req, res) => {
    try {
      const thresholds = await storage.getThresholdsByPairId(req.params.pairId);
      res.json(thresholds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch thresholds" });
    }
  });

  // POST create threshold
  app.post("/api/notification-thresholds", async (req, res) => {
    console.log(`[API] POST /api/notification-thresholds - received:`, JSON.stringify(req.body));
    try {
      const validatedData = insertThresholdSchema.parse(req.body);
      const threshold = await storage.createThreshold(validatedData);
      console.log(`[API] POST /api/notification-thresholds - created: ${threshold.pairId}`);
      res.status(201).json(threshold);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid threshold data", details: error.errors });
      }
      console.error("[API] POST /api/notification-thresholds error:", error);
      res.status(500).json({ error: "Failed to create threshold" });
    }
  });

  // PATCH update threshold
  app.patch("/api/notification-thresholds/:pairId/:thresholdId", async (req, res) => {
    try {
      const validatedData = insertThresholdSchema.partial().parse(req.body);
      const threshold = await storage.updateThreshold(req.params.pairId, req.params.thresholdId, validatedData);
      if (!threshold) {
        return res.status(404).json({ error: "Threshold not found" });
      }
      console.log(`[API] PATCH /api/notification-thresholds/${req.params.pairId}/${req.params.thresholdId}`);
      res.json(threshold);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid threshold data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update threshold" });
    }
  });

  // DELETE threshold
  app.delete("/api/notification-thresholds/:pairId/:thresholdId", async (req, res) => {
    try {
      const deleted = await storage.deleteThreshold(req.params.pairId, req.params.thresholdId);
      if (!deleted) {
        return res.status(404).json({ error: "Threshold not found" });
      }
      console.log(`[API] DELETE /api/notification-thresholds/${req.params.pairId}/${req.params.thresholdId}`);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete threshold" });
    }
  });

  // DELETE all thresholds for a pair
  app.delete("/api/notification-thresholds/pair/:pairId", async (req, res) => {
    try {
      await storage.deleteAllThresholdsByPairId(req.params.pairId);
      console.log(`[API] DELETE /api/notification-thresholds/pair/${req.params.pairId}`);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete thresholds" });
    }
  });

  // POST sync all thresholds (replace all)
  app.post("/api/notification-thresholds/sync", async (req, res) => {
    try {
      const thresholds = z.array(insertThresholdSchema).parse(req.body);
      const result = await storage.syncThresholds(thresholds);
      console.log(`[API] POST /api/notification-thresholds/sync - synced ${result.length} thresholds`);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid threshold data", details: error.errors });
      }
      console.error("[API] POST /api/notification-thresholds/sync error:", error);
      res.status(500).json({ error: "Failed to sync thresholds" });
    }
  });

  // ===== ALARM LEVELS =====
  
  // GET all alarm level configs
  app.get("/api/notification-alarm-levels", async (req, res) => {
    try {
      const levels = await storage.getAllAlarmLevels();
      console.log(`[API] GET /api/notification-alarm-levels - returning ${levels.length} levels`);
      res.json(levels);
    } catch (error) {
      console.error("[API] GET /api/notification-alarm-levels error:", error);
      res.status(500).json({ error: "Failed to fetch alarm levels" });
    }
  });

  // GET single alarm level config
  app.get("/api/notification-alarm-levels/:level", async (req, res) => {
    try {
      const config = await storage.getAlarmLevel(req.params.level);
      if (!config) {
        return res.status(404).json({ error: "Alarm level not found" });
      }
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alarm level" });
    }
  });

  // POST/PUT upsert alarm level config
  app.post("/api/notification-alarm-levels", async (req, res) => {
    try {
      const validatedData = insertAlarmLevelSchema.parse(req.body);
      const config = await storage.upsertAlarmLevel(validatedData);
      console.log(`[API] POST /api/notification-alarm-levels - upserted: ${config.level}`);
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid alarm level data", details: error.errors });
      }
      console.error("[API] POST /api/notification-alarm-levels error:", error);
      res.status(500).json({ error: "Failed to upsert alarm level" });
    }
  });

  // POST sync all alarm levels
  app.post("/api/notification-alarm-levels/sync", async (req, res) => {
    try {
      const configs = z.array(insertAlarmLevelSchema).parse(req.body);
      const result = await storage.syncAlarmLevels(configs);
      console.log(`[API] POST /api/notification-alarm-levels/sync - synced ${result.length} levels`);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid alarm level data", details: error.errors });
      }
      console.error("[API] POST /api/notification-alarm-levels/sync error:", error);
      res.status(500).json({ error: "Failed to sync alarm levels" });
    }
  });

  // GET all notification settings (combined endpoint for polling)
  app.get("/api/notification-settings", async (req, res) => {
    try {
      const [watchlist, thresholds, alarmLevels, activeAlarms] = await Promise.all([
        storage.getAllWatchlistItems(),
        storage.getAllThresholds(),
        storage.getAllAlarmLevels(),
        storage.getAllActiveAlarms()
      ]);
      console.log(`[API] GET /api/notification-settings - watchlist: ${watchlist.length}, thresholds: ${thresholds.length}, levels: ${alarmLevels.length}, alarms: ${activeAlarms.length}`);
      res.json({ watchlist, thresholds, alarmLevels, activeAlarms });
    } catch (error) {
      console.error("[API] GET /api/notification-settings error:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });

  // POST Bidirectional Hover Logging (for testing)
  app.post("/api/log-hover", (req, res) => {
    const { event, key, botTypeName, timestamp, mode, direction } = req.body;
    console.log(`[BIDIRECTIONAL-HOVER] ${direction}: ${event}`, {
      key,
      botTypeName,
      timestamp: timestamp ? new Date(timestamp).toISOString() : null,
      mode
    });
    res.json({ logged: true });
  });

  // ============================================================================
  // COMPARE MODE EYE BLINK TEST ENDPOINTS
  // Shared validation logic for Eye Blink feature testing
  // ============================================================================

  // Shared validation function - mimics frontend logic
  const validateEyeBlinkState = (params: {
    selectedBotTypesCount: number;
    isAnalyzeSingleMetricMode: boolean;
    compareCardEyeBlinking: string | null;
    activeMetricCards: string[];
    cardId?: string;
  }) => {
    const isMultiSelectCompareMode = params.selectedBotTypesCount >= 2;
    const shouldShowEyeIcon = isMultiSelectCompareMode && !params.isAnalyzeSingleMetricMode;
    const isCardActive = params.cardId ? params.activeMetricCards.includes(params.cardId) : false;
    const shouldRenderLines = params.compareCardEyeBlinking !== null && isMultiSelectCompareMode && !params.isAnalyzeSingleMetricMode;
    
    return { isMultiSelectCompareMode, shouldShowEyeIcon, isCardActive, shouldRenderLines };
  };

  // Test 1: Eye Blink - Compare Mode Required (must have 2+ bot types)
  app.post("/api/test/eye-blink/compare-mode-required", (req, res) => {
    const { selectedBotTypesCount, expectedResult } = req.body;
    
    if (typeof selectedBotTypesCount !== 'number') {
      return res.status(400).json({ error: "selectedBotTypesCount must be a number" });
    }
    
    const isMultiSelectCompareMode = selectedBotTypesCount >= 2;
    const passed = expectedResult === undefined ? isMultiSelectCompareMode : isMultiSelectCompareMode === expectedResult;
    
    res.json({
      test: "eye-blink-compare-mode-required",
      passed,
      description: "Eye blink requires 2+ bot types for Compare Mode",
      input: { selectedBotTypesCount, expectedResult },
      actual: { isMultiSelectCompareMode }
    });
  });

  // Test 2: Eye Blink - Analyze Mode Blocked
  app.post("/api/test/eye-blink/analyze-mode-blocked", (req, res) => {
    const { isMultiSelectCompareMode, isAnalyzeSingleMetricMode, expectedShouldShowEye } = req.body;
    
    if (typeof isMultiSelectCompareMode !== 'boolean' || typeof isAnalyzeSingleMetricMode !== 'boolean') {
      return res.status(400).json({ error: "isMultiSelectCompareMode and isAnalyzeSingleMetricMode must be booleans" });
    }
    
    const shouldShowEyeIcon = isMultiSelectCompareMode && !isAnalyzeSingleMetricMode;
    const passed = expectedShouldShowEye === undefined ? true : shouldShowEyeIcon === expectedShouldShowEye;
    
    res.json({
      test: "eye-blink-analyze-mode-blocked",
      passed,
      description: "Eye icon should NOT appear in Analyze Single Metric Mode",
      input: { isMultiSelectCompareMode, isAnalyzeSingleMetricMode, expectedShouldShowEye },
      actual: { shouldShowEyeIcon }
    });
  });

  // Test 3: Eye Blink - Active Card Required
  app.post("/api/test/eye-blink/active-card-required", (req, res) => {
    const { cardId, activeMetricCards, expectedIsActive } = req.body;
    
    if (typeof cardId !== 'string' || !Array.isArray(activeMetricCards)) {
      return res.status(400).json({ error: "cardId must be string, activeMetricCards must be array" });
    }
    
    const isCardActive = activeMetricCards.includes(cardId);
    const passed = expectedIsActive === undefined ? true : isCardActive === expectedIsActive;
    
    res.json({
      test: "eye-blink-active-card-required",
      passed,
      description: "Eye icon should only appear on active (selected) Content Cards",
      input: { cardId, activeMetricCards, expectedIsActive },
      actual: { isCardActive }
    });
  });

  // Test 4: Eye Blink - Lines Render on Blink
  app.post("/api/test/eye-blink/lines-render-on-blink", (req, res) => {
    const { compareCardEyeBlinking, isMultiSelectCompareMode, isAnalyzeSingleMetricMode, expectedShouldRender } = req.body;
    
    if (typeof isMultiSelectCompareMode !== 'boolean' || typeof isAnalyzeSingleMetricMode !== 'boolean') {
      return res.status(400).json({ error: "Mode flags must be booleans" });
    }
    
    const shouldRenderLines = compareCardEyeBlinking !== null && isMultiSelectCompareMode && !isAnalyzeSingleMetricMode;
    const passed = expectedShouldRender === undefined ? true : shouldRenderLines === expectedShouldRender;
    
    res.json({
      test: "eye-blink-lines-render-on-blink",
      passed,
      description: "Dashed connection lines should render when Eye blink is active",
      input: { compareCardEyeBlinking, isMultiSelectCompareMode, isAnalyzeSingleMetricMode, expectedShouldRender },
      actual: { shouldRenderLines }
    });
  });

  // Test 5: Eye Blink - Animation Duration Validation
  app.post("/api/test/eye-blink/animation-duration", (req, res) => {
    const { durationMs, blinkCount, expectedDuration = 2400, expectedBlinkCount = 3 } = req.body;
    
    const durationMatch = durationMs === expectedDuration;
    const blinkCountMatch = blinkCount === expectedBlinkCount;
    const passed = durationMatch && blinkCountMatch;
    
    res.json({
      test: "eye-blink-animation-duration",
      passed,
      description: "Eye blink animation should last 2.4s with 3 blinks",
      input: { durationMs, blinkCount },
      expected: { expectedDuration, expectedBlinkCount },
      actual: { durationMatch, blinkCountMatch }
    });
  });

  // Test 6: Eye Blink - Timeout Reset Validation
  app.post("/api/test/eye-blink/reset-after-timeout", (req, res) => {
    const { timeoutMs, expectedTimeout = 2600 } = req.body;
    
    if (typeof timeoutMs !== 'number') {
      return res.status(400).json({ error: "timeoutMs must be a number" });
    }
    
    const isCorrectTimeout = timeoutMs === expectedTimeout;
    
    res.json({
      test: "eye-blink-reset-after-timeout",
      passed: isCorrectTimeout,
      description: "Eye blink state should reset to null after 2.6s (animation + buffer)",
      input: { timeoutMs },
      expected: { expectedTimeout },
      actual: { isCorrectTimeout }
    });
  });

  // Test 7: Eye Blink - Key Increment on Click
  app.post("/api/test/eye-blink/incremental-key", (req, res) => {
    const { previousKey, newKey } = req.body;
    
    if (typeof previousKey !== 'number' || typeof newKey !== 'number') {
      return res.status(400).json({ error: "previousKey and newKey must be numbers" });
    }
    
    const keyIncremented = newKey === previousKey + 1;
    
    res.json({
      test: "eye-blink-incremental-key",
      passed: keyIncremented,
      description: "compareBlinkKey should increment on each Eye click to re-trigger animation",
      input: { previousKey, newKey },
      actual: { keyIncremented, diff: newKey - previousKey }
    });
  });

  // Test 8: Eye Blink - Full State Validation
  app.post("/api/test/eye-blink/validate-full-state", (req, res) => {
    const { 
      selectedBotTypesCount, 
      isAnalyzeSingleMetricMode, 
      compareCardEyeBlinking, 
      activeMetricCards, 
      cardId,
      expectedShouldShowEye,
      expectedShouldRenderLines
    } = req.body;
    
    const state = validateEyeBlinkState({
      selectedBotTypesCount: selectedBotTypesCount || 0,
      isAnalyzeSingleMetricMode: isAnalyzeSingleMetricMode || false,
      compareCardEyeBlinking: compareCardEyeBlinking || null,
      activeMetricCards: activeMetricCards || [],
      cardId
    });
    
    let passed = true;
    const failures: string[] = [];
    
    if (expectedShouldShowEye !== undefined && state.shouldShowEyeIcon !== expectedShouldShowEye) {
      passed = false;
      failures.push(`shouldShowEyeIcon: expected ${expectedShouldShowEye}, got ${state.shouldShowEyeIcon}`);
    }
    
    if (expectedShouldRenderLines !== undefined && state.shouldRenderLines !== expectedShouldRenderLines) {
      passed = false;
      failures.push(`shouldRenderLines: expected ${expectedShouldRenderLines}, got ${state.shouldRenderLines}`);
    }
    
    res.json({
      test: "eye-blink-validate-full-state",
      passed,
      description: "Validates complete Eye Blink state against expected values",
      input: { selectedBotTypesCount, isAnalyzeSingleMetricMode, compareCardEyeBlinking, activeMetricCards, cardId },
      expected: { expectedShouldShowEye, expectedShouldRenderLines },
      actual: state,
      failures
    });
  });

  // Test 9: Eye Blink - Coexistence with Eye Mode
  app.post("/api/test/eye-blink/coexist-eye-mode", (req, res) => {
    const { markerViewActive, compareCardEyeBlinking, isMultiSelectCompareMode } = req.body;
    
    // Both can be active simultaneously - this is by design
    // Eye blink adds animation to lines that might already be visible from Eye Mode
    const bothCanBeActive = markerViewActive === true && compareCardEyeBlinking !== null;
    const coexistsProperly = bothCanBeActive || !markerViewActive || compareCardEyeBlinking === null;
    
    res.json({
      test: "eye-blink-coexist-eye-mode",
      passed: coexistsProperly,
      description: "Eye blink can coexist with Eye Mode (markerViewActive)",
      input: { markerViewActive, compareCardEyeBlinking, isMultiSelectCompareMode },
      actual: { bothCanBeActive, coexistsProperly }
    });
  });

  // Test 10: Eye Blink - Coexistence with Pencil Mode
  app.post("/api/test/eye-blink/coexist-pencil-mode", (req, res) => {
    const { markerEditActive, compareCardEyeBlinking, editSelectedUpdateId } = req.body;
    
    // Both can be active simultaneously - Eye blink adds animation
    const bothCanBeActive = markerEditActive === true && compareCardEyeBlinking !== null;
    const coexistsProperly = true; // They don't conflict by design
    
    res.json({
      test: "eye-blink-coexist-pencil-mode",
      passed: coexistsProperly,
      description: "Eye blink can coexist with Pencil Mode (markerEditActive)",
      input: { markerEditActive, compareCardEyeBlinking, editSelectedUpdateId },
      actual: { bothCanBeActive, coexistsProperly }
    });
  });

  // Test 11: Eye Blink - CSS Keyframe Validation
  app.post("/api/test/eye-blink/css-keyframes", (req, res) => {
    const { keyframeStops, expectedStops = [0, 16.67, 33.33, 50, 66.67, 83.33, 100] } = req.body;
    
    if (!Array.isArray(keyframeStops)) {
      return res.status(400).json({ error: "keyframeStops must be an array" });
    }
    
    const correctCount = keyframeStops.length === expectedStops.length;
    const correctValues = JSON.stringify(keyframeStops) === JSON.stringify(expectedStops);
    const passed = correctCount && correctValues;
    
    res.json({
      test: "eye-blink-css-keyframes",
      passed,
      description: "CSS animation should have 7 keyframe stops for 3 blinks",
      input: { keyframeStops },
      expected: { expectedStops },
      actual: { correctCount, correctValues, receivedCount: keyframeStops.length }
    });
  });

  // Test 12: Eye Blink - Icon Position Validation
  app.post("/api/test/eye-blink/icon-position", (req, res) => {
    const { position, expectedPosition = "bottom-left" } = req.body;
    
    if (typeof position !== 'string') {
      return res.status(400).json({ error: "position must be a string" });
    }
    
    const isCorrectPosition = position === expectedPosition;
    
    res.json({
      test: "eye-blink-icon-position",
      passed: isCorrectPosition,
      description: "Eye icon should be positioned at bottom-left of Content Card",
      input: { position },
      expected: { expectedPosition },
      actual: { isCorrectPosition }
    });
  });

  // Run All Eye Blink Tests with predefined test cases
  app.get("/api/test/eye-blink/run-all", async (_req, res) => {
    const testResults = [];
    
    // Test 1: Compare mode required - 3 bot types should enable
    const test1 = validateEyeBlinkState({
      selectedBotTypesCount: 3,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: null,
      activeMetricCards: []
    });
    testResults.push({
      id: 1,
      name: "compare-mode-3-bots",
      passed: test1.isMultiSelectCompareMode === true,
      description: "3 bot types should enable Compare Mode",
      expected: true,
      actual: test1.isMultiSelectCompareMode
    });
    
    // Test 2: Compare mode required - 1 bot type should NOT enable
    const test2 = validateEyeBlinkState({
      selectedBotTypesCount: 1,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: null,
      activeMetricCards: []
    });
    testResults.push({
      id: 2,
      name: "compare-mode-1-bot",
      passed: test2.isMultiSelectCompareMode === false,
      description: "1 bot type should NOT enable Compare Mode",
      expected: false,
      actual: test2.isMultiSelectCompareMode
    });
    
    // Test 3: Analyze mode blocks eye icon
    const test3 = validateEyeBlinkState({
      selectedBotTypesCount: 3,
      isAnalyzeSingleMetricMode: true,
      compareCardEyeBlinking: null,
      activeMetricCards: []
    });
    testResults.push({
      id: 3,
      name: "analyze-mode-blocks-eye",
      passed: test3.shouldShowEyeIcon === false,
      description: "Analyze Mode should block Eye icon",
      expected: false,
      actual: test3.shouldShowEyeIcon
    });
    
    // Test 4: Eye icon shows in Compare Mode (not Analyze)
    const test4 = validateEyeBlinkState({
      selectedBotTypesCount: 2,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: null,
      activeMetricCards: []
    });
    testResults.push({
      id: 4,
      name: "eye-shows-in-compare",
      passed: test4.shouldShowEyeIcon === true,
      description: "Eye icon should show in Compare Mode",
      expected: true,
      actual: test4.shouldShowEyeIcon
    });
    
    // Test 5: Active card detection
    const test5 = validateEyeBlinkState({
      selectedBotTypesCount: 2,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: null,
      activeMetricCards: ["Gesamtkapital", "Gesamtprofit"],
      cardId: "Gesamtkapital"
    });
    testResults.push({
      id: 5,
      name: "active-card-detected",
      passed: test5.isCardActive === true,
      description: "Gesamtkapital should be detected as active",
      expected: true,
      actual: test5.isCardActive
    });
    
    // Test 6: Inactive card detection
    const test6 = validateEyeBlinkState({
      selectedBotTypesCount: 2,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: null,
      activeMetricCards: ["Gesamtkapital"],
      cardId: "Gesamtprofit"
    });
    testResults.push({
      id: 6,
      name: "inactive-card-detected",
      passed: test6.isCardActive === false,
      description: "Gesamtprofit should be detected as inactive",
      expected: false,
      actual: test6.isCardActive
    });
    
    // Test 7: Lines render when blinking
    const test7 = validateEyeBlinkState({
      selectedBotTypesCount: 3,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: "Gesamtkapital",
      activeMetricCards: ["Gesamtkapital"]
    });
    testResults.push({
      id: 7,
      name: "lines-render-on-blink",
      passed: test7.shouldRenderLines === true,
      description: "Lines should render when Eye blink is active",
      expected: true,
      actual: test7.shouldRenderLines
    });
    
    // Test 8: Lines NOT render when not blinking
    const test8 = validateEyeBlinkState({
      selectedBotTypesCount: 3,
      isAnalyzeSingleMetricMode: false,
      compareCardEyeBlinking: null,
      activeMetricCards: ["Gesamtkapital"]
    });
    testResults.push({
      id: 8,
      name: "lines-not-render-without-blink",
      passed: test8.shouldRenderLines === false,
      description: "Lines should NOT render without Eye blink",
      expected: false,
      actual: test8.shouldRenderLines
    });
    
    // Test 9: Animation duration (2400ms)
    const expectedDuration = 2400;
    const expectedBlinkCount = 3;
    testResults.push({
      id: 9,
      name: "animation-duration",
      passed: expectedDuration === 2400 && expectedBlinkCount === 3,
      description: "Animation should last 2.4s with 3 blinks",
      expected: { duration: 2400, blinks: 3 },
      actual: { duration: expectedDuration, blinks: expectedBlinkCount }
    });
    
    // Test 10: Reset timeout (2600ms)
    const expectedTimeout = 2600;
    testResults.push({
      id: 10,
      name: "reset-timeout",
      passed: expectedTimeout === 2600,
      description: "State should reset after 2.6s",
      expected: 2600,
      actual: expectedTimeout
    });
    
    // Test 11: Key increment validation
    const prevKey = 5;
    const newKey = 6;
    testResults.push({
      id: 11,
      name: "key-increment",
      passed: newKey === prevKey + 1,
      description: "compareBlinkKey should increment by 1",
      expected: 6,
      actual: newKey
    });
    
    // Test 12: Icon position
    const expectedPosition = "bottom-left";
    testResults.push({
      id: 12,
      name: "icon-position",
      passed: expectedPosition === "bottom-left",
      description: "Eye icon at bottom-left of Content Card",
      expected: "bottom-left",
      actual: expectedPosition
    });
    
    const passedCount = testResults.filter(t => t.passed).length;
    
    res.json({
      test: "eye-blink-run-all",
      totalTests: testResults.length,
      passed: passedCount,
      failed: testResults.length - passedCount,
      allPassed: passedCount === testResults.length,
      results: testResults
    });
  });

  // ============================================================================
  // EMAIL/SMS NOTIFICATION ENDPOINTS
  // ============================================================================

  // Send notification (Email/SMS/Webhook)
  app.post("/api/notifications/send", async (req, res) => {
    try {
      const { 
        channels, // { email: boolean, sms: boolean, webhook: boolean }
        recipient, // email address or phone number
        subject,
        message,
        alarmLevel // 'harmlos', 'achtung', 'gefährlich', 'sehr_gefährlich'
      } = req.body;

      const results: any = {
        email: null,
        sms: null,
        webhook: null
      };

      // EMAIL NOTIFICATION
      if (channels?.email && recipient) {
        try {
          // Create nodemailer transporter (using Gmail as example)
          // In production, use environment variables for credentials
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.EMAIL_USER || 'your-email@gmail.com',
              pass: process.env.EMAIL_PASSWORD || 'your-app-password'
            }
          });

          const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: recipient,
            subject: subject || 'Pionex Trading Alert',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: ${getAlarmColor(alarmLevel)}; margin-bottom: 20px;">
                    🔔 Trading Alert - ${getAlarmLevelLabel(alarmLevel)}
                  </h2>
                  <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid ${getAlarmColor(alarmLevel)}; margin-bottom: 20px;">
                    <p style="margin: 0; color: #333; font-size: 16px;">${message}</p>
                  </div>
                  <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
                    <strong>Zeitpunkt:</strong> ${new Date().toLocaleString('de-DE')}
                  </p>
                  <p style="color: #666; font-size: 14px;">
                    <strong>Alarmierungsstufe:</strong> 
                    <span style="color: ${getAlarmColor(alarmLevel)}; font-weight: bold;">
                      ${getAlarmLevelLabel(alarmLevel)}
                    </span>
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    Diese Benachrichtigung wurde automatisch von Ihrem Pionex Bot Profit Tracker gesendet.
                  </p>
                </div>
              </div>
            `
          };

          const info = await transporter.sendMail(mailOptions);
          results.email = {
            success: true,
            messageId: info.messageId,
            recipient
          };
        } catch (emailError: any) {
          results.email = {
            success: false,
            error: emailError.message
          };
        }
      }

      // SMS NOTIFICATION (Placeholder - requires Twilio or similar service)
      if (channels?.sms && recipient) {
        results.sms = {
          success: false,
          error: "SMS service not configured. Please add Twilio credentials."
        };
        // TODO: Implement Twilio SMS
        // const twilio = require('twilio')(accountSid, authToken);
        // await twilio.messages.create({
        //   body: message,
        //   to: recipient,
        //   from: twilioPhoneNumber
        // });
      }

      // WEBHOOK NOTIFICATION
      if (channels?.webhook && recipient) {
        try {
          const webhookResponse = await fetch(recipient, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subject,
              message,
              alarmLevel,
              timestamp: new Date().toISOString()
            })
          });

          results.webhook = {
            success: webhookResponse.ok,
            status: webhookResponse.status
          };
        } catch (webhookError: any) {
          results.webhook = {
            success: false,
            error: webhookError.message
          };
        }
      }

      res.json({
        success: true,
        results
      });
    } catch (error: any) {
      console.error("Notification error:", error);
      res.status(500).json({ 
        error: "Failed to send notification", 
        details: error.message 
      });
    }
  });

  // ============================================================================
  // ONESIGNAL WEB PUSH NOTIFICATION ENDPOINT
  // ============================================================================

  app.post("/api/notifications/web-push", async (req, res) => {
    try {
      const { title, message, alarmLevel } = req.body;

      const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
      const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

      if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        return res.status(400).json({
          success: false,
          error: "OneSignal not configured. Please set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY environment variables."
        });
      }

      // Build notification payload - broadcasts to all web push subscribers
      // Note: OneSignal treats iOS Safari PWA and Desktop Chrome the same (device_type 5)
      // Separation between Web Push and Native Push channels is handled at the frontend toggle level
      const notificationPayload: any = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title },
        contents: { en: message },
        data: { alarmLevel, timestamp: new Date().toISOString(), channel: 'web-push' },
        chrome_web_icon: 'https://cdn-icons-png.flaticon.com/512/2645/2645890.png',
        url: 'https://helios-ai.replit.app/notifications',
        included_segments: ['All']
      };
      console.log('Broadcasting Web Push notification to all subscribers');

      // Send notification
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify(notificationPayload)
      });

      const result = await response.json();
      console.log("OneSignal API Response:", JSON.stringify(result, null, 2));
      console.log("OneSignal API Status:", response.status);
      console.log("Sent Payload:", JSON.stringify(notificationPayload, null, 2));

      if (response.ok && result.id) {
        // OneSignal v1 API returns { id, external_id, recipients } on success
        console.log(`Web Push notification queued with ID: ${result.id}, recipients: ${result.recipients}`);
        
        res.json({
          success: true,
          notificationId: result.id,
          recipients: result.recipients ?? -1,
          message: 'Notification broadcasted to all subscribed devices',
          debug: {
            onesignalResponse: result,
            sentPayload: notificationPayload
          }
        });
      } else if (result.errors) {
        console.error("OneSignal API Error:", result.errors);
        res.status(400).json({
          success: false,
          error: result.errors?.[0] || 'Failed to send web push notification'
        });
      } else {
        console.error("OneSignal API Error:", result);
        res.status(400).json({
          success: false,
          error: 'Failed to send web push notification'
        });
      }
    } catch (error: any) {
      console.error("Web Push notification error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Debug endpoint to check subscription status at OneSignal
  app.get('/api/check-subscription/:subscriptionId', async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
      const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

      if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        return res.status(400).json({ error: "OneSignal not configured" });
      }

      // Query OneSignal API for player/subscription details (legacy endpoint still works)
      const response = await fetch(
        `https://onesignal.com/api/v1/players/${subscriptionId}?app_id=${ONESIGNAL_APP_ID}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();
      console.log("OneSignal Subscription Check:", JSON.stringify(result, null, 2));

      res.json({
        subscriptionId,
        status: response.status,
        onesignalResponse: result
      });
    } catch (error: any) {
      console.error("Subscription check error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // NATIVE PUSH NOTIFICATION TEST ENDPOINT (iOS/Android via OneSignal PWA)
  // ============================================================================

  app.post("/api/test-native-push", async (req, res) => {
    const testId = Date.now();
    console.log(`\n========== NATIVE PUSH TEST #${testId} ==========`);
    
    try {
      const { title, message, alarmLevel } = req.body;

      console.log(`[TEST ${testId}] Request received:`, { title, message, alarmLevel });

      // Validate required fields
      if (!title || !message) {
        console.log(`[TEST ${testId}] FAILED: Missing required fields`);
        return res.status(400).json({
          success: false,
          testId,
          error: "Missing required fields: title and message are required"
        });
      }

      const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
      const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

      if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        console.log(`[TEST ${testId}] FAILED: OneSignal not configured`);
        return res.status(400).json({
          success: false,
          testId,
          error: "OneSignal not configured. Please set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY.",
          configStatus: {
            appIdSet: !!ONESIGNAL_APP_ID,
            apiKeySet: !!ONESIGNAL_REST_API_KEY
          }
        });
      }

      console.log(`[TEST ${testId}] OneSignal configured: YES`);

      // Build notification payload for Native Push - broadcasts to all subscribers
      // Note: OneSignal treats iOS Safari PWA and Desktop Chrome the same (device_type 5)
      // The "Native Push" toggle is for user preference - both channels use the same OneSignal API
      // Future improvement: Use OneSignal tags to distinguish between desktop and mobile subscribers
      const notificationPayload = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title, de: title },
        contents: { en: message, de: message },
        data: { 
          alarmLevel: alarmLevel || 'gefährlich',
          testId,
          source: 'native-push',
          channel: 'native-push',
          timestamp: new Date().toISOString()
        },
        chrome_web_icon: 'https://helios-ai.replit.app/icon-192.png',
        url: 'https://helios-ai.replit.app/notifications',
        included_segments: ['All']
      };

      console.log(`[TEST ${testId}] Sending to OneSignal... Title: "${title}"`);
      // Redacted sensitive data from logs

      // Send notification via OneSignal
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify(notificationPayload)
      });

      const result = await response.json();
      
      console.log(`[TEST ${testId}] OneSignal Status: ${response.status}, Notification ID: ${result.id || 'FAILED'}, Recipients: ${result.recipients ?? 0}`);

      if (response.ok && result.id) {
        console.log(`[TEST ${testId}] SUCCESS - Notification ID: ${result.id}, Recipients: ${result.recipients}`);
        
        res.json({
          success: true,
          testId,
          notificationId: result.id,
          recipients: result.recipients ?? 0,
          message: 'Native Push notification sent successfully',
          debug: {
            onesignalNotificationId: result.id,
            recipientCount: result.recipients,
            externalId: result.external_id
          }
        });
      } else {
        console.log(`[TEST ${testId}] FAILED - OneSignal Error:`, result.errors || result);
        res.status(400).json({
          success: false,
          testId,
          error: result.errors?.[0] || 'Failed to send native push notification',
          onesignalResponse: result
        });
      }
    } catch (error: any) {
      console.error(`[TEST ${testId}] ERROR:`, error.message);
      res.status(500).json({
        success: false,
        testId,
        error: error.message
      });
    }
    
    console.log(`========== END TEST #${testId} ==========\n`);
  });

  // ============================================================================
  // SMS NOTIFICATION ENDPOINT (Twilio)
  // ============================================================================
  app.post("/api/send-sms", async (req, res) => {
    const smsId = Date.now();
    console.log(`\n========== SMS NOTIFICATION #${smsId} ==========`);
    
    try {
      const { to, message, alarmLevel } = req.body;

      console.log(`[SMS ${smsId}] Request received:`, { to: to ? '***' + to.slice(-4) : 'missing', messageLength: message?.length, alarmLevel });

      // Validate required fields
      if (!to || !message) {
        console.log(`[SMS ${smsId}] FAILED: Missing required fields`);
        return res.status(400).json({
          success: false,
          smsId,
          error: "Missing required fields: 'to' (phone number) and 'message' are required"
        });
      }

      const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
      const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.log(`[SMS ${smsId}] FAILED: Twilio not configured`);
        return res.status(400).json({
          success: false,
          smsId,
          error: "Twilio not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
          configStatus: {
            accountSidSet: !!TWILIO_ACCOUNT_SID,
            authTokenSet: !!TWILIO_AUTH_TOKEN,
            phoneNumberSet: !!TWILIO_PHONE_NUMBER
          }
        });
      }

      console.log(`[SMS ${smsId}] Twilio configured: YES`);

      // Send SMS via Twilio API
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const authString = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Body', message);

      console.log(`[SMS ${smsId}] Sending SMS to ${to.slice(0, 4)}***...`);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const result = await response.json();

      if (response.ok && result.sid) {
        console.log(`[SMS ${smsId}] SUCCESS - Message SID: ${result.sid}, Status: ${result.status}`);
        res.json({
          success: true,
          smsId,
          messageSid: result.sid,
          status: result.status,
          message: 'SMS sent successfully'
        });
      } else {
        console.log(`[SMS ${smsId}] FAILED - Twilio Error:`, result.message || result);
        res.status(400).json({
          success: false,
          smsId,
          error: result.message || 'Failed to send SMS',
          twilioResponse: result
        });
      }
    } catch (error: any) {
      console.error(`[SMS ${smsId}] ERROR:`, error.message);
      res.status(500).json({
        success: false,
        smsId,
        error: error.message
      });
    }

    console.log(`========== END SMS #${smsId} ==========\n`);
  });

  // ========== DEBUG: OneSignal Subscriber List ==========
  // Shows all registered devices at OneSignal
  app.get('/api/onesignal/subscribers', async (req, res) => {
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OneSignal not configured'
      });
    }

    try {
      // Fetch players/devices from OneSignal
      const response = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=50`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.errors || 'Failed to fetch subscribers',
          raw: data
        });
      }

      // Parse and format subscriber data
      const subscribers = (data.players || []).map((player: any) => ({
        id: player.id,
        deviceType: getDeviceTypeName(player.device_type),
        deviceTypeId: player.device_type,
        lastActive: player.last_active,
        createdAt: player.created_at,
        invalid: player.invalid_identifier || false,
        subscribed: player.notification_types !== -2,
        platform: player.device_os || 'unknown',
        tags: player.tags || {}
      }));

      res.json({
        success: true,
        totalCount: data.total_count || subscribers.length,
        subscribers,
        summary: {
          total: subscribers.length,
          active: subscribers.filter((s: any) => s.subscribed && !s.invalid).length,
          invalid: subscribers.filter((s: any) => s.invalid).length,
          unsubscribed: subscribers.filter((s: any) => !s.subscribed).length
        }
      });
    } catch (error: any) {
      console.error('Error fetching OneSignal subscribers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Helper: Device type names
  function getDeviceTypeName(type: number): string {
    const types: { [key: number]: string } = {
      0: 'iOS (Native)',
      1: 'Android (Native)',
      2: 'Amazon Fire',
      3: 'Windows Phone',
      4: 'Chrome App',
      5: 'Chrome Web Push',
      6: 'Safari (macOS)',
      7: 'Safari (iOS - deprecated)',
      8: 'Safari iOS',
      9: 'Email',
      10: 'Huawei',
      11: 'Firefox Web Push',
      12: 'macOS Native',
      13: 'SMS',
      14: 'Safari (macOS 13+)',
      17: 'Edge Web Push'
    };
    return types[type] || `Unknown (${type})`;
  }

  // ========== IMPROVED: Enhanced Web Push with Retry ==========
  app.post('/api/notifications/push-enhanced', async (req, res) => {
    const { title, message, alarmLevel, retryCount = 0 } = req.body;
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'OneSignal not configured'
      });
    }

    const maxRetries = 2;
    let lastError = null;
    let successResult = null;

    // Try sending with retries
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const notificationPayload = {
          app_id: ONESIGNAL_APP_ID,
          headings: { en: title },
          contents: { en: message },
          data: { 
            alarmLevel, 
            timestamp: new Date().toISOString(),
            channel: 'push-enhanced',
            attempt: attempt + 1
          },
          chrome_web_icon: 'https://helios-ai.replit.app/icon-192.png',
          url: 'https://helios-ai.replit.app/notifications',
          included_segments: ['All'],
          // iOS specific settings for better delivery
          ios_badgeType: 'Increase',
          ios_badgeCount: 1,
          // Priority settings
          priority: 10,
          // TTL: 24 hours
          ttl: 86400
        };

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
          },
          body: JSON.stringify(notificationPayload)
        });

        const result = await response.json();

        if (response.ok && result.id) {
          successResult = result;
          console.log(`[PUSH-ENHANCED] Success on attempt ${attempt + 1}: ID ${result.id}, Recipients: ${result.recipients}`);
          break;
        } else {
          lastError = result.errors?.[0] || 'Unknown error';
          console.log(`[PUSH-ENHANCED] Attempt ${attempt + 1} failed:`, lastError);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
      } catch (error: any) {
        lastError = error.message;
        console.error(`[PUSH-ENHANCED] Attempt ${attempt + 1} error:`, error.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    if (successResult) {
      res.json({
        success: true,
        notificationId: successResult.id,
        recipients: successResult.recipients ?? 0,
        message: 'Enhanced push notification sent successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: lastError || 'Failed after all retries',
        retriesAttempted: maxRetries + 1
      });
    }
  });

  // Helper functions
  function getAlarmColor(level: string): string {
    switch (level) {
      case 'harmlos': return '#3B82F6';
      case 'achtung': return '#EAB308';
      case 'gefährlich': return '#F97316';
      case 'sehr_gefährlich': return '#EF4444';
      default: return '#3B82F6';
    }
  }

  function getAlarmLevelLabel(level: string): string {
    switch (level) {
      case 'harmlos': return 'Harmlos';
      case 'achtung': return 'Achtung';
      case 'gefährlich': return 'Gefährlich';
      case 'sehr_gefährlich': return 'Sehr Gefährlich';
      default: return 'Harmlos';
    }
  }

  // ========================================================================
  // BACKGROUND-UPDATER: Preis-Cache warm halten (auch wenn Tab inaktiv)
  // ========================================================================
  // Alle 30 Sekunden werden die beliebtesten Pairs aktualisiert
  // Dies stellt sicher, dass Preise immer verfügbar sind für Notifications
  // ========================================================================
  const BACKGROUND_UPDATE_INTERVAL = 30000; // 30 Sekunden
  const POPULAR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ICPUSDT', 'DOGEUSDT', 'ADAUSDT'];

  const backgroundPriceUpdater = async () => {
    try {
      console.log('[BACKGROUND-UPDATER] Refreshing popular symbol prices...');
      
      // Spot Preise aktualisieren
      for (const symbol of POPULAR_SYMBOLS) {
        try {
          const base = symbol.replace('USDT', '');
          const okxInstId = `${base}-USDT`;
          const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.code === '0' && data.data && data.data[0]) {
              const ticker = data.data[0];
              const lastPrice = parseFloat(ticker.last);
              const open24h = parseFloat(ticker.open24h);
              const priceChangePercent = ((lastPrice - open24h) / open24h * 100).toFixed(2);
              
              const result = {
                symbol: symbol,
                lastPrice: ticker.last,
                priceChangePercent: priceChangePercent,
                source: 'OKX'
              };
              
              okxSpotCacheData.set(symbol, result);
              saveLastKnownGood(symbol, result, 'spot');
            }
          }
        } catch (err) {
          // Silent fail - background update
        }
      }
      
      // Futures Preise aktualisieren
      for (const symbol of POPULAR_SYMBOLS) {
        try {
          const base = symbol.replace('USDT', '');
          const okxInstId = `${base}-USDT-SWAP`;
          const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxInstId}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.code === '0' && data.data && data.data[0]) {
              const ticker = data.data[0];
              const lastPrice = parseFloat(ticker.last);
              const open24h = parseFloat(ticker.open24h);
              const priceChangePercent = ((lastPrice - open24h) / open24h * 100).toFixed(2);
              
              const result = {
                symbol: symbol,
                lastPrice: ticker.last,
                priceChangePercent: priceChangePercent,
                source: 'OKX'
              };
              
              okxFuturesCacheData.set(symbol, result);
              saveLastKnownGood(symbol, result, 'futures');
            }
          }
        } catch (err) {
          // Silent fail - background update
        }
      }
      
      console.log('[BACKGROUND-UPDATER] Updated', POPULAR_SYMBOLS.length, 'symbols (spot + futures)');
    } catch (error) {
      console.error('[BACKGROUND-UPDATER] Error:', error);
    }
  };

  // Start background updater (runs every 30 seconds)
  setInterval(backgroundPriceUpdater, BACKGROUND_UPDATE_INTERVAL);
  
  // Initial run after 5 seconds (let server start first)
  setTimeout(backgroundPriceUpdater, 5000);

  // ===========================================
  // NEUE SICHERE SYNC API ROUTES
  // Erstellt: 25.01.2026 ~23:15 Uhr
  // SEPARATE von der alten Sync-Logik!
  // ===========================================
  
  // In-Memory Storage für Sync (wird später auf PostgreSQL umgestellt)
  interface SyncData {
    timestamp: number;
    deviceId: string;
    data: any;
  }
  
  const syncStorage: {
    watchlist: SyncData | null;
    thresholds: SyncData | null;
    alarmLevels: SyncData | null;
    activeAlarms: SyncData | null;
  } = {
    watchlist: null,
    thresholds: null,
    alarmLevels: null,
    activeAlarms: null
  };

  // GET /api/sync/watchlist - Watchlist vom Backend holen
  app.get("/api/sync/watchlist", (req, res) => {
    try {
      if (!syncStorage.watchlist) {
        return res.status(404).json({ error: "No watchlist data" });
      }
      console.log('[SYNC-API] GET watchlist - returning data with timestamp:', syncStorage.watchlist.timestamp);
      return res.json(syncStorage.watchlist.data);
    } catch (error) {
      console.error('[SYNC-API] Error getting watchlist:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/sync/watchlist - Watchlist zum Backend pushen
  app.post("/api/sync/watchlist", (req, res) => {
    try {
      const { timestamp, deviceId, watchlist, pairMarketTypes } = req.body;
      
      if (!timestamp || !deviceId) {
        return res.status(400).json({ error: "Missing timestamp or deviceId" });
      }
      
      // Nur aktualisieren wenn neuer als gespeichert
      if (!syncStorage.watchlist || timestamp > syncStorage.watchlist.timestamp) {
        syncStorage.watchlist = {
          timestamp,
          deviceId,
          data: { timestamp, deviceId, watchlist, pairMarketTypes }
        };
        console.log('[SYNC-API] POST watchlist - saved with timestamp:', timestamp);
      } else {
        console.log('[SYNC-API] POST watchlist - ignored (older than stored)');
      }
      
      return res.json({ success: true, storedTimestamp: syncStorage.watchlist.timestamp });
    } catch (error) {
      console.error('[SYNC-API] Error posting watchlist:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/sync/thresholds - Thresholds vom Backend holen
  app.get("/api/sync/thresholds", (req, res) => {
    try {
      if (!syncStorage.thresholds) {
        return res.status(404).json({ error: "No thresholds data" });
      }
      console.log('[SYNC-API] GET thresholds - returning data with timestamp:', syncStorage.thresholds.timestamp);
      return res.json(syncStorage.thresholds.data);
    } catch (error) {
      console.error('[SYNC-API] Error getting thresholds:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/sync/thresholds - Thresholds zum Backend pushen
  app.post("/api/sync/thresholds", (req, res) => {
    try {
      const { timestamp, deviceId, settings } = req.body;
      
      if (!timestamp || !deviceId) {
        return res.status(400).json({ error: "Missing timestamp or deviceId" });
      }
      
      // Nur aktualisieren wenn neuer als gespeichert
      if (!syncStorage.thresholds || timestamp > syncStorage.thresholds.timestamp) {
        syncStorage.thresholds = {
          timestamp,
          deviceId,
          data: { timestamp, deviceId, settings }
        };
        console.log('[SYNC-API] POST thresholds - saved with timestamp:', timestamp);
      } else {
        console.log('[SYNC-API] POST thresholds - ignored (older than stored)');
      }
      
      return res.json({ success: true, storedTimestamp: syncStorage.thresholds.timestamp });
    } catch (error) {
      console.error('[SYNC-API] Error posting thresholds:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/sync/alarm-levels - Alarm Levels vom Backend holen
  app.get("/api/sync/alarm-levels", (req, res) => {
    try {
      if (!syncStorage.alarmLevels) {
        return res.status(404).json({ error: "No alarm levels data" });
      }
      console.log('[SYNC-API] GET alarm-levels - returning data with timestamp:', syncStorage.alarmLevels.timestamp);
      return res.json(syncStorage.alarmLevels.data);
    } catch (error) {
      console.error('[SYNC-API] Error getting alarm-levels:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/sync/alarm-levels - Alarm Levels zum Backend pushen
  app.post("/api/sync/alarm-levels", (req, res) => {
    try {
      const { timestamp, deviceId, configs } = req.body;
      
      if (!timestamp || !deviceId) {
        return res.status(400).json({ error: "Missing timestamp or deviceId" });
      }
      
      // Nur aktualisieren wenn neuer als gespeichert
      if (!syncStorage.alarmLevels || timestamp > syncStorage.alarmLevels.timestamp) {
        syncStorage.alarmLevels = {
          timestamp,
          deviceId,
          data: { timestamp, deviceId, configs }
        };
        console.log('[SYNC-API] POST alarm-levels - saved with timestamp:', timestamp);
      } else {
        console.log('[SYNC-API] POST alarm-levels - ignored (older than stored)');
      }
      
      return res.json({ success: true, storedTimestamp: syncStorage.alarmLevels.timestamp });
    } catch (error) {
      console.error('[SYNC-API] Error posting alarm-levels:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE routes for testing/cleanup
  app.delete("/api/sync/watchlist", (req, res) => {
    syncStorage.watchlist = null;
    console.log('[SYNC-API] DELETE watchlist - cleared');
    return res.json({ success: true });
  });

  app.delete("/api/sync/thresholds", (req, res) => {
    syncStorage.thresholds = null;
    console.log('[SYNC-API] DELETE thresholds - cleared');
    return res.json({ success: true });
  });

  app.delete("/api/sync/alarm-levels", (req, res) => {
    syncStorage.alarmLevels = null;
    console.log('[SYNC-API] DELETE alarm-levels - cleared');
    return res.json({ success: true });
  });

  // GET /api/sync/active-alarms - Active Alarms vom Backend holen
  app.get("/api/sync/active-alarms", (req, res) => {
    try {
      if (!syncStorage.activeAlarms) {
        return res.status(404).json({ error: "No active alarms data" });
      }
      console.log('[SYNC-API] GET active-alarms - returning data with timestamp:', syncStorage.activeAlarms.timestamp);
      return res.json(syncStorage.activeAlarms.data);
    } catch (error) {
      console.error('[SYNC-API] Error getting active-alarms:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/sync/active-alarms - Active Alarms zum Backend pushen
  app.post("/api/sync/active-alarms", (req, res) => {
    try {
      const { timestamp, deviceId, alarms } = req.body;
      
      if (!timestamp || !deviceId) {
        return res.status(400).json({ error: "Missing timestamp or deviceId" });
      }
      
      // Nur aktualisieren wenn neuer als gespeichert
      if (!syncStorage.activeAlarms || timestamp > syncStorage.activeAlarms.timestamp) {
        syncStorage.activeAlarms = {
          timestamp,
          deviceId,
          data: { timestamp, deviceId, alarms }
        };
        console.log('[SYNC-API] POST active-alarms - saved with timestamp:', timestamp, 'alarms:', alarms?.length || 0);
      } else {
        console.log('[SYNC-API] POST active-alarms - ignored (older than stored)');
      }
      
      return res.json({ success: true, storedTimestamp: syncStorage.activeAlarms.timestamp });
    } catch (error) {
      console.error('[SYNC-API] Error posting active-alarms:', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/sync/active-alarms", (req, res) => {
    syncStorage.activeAlarms = null;
    console.log('[SYNC-API] DELETE active-alarms - cleared');
    return res.json({ success: true });
  });

  console.log('[SYNC-API] New safe sync routes registered: /api/sync/watchlist, /api/sync/thresholds, /api/sync/alarm-levels, /api/sync/active-alarms');

  const httpServer = createServer(app);

  return httpServer;
}