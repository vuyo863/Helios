# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project provides detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features. It also features a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts. The business vision is to empower cryptocurrency traders with comprehensive analytics and timely notifications to enhance trading decisions.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife
- **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are protected from modification to ensure stability. These protected areas (Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Added-Mode Overlay, Bot-Type CRUD, AI-Analysis Page, Info-Tooltips, and specific Notifications page components) must **NEVER** be altered unless explicitly instructed by the user.
- **Golden State - Notifications Page V1**: The following three sections on the Notifications page are Golden State and must NEVER be modified without explicit user permission:
  1. **Trendpreise & Watchlist**: Search, Spot/Futures toggle, watchlist display with prices
  2. **Benachrichtigungen konfigurieren**: Threshold dialog system, dialog behavior (no auto-close, no auto-save on X/ESC), explicit "Speichern" requirement, cleanup of unsaved thresholds, draft exclusion from alerts
  3. **Aktive Alarmierungen**: Dynamic border color based on highest danger level, red blinking animation for "Sehr Gefährlich", sorting dropdown (Dringlichkeit default), scroll container with fixed height
- **Golden State - Push Benachrichtigungen**: Der folgende Toggle und seine Funktion sind Golden State und dürfen NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Toggle:** "Push Benachrichtigungen (iOS, Android, Browser)" in den Alarm-Level Einstellungen
  - **Funktion:** Sendet Push-Nachrichten an ALLE registrierten Geräte (iPhone, iPad, Windows Chrome) via OneSignal
  - **Backend-Routen:** `/api/notifications/web-push`, `/api/test-native-push`, `/api/notifications/push-enhanced`
  - **Unified Logic:** Ein Toggle kontrolliert beide internen Werte (webPush + nativePush), da OneSignal keine Geräte-Trennung unterstützt
  - **Push Test Button:** Versteckt hinter Auge-Symbol (Eye/EyeOff Toggle) in der Header-Zeile der Notifications-Seite
- **Workflow**: For the Notifications page, adding or editing a threshold, or changing its alarm level, requires an explicit "Speichern" (Save) button click; there is no auto-save for these actions. Dialog cleanup is automatic: when a "new threshold" dialog is closed (via X, ESC, or outside click) without saving, any incomplete threshold (missing value or notification type) is automatically removed from state. The `hasAnyThresholds` check excludes the currently editing threshold to prevent dialog auto-close during editing.

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, leveraging `shadcn/ui` and Tailwind CSS for a responsive interface. Recharts is utilized for dynamic data visualization, and Wouter for client-side routing. The dashboard features MainChart, Compare Mode, and Added Mode (with Analysis and Overlay). Interactive elements include a marker system, zoom/pan, and Info-Tooltips. The Notifications page incorporates a watchlist with live Binance price updates, a configurable threshold system with four alarm levels, and an active alerts display. Web Push Notifications are integrated via OneSignal.

### Technical Implementations
- **State Management**: TypeScript-typed state for various application components.
- **Data Handling**: Optimized with `useMemo` hooks.
- **Bot Type Management**: Supports CRUD operations, CSV/Excel upload, and update history.
- **Notifications Data Persistence**: Watchlist and pair market types are persisted in `localStorage`. Futures pair identification uses a robust symbol-based fallback.
- **OneSignal Integration**: Configured for web push notifications, initialized on the production URL, with player ID storage for targeted delivery.
- **Backend Service Worker Route**: Express.js serves `OneSignalSDKWorker.js`.
- **Backend Notification Route**: Handles web push requests for specific players or all subscribed users.
- **Unified Push Logic**: A single frontend toggle controls both `webPush` and `nativePush` states due to OneSignal limitations, sending one notification to all subscribers (desktop and PWA).
- **Enhanced Push Route**: `/api/notifications/push-enhanced` includes retry logic, iOS optimizations, and a 24-hour TTL for improved delivery.

### Feature Specifications
- **Marker System**: Interactive points on charts.
- **Zoom & Pan**: Chart navigation.
- **AI-Analysis**: Integration with OpenAI for insights.
- **Info-Tooltips**: Explanations for metrics.
- **Notifications Watchlist**: Real-time price tracking.
- **Threshold System**: Configurable price alerts.
- **German Formatting**: Prices and thresholds displayed in German number format.
- **Web Push Notifications**: Real-time alerts via OneSignal.
- **Native Push Notifications (PWA)**: Supported on iOS (16.4+) and Android via PWA, leveraging OneSignal.
- **Push Test Button**: Hidden by default, accessible via an eye icon to prevent accidental triggers.

### System Design Choices
- **Modular Architecture**: Clear separation of concerns.
- **Stable ID Handling**: Symbol-based lookup for futures pairs.
- **OneSignal Configuration**: Specific App ID, Site URL, and REST API Key for secure and targeted notifications using `include_player_ids`.
- **PWA Infrastructure**: `manifest.json` and Apple Meta-Tags for PWA support on mobile devices.

## External Dependencies
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
- **Backend Framework**: Express.js with TypeScript.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Storage**: In-memory `MemStorage` for server-side data handling.
- **Crypto Data**: Binance API (Spot and Futures market data).
- **Web Push Notifications**: OneSignal Web Push SDK v16.