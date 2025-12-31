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
*   **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are designated as "Golden State" and are protected from modification to ensure stability. This includes the Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Bot-Type CRUD, and AI-Analysis Page.
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

## Golden State Version 1.1 - Erfolgreiche Erweiterung (31.12.2025)

### Zusammenfassung

Am 31.12.2025 wurden die Golden States erfolgreich erweitert. Die Kernfunktionalitäten (Auge-Modus, Stift-Modus, Marker-System, Chart-Rendering) blieben **vollständig unverändert**. Es wurden lediglich **Mode-Wechsel-Handler** erweitert, um ein konsistentes Benutzererlebnis zu gewährleisten.

**Status**: ✅ ERFOLGREICH IMPLEMENTIERT UND GETESTET

---

## Was wurde erreicht?

### Problem vor Version 1.1
Beim Wechsel zwischen verschiedenen Chart-Modi (Compare ↔ Added, Analysis ↔ Overlay) wurden die Zustände der Auge- und Stift-Modi nicht zurückgesetzt. Das führte zu:

1. **Verwirrende UI**: Das Auge-Icon blieb blau (aktiv), obwohl man in einen anderen Modus gewechselt hatte
2. **Inkonsistente Markierungen**: Gestrichelte Linien und Marker-Highlights blieben sichtbar im neuen Modus
3. **State-Leaks**: Zustände aus einem Modus "bluteten" in den anderen Modus über

### Lösung in Version 1.1
Beim Modus-Wechsel werden jetzt **alle relevanten States auf Default zurückgesetzt**:

| State | Reset-Wert | Funktion |
|-------|------------|----------|
| `markerViewActive` | `false` | Auge-Icon wird grau (deaktiviert) |
| `markerEditActive` | `false` | Stift-Icon wird grau (deaktiviert) |
| `hoveredUpdateId` | `null` | Keine Hover-Markierung aktiv |
| `lockedUpdateIds` | `new Set()` | Keine geklickten Markierungen |
| `resetPencilAnalyzeState(true)` | Alle States | Stift-Modus komplett zurückgesetzt |

---

## Detaillierte Änderungsdokumentation

### Änderung 1: Compare ↔ Added Mode-Wechsel

**Datei**: `client/src/pages/dashboard.tsx`  
**Zeilen**: 10865-10923  
**Datum**: 31.12.2025 15:10

**Was wurde geändert?**

Der Toggle-Handler für den Compare/Added-Wechsel wurde erweitert. Vorher wurde nur `setAlleEintraegeMode()` aufgerufen. Jetzt werden zusätzlich alle Eye/Pencil States zurückgesetzt.

**Code-Markierung im Quellcode**:
```tsx
{/* HINZUGEFÜGT: 31.12.2025 14:45 - Reset Eye/Pencil States beim Modus-Wechsel
    AKTUALISIERT: 31.12.2025 15:10 - Auch Icons deaktivieren (markerViewActive/markerEditActive)
    Begründung: Compare und Added sind separate Modi, komplett auf Default zurücksetzen */}
```

**Betroffene onClick-Handler**:
1. **Compare-Button**: Zeilen 10869-10881
2. **Added-Button**: Zeilen 10896-10908

**Eingesetzte Reset-Befehle** (in beiden Buttons):
```tsx
// Deaktiviere Auge- und Stift-Icons
setMarkerViewActive(false);
setMarkerEditActive(false);
// Reset Auge-Modus States
setHoveredUpdateId(null);
setLockedUpdateIds(new Set());
// Reset Stift-Modus States
resetPencilAnalyzeState(true);
```

---

### Änderung 2: Analysis ↔ Overlay Mode-Wechsel

**Datei**: `client/src/pages/dashboard.tsx`  
**Zeilen**: 6019-6077  
**Datum**: 31.12.2025 15:20

**Was wurde geändert?**

