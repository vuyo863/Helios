# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project aims to provide users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features, to empower better trading decisions.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive interface. Recharts is used for dynamic data visualization, and Wouter for client-side routing.

The dashboard offers three primary chart modes:
1.  **MainChart**: Displays detailed performance for a single bot type.
2.  **Compare Mode**: Compares the performance of two or more bot types.
3.  **Added Mode**: Aggregates data from multiple bot types, with an "Analysis" sub-toggle and an "Overlay" feature.

Key interactive features include a marker system (U1, C1), eye and pencil modes for detailed interaction, and zoom/pan functionalities.

### Technical Implementations
*   **State Management**: TypeScript-typed state manages chart modes, bot types, and interaction.
*   **Data Handling**: `useMemo` hooks optimize data preparation.
*   **Bot Type Management**: Supports CRUD operations for bot types, including CSV/Excel upload and update history.
*   **Eye Mode**: Provides an extended overlay view with Period Comparison Cards and aggregated metrics.
*   **Pencil Mode**: Allows single-period selection for detailed analysis, including a bar chart for performance metrics.

### Feature Specifications
*   **Marker System**: Defines interactive points on charts for event analysis.
*   **Zoom & Pan**: Interactive chart navigation.
*   **AI-Analysis**: Integration with OpenAI for automated insights and data summarization.
*   **Info-Tooltips**: Provides explanations for key metrics like "Ø Profit/Tag" and "Real Profit/Tag" in Added Mode.

### System Design Choices
*   **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are protected from modification to ensure stability. This includes Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Added-Mode Overlay, Bot-Type CRUD, AI-Analysis Page, and Info-Tooltips for metric cards.
*   **Modular Architecture**: Clear separation of concerns between frontend and backend, and within frontend components.

## External Dependencies
*   **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
*   **Backend Framework**: Express.js with TypeScript.
*   **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
*   **Validation**: Zod.
*   **AI Integration**: OpenAI API.
*   **Storage**: In-memory `MemStorage` for server-side data handling.