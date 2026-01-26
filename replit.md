# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots, providing detailed insights into bot performance and advanced analytics. It also includes a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts. The project aims to empower cryptocurrency traders with comprehensive analytics and timely notifications to enhance trading decisions and capitalize on market opportunities.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife
- **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are protected from modification to ensure stability. These protected areas (Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Added-Mode Overlay, Bot-Type CRUD, AI-Analysis Page, Info-Tooltips, and specific Notifications page components) must **NEVER** be altered unless explicitly instructed by the user.
- **Golden State - Notifications Page V1**: The following three sections on the Notifications page are Golden State and must NEVER be modified without explicit user permission:
  1. **Trendpreise & Watchlist**: Search, Spot/Futures toggle, watchlist display with prices
  2. **Benachrichtigungen konfigurieren**: Threshold dialog system, dialog behavior (no auto-close, no auto-save on X/ESC), explicit "Speichern" requirement, cleanup of unsaved thresholds, draft exclusion from alerts
  3. **Aktive Alarmierungen**: Dynamic border color based on highest danger level, red blinking animation for "Sehr Gefährlich", sorting dropdown (Dringlichkeit default), scroll container with fixed height
- **Golden State - Benachrichtigungen Konfigurieren V1.4**: Die komplette "Benachrichtigungen konfigurieren" Section ist Golden State und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **UI-Elemente:** Kontenkarte mit Glocken-Symbol, "Keine Benachrichtigungen konfiguriert" Leertext, "+ Benachrichtigung hinzufügen" Button
  - **Schwellenwert-Karten:** Alarm-Level Farben, Toggle (Aktiv/Pause), Status-Anzeige (0/1, X ∞, ✓), Bearbeiten/Löschen Icons
  - **Dialog-System:** Schwellenwert-Dialog, Alarm-Level-Dialog, Speichern-Pflicht, kein Auto-Save bei X/ESC
  - **Häufigkeits-Optionen:** Einmalig und Wiederholend mit korrektem Verhalten
- **Golden State - Einmalig Threshold Logic**: Die komplette Logik für "Häufigkeit: Einmalig" ist Golden State und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Verhalten:** Neuer Schwellenwert zeigt "0/1", Toggle = "Aktiv"
  - **Nach Trigger:** `isActive = false`, Status wechselt zu "✓" (grüner Haken), Toggle = "Pause"
  - **Nach Page Refresh:** Toggle bleibt "Pause", Status zeigt korrekt "✓" (basierend auf `isActive === false` in localStorage)
  - **Reaktivierung:** User kann Toggle zurück auf "Aktiv" setzen → Status wird "0/1", kann erneut triggern
  - **Single State Update:** Beide Updates (isActive + triggerCount) erfolgen in EINEM `setTrendPriceSettings` Aufruf um Race Conditions zu vermeiden
  - **Status-Anzeige Logik:** Prüft `isActive === false` (persistiert) ODER `triggeredThresholds` (Session)
- **Golden State - Wiederholend Threshold Logic**: Die komplette Logik für "Häufigkeit: Wiederholend" ist Golden State und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Verhalten:** Neuer Schwellenwert zeigt "0 ∞", Toggle = "Aktiv"
  - **Nach Trigger:** Counter wird erhöht, Status zeigt "X ∞" (X = Anzahl Trigger), Toggle bleibt "Aktiv"
  - **Re-Trigger Prevention:** Bei `requiresApproval=false` kann erst wieder triggern nach Auto-Dismiss des vorherigen Alarms
  - **Nach Page Refresh:** `activeAlarmId` bleibt im localStorage → verhindert Duplikat-Alarme
  - **Nach Auto-Dismiss/Stoppen:** `activeAlarmId` wird gelöscht → Re-Trigger wieder erlaubt
  - **Implementierung:** `activeAlarmId` Feld im ThresholdConfig, localStorage-persistiert
  - **WICHTIG:** `activeAlarmId` wird jetzt für ALLE wiederholend Schwellenwerte gesetzt (sowohl `requiresApproval=true` als auch `false`), um Duplikate nach Page Refresh zu verhindern
