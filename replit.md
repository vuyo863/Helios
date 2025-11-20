# Pionex Bot Profit Tracker

## Overview

The Pionex Bot Profit Tracker is a web application designed to help users track and analyze profits from their Pionex trading bots. The application provides three main features:

1. **Dashboard (Übersicht)**: Displays comprehensive statistics including total investment, total profit, profit percentages, and visualizations through charts and tables
2. **Upload Interface**: Allows users to upload screenshots of bot performance and manually enter trading data
3. **Reports**: Generates filtered reports based on date ranges with detailed analytics

The application is built as a full-stack solution with a React frontend and Express backend, designed to be data-intensive with a focus on clarity and professional financial presentation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component Library**: shadcn/ui (Radix UI primitives) with the "new-york" style configuration

**Design System**: Material Design 3 principles with Roboto font family, emphasizing data clarity and professional financial aesthetics

**Routing**: Client-side routing using Wouter library with four main routes:
- `/` - Dashboard/Overview page
- `/upload` - Screenshot upload and data entry page
- `/bot-types` - Bot Types management and overview page
- `/reports` - Reports and analytics page

**State Management**: 
- TanStack Query (React Query) for server state management and data fetching
- Local component state using React hooks for UI interactions

**Data Visualization**: Recharts library for rendering line charts (profit over time) and bar charts (profit by bot)

**Styling**: Tailwind CSS with custom design tokens defined in CSS variables for theming support. Follows a consistent spacing system (4, 6, 8, 12, 16, 24 units).

**Type Safety**: Full TypeScript implementation with shared types between frontend and backend

### Backend Architecture

**Framework**: Express.js running on Node.js with TypeScript

**API Design**: RESTful API endpoints:
- `GET /api/entries` - Fetch all bot entries
- `GET /api/entries/:id` - Fetch single bot entry
- `GET /api/report?from=&to=` - Generate reports for date ranges
- `POST /api/upload` - Create new bot entries
- `GET /api/bot-types` - Fetch all bot types
- `POST /api/bot-types` - Create new bot type
- `PUT /api/bot-types/:id` - Update existing bot type (with Zod validation for non-empty updates)
- `DELETE /api/bot-types/:id` - Delete bot type (sets botTypeId to null for related entries)

**Development Server**: Vite middleware integration for hot module replacement and development experience

**Data Storage Strategy**: Currently using in-memory storage (`MemStorage` class) with mock data. The architecture supports easy migration to persistent database storage through the `IStorage` interface abstraction.

**Session Management**: Prepared for session handling with connect-pg-simple package

### Database Schema

**ORM**: Drizzle ORM configured for PostgreSQL

**Schema Design**:

1. **users table**: User authentication data
   - id (UUID primary key)
   - username (unique)
   - password (hashed)

2. **bot_types table**: Bot type/style categorization
   - id (UUID primary key)
   - name (unique text)
   - description (optional text)
   - color (optional text - hex color code)
   - createdAt (text timestamp)

3. **bot_entries table**: Core data structure for bot trading records
   - id (UUID primary key)
   - date (date field for entry timestamp)
   - botName (text)
   - botTypeId (optional foreign key to bot_types)
   - botType (optional text - bot type category)
   - version (optional text - bot version identifier)
   - botDirection (optional text - trading direction: Long/Short)
   - investment (numeric with precision 12, scale 2)
   - extraMargin (optional numeric - extra margin)
   - totalInvestment (optional numeric - total investment)
   - profit (numeric with precision 12, scale 2)
   - profitPercent (numeric with precision 8, scale 2)
   - periodType (text: 'Tag', 'Woche', 'Monat')
   - longestRuntime (optional text - longest runtime in format "Xd Xh Xs")
   - avgRuntime (optional text - average runtime in format "Xd Xh Xs")
   - avgGridProfitHour (optional numeric - average grid profit per hour)
   - avgGridProfitDay (optional numeric - average grid profit per day)
   - avgGridProfitWeek (optional numeric - average grid profit per week)
   - overallTrendPnlUsdt (optional numeric - overall trend P&L in USDT)
   - overallTrendPnlPercent (optional numeric - overall trend P&L percentage)
   - overallGridProfitUsdt (optional numeric - overall grid profit in USDT)
   - overallGridProfitPercent (optional numeric - overall grid profit percentage)
   - highestGridProfit (optional numeric - highest grid profit in USDT)
   - highestGridProfitPercent (optional numeric - highest grid profit percentage)
   - leverage (optional text - leverage multiplier e.g. "5x")
   - notes (optional text)
   - screenshotPath (optional text for file storage reference)

**Data Validation**: Zod schemas generated from Drizzle schema for runtime validation

**Migration Strategy**: Drizzle Kit configured with migrations directory for schema versioning

### External Dependencies

**Database**: 
- Neon Serverless PostgreSQL (via @neondatabase/serverless package)
- Connection configured through DATABASE_URL environment variable
- Drizzle ORM for type-safe database operations

**UI Component Dependencies**:
- Radix UI primitives for accessible, unstyled components (dialogs, popovers, dropdowns, etc.)
- Recharts for data visualization
- date-fns for date formatting and manipulation with German locale support
- Lucide React for consistent iconography

**Form Handling**:
- React Hook Form for form state management
- @hookform/resolvers with Zod for schema validation

