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

### Perioden-Profit-Berechnung (Overlay-Modus)

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

#### Code-Referenz
Die Implementierung befindet sich in `client/src/pages/dashboard.tsx` (ca. Zeilen 9038-9094).

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