- **Golden State - Push Benachrichtigungen**: Der folgende Toggle und seine Funktion sind Golden State und dürfen NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Toggle:** "Push Benachrichtigungen (iOS, Android, Browser)" in den Alarm-Level Einstellungen
  - **Funktion:** Sendet Push-Nachrichten an ALLE registrierten Geräte (iPhone, iPad, Windows Chrome) via OneSignal
  - **Backend-Routen:** `/api/notifications/web-push`, `/api/test-native-push`, `/api/notifications/push-enhanced`
  - **Unified Logic:** Ein Toggle kontrolliert beide internen Werte (webPush + nativePush), da OneSignal keine Geräte-Trennung unterstützt
  - **Push Test Button:** Versteckt hinter Auge-Symbol (Eye/EyeOff Toggle) in der Header-Zeile der Notifications-Seite
- **DIAMOND STATE - Alarmierungsstufen konfigurieren**: Die komplette "Alarmierungsstufen konfigurieren" Section ist DIAMOND STATE (höchster Schutz) und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **4 Alarm-Level-Karten:** Harmlos (blau), Achtung (gelb), Gefährlich (orange), Sehr Gefährlich (rot) im 2x2 Grid
  - **Karten-Anzeige:** Aktive Kanäle, Approval-Status, Wiederholung (Xx oder ∞), Sequenz, Restwartezeit
  - **Benachrichtigungskanäle:** E-Mail, SMS (mit Telefonnummer), Push (unified für iOS/Android/Browser)
  - **Approval erforderlich Toggle:** Mit automatischem Force-On bei infinite Wiederholungen
  - **Wiederholung:** Numerisches Input + "∞ Unendlich" Button, mit `py-0.5` für Border-Fix
  - **Sequenz:** 3-Spalten Grid (Stunden, Minuten, Sekunden)
  - **Restwartezeit:** Nur sichtbar wenn Approval=false UND repeatCount nicht infinite
  - **Dialog-System:** Bearbeiten-Dialog mit "Abbrechen" und "Speichern" Buttons
- **DIAMOND STATE - Trendpreis & Watchlist Cross-Device Sync V1.0**:
  Die komplette Cross-Device Synchronisation für Trendpreis & Watchlist ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.
  - **Checkpoint:** 26.01.2026 ~01:30 Uhr, Commit: `90eb8f587f88684d60fad8b2e75d83a0b1ca718a`
  - **Problem gelöst:** Remote-Updates wurden ignoriert weil Timestamp-Vergleich fundamental fehlerhaft war. `createWatchlistSyncData()` erstellte bei jedem Poll neue Timestamps, wodurch Remote-Daten immer "älter" erschienen.
  - **Solution:** Implemented `lastKnownRemoteWatchlistTimestamp`, `lastKnownRemoteThresholdsTimestamp`, `lastKnownRemoteAlarmLevelsTimestamp` for correct comparison and added DELETE routes for sync data cleanup.
  - **DIAMOND STATE Files:** `client/src/hooks/useCrossDeviceSync.ts` and Sync API routes in `server/routes.ts`.
  - **Sync-Logik:** Compares against last known remote timestamp (not freshly created local timestamps).
  - **Sync-Strategie:** `localStorage` remains master for local changes, backend for cross-device sync only. Timestamp-based versioning, polling every 3.5 seconds.
  - **Tests bestanden:** 20/20 Durchgänge mit 5 Tabs gleichzeitig (ADD + DELETE), Backend API Logs verifiziert.

- **Benachrichtigungen Konfigurieren Cross-Device Sync V1.0 (WARTET AUF PRÜFUNG)**:
  Cross-Device Synchronisation für Thresholds (Schwellenwerte) - wartet auf User-Prüfung für DIAMOND STATE.
  - **Checkpoint:** 26.01.2026 ~01:45 Uhr, Commit: `a2b6e4023c6deb191e65de15b09758be6174c78f`
  - **Gleiche Logik wie Watchlist Sync:** `lastKnownRemoteThresholdsTimestamp` Ref für korrekten Timestamp-Vergleich.
  - **API-Routen:** GET/POST/DELETE `/api/sync/thresholds`
  - **Tests durchgeführt:** 20/20 Durchgänge mit 5 Tabs gleichzeitig (ADD + DELETE), Backend API Logs geprüft.
