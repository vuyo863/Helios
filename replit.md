# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots, providing detailed performance insights and advanced analytics. It includes a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with customizable threshold alerts. The project aims to provide traders with comprehensive analytics and timely notifications to enhance decision-making with real-time data and a user-friendly interface, ultimately supporting better trading strategies and improved profitability.

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
- **DIAMOND STATE - Trendpreis & Watchlist Cross-Device Sync V1.0**:
Die komplette Cross-Device Synchronisation für Trendpreis & Watchlist ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.
  - **DIAMOND STATE Files:** `client/src/hooks/useCrossDeviceSync.ts` and Sync API routes in `server/routes.ts`.
  - **Sync-Logik:** Compares against last known remote timestamp (not freshly created local timestamps).
  - **Sync-Strategie:** `localStorage` remains master for local changes, backend for cross-device sync only. Timestamp-based versioning, polling every 3.5 seconds.
- **DIAMOND STATE - Benachrichtigungen Konfigurieren Cross-Device Sync V2.0**:
Die komplette Cross-Device Synchronisation für Schwellenwerte (Thresholds) ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.

  ### KOMPLETTE SECTION "BENACHRICHTIGUNGEN KONFIGURIEREN" (DIAMOND STATE):

  #### UI-STRUKTUR:
  - **Section Header:** "Benachrichtigungen konfigurieren" mit Glocken-Symbol
  - **Leer-Zustand:** "Keine Benachrichtigungen konfiguriert" Text wenn keine Thresholds existieren
  - **Trading-Pair Karten:** Pro Trading-Pair eine Karte mit:
    - Header: Symbol-Name (z.B. "BTCUSDT") + Market-Type Badge (Spot/Futures)
    - Status-Badge: "Aktiv" (grün) wenn in Watchlist UND min. 1 Threshold aktiv, sonst "Pause" (grau)
    - "+ Benachrichtigung hinzufügen" Button

  #### SCHWELLENWERT-KARTEN (pro Threshold):
  - **Alarm-Level Farben:** 
    - Harmlos = Blau
    - Achtung = Gelb
    - Gefährlich = Orange
    - Sehr Gefährlich = Rot
  - **Toggle:** Aktiv/Pause (setzt `isActive` true/false)
  - **Status-Anzeige:**
    - "0/1" = Einmalig, noch nicht getriggert
    - "X/1" oder "✓" = Einmalig, bereits getriggert
    - "0 ∞" = Wiederholend, noch nicht getriggert
    - "X ∞" = Wiederholend, X mal getriggert
  - **Icons:** Bearbeiten (Pencil), Löschen (Trash)
  - **Threshold-Wert:** z.B. "≥ 100.000 $" oder "≤ 50.000 $"

  #### DIALOG-SYSTEM:
  - **Schwellenwert-Dialog:**
    - Schwellenwert Input (deutsches Zahlenformat: 1.000,50)
    - Richtung: Steigt auf / Fällt auf
    - Häufigkeit: Einmalig / Wiederholend
    - Alarm-Level Dropdown
    - Notiz (optional)
    - "Speichern" Button (PFLICHT - kein Auto-Save!)
    - X-Button / ESC / Außenklick = Dialog schließen OHNE Speichern
  - **Alarm-Level-Dialog:**
    - Öffnet sich bei Klick auf Alarm-Level Dropdown
    - Zeigt alle 4 Alarm-Levels zur Auswahl
    - Zurück zur Schwellenwert-Dialog nach Auswahl

  #### DIALOG-VERHALTEN (KRITISCH - NIEMALS ÄNDERN):
  - **Kein Auto-Save:** Änderungen werden NUR bei "Speichern" Klick gespeichert
  - **Kein Auto-Close:** Dialog schließt NICHT automatisch bei Wert-Eingabe
  - **X/ESC/Außenklick:** Dialog schließen OHNE Änderungen zu speichern
  - **Draft Cleanup:** Unvollständige Thresholds (ohne Wert oder Richtung) werden automatisch entfernt wenn Dialog geschlossen wird
  - **hasAnyThresholds Check:** Excludiert aktuell bearbeiteten Threshold um Dialog-Auto-Close während Bearbeitung zu verhindern

  #### THRESHOLD-LOGIK:
  - **Einmalig:** Nach Trigger wird `isActive = false` gesetzt, Status zeigt "✓"
  - **Wiederholend:** Nach Trigger wird `triggerCount` erhöht, bleibt aktiv
  - **Re-Trigger Prevention:** `activeAlarmId` verhindert Duplikat-Alarme
  - **Persistenz:** Alle Daten in localStorage UND Backend (Cross-Device Sync)

  #### WAS WIRD SYNCHRONISIERT:
  - Alle Threshold-Konfigurationen (`trendPriceSettings`)
  - Toggle-Status (`isActive`)
  - Trigger-Count (`triggerCount`)
  - Active-Alarm-ID (`activeAlarmId`)
  - Notizen (`note`)
  - Alarm-Level (`alarmLevel`)

  ### SYNC-ARCHITEKTUR (DIAMOND STATE):

  #### Anti-Ping-Pong System (3+ Tabs):
  - **Problem:** Tab A pusht → Tab B empfängt → Tab B pusht zurück → Endlosschleife
  - **Lösung:** Hash-basierte Duplikat-Erkennung:
    - `lastPushedWatchlistHash` / `lastPushedThresholdsHash` / etc.
    - `lastReceivedWatchlistHash` / `lastReceivedThresholdsHash` / etc.
    - Vor Push: Check ob Daten von Remote kamen → Skip Push
  #### Timestamp-Vergleich (korrekt):
  - **Problem:** Neue Timestamps bei jedem Vergleich → Local immer "neuer"
  - **Lösung:** `lastKnownRemoteTimestamp` Refs:
    - Speichert letzten bekannten Remote-Timestamp
    - Vergleich gegen gespeicherten Wert, nicht gegen neuen Timestamp
  #### Refs für Stable Polling:
  - **Problem:** Interval wird bei jedem State-Change neu erstellt
  - **Lösung:** Refs für alle State-Werte und Setter:
    - `watchlistRef`, `trendPriceSettingsRef`, etc.
    - `setWatchlistRef`, `setTrendPriceSettingsRef`, etc.
    - Polling-Interval hat EMPTY Dependency Array

  ### API-ROUTEN (DIAMOND STATE):
  - GET/POST `/api/sync/watchlist`
  - GET/POST `/api/sync/thresholds`
  - GET/POST `/api/sync/alarm-levels`
  - GET/POST `/api/sync/active-alarms`

  ### SYNC-PARAMETER:
  - **Polling-Intervall:** 3.5 Sekunden
  - **Push-Debounce:** 1 Sekunde
  - **Remote-Update-Flag-Timeout:** 1 Sekunde
  - **Master:** localStorage bleibt Master, Backend nur für Cross-Device Sync
