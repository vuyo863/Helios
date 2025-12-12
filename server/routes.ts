import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBotEntrySchema, insertBotTypeSchema, insertBotTypeUpdateSchema, botTypes } from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

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

  const httpServer = createServer(app);

  return httpServer;
}