# Pionex Bot Profit Tracker

## Overview

The Pionex Bot Profit Tracker is a full-stack web application for tracking and analyzing profits from Pionex trading bots. It features a comprehensive dashboard, a flexible data upload interface, and generates detailed, filterable financial reports. The application aims to provide clear, professional financial insights, leveraging a React frontend and an Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript (Vite).
- **UI/UX**: shadcn/ui (Radix UI primitives) adhering to Material Design 3 principles, using Roboto font for data clarity and professional aesthetics.
- **Routing**: Wouter library with dedicated routes for Dashboard, Upload, Bot Types, and Reports.
- **State Management**: TanStack Query for server state; React hooks for local component state.
- **Data Visualization**: Recharts for dynamic line and bar charts.
- **Styling**: Tailwind CSS with custom design tokens for theming.
- **Features**: Advanced profit calculation logic ("Neu" for current values, "Vergleich" for precise differences), bot types management (CRUD), and dynamic chart animations with zoom, pan, and offset capabilities.

### Backend
- **Framework**: Express.js with Node.js and TypeScript.
- **API Design**: RESTful API for managing bot entries and types.
- **Data Storage**: Currently in-memory (`MemStorage`), designed for future migration to persistent storage.
- **AI Integration (GPT-4o)**: Utilizes AI for structured JSON data extraction from Pionex bot screenshots (Phase 2) and intelligent calculation support (Phase 4). Server-side logic handles "Vergleich" mode calculations for reliability.
- **Validation**: Zod for schema validation and robust input validation to prevent invalid requests and ensure data integrity.

### Database
- **ORM**: Drizzle ORM configured for PostgreSQL.
- **Schema**:
    - `users`: User authentication.
    - `bot_types`: Bot categorization (name, description, color).
    - `bot_entries`: Core trading records (date, botName, investment, profit, various grid profit metrics, trend P&L).
- **Migrations**: Drizzle Kit for schema versioning.

## External Dependencies

### Database
- Neon Serverless PostgreSQL (`@neondatabase/serverless`)
- Drizzle ORM

### UI/Visualization
- Radix UI primitives
- Recharts
- date-fns
- Lucide React

### Form Handling
- React Hook Form
- `@hookform/resolvers` (with Zod)

### Utilities
- clsx
- tailwind-merge
- class-variance-authority

### Development Tools
- ESBuild
- TSX