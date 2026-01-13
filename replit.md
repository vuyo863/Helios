# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. It offers detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytics. The application also features a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts. The business vision is to empower cryptocurrency traders with comprehensive analytics and timely notifications to enhance trading decisions and capitalize on market opportunities, with market potential to provide reliable, real-time cryptocurrency data and analytics.

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
  - **Dokumentation:** Siehe `docs/GOLDEN_STATE_einmalig_threshold_logic.md` für vollständigen Code-Snapshot
  - **Unit Tests:** 10 Tests in `server/threshold-einmalig.test.ts` (alle bestanden)
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
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive design. Recharts is used for dynamic data visualization, and Wouter for client-side routing. The dashboard includes MainChart, Compare Mode, and Added Mode (Analysis and Overlay). The Notifications page features a watchlist with live Binance prices, a configurable threshold system with four alarm levels, and an active alerts display. PWA functionality is supported via `manifest.json` and Apple Meta-Tags.

### Technical Implementations
- **Frontend**: React, TypeScript.
- **Backend**: Express.js with TypeScript.
- **State Management**: TypeScript-typed state with `useMemo` hooks for optimization.
- **Data Persistence**: Watchlist and pair market types are persisted in `localStorage`.
- **Notification Logic**: Configurable thresholds, multi-channel notifications (email, SMS, push), and an alarm approval system with auto-dismiss functionality. Active alarms are synchronized across devices via a backend API with PostgreSQL persistence and 3.5-second polling intervals. Re-Trigger Prevention for "Wiederholend" thresholds using `activeAlarmId`.
- **Price Data System**: A 5-Tier Fallback System ensures 99%+ reliability for cryptocurrency prices:
    - **Tier 1 (Primary)**: OKX API with 2s cache.
    - **Tier 2 (LKG)**: Last-Known-Good Cache with 24h persistence.
    - **Tier 3 (CoinGecko)**: Automatic fallback for spot prices.
    - **Tier 4 (Stale)**: Stale Cache return for partial API outages.
    - **Tier 5 (Emergency)**: Static emergency values.
    - **Background-Updater**: Server-side 30s interval for 8 popular symbols.
    - **Frontend Backup System**: Exponential backoff retry, Page Visibility API re-fetch, and a watchdog for `lastPriceUpdateRef`.
- **Push Notification Integration**: OneSignal for web and native push notifications, with a unified frontend toggle.
- **PWA Support**: `manifest.json` and Apple Meta-Tags enable PWA functionality.

### System Design Choices
- **Modular Architecture**: Clear separation of concerns.
- **Stable ID Handling**: Symbol-based lookup for futures pairs.
- **Multi-Environment Database**: `server/db.ts` uses `RUNTIME_ENV` to switch between Neon Serverless (Replit) and PostgreSQL (server) with Drizzle ORM.
- **OneSignal Configuration**: Specific App ID, Site URL, and REST API Key supporting multiple production domains (`helios-ai.replit.app`, `helios-ai.app`).

## External Dependencies
- **Database**: Neon Serverless (Replit), PostgreSQL with Drizzle ORM.
- **Backend Framework**: Express.js.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Crypto Data**: OKX API (Spot and Futures), CoinGecko.
- **Web Push Notifications**: OneSignal Web Push SDK v16.
- **SMS Notifications**: Twilio.