- **Workflow**: For the Notifications page, adding or editing a threshold, or changing its alarm level, requires an explicit "Speichern" (Save) button click; there is no auto-save for these actions. Dialog cleanup is automatic: when a "new threshold" dialog is closed (via X, ESC, or outside click) without saving, any incomplete threshold (missing value or notification type) is automatically removed from state. The `hasAnyThresholds` check excludes the currently editing threshold to prevent dialog auto-close during editing.
- **Golden State - Trendpreise & Watchlist V1.1**:
  - **Safe Remove Workflow:** User removes Trading-Pair from Watchlist. ALL thresholds are set to `isActive: false` (paused). `activeAlarmId` is deleted. Trading-Pair remains visible in "Benachrichtigungen konfigurieren" with "Paused" Badge.
  - **Safe Re-Add Workflow:** User re-add Trading-Pair to Watchlist. Existing settings are NOT modified. Thresholds remain `isActive: false` (paused). NO automatic alarms are triggered. User must manually activate the Toggle + click "Speichern".
- **Golden State - Benachrichtigungen Konfigurieren V1.5**:
  - **Combined Pairs Display:** Displays all pairs with configured thresholds (Watchlist + Non-Watchlist).
  - **Trading-Pair Card Status Badge:** "Active" (green) if in Watchlist AND at least 1 threshold is active. "Paused" (gray) otherwise.
- **Golden State - Aktive Alarmierungen V1.1**:
  - **Behavior after Remove/Re-Add:** No new alarms are triggered after removing/re-adding a trading pair from the watchlist; thresholds remain paused and require manual activation.
- **DIAMOND STATE - Aktive Alarmierungen Cross-Device Sync V1.0**:
Die komplette Cross-Device Synchronisation für Aktive Alarmierungen ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.
  - **Ziel:** Wenn User auf Tab A "Approved" oder "Stoppen" klickt, verschwindet der Alarm automatisch auf allen anderen Tabs (B, C, etc.)
  - **API-Routen:** GET/POST/DELETE `/api/sync/active-alarms`
  - **Sync-Strategie:** Timestamp-basierte Versionierung, Polling alle 3.5 Sekunden
  - **Anti-Ping-Pong:** Hash-basierte Duplikat-Erkennung verhindert Push-Back von empfangenen Daten
  - **Date Parsing:** `triggeredAt` und `restwartezeitEndsAt` werden als ISO-Strings übertragen und beim Pull zurück zu Date-Objekten konvertiert
  - **localStorage Update:** Nach Remote-Sync wird localStorage sofort aktualisiert für Konsistenz
  - **Master:** localStorage bleibt Master für lokale Änderungen, Backend nur für Cross-Device Sync

## System Architecture
### UI/UX
The frontend is built with React and TypeScript, leveraging `shadcn/ui` and Tailwind CSS for a responsive design. Recharts is used for data visualization, and Wouter for client-side routing. The application features a dashboard with charting capabilities and a Notifications page that includes a watchlist with live Binance prices, a configurable threshold system across four alarm levels, and an active alerts display. PWA support is integrated.

### Technical Implementations
- **Frontend**: React, TypeScript.
- **Backend**: Express.js with TypeScript.
- **State Management**: TypeScript-typed state with `useMemo` hooks.
- **Data Persistence**: Watchlist and pair market types are stored in `localStorage`.
- **Notification Logic**: Configurable thresholds, multi-channel notifications (email, SMS, push), and an alarm approval system with auto-dismiss and repetition logic. Active alarms are synchronized across devices via a backend API with PostgreSQL persistence and 3.5-second polling intervals.
- **Push Notification Integration**: OneSignal for web and native push notifications.
- **5-Tier Fallback Preissystem**: Ensures reliable cryptocurrency price data using a tiered system (OKX API, Last-Known-Good Cache, CoinGecko, Stale Cache, Emergency values) with server-side background updates and per-symbol price guarantees.
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