Der Toggle-Handler für den Analysis/Overlay-Wechsel (im Added Mode) wurde erweitert. Vorher wurde nur `setAddedModeView()` aufgerufen. Jetzt werden zusätzlich alle Eye/Pencil States zurückgesetzt.

**Code-Markierung im Quellcode**:
```tsx
{/* GOLDEN STATE UPDATE: 31.12.2025 15:20 - Reset Eye/Pencil States beim Analysis↔Overlay Wechsel
    Begründung: Analysis und Overlay sind separate Modi, komplett auf Default zurücksetzen */}
```

**Betroffene onClick-Handler**:
1. **Analysis-Button**: Zeilen 6024-6037
2. **Overlay-Button**: Zeilen 6050-6063

**Eingesetzte Reset-Befehle** (in beiden Buttons):
```tsx
// Deaktiviere Auge- und Stift-Icons
setMarkerViewActive(false);
setMarkerEditActive(false);
// Reset Auge-Modus States
setHoveredUpdateId(null);
setLockedUpdateIds(new Set());
// Reset Stift-Modus States
resetPencilAnalyzeState(true);
```

---

### Änderung 3: Gestrichelte Linien Overflow Fix (Vorbereitung)

**Datei**: `client/src/pages/dashboard.tsx`  
**Zeilen**: 6260-6272  
**Datum**: 31.12.2025 13:30

**Was wurde geändert?**

Die gestrichelten Verbindungslinien von Markern (U1, C1) zum Chart waren nicht sichtbar weil der Container `overflow-hidden` hatte.

**Lösung**:
- Marker-Container: `overflow-hidden` → `overflow-visible`
- SVG-Element: `style={{ overflow: 'visible' }}` hinzugefügt

**Auswirkung**: Nur CSS/Visibility-Änderung, keine Logik betroffen.

---

## Was wurde NICHT verändert (Golden State Schutz)

Die folgenden Bereiche sind als **Golden State** geschützt und wurden bei dieser Erweiterung **nicht modifiziert**:

| Golden State Bereich | Status |
|---------------------|--------|
| Eye Mode (Auge-Modus) Logik | ✅ Unverändert |
| Pencil Mode (Stift-Modus) Logik | ✅ Unverändert |
| MainChart Rendering | ✅ Unverändert |
| Compare Mode Funktionalität | ✅ Unverändert |
| Added-Mode Analysis Funktionalität | ✅ Unverändert |
| Overlay Mode Funktionalität | ✅ Unverändert |
| Bot-Type CRUD | ✅ Unverändert |
| AI-Analysis Page | ✅ Unverändert |
| Farben und Linienführung | ✅ Unverändert |
| Marker-System (U1, C1, etc.) | ✅ Unverändert |
| Period Comparison Cards | ✅ Unverändert |
| Bar Chart im Pencil Mode | ✅ Unverändert |
| Zoom & Pan Funktionen | ✅ Unverändert |

---

## Testszenarien (Erfolgreich durchgeführt)

### Test 1: Compare → Added Wechsel
1. ✅ Im Compare Mode Auge-Icon aktivieren
2. ✅ Marker (U1/C1) anklicken
3. ✅ Zu Added wechseln
4. ✅ **Ergebnis**: Auge-Icon grau, keine Markierungen sichtbar

### Test 2: Added → Compare Wechsel
1. ✅ Im Added Mode Auge-Icon aktivieren
2. ✅ Marker anklicken
3. ✅ Zu Compare wechseln
4. ✅ **Ergebnis**: Auge-Icon grau, keine Markierungen sichtbar

### Test 3: Analysis → Overlay Wechsel
1. ✅ Im Added Mode → Analysis
2. ✅ Auge-Icon aktivieren
3. ✅ Zu Overlay wechseln
4. ✅ **Ergebnis**: Auge-Icon grau

