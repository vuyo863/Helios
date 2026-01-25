# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. It provides detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytics. The application also features a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts. The business vision is to empower cryptocurrency traders with comprehensive analytics and timely notifications to enhance trading decisions and capitalize on market opportunities.

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
  - **BUGFIX 25.01.2026 - Sofortige Alarm-Auslösung nach Reaktivierung:**
    - **Problem:** Nach dem Reaktivieren eines "Einmalig" Schwellenwerts (Toggle von "Pause" auf "Aktiv" + "Speichern") wurde der Alarm NICHT sofort ausgelöst. Der User musste den Dialog schließen und erneut öffnen, bevor der Alarm erschien.
    - **Root Cause:** Im Speichern-Handler des **existierenden Threshold Dialogs** (Zeile ~4085) wurde `setEditingThresholdId(null)` NICHT aufgerufen. Dadurch blieb `editingThresholdId` auf der Threshold-ID gesetzt.
    - **Auswirkung:** Der Threshold-Check (Zeile ~940) hat die Bedingung `if (threshold.id === editingThresholdId) return;` erfüllt und den Threshold übersprungen, obwohl der Dialog bereits geschlossen war.
    - **Lösung:** Im existierenden Threshold Dialog nach dem Speichern jetzt `setEditingThresholdId(null)` UND `editingThresholdRef.current = { pairId: null, thresholdId: null }` aufrufen, BEVOR der `setTimeout(() => setThresholdCheckTrigger(...), 0)` den Threshold-Check triggert.
    - **Code-Stelle:** `client/src/pages/notifications.tsx`, Zeile ~4088-4091
    - **Ergebnis:** Nach "Speichern" wird der Alarm jetzt SOFORT in "Aktive Alarmierungen" angezeigt
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
- **Golden State - Trendpreise & Watchlist V1.1**:
  - **Problem gelöst:** Trading-Pairs mit konfigurierten Schwellenwerten verschwanden aus "Benachrichtigungen konfigurieren" wenn sie aus der Watchlist entfernt wurden.
  - **Lösung - Safe Remove Workflow:**
    1. User entfernt Trading-Pair aus Watchlist
    2. ALLE Schwellenwerte werden auf `isActive: false` gesetzt (pausiert)
    3. `activeAlarmId` wird gelöscht (kein Re-Trigger möglich)
    4. Trading-Pair bleibt in "Benachrichtigungen konfigurieren" sichtbar (mit "Paused" Badge)
  - **Lösung - Safe Re-Add Workflow:**
    1. User fügt Trading-Pair wieder zur Watchlist hinzu
    2. Existierende Settings werden NICHT modifiziert
    3. Schwellenwerte bleiben auf `isActive: false` (pausiert)
    4. KEINE automatischen Alarme werden ausgelöst
    5. User muss manuell den Toggle auf "Aktiv" setzen + "Speichern" klicken
  - **Implementierung:**
    - `removeFromWatchlist()` setzt alle Schwellenwerte auf `isActive: false`
    - `addToWatchlist()` behält existierende Settings unverändert bei
    - Threshold-Check überspringt alle Schwellenwerte mit `isActive === false`
  - **Unit Tests:** 30 Tests in `server/no-auto-alarm-after-readd.test.ts` (alle bestanden)
- **Golden State - Benachrichtigungen Konfigurieren V1.5**:
  - **Problem gelöst:** Nur Watchlist-Pairs wurden angezeigt. Pairs mit Schwellenwerten aber nicht in Watchlist waren unsichtbar.
  - **Lösung - Combined Pairs Display:**
    - `allPairsToShow = [...watchlist, ...pairsWithThresholdsNotInWatchlist]`
    - ALLE Pairs mit konfigurierten Schwellenwerten werden angezeigt (Watchlist + Nicht-Watchlist)
  - **Trading-Pair Card Status Badge:**
    - **"Active" (grün):** Pair ist in Watchlist UND mindestens 1 Schwellenwert hat `isActive !== false`
    - **"Paused" (grau):** Pair ist NICHT in Watchlist ODER alle Schwellenwerte haben `isActive === false`
  - **Badge-Logik:**
    ```typescript
    const isInWatchlist = watchlist.includes(trendPriceId);
    const hasAnyActiveThreshold = savedThresholds.some(t => t.isActive !== false);
    const isActive = isInWatchlist && hasAnyActiveThreshold;
    // Badge: isActive ? "Active" : "Paused"
    ```
  - **Einmalig-Threshold Sonderfall:** Nach Trigger wird `isActive: false` gesetzt → Badge zeigt korrekt "Paused" wenn es der einzige Schwellenwert war
  - **Unit Tests:** 25 Tests in `server/badge-logic.test.ts` (alle bestanden)
