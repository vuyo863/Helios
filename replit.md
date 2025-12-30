# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project provides users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features. The goal is to offer comprehensive data analysis for better trading decisions.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, utilizing `shadcn/ui` and Tailwind CSS for a modern, responsive interface. Recharts handles dynamic data visualization. Wouter manages client-side routing.

The dashboard features three main chart modes:
1.  **MainChart**: Displays detailed performance for a single bot type, including total profit, average daily profit, real daily profit, total capital, and total profit percentage. It supports interactive metric cards, a robust marker system (U1, C1), eye and pencil modes for interaction, and zoom/pan functionalities.
2.  **Compare Mode**: Enables comparison of two or more bot types, visualizing their performance with color-coded lines, highlighting start/end points of updates, and showing runtime information.
3.  **Edit (Added) Mode**: Aggregates data from multiple bot types, focusing on end values. It includes an "Analysis" sub-toggle for metric display and a planned "Overlay" feature for alternative data representation.

### Technical Implementations
*   **State Management**: Extensive use of TypeScript-typed state for managing chart modes (e.g., `isMultiBotChartMode`, `isSingleBotMode`), selected bot types, and interaction modes.
*   **Data Handling**: `useMemo` hooks optimize data preparation for single bot, added mode, and compare mode charts.
*   **Color System**: A consistent color palette is used for metrics and chart elements (e.g., green for 'Gesamtprofit', red for end points).
*   **Bot Type Management**: Comprehensive CRUD operations for bot types, including CSV/Excel upload and update history tracking.

### Feature Specifications
*   **Marker System**: Allows users to define and interact with specific points on charts for event tracking and analysis.
*   **Zoom & Pan**: Interactive zooming and panning capabilities on chart axes, particularly in analysis modes.
*   **AI-Analysis**: Integration with OpenAI for automated insights and chart data summarization.

---

## 🔒 GOLDEN STATE: Auge-Modus (Eye Mode / Overlay Mode)

> **ACHTUNG: GOLDEN STATE - KEINE ÄNDERUNGEN ERLAUBT!**
> Der Auge-Modus ist vollständig implementiert, getestet und abgeschlossen.
> Dieser Code darf NICHT mehr modifiziert werden - 0,0 gar nicht!

### Übersicht Auge-Modus

Der Auge-Modus (aktiviert durch das Auge-Icon im Added Mode) zeigt eine erweiterte Overlay-Ansicht mit:
- **Period Comparison Cards**: Vergleich von Zeitperioden mit Profit-Berechnung
- **Eye Mode Content Card**: Aggregierte Metriken für ausgewählte Bot-Types
- **Sortierung & Animationen**: Interaktive Sortierung mit Framer Motion Animationen

### Implementierte Features

#### 1. Period Comparison Cards
- **Zeitperioden-Aufteilung**: Automatische Einteilung des Zeitraums in Perioden (1h, 6h, 12h, 1d, 3d, 1w, 2w, 1m)
- **Profit pro Periode**: Berechnet wie viel Profit in jeder Periode erzielt wurde
- **Bot-Beiträge**: Zeigt welche Bots wie viel zu jeder Periode beigetragen haben
- **Sortierung**: Nach Datum (aufsteigend/absteigend) oder Profit (höchster/niedrigster zuerst)
- **Framer Motion Animationen**: Sanfte 0.3s ease-in-out Animationen beim Sortieren

#### 2. Eye Mode Content Card
- **Gesamtprofit**: Summe aller Bot-Profite mit Dollarzeichen ($) und Farbkodierung (grün ≥0, rot <0)
- **Gesamtkapital**: Aggregiertes Investment aller ausgewählten Bots
- **Profit %**: Prozentuale Rendite
- **Ø Profit/Tag**: Durchschnittlicher täglicher Profit
- **Real Profit/Tag**: Tatsächlicher täglicher Profit

#### 3. Perioden-Zeitraum-Berechnung
- **minTimestamp**: Verwendet das früheste `lastUpload` (Start-Datum) aller relevanten Updates
- **maxTimestamp**: Verwendet das späteste `thisUpload` (End-Datum)
- **Wichtig**: Perioden decken den GESAMTEN Bot-Zeitraum ab, nicht nur ab dem ersten sichtbaren Datenpunkt

