### Overview
The Pionex Bot Profit Tracker is a full-stack web application designed to track and analyze profits from Pionex trading bots. It features a comprehensive dashboard, a flexible data upload interface, and generates detailed, filterable financial reports. The primary goal is to provide clear, professional financial insights to users through a React frontend and an Express backend.

### User Preferences
Preferred communication style: Simple, everyday language (German).

---

## GOLDEN STATE DOKUMENTATION

### Was bedeutet "GoldenState"?

**GoldenState** bezeichnet einen Zustand von Code/Features, der:
- **Vollständig fertig entwickelt** ist
- **Getestet und stabil** funktioniert
- **NIEMALS mehr verändert werden darf**
- Als "Gold wert" betrachtet wird - daher der Name

**WICHTIG**: Alle GoldenState-Bereiche sind TABU für Änderungen. Diese Regel ist absolut und ohne Ausnahme!

---

## DASHBOARD-PAGE ARCHITEKTUR

Die Dashboard-Page (`client/src/pages/dashboard.tsx`) ist die Hauptseite der Anwendung und enthält verschiedene **Sections/Modi**, die unterschiedliche Status haben:

### Datei-Location
- **Hauptdatei**: `client/src/pages/dashboard.tsx` (ca. 8500+ Zeilen)
- **Schema**: `shared/schema.ts`
- **Storage**: `server/storage.ts`
- **Routes**: `server/routes.ts`

---

## SECTION 1: MainChart (GOLDEN STATE)

### Was ist MainChart?
Der MainChart ist der **Haupt-Chart-Bereich** der Dashboard-Page. Er zeigt die Profit-Entwicklung für einen **einzelnen ausgewählten Bot-Type** an.

### MainChart Features (alle GOLDEN STATE):
- **Einzelner Bot-Type Visualisierung**: Zeigt Gesamtprofit, Ø Profit/Tag, Real Profit/Tag, Gesamtkapital, Gesamtprofit %
- **Metrik-Karten**: Aktivierbare Metriken über Klick auf die Karten
- **Marker-System**: U1, U2, U3... für Updates, C1, C2... für Closed Bots
- **Eye-Mode (`markerViewActive`)**: Multi-Selection von Markern für Chart-Interaktion
- **Pencil-Mode (`markerEditActive`)**: Single-Selection für Detail-Editing
- **Zeit-Range Filter**: Von/Bis Datum-Filter mit Graph Settings
- **Zoom**: X/Y-Achsen Zoom-Funktionalität
- **Tooltip**: Zeigt Datum, Metrik-Werte, Runtime

### MainChart Activation Condition:
```typescript
// Aktiviert wenn NUR EIN Bot-Type ausgewählt ist
selectedChartBotTypes.length === 1 && !compareActive
```

### CODE-BEREICHE (NICHT ANFASSEN):
- Zeilen ca. 800-1200: MainChart useMemo (`chartData`)
- Zeilen ca. 5800-6500: MainChart Rendering im JSX
- Alle Single-Bot-Type spezifischen Logiken

---

## SECTION 2: Compare Mode (GOLDEN STATE)

### Was ist Compare Mode?
Der Compare Mode ermöglicht den **Vergleich von 2+ Bot-Types** auf demselben Chart mit farbcodierten Linien.

### Compare Mode Features (alle GOLDEN STATE):
- **Multi-Bot-Type Vergleich**: Mehrere Bot-Types werden mit unterschiedlichen Farben dargestellt
- **compareColorMap**: Dedizierte Farbzuordnung pro Bot-Type
- **Zwei Punkte pro Update**: Jedes Update zeigt Start-Punkt und End-Punkt
- **Start/End Markers**: Grüne Start-Box, Rote End-Box im Tooltip
- **Runtime-Anzeige**: Nur bei End-Punkten
- **Analyze Single Metric Mode**: Ausnahme-Zustand für Detail-Analyse einer einzelnen Metrik

### Compare Mode Activation Condition:
```typescript
// Aktiviert wenn 2+ Bot-Types UND Compare-Toggle aktiv
selectedChartBotTypes.length >= 2 && compareActive === true
```

### CODE-BEREICHE (NICHT ANFASSEN):
- Zeilen ca. 1200-1400: Compare Mode useMemo
- `isMultiSelectCompareMode` Flag und alle zugehörigen Logiken
- compareColorMap Definition und Verwendung
- Alle Tooltip-Logiken für Compare Mode (Zeilen ca. 6050-6240)

---

## SECTION 3: Added/Portfolio Mode (ARBEITSBEREICH - NICHT Golden State)

### Was ist Added/Portfolio Mode?
Der Added Mode (auch "Portfolio Mode" genannt) zeigt **mehrere Bot-Types aggregiert** an - aber OHNE den Compare-Toggle aktiv zu haben.

### AKTUELLER STAND (Dezember 2025 - Überarbeitet):