- **Golden State - Aktive Alarmierungen V1.1**:
  - **Verhalten nach Remove/Re-Add:** 
    - Wenn Trading-Pair aus Watchlist entfernt wird → Schwellenwerte pausiert → KEINE neuen Alarme
    - Wenn Trading-Pair wieder hinzugefügt wird → Schwellenwerte bleiben pausiert → KEINE automatischen Alarme
    - User muss Schwellenwert manuell aktivieren um Alarm auszulösen
  - **Keine Änderungen an:** Border-Farben, Blinking-Animation, Sortierung, Scroll-Container

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive design. Recharts is used for dynamic data visualization, and Wouter for client-side routing. The dashboard includes MainChart, Compare Mode, and Added Mode (Analysis and Overlay). The Notifications page features a watchlist with live Binance prices, a configurable threshold system with four alarm levels, and an active alerts display.

### Technical Implementations
- **Frontend**: React, TypeScript.
- **Backend**: Express.js with TypeScript.
- **State Management**: TypeScript-typed state with `useMemo` hooks for optimization.
- **Data Persistence**: Watchlist and pair market types are persisted in `localStorage`.
- **Notification Logic**: Configurable thresholds, multi-channel notifications (email, SMS, push), and an alarm approval system with auto-dismiss functionality. Active alarms are synchronized across devices via a backend API with PostgreSQL persistence and 3.5-second polling intervals.
- **Push Notification Integration**: OneSignal is used for web and native push notifications, with a unified frontend toggle. The backend `/api/notifications/push-enhanced` route handles enhanced delivery.
- **PWA Support**: `manifest.json` and Apple Meta-Tags enable PWA functionality.

### Feature Specifications
- **Charts**: Interactive marker system, zoom & pan.
- **AI-Analysis**: Integration with OpenAI.
- **Info-Tooltips**: Contextual explanations.
- **Notifications**:
  - Real-time price tracking watchlist.
  - Configurable price alerts with German number formatting.
  - Web Push Notifications via OneSignal.
  - Native Push Notifications (PWA) for iOS and Android.
  - SMS Notifications via Twilio.
  - Alarm Approval System with auto-dismiss and repetition logic.
  - Cross-Device Alarm Synchronization through a backend API.
  - Re-Trigger Prevention for "Wiederholend" thresholds using `activeAlarmId`.
  - **5-Tier Fallback Preissystem (99%+ Zuverlässigkeit)**:
    - **Tier 1 (Primary)**: OKX API mit 2s Cache (Spot: `/api/okx/spot`, Futures: `/api/okx/futures`)
    - **Tier 2 (LKG)**: Last-Known-Good Cache mit 24h Persistenz im Server-Memory
    - **Tier 3 (CoinGecko)**: Automatischer Fallback zu CoinGecko für Spot-Preise
    - **Tier 4 (Stale)**: Stale Cache Rückgabe bei partiellen API-Ausfällen
    - **Tier 5 (Emergency)**: Statische Emergency-Werte (source: `Emergency-NoData`)
    - **Background-Updater**: Server-seitiges 30s Intervall aktualisiert 8 populäre Symbole (BTC, ETH, SOL, BNB, XRP, ICP, DOGE, ADA) unabhängig von Client-Aktivität
    - **Per-Symbol Guarantee**: Jedes angefragte Symbol erhält garantiert einen Preis (keine partiellen Antworten)
  - **Frontend Backup System**:
    - **Primary**: 2-Sekunden-Intervall für Preis-Updates
    - **Backup #1**: Exponential Backoff Retry bei API-Fehlern (max 5 Retries, bis 10s Delay)
    - **Backup #2**: Page Visibility API triggert sofortigen Refetch wenn Tab reaktiviert wird
    - **Backup #3**: Watchdog prüft alle 30s ob `lastPriceUpdateRef` veraltet ist und erzwingt Neustart
    - **Sofortiger Preis-Fetch**: Neue Watchlist-Pairs triggern sofortigen Preis-Fetch statt auf Intervall zu warten

### System Design Choices
- **Modular Architecture**: Clear separation of concerns.
- **Stable ID Handling**: Symbol-based lookup for futures pairs.
- **OneSignal Configuration**: Specific App ID, Site URL, and REST API Key.
- **Multi-Environment Database**: `server/db.ts` uses `RUNTIME_ENV` to switch between Neon Serverless (Replit) and PostgreSQL (server) with Drizzle ORM.
- **OneSignal Domain Configuration**: Supports multiple production domains (`helios-ai.replit.app`, `helios-ai.app`).

## External Dependencies
- **Database**: Neon Serverless (Replit) or PostgreSQL (server) with Drizzle ORM.
- **Backend Framework**: Express.js.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Crypto Data**: OKX API (Spot and Futures), CoinGecko Fallback.
- **Web Push Notifications**: OneSignal Web Push SDK v16.
- **SMS Notifications**: Twilio.