### Perioden-Profit-Berechnung

Die Perioden-Profit-Berechnung ermittelt, wie viel Profit in einer bestimmten Zeitperiode erzielt wurde. Die Summe aller Perioden ergibt den Kontokart-Wert (z.B. 205.96 USDT).

#### Automatische Unterscheidung der Berechnungsarten

Das System erkennt automatisch, welche Berechnungsart für jedes Update verwendet werden muss:

**Schritt 1: Closed Bot prüfen**
```
if (update.status === 'Closed Bots') → Closed-Bot-Berechnung
```

**Schritt 2: Zeitbasis ermitteln (nur für aktive Bots)**
```javascript
// Berechne mit beiden möglichen Zeitbasen:
calcWithAvgRuntime = avgGridProfitHour × avgRuntimeHours
calcWithFromUntil = avgGridProfitHour × fromUntilHours

// Prüfe welche näher an overallGridProfitUsdt liegt:
if (|calcWithAvgRuntime - overallGridProfitUsdt| < |calcWithFromUntil - overallGridProfitUsdt|)
  → Startmetrik-Modus
else
  → Vergleich-Modus
```

#### Drei Berechnungsarten

| Modus | Wann verwendet | Formel |
|-------|----------------|--------|
| **Closed Bot** | `status === 'Closed Bots'` | `profit` einmalig am End-Datum |
| **Startmetrik** | Neues Update (avgRuntime-basiert) | `avgGridProfitHour × (avgRuntime × Überlappungs-Verhältnis)` |
| **Vergleich** | Update mit Vorgänger (From/Until-basiert) | `avgGridProfitHour × Überlappungs-Stunden` |

#### Detaillierte Erklärung

**1. Closed Bots**
- Der `profit`-Wert wird einmalig am End-Datum (`thisUpload`) gutgeschrieben
- Keine stündliche Berechnung, da der Bot bereits geschlossen ist
- Beispiel: profit = 4.88 USDT → wird der Periode zugerechnet, in der das End-Datum liegt

**2. Startmetrik (avgRuntime-basiert)**
- Wird verwendet, wenn das Update eine neue Startmetrik ist (kein Vorgänger)
- `avgGridProfitHour` wurde aus `overallGridProfitUsdt / avgRuntime` berechnet
- Perioden-Profit = `avgGridProfitHour × (avgRuntime × (Überlappung / Gesamtdauer))`
- Beispiel: bhj v1 → 2.85 × 38.47h = 109.64 USDT

**3. Vergleich (From/Until-basiert)**
- Wird verwendet, wenn das Update einen Vorgänger hat (Differenz-Berechnung)
- `avgGridProfitHour` wurde aus `overallGridProfitUsdt / (Until - From)` berechnet
- Perioden-Profit = `avgGridProfitHour × Überlappungs-Stunden`
- Beispiel: teshh v4 → -0.04 × 469.75h = -18.79 USDT

### Kritische Bug-Fixes (abgeschlossen)

1. **minTimestamp-Korrektur**: Verwendet jetzt frühestes `lastUpload` statt erstes End-Event, damit alle Bot-Laufzeit-Tage in Perioden erfasst werden
2. **Perioden-Summe validiert**: Summe aller Perioden entspricht dem Kontokart-Wert (~205.96 USDT)
3. **Dollarzeichen & Farbkodierung**: Gesamtprofit zeigt `{wert} $` mit grün (≥0) oder rot (<0)

### Code-Referenzen

| Feature | Datei | Ca. Zeilen |
|---------|-------|------------|
| Perioden-Profit-Berechnung | `dashboard.tsx` | 9038-9094 |
| Period Comparison Cards | `dashboard.tsx` | 9100-9300 |
| Eye Mode Content Card | `dashboard.tsx` | 8900-9000 |
| minTimestamp-Berechnung | `dashboard.tsx` | 1757-1771 |
| Framer Motion Animationen | `dashboard.tsx` | Period Cards mit `motion.div` |

