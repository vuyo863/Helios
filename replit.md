# Pionex Bot Profit Tracker

## Overview
A full-stack web application designed for tracking and analyzing profits from Pionex trading bots. It provides comprehensive insights into bot performance through profit trend visualization, bot type comparison, and advanced analytics. Additionally, the application includes a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with customizable threshold alerts. The primary goal is to equip cryptocurrency traders with robust analytics and timely notifications, enabling them to make informed trading decisions and leverage market opportunities effectively.

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
  - **Dokumentation:** Siehe `docs/GOLDEN_STATE_einmalig_threshold_logic.md` und `docs/GOLDEN_STATE_wiederholend_threshold_logic.md`
- **Golden State - Einmalig Threshold Logic**: Die komplette Logik für "Häufigkeit: Einmalig" ist Golden State und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Verhalten:** Neuer Schwellenwert zeigt "0/1", Toggle = "Aktiv"
  - **Nach Trigger:** `isActive = false`, Status wechselt zu "✓" (grüner Haken), Toggle = "Pause"
  - **Nach Page Refresh:** Toggle bleibt "Pause", Status zeigt korrekt "✓" (basierend auf `isActive === false` in localStorage)
  - **Reaktivierung:** User kann Toggle zurück auf "Aktiv" setzen → Status wird "0/1", kann erneut triggern
  - **Single State Update:** Beide Updates (isActive + triggerCount) erfolgen in EINEM `setTrendPriceSettings` Aufruf um Race Conditions zu vermeiden
  - **Status-Anzeige Logik:** Prüft `isActive === false` (persistiert) ODER `triggeredThresholds` (Session)
  - **Duplikat-Prevention (V1.1):** `activeAlarmId` wird jetzt auch für Einmalig gesetzt um Duplikate nach Page Refresh zu verhindern
  - **Dokumentation:** Siehe `docs/GOLDEN_STATE_einmalig_threshold_logic.md` für vollständigen Code-Snapshot
  - **Unit Tests:** 20 Tests in `server/test-einmalig-wiederholend-duplicates.ts` (alle bestanden)
- **Golden State - Wiederholend Threshold Logic**: Die komplette Logik für "Häufigkeit: Wiederholend" ist Golden State und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Verhalten:** Neuer Schwellenwert zeigt "0 ∞", Toggle = "Aktiv"
  - **Nach Trigger:** Counter wird erhöht, Status zeigt "X ∞" (X = Anzahl Trigger), Toggle bleibt "Aktiv"
  - **Re-Trigger Prevention:** Bei `requiresApproval=false` kann erst wieder triggern nach Auto-Dismiss des vorherigen Alarms
  - **Nach Page Refresh:** `activeAlarmId` bleibt im localStorage → verhindert Duplikat-Alarme
  - **Nach Auto-Dismiss/Stoppen:** `activeAlarmId` wird gelöscht → Re-Trigger wieder erlaubt
  - **Implementierung:** `activeAlarmId` Feld im ThresholdConfig, localStorage-persistiert
  - **Dokumentation:** Siehe `docs/GOLDEN_STATE_wiederholend_threshold_logic.md` für vollständigen Code-Snapshot
  - **Unit Tests:** 20 Tests in `server/threshold-wiederholend.test.ts` (alle bestanden)
  - **WICHTIG:** `activeAlarmId` wird jetzt für ALLE wiederholend Schwellenwerte gesetzt (sowohl `requiresApproval=true` als auch `false`), um Duplikate nach Page Refresh zu verhindern
- **Golden State - Push Benachrichtigungen**: Der folgende Toggle und seine Funktion sind Golden State und dürfen NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Toggle:** "Push Benachrichtigungen (iOS, Android, Browser)" in den Alarm-Level Einstellungen
  - **Funktion:** Sendet Push-Nachrichten an ALLE registrierten Geräte (iPhone, iPad, Windows Chrome) via OneSignal
  - **Backend-Routen:** `/api/notifications/web-push`, `/api/test-native-push`, `/api/notifications/push-enhanced`
  - **Unified Logic:** Ein Toggle kontrolliert beide internen Werte (webPush + nativePush), da OneSignal keine Geräte-Trennung unterstützt
  - **Push Test Button:** Versteckt hinter Auge-Symbol (Eye/EyeOff Toggle) in der Header-Zeile der Notifications-Seite
- **DIAMOND STATE - Trendpreise & Watchlist V1**: Die komplette "Trendpreise & Watchlist" Section inkl. 5-Tier Fallback Preissystem ist DIAMOND STATE (höchster Schutz) und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **Dokumentation:** Siehe `docs/DIAMOND_STATE_trendpreise_watchlist_v1.md` für vollständigen Code-Snapshot und Implementierungsdetails
  - **UI-Elemente:** Suchfeld, Spot/Futures Toggle, Watchlist-Anzeige mit Live-Preisen
  - **API-Endpunkte:** `/api/okx/spot`, `/api/okx/futures`, `/api/test-fallback-tiers`
  - **5-Tier Fallback System:** OKX → LKG → CoinGecko → Stale → Emergency
  - **Per-Symbol Garantie:** JEDES angefragte Symbol erhält garantiert einen Preis
  - **Background-Updater:** Server-seitig 30s Intervall für 8 populäre Symbole
  - **Cache-Strategie:** 2s TTL für Echtzeit, 24h LKG Persistenz
  - **Tests:** 23+ erfolgreiche Tests über alle 5 Tier-Stufen
