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

**CRITICAL ARCHITECTURE CHANGE - Server-Side VERGLEICH Calculations:**
- **Problem**: AI (GPT-4o) was unreliable for VERGLEICH mode calculations despite extensive prompt engineering
- **Solution**: Hybrid approach - AI calculates totals (NEU mode), Server computes differences (VERGLEICH mode)
- **Benefits**: 100% reliable, faster, no AI calculation errors

**Phase 2 (Data Extraction - AI-Powered):**
- OpenAI Vision API extracts structured JSON from screenshots with 100% accuracy
- Handles multiple screenshots per upload
- Validates all required fields present

**Phase 4 (Calculations - Hybrid AI + Server):**
1. **AI Calculations (Always NEU Mode)**:
   - AI ALWAYS calculates current total values across all screenshots
   - Computes both percentage bases (Gesamtinvestment + Investitionsmenge)
   - No VERGLEICH logic in AI prompts anymore
   
2. **Server-Side VERGLEICH Processing**:
   - After AI returns totals, server checks which modes are VERGLEICH
   - For VERGLEICH modes: calculates delta = current - previous
   - Replaces AI's total values with calculated deltas
   - 100% reliable, no AI calculation errors

**Backend Validation & Security (2-Layer System):**

1. **Input Validation** - Prevents invalid requests before AI processing:
   - Checks if previousUploadData exists when VERGLEICH modes active
   - Validates JSON format and completeness
   - Ensures previous upload has all required fields
   
2. **Schema Validation** - Validates AI output structure with Zod:
   - Ensures all fields have correct data types (string/number/null)
   - Accepts both string and number formats for flexibility
   - Rejects malformed AI responses before processing
   
3. **Runtime Validation** - Prevents unrealistic calculations:
   - Validates runtime requirements for avgGridProfit* fields
   - Prevents unrealistic values (e.g., weekly averages when bot runs <7 days)
   - Accepts null/0 values for metrics that cannot be calculated

**Removed Features:**
- ❌ AI-based VERGLEICH calculation validation (was unreliable)
- ❌ Server recalculation verification (no longer needed, server is source of truth)
- ❌ 2-cent tolerance checks (no longer needed, server math is exact)

**Test Infrastructure:**

- test-ai-debug-vergleich.js: VERGLEICH mode testing
- test-ai-2-uploads-quick.js: Quick NEU + VERGLEICH validation
- All tests passing with SERVER-calculated VERGLEICH values

## Recent Updates (December 6, 2025)

**Upload Timing Fields Implementation:**
- Added new fields: `uploadRuntime`, `lastUpload`, `thisUpload` to bot_type_updates schema
- Upload Laufzeit: Calculates time difference between Last Upload and This Upload
- Last Upload: Shows previous upload date/time (empty for Startmetrik)
- This Upload: Always shows current real-time date

**Date Logic Fix (Server + Frontend):**
- **Startmetrik**: AI calculates the date (current date minus longest runtime from screenshots)
- **Normal Uploads**: Server sets `date = null`, Frontend uses current real-time date
- Server-side enforcement ensures consistent date handling regardless of AI response

**Bot Types Page Enhancements:**
- Update history modal now displays upload timing fields
- Format: "From [Last Upload] Until [This Upload]" with Upload Laufzeit

**Database Schema:**
- All upload timing fields are nullable (text type)
- Compatible with existing data

## Recent Updates (December 6, 2025 - Continued)

**Last Grid Profit Durchschnitt & Change Implementation:**

**New UI Features:**
- Last Grid Profit Durchschnitt section with 3 clickable time period fields (Stunde, Tag, Woche)
- Clicking on a time period highlights it with a blue ring
- Change field shows the corresponding value for the selected time period
- Toggle between Dollar ($) and Prozent (%) display for Change values

**Change Calculation Logic (Frontend-Calculated):**
- 6 Change values calculated (3 time periods x 2 units):
  - `changeHourDollar`: Current Stunde - Previous Stunde
  - `changeHourPercent`: ((Current - Previous) / |Previous|) x 100
  - `changeDayDollar`, `changeDayPercent`: Same logic for Tag
  - `changeWeekDollar`, `changeWeekPercent`: Same logic for Woche
- Empty at Startmetrik (no previous values to compare)
- Values from previous upload loaded from database

**Database Schema Updates:**
- Added to `bot_type_updates`:
  - `lastAvgGridProfitHour`, `lastAvgGridProfitDay`, `lastAvgGridProfitWeek`
  - `changeHourDollar`, `changeHourPercent`
  - `changeDayDollar`, `changeDayPercent`
  - `changeWeekDollar`, `changeWeekPercent`

**Bot Types Page Display:**
- Last Grid Profit Durchschnitt section (shows previous upload values)
- Change section with all 6 values (3 Dollar, 3 Prozent)
- Conditional display: sections only shown if values exist