#### Was wurde überarbeitet:
1. **Nur End-Events werden angezeigt**: Keine Start-Events mehr, nur die End-Werte (thisUpload)
2. **Jeder End-Event ist ein separater Punkt**: Nicht mehr aggregiert, sondern individuell
3. **Individuelle Y-Werte**: Jeder Punkt zeigt den Profit des einzelnen Bots
4. **Neuer Tooltip-Format**:
   - Datum/Uhrzeit
   - "END" Label (mit "Closed Bot" falls zutreffend)
   - Bot-Type Name
   - Gesamtprofit (individueller Wert)
   - Runtime

#### Datenstruktur (multiBotChartData):
```typescript
// Jeder Datenpunkt enthält:
{
  timestamp: number,           // X-Achse Zeitpunkt
  Gesamtprofit: number,        // Y-Achse Wert (individueller Profit)
  _botTypeName: string,        // Name des Bot-Types
  _profit: number,             // Der individuelle Profit-Wert
  _runtimeMs: number,          // Runtime in Millisekunden
  _isClosedBot: boolean,       // true wenn status === "Closed Bots"
  _botTypeId: string           // ID für Farbzuordnung
}
```

#### Added Mode Activation Condition:
```typescript
// Aktiviert wenn 2+ Bot-Types OHNE Compare-Toggle
selectedChartBotTypes.length >= 2 && compareActive === false
// ODER via isMultiBotChartMode Flag
```

### CODE-BEREICHE (ARBEITSBEREICH):
- **Zeilen ca. 1413-1591**: `multiBotChartData` useMemo - ÜBERARBEITET
- **Zeilen ca. 6262-6324**: Added Mode Tooltip - ÜBERARBEITET
- **Zeilen ca. 6662-6704**: Dot-Renderer für Added Mode

---

## SECTION 4: Bot-Type Verwaltung (GOLDEN STATE)

### Features (alle GOLDEN STATE):
- **Bot-Type erstellen**: Name, Status, Investitionsmenge
- **Bot-Type bearbeiten**: Inline-Editing
- **Bot-Type löschen**: Mit Bestätigung
- **Bot-Type Updates hochladen**: CSV/Excel Import
- **Update-History**: Alle historischen Updates pro Bot-Type

### CODE-BEREICHE (NICHT ANFASSEN):
- Bot-Type CRUD Operationen
- Upload-Funktionalität
- Update-Liste und Verwaltung

---

## SECTION 5: AI-Analysis Page (GOLDEN STATE)

### Location:
- **Datei**: `client/src/pages/ai-analysis.tsx`

### Features (alle GOLDEN STATE):
- OpenAI Integration für Profit-Analyse
- Automatische Insights-Generierung
- Chart-Daten Zusammenfassung

---

## EDIT-MODUS DETAILS

### Was ist der Edit-Modus?
Der Edit-Modus ermöglicht das **Bearbeiten von einzelnen Updates** eines Bot-Types.

### Toggle-System (Implementiert aber noch nicht voll funktional):
Es gibt einen **Toggle** mit zwei Optionen:
1. **Overlay Mode**: Zeigt die Edit-Ansicht als Overlay über dem Chart
2. **Analysis Mode**: Zeigt erweiterte Analyse-Funktionen

### Probleme die wir hatten:
- Die ursprüngliche Implementierung war zu komplex
- Overlay-Positionierung war schwierig
- Analysis-Features wurden noch nicht implementiert

### Aktueller Stand:
- Toggle ist eingebaut
- Overlay-Grundstruktur existiert
- Analysis-Funktionen sind geplant aber noch nicht umgesetzt

---

## MARKER-SYSTEM

### Update Markers:
- **U1, U2, U3...**: Nummerierte Marker für Updates
- **C1, C2, C3...**: Nummerierte Marker für Closed Bots
- **Neon-Blue Glow**: Aktive/ausgewählte Marker leuchten

### Marker Interaktion:
- **Eye Mode (markerViewActive)**: Mehrfachauswahl möglich, bidirektionale Interaktion mit Chart-Punkten
- **Pencil Mode (markerEditActive)**: Einzelauswahl für detailliertes Editing, überschreibt Eye Mode

---

## FARB-SYSTEM

### Metrik-Farben (konstant):
```typescript
const metricColors = {
  'Gesamtprofit': '#22c55e',      // Grün
  'Ø Profit/Tag': '#3b82f6',      // Blau
  'Real Profit/Tag': '#8b5cf6',   // Lila
  'Gesamtkapital': '#f59e0b',     // Orange
  'Gesamtprofit %': '#ec4899'     // Pink
};
```

### Compare Mode Farben:
```typescript
const compareColorMap = {
  // Dynamisch pro Bot-Type ID zugewiesen
  // Verschiedene distinkte Farben für jeden Bot-Type
};
```

### Spezielle Farben:
- **Neon-Blue**: `#3b82f6` - Für aktive Elemente
- **Cyan**: `#06b6d4` - Für "Gesamt" Linie im Added Mode
- **Rot**: `#ef4444` - Für End-Punkte/Labels
- **Grün**: `#22c55e` - Für Start-Punkte/Labels

---

## WICHTIGE VARIABLEN UND FLAGS