- **DIAMOND STATE - Alarmierungsstufen konfigurieren**: Die komplette "Alarmierungsstufen konfigurieren" Section ist DIAMOND STATE (höchster Schutz) und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden:
  - **4 Alarm-Level-Karten:** Harmlos (blau), Achtung (gelb), Gefährlich (orange), Sehr Gefährlich (rot) im 2x2 Grid
  - **Karten-Anzeige:** Aktive Kanäle, Approval-Status, Wiederholung (Xx oder ∞), Sequenz, Restwartezeit
  - **Benachrichtigungskanäle:** E-Mail, SMS (mit Telefonnummer), Push (unified für iOS/Android/Browser)
  - **Approval erforderlich Toggle:** Mit automatischem Force-On bei infinite Wiederholungen
  - **Wiederholung:** Numerisches Input + "∞ Unendlich" Button, mit `py-0.5` für Border-Fix
  - **Sequenz:** 3-Spalten Grid (Stunden, Minuten, Sekunden)
  - **Restwartezeit:** Nur sichtbar wenn Approval=false UND repeatCount nicht infinite
  - **Dialog-System:** Bearbeiten-Dialog mit "Abbrechen" und "Speichern" Buttons
  - **Dokumentation:** Siehe `docs/GOLDEN_STATE_alarmierungsstufen_konfigurieren.md` für vollständigen Code-Snapshot
- **Workflow**: For the Notifications page, adding or editing a threshold, or changing its alarm level, requires an explicit "Speichern" (Save) button click; there is no auto-save for these actions. Dialog cleanup is automatic: when a "new threshold" dialog is closed (via X, ESC, or outside click) without saving, any incomplete threshold (missing value or notification type) is automatically removed from state. The `hasAnyThresholds` check excludes the currently editing threshold to prevent dialog auto-close during editing.

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, leveraging `shadcn/ui` and Tailwind CSS for a responsive design. Recharts is employed for dynamic data visualization, and Wouter manages client-side routing. The dashboard features MainChart, Compare Mode, and Added Mode (Analysis and Overlay). The Notifications page includes a watchlist with live Binance prices, a configurable threshold system across four alarm levels, and an active alerts display. PWA support is enabled via `manifest.json` and Apple Meta-Tags.

### Technical Implementations
- **Frontend**: React, TypeScript.
- **Backend**: Express.js with TypeScript.
- **State Management**: TypeScript-typed state with `useMemo` hooks for optimization.
- **Data Persistence**: Watchlist and pair market types are persisted in `localStorage`.
- **Notification Logic**: Configurable thresholds, multi-channel notifications (email, SMS, push), and an alarm approval system with auto-dismiss functionality. Active alarms are synchronized across devices via a backend API with PostgreSQL persistence and 3.5-second polling intervals. Re-trigger prevention for both "Einmalig" and "Wiederholend" thresholds is implemented using `activeAlarmId` to prevent duplicates after page refresh.
- **Push Notification Integration**: OneSignal provides web and native push notifications, controlled by a unified frontend toggle. The backend `/api/notifications/push-enhanced` route handles enhanced delivery.
- **5-Tier Fallback Price System**: Ensures 99%+ reliability for crypto prices using OKX, Last-Known-Good Cache, CoinGecko, Stale Cache, and Emergency static values. A server-side background updater fetches prices for 8 popular symbols every 30 seconds.
- **Frontend Price Backup System**: Includes exponential backoff retries, immediate refetch on tab reactivation, and a watchdog mechanism to ensure fresh price data.

### System Design Choices
- **Modular Architecture**: Emphasizes clear separation of concerns.
- **Stable ID Handling**: Uses symbol-based lookup for futures pairs.
- **OneSignal Configuration**: Utilizes a specific App ID, Site URL, and REST API Key, supporting multiple production domains (`helios-ai.replit.app`, `helios-ai.app`).
- **Multi-Environment Database**: `server/db.ts` dynamically switches between Neon Serverless (Replit) and PostgreSQL (server) using Drizzle ORM based on `RUNTIME_ENV`.
- **Direction-Specific Alarm Locking**: Implements `activeAlarmIdIncrease` and `activeAlarmIdDecrease` to allow independent operation of increase and decrease alarms.

## External Dependencies
- **Database**: Neon Serverless (Replit) or PostgreSQL with Drizzle ORM.
- **Backend Framework**: Express.js.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Crypto Data**: OKX API (Spot and Futures), CoinGecko.
- **Web Push Notifications**: OneSignal Web Push SDK.
- **SMS Notifications**: Twilio.