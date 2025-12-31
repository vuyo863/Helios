# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project provides users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features. The goal is to offer comprehensive data analysis for better trading decisions and to empower users with tools for informed trading decisions.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, utilizing `shadcn/ui` and Tailwind CSS for a modern, responsive interface. Recharts handles dynamic data visualization. Wouter manages client-side routing.

The dashboard features three main chart modes:
1.  **MainChart**: Displays detailed performance for a single bot type, including total profit, average daily profit, real daily profit, total capital, and total profit percentage. It supports interactive metric cards, a robust marker system (U1, C1), eye and pencil modes for interaction, and zoom/pan functionalities.
2.  **Compare Mode**: Enables comparison of two or more bot types, visualizing their performance with color-coded lines, highlighting start/end points of updates, and showing runtime information.
3.  **Added Mode**: Aggregates data from multiple bot types, focusing on end values. It includes an "Analysis" sub-toggle for metric display and supports an "Overlay" feature for alternative data representation (Eye Mode, Pencil Mode).

### Technical Implementations
*   **State Management**: Extensive use of TypeScript-typed state for managing chart modes, selected bot types, and interaction modes.
*   **Data Handling**: `useMemo` hooks optimize data preparation for various chart modes.
*   **Color System**: A consistent color palette is used for metrics and chart elements.
*   **Bot Type Management**: Comprehensive CRUD operations for bot types, including CSV/Excel upload and update history tracking.
*   **Eye Mode**: Provides an extended overlay view with Period Comparison Cards (showing profit per period and bot contributions), and an Eye Mode Content Card displaying aggregated metrics like total profit, total capital, profit percentage, and average daily profit. This mode includes automatic period division and profit calculation, distinguishing between Closed Bot, Startmetrik (avgRuntime-based), and Vergleich (From/Until-based) calculation methods. Framer Motion is used for sorting animations.
*   **Pencil Mode**: Allows single-selection of a period for detailed analysis. Users can "Apply" a selection to activate an "Analyze" mode, where the chart zooms to the selected period and displays bot performance in a compare-style view. This mode includes a bar chart with selectable metrics (profit, capital, percent, avgDaily) and color-coding.

### Feature Specifications
*   **Marker System**: Allows users to define and interact with specific points on charts for event tracking and analysis.
*   **Zoom & Pan**: Interactive zooming and panning capabilities on chart axes.
*   **AI-Analysis**: Integration with OpenAI for automated insights and chart data summarization.

### System Design Choices
*   **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are designated as "Golden State" and are protected from modification to ensure stability. This includes:
    - Eye Mode (Auge-Modus)
    - Pencil Mode (Stift-Modus)
    - MainChart
    - Compare Mode
    - Added-Mode Analysis
    - **Added-Mode Overlay** ← NEU in Version 1.2 (31.12.2025)
    - Bot-Type CRUD
    - AI-Analysis Page
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

---

# 🏆 GOLDEN STATE VERSION 1.2 - Overlay Mode Offiziell Golden State

**Datum**: 31.12.2025  
**Status**: ✅ VOLLSTÄNDIG IMPLEMENTIERT UND GETESTET

---

## Zusammenfassung

**Overlay Mode ist jetzt offiziell Teil des Golden State.**

Alle Graph-Einstellungen, Berechnungen und Funktionalitäten im Overlay Mode sind:
- ✅ **Sauber und perfekt** implementiert
- ✅ **Vollständig getestet**
- ✅ **Geschützt vor Modifikationen**
- ✅ **Als Default gesetzt** (wenn "Gesamt" ausgewählt ist)

---

## Vollständige Änderungsdokumentation dieser Session (31.12.2025)

### Änderung 1: Overlay als Default-Ansicht im Added Mode

**Datei**: `client/src/pages/dashboard.tsx`  
**Zeile**: 205  
**Zeitpunkt**: 31.12.2025 17:25

**Was wurde geändert?**

Der Default-Wert für `addedModeView` wurde von `'analysis'` auf `'overlay'` geändert.

**Vorher**:
```tsx
const [addedModeView, setAddedModeView] = useState<'analysis' | 'overlay'>('analysis');
```

**Nachher**:
```tsx
const [addedModeView, setAddedModeView] = useState<'analysis' | 'overlay'>('overlay');
```