**Utilities**:
- clsx and tailwind-merge for conditional CSS class management
- class-variance-authority for component variant styling

**Development Tools**:
- Replit-specific plugins for development environment integration
- ESBuild for production bundling
- TSX for TypeScript execution in development

**Implemented Features** (November 2025):
- **Bot Types Page** (November 17, 2025):
  - Dedicated `/bot-types` route with navigation bar integration
  - Displays all bot type categories as responsive content cards (grid layout: 1 column mobile, 2 tablet, 3 desktop)
  - Each card shows: bot type name, description, color indicator badge, creation date
  - Cards feature hover/active elevation effects for interactive feedback
  - Empty state with helpful message when no bot types exist
  - Fully integrated with existing bot type API endpoints
  - Navigation accessible via "Bot Types" button in navbar with Layers icon
- **Bot Type Management**: Full CRUD operations for bot types/styles
  - BotTypeManager component with two tabs: "Bestehende Bots" (view existing) and "Create Bot Type" (create new)
  - Each bot type has a name, optional description, and optional color (6 predefined colors available)
  - **Edit Mode**: Click pencil icon to edit existing bot type, form auto-fills, Save button updates in-place (no duplicates), Cancel button discards changes
  - **Delete**: Click trash icon to delete with confirmation dialog ("Möchten Sie die Inhalte und die Kategorie sicher löschen?")
  - Bot entries can be associated with a bot type for better categorization
  - When bot type is deleted, related entries retain data but botTypeId is set to null (data integrity)
  - Mock data includes 3 predefined bot types: Grid Trading Bots (blue), Futures Bots (green), Moon Bots (purple)
- **Upload Form Streamlined**: Notes field removed from bot entry upload form for cleaner data entry experience
- **Grid Profit Metrics Enhancement** (November 17, 2025):
  - "Grid Profit Durchschnitt" restructured from single field to three time-based metrics:
    - avgGridProfitHour (per hour)
    - avgGridProfitDay (per day)
    - avgGridProfitWeek (per week)
  - UI displays three compact input fields side-by-side with labels "Stunde", "Tag", "Woche"
  - All three metrics available in ProfitBarChartAdvanced for multi-timeframe analysis
  - Backend mock data updated with realistic hourly/daily/weekly values across 6 entries
- **Upload Form Section Reorganization** (November 17, 2025):
  - Form restructured into separate cyan-bordered sections with white backgrounds:
    1. **Bot Type**: Two side-by-side fields - Bot Type (category) and Version (with Save button in header)
    2. **Info**: Datum, Bot-Richtung, Hebel, Längste Laufzeit, Durchschnittliche Laufzeit
    3. **Investment**: Investitionsmenge (USDT), Extra Margin, Gesamtinvestment (3 Felder; Dropdown fest auf "Neu", nicht änderbar)
    4. **Gesamter Profit / P&L**: Gesamtprofit (USDT), Gesamtprofit (%)
    5. **Trend P&L**: Trend P&L (USDT), Trend P&L (%)
    6. **Grid Trading**: Grid Profit metrics, Overall Grid Profit, Highest Grid Profit
  - Most sections (Investment, Gesamter Profit/P&L, Trend P&L, Grid Trading) include dropdown filter with 2 mode options: "Vergleich" (comparison/difference), "Neu" (new/current values)
  - Info section has NO dropdown (fixed logic for each field, isolated per upload)
  - Dropdowns positioned to the right of section titles for easy time range selection
  - Bot Type and Version fields are optional text inputs stored in database
- **Critical Percentage Calculation Logic** (November 20, 2025):
  - **"Neu" Mode with TWO Dropdown Options**:
    - Each percentage field has a dropdown: "Gesamtinvestment" or "Investitionsmenge"
    - **Option 1 - Gesamtinvestment**: Percentage = (current_value_usdt / total_investment) × 100
      - Example: 75 USDT profit / 700 USDT total investment = 10.71%
      - Meaning: "Current profit is 10.71% of total capital deployed"
    - **Option 2 - Investitionsmenge**: Percentage = (current_value_usdt / investment) × 100
      - Example: 75 USDT profit / 500 USDT investment = 15%
      - Meaning: "Current profit is 15% of base investment (excluding extra margin)"
    - **CRITICAL: AI must ALWAYS calculate and output BOTH values** - dropdown is ONLY for UI display, NOT a filter criterion
    - The dropdown does NOT control what AI calculates - both values are required in AI output
  - **"Vergleich" Mode**: Percentage = (delta_usdt / previous_value) × 100
    - Example: 50→75 USDT = +25 USDT = (25/50)×100 = +50%
    - Meaning: "Profit increased BY 50%" (growth rate!)
    - NOT based on total_investment, but on previous value
    - Dropdown is irrelevant in "Vergleich" mode
  - This applies to all percentage fields in: Profit/P&L, Trend P&L, Grid Trading (Gesamter + Höchster)
  - Documented in `shared/modes-logic.ts` for AI implementation in Phase 4

**Planned Features**:
- Screenshot upload functionality (file storage not yet implemented)
- OCR/AI analysis placeholder for automatic data extraction from screenshots
- User authentication system (schema exists but routes not implemented)
- Filter/group by bot type on Dashboard and Reports pages