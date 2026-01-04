# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project aims to provide users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features, to empower better trading decisions. It also includes a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife
- **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are protected from modification to ensure stability. These protected areas (Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Added-Mode Overlay, Bot-Type CRUD, AI-Analysis Page, Info-Tooltips, and specific Notifications page components) must **NEVER** be altered unless explicitly instructed by the user.
- **Workflow**: For the Notifications page, adding or editing a threshold, or changing its alarm level, requires an explicit "Speichern" (Save) button click; there is no auto-save for these actions.

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive interface. Recharts is used for dynamic data visualization, and Wouter for client-side routing.

The dashboard offers three primary chart modes:
1.  **MainChart**: Displays detailed performance for a single bot type.
2.  **Compare Mode**: Compares the performance of two or more bot types.
3.  **Added Mode**: Aggregates data from multiple bot types, with an "Analysis" sub-toggle and an "Overlay" feature.

Key interactive features include a marker system (U1, C1), eye and pencil modes for detailed interaction, and zoom/pan functionalities. Info-Tooltips provide explanations for key metrics.

The Notifications page features a watchlist with live price updates (every 2 seconds) from Binance API for Spot and Futures pairs, displaying 24h price changes and market type badges. It also includes a threshold system with comma-input support, four alarm levels (harmlos, achtung, gefährlich, sehr_gefährlich), and an `isActive` toggle. Active alerts are displayed in a fixed-height scroll area with a blue border and a red badge in the Navbar.

### Technical Implementations
- **State Management**: TypeScript-typed state manages chart modes, bot types, and interaction.
- **Data Handling**: `useMemo` hooks optimize data preparation.
- **Bot Type Management**: Supports CRUD operations for bot types, including CSV/Excel upload and update history.
- **Eye Mode**: Provides an extended overlay view with Period Comparison Cards and aggregated metrics.
- **Pencil Mode**: Allows single-period selection for detailed analysis, including a bar chart for performance metrics.
- **Notifications Data Persistence**: Watchlist and pair market types are persisted in `localStorage`. Futures pair identification includes a robust symbol-based fallback mechanism to ensure stability across page reloads, with automatic migration for older data formats.

### Feature Specifications
- **Marker System**: Defines interactive points on charts for event analysis.
- **Zoom & Pan**: Interactive chart navigation.
- **AI-Analysis**: Integration with OpenAI for automated insights and data summarization.
- **Info-Tooltips**: Provides explanations for key metrics like "Ø Profit/Tag" and "Real Profit/Tag" in Added Mode.
- **Notifications Watchlist**: Real-time price tracking from Binance for Spot and Futures pairs.
- **Threshold System**: Configurable price alerts with different priority levels and activation states.
- **German Formatting**: Prices and thresholds are displayed in German number format (e.g., 50.000,00).

### System Design Choices
- **Modular Architecture**: Clear separation of concerns between frontend and backend, and within frontend components.
- **Stable ID Handling**: For Notifications, futures pairs use a symbol-based lookup to counteract unstable index-based IDs after reloads, ensuring data integrity.

## External Dependencies
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
- **Backend Framework**: Express.js with TypeScript.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Storage**: In-memory `MemStorage` for server-side data handling.
- **Crypto Data**: Binance API (for Spot and Futures market data).