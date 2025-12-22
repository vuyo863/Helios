### Overview
The Pionex Bot Profit Tracker is a full-stack web application designed to track and analyze profits from Pionex trading bots. It features a comprehensive dashboard, a flexible data upload interface, and generates detailed, filterable financial reports. The primary goal is to provide clear, professional financial insights to users through a React frontend and an Express backend.

### User Preferences
Preferred communication style: Simple, everyday language (German).

### System Architecture

#### UI/UX
- **Framework**: React with TypeScript (Vite)
- **Design System**: shadcn/ui + Material Design 3 + Roboto font
- **Styling**: Tailwind CSS
- **Charting Library**: Recharts

#### Backend
- **Framework**: Express.js + Node.js + TypeScript
- **Storage**: MemStorage (in-memory for transient data)
- **Validation**: Zod

#### Database
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Includes `users`, `bot_types`, and `bot_entries` tables.
- **Migrations**: Drizzle Kit

#### Core Features & Design Patterns
- **Chart System**:
    - **Compare Mode**: Visualizes profit data for multiple selected bot types, displaying two points per update (start and end) for each bot type. Activated when `selectedChartBotTypes.length >= 2` and the "Compare" toggle is active.
    - **Added Mode**: Accumulates and displays values for multiple bot types.
    - **Marker System**: Uses distinct markers for updates (U1, U2, ...) and closed bots (C1, C2, ...), with specific keying for normal and compare modes. Active markers feature a neon-blue glow.
    - **Analyze Single Metric Mode**: An "exception state" within Compare Mode allowing detailed analysis of a single metric from a specific bot type, temporarily reverting to single-bot chart rendering.
- **Interactive Modes**:
    - **Eye Mode (`markerViewActive`)**: Allows multi-selection of markers, enabling bidirectional interaction between markers and chart points.
    - **Pencil Mode (`markerEditActive`)**: Prioritizes single-selection for detailed editing of an update, overriding Eye Mode when active.
- **Color System**: Utilizes `compareColorMap` for distinct bot-type specific coloring in Compare Mode, with a consistent neon-blue for active elements.
- **Graph Settings**: Time-range filters and metric counting are dynamically applied, adjusting aggregation logic based on whether a single bot, multiple bots (added mode), or compare mode is active.
- **Added Mode Features** (Dec 2025):
    - Aggregated "Gesamt" line with cyan color (#06b6d4)
    - Highest/Lowest markers (↑H/↓L) via `addedExtremeValues` useMemo
    - Connection lines with bot-type-specific colors
    - Tooltip shows "Gesamt:" with cyan border
    - Anzahl Metriks counter shows preview (pre-Apply selection) - consistent with Compare/Normal modes

### External Dependencies
- **Database**: Neon Serverless PostgreSQL
- **ORM**: Drizzle ORM
- **UI Components**: Radix UI, Recharts, date-fns, Lucide React
- **Form Management**: React Hook Form
- **Validation**: Zod
- **Utilities**: clsx, tailwind-merge, class-variance-authority