### Verwendete Technologien im Auge-Modus

- **Framer Motion**: `motion.div` mit `layout` prop für sanfte Card-Animationen
- **Recharts**: Chart-Darstellung (falls benötigt)
- **TypeScript**: Vollständig typisierte States und Props
- **Tailwind CSS**: Styling inkl. dynamische Farbklassen

---

## 🔧 STIFT-MODUS (Pencil Mode) - SEPARATE SEKTION

> **KOMPLETT GETRENNT vom Auge-Modus - eigene States, eigene Logik**
> Der Stift-Modus (Pencil Mode) ist als vollständig separate Sektion implementiert, um den Golden State des Auge-Modus nicht zu beeinträchtigen.

### Übersicht Stift-Modus

Der Stift-Modus (aktiviert durch das Stift-Icon im Overlay Mode) ermöglicht:
- **Period-Auswahl**: Single-Select einer Period im Marker-Container
- **Apply-Workflow**: Auswahl speichern und Analyze-Button aktivieren
- **Analyze-Modus**: Chart zeigt nur die ausgewählte Period im Compare-Stil

### Implementierte Features

#### 1. Separate States
- `hoveredPencilPeriodKey`: Hovered Period (null oder Period-Key)
- `selectedPencilPeriodKey`: Ausgewählte Period (vor Apply)
- `appliedPencilPeriodKey`: Angewendete Period (nach Apply)
- `overlayAnalyzeMode`: Boolean für Analyze-Modus

#### 2. Stift-Modus UI Card
- **Period Details**: Von/Bis Datum, Gesamtprofit
- **Trash-Button**: Auswahl löschen
- **Analyze-Button**: Aktiviert overlayAnalyzeMode (neonblauer Glow wenn aktiv)
- **Apply-Button**: Speichert ausgewählte Period

#### 3. Marker-Container Interaktion
- **Hover**: Zeigt Period-Highlight (neonblau)
- **Click**: Single-Select (wählt Period aus oder ab)
- **Deaktiviert**: Wenn overlayAnalyzeMode aktiv

#### 4. Chart-Rendering im Analyze-Modus
- **Datenfilterung**: `overlayChartData.data` gefiltert auf `overlayAnalyzeModeBounds`
- **XAxis-Domain**: Automatischer Zoom auf Period-Zeitraum
- **Compare-Stil**: Individuelle Bot-Type Linien innerhalb der Period

### Code-Referenzen

| Feature | Datei | Ca. Zeilen |
|---------|-------|------------|
| States | `dashboard.tsx` | 283-288 |
| overlayAnalyzeModeBounds | `dashboard.tsx` | 3025-3049 |
| Period Interaktion | `dashboard.tsx` | 6099-6134 |
| Chart Data Filterung | `dashboard.tsx` | 7083-7094 |
| XAxis Domain | `dashboard.tsx` | 4218-4251 |
| Stift-Modus UI | `dashboard.tsx` | 9061-9272 |

### Backend-Tests (35 erfolgreich)

- 20 Logik-Tests: Period Key Parsing, Date Parsing, Profit Calculation
- 15 API-Integration-Tests: Bot Types, Updates, Timestamps, Filtering

---

### System Design Choices
*   **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase (e.g., MainChart, Compare Mode, Edit-Modus Analysis, Bot-Type CRUD, AI-Analysis page) are designated as "Golden State" and are protected from modification to ensure stability.
*   **Modular Architecture**: Clear separation of concerns between frontend and backend, and within the frontend, distinct modules for different chart functionalities.

## External Dependencies
*   **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
*   **Backend Framework**: Express.js with TypeScript.
*   **Frontend Libraries**:
    *   React: Core UI library.
    *   Recharts: Data visualization.
    *   shadcn/ui & Tailwind CSS: UI components and styling.
    *   Wouter: Client-side routing.
*   **Validation**: Zod for schema validation.
*   **AI Integration**: OpenAI API.
*   **Storage**: In-memory `MemStorage` for server-side data handling.