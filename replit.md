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

## Änderungslog (Golden State Modifikationen)

### 31.12.2025 15:10 - Mode-Wechsel Komplett-Reset

**Problem**: Wenn im Compare Mode etwas im Auge-/Stift-Modus markiert wird und dann zu Added Analysis gewechselt wird, bleiben Markierungen und aktive Icons bestehen. Das sollte nicht sein da Compare und Added separate Modi sind.

**Lösung**: Beim Toggle zwischen Compare ↔ Added werden alle States auf Default zurückgesetzt:
- `markerViewActive` → false (Auge-Icon deaktivieren)
- `markerEditActive` → false (Stift-Icon deaktivieren)
- `hoveredUpdateId` → null
- `lockedUpdateIds` → new Set()
- `resetPencilAnalyzeState(true)` (setzt alle Stift-Modus States zurück)

**Code-Stelle**: `dashboard.tsx` Zeilen 10865-10923

**Auswirkung**: Minimaler Eingriff, NUR der Toggle-Handler wurde erweitert. Keine Logik-Änderungen an:
- Auge-Modus Funktionalität
- Stift-Modus Funktionalität
- Farben/Linien/Verbindungen
- Chart-Rendering

---

### 31.12.2025 13:30 - Gestrichelte Linien Overflow Fix

**Problem**: Gestrichelte Verbindungslinien von Markern (U1, C1) zum Chart waren nicht sichtbar.

**Ursache**: Marker-Container hatte `overflow-hidden` was die SVG-Linien bei 80px Höhe abschnitt.

**Lösung**: 
- Marker-Container: `overflow-hidden` → `overflow-visible`
- SVG-Element: `style={{ overflow: 'visible' }}` hinzugefügt

**Code-Stelle**: `dashboard.tsx` Zeilen 6260-6272

**Auswirkung**: Nur CSS/Visibility, keine Logik-Änderungen.