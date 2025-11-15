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

**Routing**: Client-side routing using Wouter library with three main routes:
- `/` - Dashboard/Overview page
- `/upload` - Screenshot upload and data entry page
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
- `POST /api/upload` - Create new bot entries (planned)

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

2. **bot_entries table**: Core data structure for bot trading records
   - id (UUID primary key)
   - date (date field for entry timestamp)
   - botName (text)
   - investment (numeric with precision 12, scale 2)
   - profit (numeric with precision 12, scale 2)
   - profitPercent (numeric with precision 8, scale 2)
   - periodType (text: 'Tag', 'Woche', 'Monat')
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

**Planned Features**:
- Screenshot upload functionality (file storage not yet implemented)
- OCR/AI analysis placeholder for automatic data extraction from screenshots
- User authentication system (schema exists but routes not implemented)