- **Workflow**: For the Notifications page, adding or editing a threshold, or changing its alarm level, requires an explicit "Speichern" (Save) button click; there is no auto-save for these actions. Dialog cleanup is automatic: when a "new threshold" dialog is closed (via X, ESC, or outside click) without saving, any incomplete threshold (missing value or notification type) is automatically removed from state. The `hasAnyThresholds` check excludes the currently editing threshold to prevent dialog auto-close during editing.
- **Golden State - Trendpreise & Watchlist V1.1**:
  - **Safe Remove Workflow:** User removes Trading-Pair from Watchlist. ALL thresholds are set to `isActive: false` (paused). `activeAlarmId` is deleted. Trading-Pair remains visible in "Benachrichtigungen konfigurieren" with "Paused" Badge.
  - **Safe Re-Add Workflow:** User re-adds Trading-Pair to Watchlist. Existing settings are NOT modified. Thresholds remain `isActive: false` (paused). NO automatic alarms are triggered. User must manually activate the Toggle + click "Speichern".
- **Golden State - Benachrichtigungen Konfigurieren V1.5**:
  - **Combined Pairs Display:** Displays all pairs with configured thresholds (Watchlist + Non-Watchlist).
  - **Trading-Pair Card Status Badge:** "Active" (green) if in Watchlist AND at least 1 threshold is active. "Paused" (gray) otherwise.
- **Golden State - Aktive Alarmierungen V1.1**:
  - **Behavior after Remove/Re-Add:** No new alarms are triggered after removing/re-adding a trading pair from the watchlist; thresholds remain paused and require manual activation.

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, utilizing `shadcn/ui` and Tailwind CSS for a responsive design. Recharts provides dynamic data visualization, and Wouter manages client-side routing. The application features a dashboard with MainChart, Compare Mode, and Added Mode (Analysis and Overlay). The Notifications page includes a watchlist with live Binance prices, a configurable threshold system with four alarm levels, and an active alerts display. PWA support is integrated via `manifest.json` and Apple Meta-Tags.

### Technical Implementations
- **Frontend**: React, TypeScript.
- **Backend**: Express.js with TypeScript.
- **State Management**: TypeScript-typed state with `useMemo` hooks.
- **Data Persistence**: Watchlist and pair market types are stored in `localStorage`.
- **Notification Logic**: Configurable thresholds, multi-channel notifications (email, SMS, push), and an alarm approval system with auto-dismiss and repetition logic. Active alarms are synchronized across devices via a backend API with PostgreSQL persistence and 3.5-second polling intervals.
- **Push Notification Integration**: OneSignal for web and native push notifications.
- **5-Tier Fallback Preissystem**: Ensures 99%+ reliability for cryptocurrency price data using a tiered system (OKX API, Last-Known-Good Cache, CoinGecko, Stale Cache, Emergency values) with server-side background updates and per-symbol price guarantees.
- **Frontend Backup System**: Features a 2-second interval for price updates, exponential backoff retry on API errors, immediate refetch on page visibility change, and a watchdog to restart price fetching.

### Feature Specifications
- **Charts**: Interactive marker system, zoom & pan.
- **AI-Analysis**: Integration with OpenAI.
- **Info-Tooltips**: Contextual explanations.
- **Notifications**: Real-time price tracking watchlist, configurable price alerts with German number formatting, Web Push Notifications, Native Push Notifications (PWA) for iOS and Android, SMS Notifications, Alarm Approval System with auto-dismiss and repetition logic, Cross-Device Alarm Synchronization, Re-Trigger Prevention for "Wiederholend" thresholds using `activeAlarmId`.

### System Design Choices
- **Modular Architecture**: Clear separation of concerns.
- **Stable ID Handling**: Symbol-based lookup for futures pairs.
- **Multi-Environment Database**: `server/db.ts` uses `RUNTIME_ENV` to switch between Neon Serverless (Replit) and PostgreSQL (server) with Drizzle ORM.
- **OneSignal Configuration**: Specific App ID, Site URL, and REST API Key. Supports multiple production domains.

## External Dependencies
- **Database**: Neon Serverless (Replit) or PostgreSQL (server) with Drizzle ORM.
- **Backend Framework**: Express.js.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Crypto Data**: OKX API, CoinGecko.
- **Web Push Notifications**: OneSignal Web Push SDK v16.
- **SMS Notifications**: Twilio.