**Auswirkung**: 
- Wenn ein User die Seite **neu lädt** oder **zum ersten Mal besucht**
- Und "Gesamt" im oberen Toggle ausgewählt hat
- Wird automatisch **Overlay** angezeigt statt Analysis

**Warum?**
Der User bevorzugt die Overlay-Ansicht als Standard-Ansicht im Added Mode.

---

### Änderung 2: Real Profit/Tag Berechnung im Overlay Mode korrigiert

**Datei**: `client/src/pages/dashboard.tsx`  
**Zeilen**: 2331-2351 (Overlay Mode), 2427  
**Zeitpunkt**: 31.12.2025 17:00

#### Problem

Im Overlay Mode wurde "Real Profit/Tag" **falsch berechnet**:
- **Analysis Mode**: 6.89 USDT ✅ (korrekt)
- **Overlay Mode**: 7.21 USDT ❌ (falsch - zu hoch!)

#### Ursache

Der Overlay Mode verwendete einen **falschen Startzeitpunkt** für die Berechnung:

| Mode | Verwendeter Startzeitpunkt | Resultat |
|------|---------------------------|----------|
| Analysis | `earliestStartTs` (frühestes `lastUpload`) | ✅ Korrekt |
| Overlay | `endEvents[0]?.timestamp` (erstes End-Event) | ❌ Zu spät! |

**Formel**: `realDailyProfit = totalProfit / daySpan`  
**daySpan**: `(maxTimestamp - minTimestamp) / (1000 * 60 * 60 * 24)`

Mit dem falschen, **späteren** `minTimestamp` war `daySpan` kleiner → höherer (falscher) `realDailyProfit`.

#### Lösung

Die `earliestStartTs`-Logik wurde **exakt vom Analysis Mode kopiert** und im Overlay Mode eingefügt:

**Eingefügter Code** (Zeilen 2331-2351):
```tsx
// ========== GOLDEN STATE UPDATE: 31.12.2025 16:00 - earliestStartTs Logik von Analysis kopiert ==========
// BERECHNE ECHTEN ZEITRAUM (inkl. Start-Daten)
// minTimestamp sollte das früheste lastUpload sein, damit Real Profit/Tag korrekt berechnet wird
// KOPIERT von Analysis Mode (Zeilen 1791-1805) - Analysis bleibt UNVERÄNDERT
let earliestStartTs = Infinity;
relevantUpdates.forEach(update => {
  if (update.lastUpload) {
    const startDate = parseGermanDate(update.lastUpload);
    if (startDate) {
      earliestStartTs = Math.min(earliestStartTs, startDate.getTime());
    }
  }
});
// Fallback: Wenn kein lastUpload gefunden, nutze erstes End-Event
if (earliestStartTs === Infinity) {
  earliestStartTs = endEvents[0]?.timestamp || 0;
}
// ========== ENDE GOLDEN STATE UPDATE ==========
```

**Zeile 2427** wurde geändert von:
```tsx
const minTimestamp = endEvents[0]?.timestamp || 0;  // ALT
```
zu:
```tsx
const minTimestamp = earliestStartTs;  // NEU
```

#### Ergebnis

Beide Modi zeigen jetzt **identische** Real Profit/Tag Werte:
- **Analysis Mode**: 6.89 USDT ✅
- **Overlay Mode**: 6.89 USDT ✅ (jetzt identisch!)

#### Wichtige Klarstellung zur Berechnungsmethodik

Die "Real Profit/Tag"-Berechnung basiert auf dem **`lastUpload`-Datum** (Upload-Zeitpunkt in die App), **NICHT** auf dem Bot-Start-Datum das in den Metriken/Screenshot steht.

- `earliestStartTs` = das früheste `lastUpload` aller ausgewählten Updates
- Das ist der Zeitpunkt, wann das erste Update in die App hochgeladen wurde

---

## Was wurde NICHT verändert (Golden State Schutz)

Die folgenden Bereiche wurden bei dieser Session **NICHT modifiziert**:

