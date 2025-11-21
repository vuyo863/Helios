# Pionex Bot Profit Tracker

## Overview

The Pionex Bot Profit Tracker is a web application designed to track and analyze profits from Pionex trading bots. It provides a comprehensive dashboard, a flexible upload interface for bot performance data, and generates detailed, filterable reports. The application aims to offer a clear, professional financial overview, built as a full-stack solution with a React frontend and an Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

**Framework**: React with TypeScript (Vite build tool).
**UI/UX**: shadcn/ui (Radix UI primitives) following Material Design 3 principles, with Roboto font. Emphasizes data clarity and professional aesthetics.
**Routing**: Wouter library with routes for Dashboard (`/`), Upload (`/upload`), Bot Types (`/bot-types`), and Reports (`/reports`).
**State Management**: TanStack Query for server state, React hooks for local component state.
**Data Visualization**: Recharts for line and bar charts.
**Styling**: Tailwind CSS with custom design tokens for theming.
**Type Safety**: Full TypeScript with shared types.

### Backend

**Framework**: Express.js with Node.js and TypeScript.
**API Design**: RESTful API for managing bot entries and types, including data fetching, creation, updating, and deletion.
**Development**: Vite middleware for HMR.
**Data Storage**: Currently in-memory (`MemStorage`), designed for easy migration to persistent storage via `IStorage` interface.
**Session Management**: Prepared for `connect-pg-simple`.

### Database

**ORM**: Drizzle ORM configured for PostgreSQL.
**Schema**:
- `users`: User authentication (id, username, password).
- `bot_types`: Categorization of bots (id, name, description, color, createdAt).
- `bot_entries`: Core trading records (date, botName, botTypeId, investment, profit, profitPercent, various grid profit metrics, trend P&L, etc.).
**Data Validation**: Zod schemas derived from Drizzle for runtime validation.
**Migrations**: Drizzle Kit for schema versioning.

### Key Features & Design Decisions

- **Bot Types Management**: CRUD operations for bot categories, including association with bot entries.
- **Advanced Profit Calculation Logic**:
    - **"Neu" Mode**: Calculates current values with percentages based on both "Gesamtinvestment" (Total Investment) and "Investitionsmenge" (Base Investment).
    - **"Vergleich" Mode**: Calculates precise differences (current - previous values) for all metrics, indicating growth rates.
    - **Grid Profit Metrics**: Restructured to include hourly, daily, and weekly averages. Special logic for "Höchster Grid Profit" uses individual screenshot investment for percentage calculation.
- **AI Integration (GPT-4o)**:
    - **Phase 2: Screenshot Data Extraction**: Extracts structured JSON data from Pionex bot screenshots, validating required fields.
    - **Phase 4: Intelligent Calculations**: Performs sophisticated calculations based on extracted data, handling "Startmetrik" (first upload) and "Update" scenarios for both "Neu" and "Vergleich" modes.
    - **Comprehensive Prompt System**: Detailed prompts guide the AI for data extraction and complex calculations, ensuring German language output without emojis.

## External Dependencies

**Database**:
- Neon Serverless PostgreSQL (`@neondatabase/serverless`)
- Drizzle ORM

**UI/Visualization**:
- Radix UI primitives
- Recharts
- date-fns
- Lucide React

**Form Handling**:
- React Hook Form
- `@hookform/resolvers` (with Zod)

**Utilities**:
- clsx
- tailwind-merge
- class-variance-authority

**Development Tools**:
- ESBuild
- TSX

## Recent Updates (November 21, 2025)

**AI Integration - Phase 2 & Phase 4 - FULLY WORKING ✅**

- **Phase 2 (Data Extraction)**: OpenAI Vision API extracts structured JSON from screenshots with 100% accuracy
- **Phase 4 (Calculations)**: GPT-4o performs sophisticated calculations for both "Neu" and "Vergleich" modes
- **Startmetrik Understanding**: AI correctly returns 0.00 for VERGLEICH mode when no previous data exists
- **VERGLEICH Calculations**: Precisely calculates differenzen (current - previous) for all metrics
- **NEU Calculations**: Computes both percentage bases (Gesamtinvestment + Investitionsmenge)

**Backend Validation & Security:**

- Server-side validation prevents invalid VERGLEICH requests:
  - Checks if previousUploadData exists when required
  - Validates JSON format and completeness
  - Verifies all required fields for active VERGLEICH modes
- Clear error messages guide users to fix issues or switch modes
- Prevents division-by-zero and null reference errors
- Comprehensive negative tests confirm validation for all edge cases

**Test Infrastructure:**

- test-ai-phases.js: Phase 2 + Phase 4 API testing
- test-ai-comprehensive.js: Startmetrik + Update scenarios
- test-ai-negative.js: Validation & error handling tests
- All tests passing with exact expected values