### Chart-Modi:
```typescript
isMultiBotChartMode          // true wenn 2+ Bot-Types und KEIN Compare
isMultiSelectCompareMode     // true wenn 2+ Bot-Types UND Compare aktiv
isSingleBotMode              // true wenn nur 1 Bot-Type
```

### Interaktions-Modi:
```typescript
markerViewActive             // Eye Mode aktiv
markerEditActive             // Pencil Mode aktiv
compareActive                // Compare Toggle aktiv
```

### Daten-Quellen:
```typescript
chartData                    // Single-Bot MainChart Daten
multiBotChartData           // Added Mode Daten (2+ Bots ohne Compare)
compareChartData            // Compare Mode Daten (2+ Bots mit Compare)
```

---

## REGELN FÜR ZUKÜNFTIGE ENTWICKLUNG

### ABSOLUT VERBOTEN:
1. Änderungen am MainChart Code (GoldenState)
2. Änderungen am Compare Mode Code (GoldenState)
3. Änderungen an Bot-Type Verwaltung (GoldenState)
4. Änderungen an AI-Analysis Page (GoldenState)

### ERLAUBT:
1. Änderungen am Added/Portfolio Mode
2. Neue Features die keine GoldenState-Bereiche berühren
3. Bug-Fixes die isoliert sind

### BEI JEDER ÄNDERUNG:
1. Prüfen ob GoldenState betroffen
2. Wenn ja: STOPP - nicht anfassen
3. Wenn nein: Vorsichtig vorgehen, testen

---

## System Architecture

### UI/UX
- **Framework**: React with TypeScript (Vite)
- **Design System**: shadcn/ui + Material Design 3 + Roboto font
- **Styling**: Tailwind CSS
- **Charting Library**: Recharts

### Backend
- **Framework**: Express.js + Node.js + TypeScript
- **Storage**: MemStorage (in-memory for transient data)
- **Validation**: Zod

### Database
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Includes `users`, `bot_types`, and `bot_entries` tables.
- **Migrations**: Drizzle Kit

### External Dependencies
- **Database**: Neon Serverless PostgreSQL
- **ORM**: Drizzle ORM
- **UI Components**: Radix UI, Recharts, date-fns, Lucide React
- **Form Management**: React Hook Form
- **Validation**: Zod
- **Utilities**: clsx, tailwind-merge, class-variance-authority

---

## CHANGELOG

### Dezember 2025 - Added Mode Redesign
**Was wurde gemacht:**
1. `multiBotChartData` useMemo komplett überarbeitet
2. Nur noch End-Events (thisUpload) werden angezeigt
3. Jeder End-Event ist ein separater Datenpunkt
4. Tooltip zeigt: Datum, END-Label, Bot-Type Name, Gesamtprofit, Runtime
5. Keine Aggregation mehr - individuelle Werte pro Bot

**Warum:**
- Ursprünglich wurden Werte kumulativ addiert über Zeit
- Benutzer wollte nur End-Werte sehen, nicht aggregiert
- Jeder Bot-Profit soll separat sichtbar sein

---

## ZUSAMMENFASSUNG GOLDEN STATE BEREICHE

| Bereich | Status | Datei/Zeilen | Beschreibung |
|---------|--------|--------------|--------------|
| MainChart | GOLDEN STATE | dashboard.tsx ~800-1200, ~5800-6500 | Single-Bot Visualisierung |
| Compare Mode | GOLDEN STATE | dashboard.tsx ~1200-1400, ~6050-6240 | Multi-Bot Vergleich |
| Bot-Type CRUD | GOLDEN STATE | dashboard.tsx, storage.ts, routes.ts | Verwaltung |
| AI-Analysis | GOLDEN STATE | ai-analysis.tsx | KI-Analyse |
| Added Mode | ARBEITSBEREICH | dashboard.tsx ~1413-1591, ~6262-6324 | Portfolio-Ansicht |

---

## WO FINDE ICH WAS?

### Hauptdateien:
- `client/src/pages/dashboard.tsx` - Dashboard mit allen Chart-Modi
- `client/src/pages/ai-analysis.tsx` - KI-Analyse Seite
- `shared/schema.ts` - Datenbank-Schema und Typen
- `server/storage.ts` - Storage-Interface
- `server/routes.ts` - API-Endpunkte

### Chart-Logik:
- `chartData` useMemo: Single-Bot Daten (ca. Zeile 800)
- `multiBotChartData` useMemo: Added Mode Daten (ca. Zeile 1413)
- Compare Mode Logik: Suche nach `isMultiSelectCompareMode`

### Tooltip-Logik:
- MainChart Tooltip: Suche nach "Standard: Eine Info-Box"
- Compare Mode Tooltip: Suche nach "COMPARE MODUS"
- Added Mode Tooltip: Suche nach "ADDED/PORTFOLIO MODUS"

### Marker-Logik:
- Marker-Rendering: Suche nach `markerViewActive`
- Marker-Liste: Suche nach "Update-Marker" oder "Marker-Bereich"