| Golden State Bereich | Status | Begründung |
|---------------------|--------|------------|
| **Analysis Mode Logik** | ✅ **UNVERÄNDERT** | Nur von dort kopiert, keine Änderung am Original |
| Eye Mode (Auge-Modus) Logik | ✅ Unverändert | Keine Modifikation |
| Pencil Mode (Stift-Modus) Logik | ✅ Unverändert | Keine Modifikation |
| MainChart Rendering | ✅ Unverändert | Keine Modifikation |
| Compare Mode Funktionalität | ✅ Unverändert | Keine Modifikation |
| Bot-Type CRUD | ✅ Unverändert | Keine Modifikation |
| AI-Analysis Page | ✅ Unverändert | Keine Modifikation |
| Farben und Linienführung | ✅ Unverändert | Keine Modifikation |
| Marker-System (U1, C1, etc.) | ✅ Unverändert | Keine Modifikation |
| Period Comparison Cards | ✅ Unverändert | Keine Modifikation |
| Bar Chart im Pencil Mode | ✅ Unverändert | Keine Modifikation |
| Zoom & Pan Funktionen | ✅ Unverändert | Keine Modifikation |

---

## Overlay Mode - Offizielle Golden State Spezifikation

### Geschützte Funktionalitäten

Der Overlay Mode umfasst folgende **geschützte Funktionalitäten**:

1. **Graph-Einstellungen**
   - Linienfarben und -stärken
   - Achsenbeschriftungen
   - Tooltip-Verhalten
   - Zoom/Pan-Interaktionen

2. **Metrikkarten-Bereich**
   - Gesamtkapital
   - Gesamtprofit
   - Gesamtprofit % (GI)
   - Ø Profit/Tag
   - Real Profit/Tag ← Korrigiert in v1.2

3. **Berechnungslogik**
   - `earliestStartTs` Berechnung aus `lastUpload`
   - `realDailyProfit` Formel
   - `daySpan` Berechnung
   - Fallback-Logik für fehlende Daten

4. **UI-Elemente**
   - Analysis/Overlay Toggle
   - From/Until Dropdown
   - Eye Mode Integration
   - Pencil Mode Integration

### Änderungsregeln für Overlay Mode

Ab sofort gelten für den Overlay Mode die gleichen Regeln wie für alle anderen Golden State Bereiche:

| Erlaubt | Nicht erlaubt |
|---------|---------------|
| Bug-Fixes mit Dokumentation | Neue Features ohne Genehmigung |
| Performance-Optimierungen | Änderungen an der Berechnungslogik |
| CSS/Styling-Anpassungen | Entfernen von Funktionalitäten |
| Kommentare/Dokumentation | Refactoring ohne Begründung |

---

## Architektur-Übersicht der betroffenen States

```
Dashboard State Management (dashboard.tsx)
├── markerViewActive (boolean)       ← Auge-Icon aktiv/inaktiv
├── markerEditActive (boolean)       ← Stift-Icon aktiv/inaktiv
├── hoveredUpdateId (string|null)    ← Hover-Markierung
├── lockedUpdateIds (Set<string>)    ← Geklickte Markierungen
├── alleEintraegeMode ('compare'|'added')  ← Hauptmodus
├── addedModeView ('analysis'|'overlay')   ← Submodus im Added Mode
│   └── DEFAULT: 'overlay' (seit v1.2)
└── resetPencilAnalyzeState(force)   ← Funktion zum Reset aller Pencil-States
    ├── analyzeMode → false
    ├── overlayAnalyzeMode → false
    ├── selectedPeriodIndex → null
    ├── selectedPeriodBotDetails → null
    ├── pencilModeAnalyzeMetric → 'profit'
    └── Zoom-States zurücksetzen
```

---

## Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.0 | - | Initiale Implementation |
| 1.1 | 31.12.2025 | Mode-Wechsel-Handler erweitert (Eye/Pencil Reset) |
| **1.2** | **31.12.2025** | **Overlay Mode → Golden State, Real Profit/Tag Fix, Default auf Overlay** |

---

## Fazit

Die Golden State Version 1.2 erweitert den geschützten Bereich um den **Overlay Mode**. Alle Graph-Einstellungen und Berechnungen sind jetzt:
- ✅ Vollständig dokumentiert
- ✅ Getestet und verifiziert
- ✅ Als Golden State geschützt
- ✅ Als Default-Ansicht konfiguriert

Der Code ist sauber, perfekt und darf nur mit dokumentierten Bug-Fixes modifiziert werden.