### Test 4: Overlay → Analysis Wechsel
1. ✅ Im Added Mode → Overlay
2. ✅ Auge-Icon aktivieren
3. ✅ Zu Analysis wechseln
4. ✅ **Ergebnis**: Auge-Icon grau

---

## Golden State Version 1.2 - Real Profit/Tag Fix im Overlay Mode (31.12.2025)

### Problem

Im Overlay Mode wurde "Real Profit/Tag" falsch berechnet:
- **Analysis Mode**: 6.89 USDT ✅ (korrekt)
- **Overlay Mode**: 7.21 USDT ❌ (falsch)

### Ursache

Der Overlay Mode verwendete `endEvents[0]?.timestamp` (Zeitpunkt des ersten End-Events) als `minTimestamp`, während der Analysis Mode `earliestStartTs` (das früheste `lastUpload`-Datum aller Updates) verwendete.

**Formel**: `realDailyProfit = totalProfit / daySpan`  
**daySpan**: `(maxTimestamp - minTimestamp) / (1000 * 60 * 60 * 24)`

Mit dem falschen, späteren `minTimestamp` war `daySpan` kleiner, was zu einem höheren (falschen) `realDailyProfit` führte.

### Lösung

Die `earliestStartTs`-Logik wurde **exakt vom Analysis Mode kopiert** und im Overlay Mode eingefügt:

**Datei**: `client/src/pages/dashboard.tsx`  
**Zeilen**: 2331-2351 (Overlay Mode)  
**Datum**: 31.12.2025 17:00

**Kopierte Logik** (von Analysis Mode Zeilen 1791-1805):
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

**Zeile 2427**: `const minTimestamp = earliestStartTs;` (statt vorher `endEvents[0]?.timestamp`)

### Ergebnis

- **Analysis Mode**: 6.89 USDT ✅
- **Overlay Mode**: 6.89 USDT ✅ (jetzt identisch)

### Was wurde NICHT verändert

| Golden State Bereich | Status |
|---------------------|--------|
| Analysis Mode Logik | ✅ **Unverändert** (Golden State geschützt) |
| Eye Mode Logik | ✅ Unverändert |
| Pencil Mode Logik | ✅ Unverändert |
| Alle anderen Berechnungen | ✅ Unverändert |

### Berechnungsmethodik (Klarstellung)

Die "Real Profit/Tag"-Berechnung basiert auf dem **`lastUpload`-Datum** (Upload-Zeitpunkt), **NICHT** auf dem Bot-Start-Datum das in den Metriken/Screenshot steht.

- `earliestStartTs` = das früheste `lastUpload` aller ausgewählten Updates
- Das ist der Zeitpunkt, wann das Update in die App hochgeladen wurde

---

## Architektur-Übersicht der betroffenen States

```
Dashboard State Management
├── markerViewActive (boolean)       ← Auge-Icon aktiv/inaktiv
├── markerEditActive (boolean)       ← Stift-Icon aktiv/inaktiv
├── hoveredUpdateId (string|null)    ← Hover-Markierung
├── lockedUpdateIds (Set<string>)    ← Geklickte Markierungen
├── alleEintraegeMode ('compare'|'added')  ← Hauptmodus
├── addedModeView ('analysis'|'overlay')   ← Submodus im Added Mode
└── resetPencilAnalyzeState(force)   ← Funktion zum Reset aller Pencil-States
    ├── analyzeMode → false
    ├── overlayAnalyzeMode → false
    ├── selectedPeriodIndex → null
    ├── selectedPeriodBotDetails → null
    ├── pencilModeAnalyzeMetric → 'profit'
    └── Zoom-States zurücksetzen
```

---

## Fazit

Die Golden State Version 1.1 ist eine **minimal-invasive Erweiterung**, die das Benutzererlebnis verbessert ohne die Kernfunktionalitäten zu berühren. Alle Änderungen sind im Code mit Datum, Uhrzeit und Begründung dokumentiert und können jederzeit nachvollzogen werden.