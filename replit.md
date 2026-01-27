# Pionex Bot Profit Tracker

## NOTIFICATION PAGE - FINISHED (2026-01-27)
**Alle Cross-Device Sync Sections sind DIAMOND STATE:**
- Trendpreis & Watchlist Cross-Device Sync V2.0
- Benachrichtigungen Konfigurieren Cross-Device Sync V2.2
- Aktive Alarmierungen Cross-Device Sync V1.1
- Alarmierungsstufen konfigurieren

---

## iOS Zoom Fix V1.0 (2026-01-27) - SEPARATE SECTION
**Komplett SEPARAT vom Sync-System. Hat NICHTS mit Cross-Device Sync zu tun.**

### Das Problem:
- **Nur auf iPad/iPhone:** Nach Page-Refresh zoomte die Seite über den Watchlist-Preis-Bereich
- **Trigger:** Passierte nach dem Löschen eines Schwellenwerts oder Trendpreises
- **Ursache:** iOS Safari stellt den Fokus auf das zuletzt aktive Element nach Reload wieder her

### Die Lösung:
Neuer Hook `useIOSZoomFix` in separater Datei:
```typescript
// client/src/hooks/useIOSZoomFix.ts
export function useIOSZoomFix() {
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement !== document.body) {
        activeElement.blur();
        console.log('[iOS-ZOOM-FIX] Blurred active element on page load');
      }
    }
  }, []);
}
```

### Integration:
- Hook wird in `notifications.tsx` aufgerufen (Zeile ~1556)
- Komplett isoliert vom Sync-Code
- Läuft nur auf iOS-Geräten
- Console-Log zeigt wann der Fix aktiv wird

### Dateien:
- `client/src/hooks/useIOSZoomFix.ts` - Separater Hook
- `client/src/pages/notifications.tsx` - Import und Aufruf (Zeile 20, 1556)

---

## Overview
A full-stack web application for cryptocurrency traders to track and analyze profits from Pionex trading bots. It provides detailed performance insights, advanced analytics, real-time cryptocurrency price monitoring, and customizable threshold alerts to optimize trading strategies and maximize returns. The project aims to empower users with data-driven decision-making tools.

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
- **DIAMOND STATE - Trendpreis & Watchlist Cross-Device Sync V2.0**: Die komplette Cross-Device Synchronisation für Trendpreis & Watchlist ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.
  ### DIAMOND STATE FILE (NIEMALS ÄNDERN):
  **`client/src/hooks/useCrossDeviceSync.ts`** - VOLLSTÄNDIGER CODE GESCHÜTZT (600 Zeilen)
  ⚠️⚠️⚠️ DIESE DATEI DARF NIEMALS MODIFIZIERT WERDEN ⚠️⚠️⚠️
  Der komplette Code ist in der Datei gespeichert und funktioniert perfekt.
  Bei Bedarf kann der Code mit `cat client/src/hooks/useCrossDeviceSync.ts` angezeigt werden.
- **DIAMOND STATE - Benachrichtigungen Konfigurieren Cross-Device Sync V2.2**:
Die komplette Cross-Device Synchronisation für Schwellenwerte (Thresholds) und Alarmierungsstufen (Alarm Levels) ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.

  ### ÜBERSICHT DER GELÖSTEN PROBLEME:
  Diese Sektion dokumentiert drei kritische Cross-Device-Sync Bugs die in V2.1 und V2.2 behoben wurden:
  1. **V2.1:** Threshold/Alarm-Level Löschungen wurden nicht auf andere Geräte synchronisiert
  2. **V2.2:** "Flash" von alten Daten bei Page-Refresh behoben
  3. **V2.2:** Beide Fixes funktionieren identisch für Spot UND Futures Trading-Pairs

  ---
  
  #### BUG-FIX V2.1 (2026-01-27): lastPushedHash Update bei Remote-Empfang für Thresholds UND Alarm Levels
  
  ##### DAS PROBLEM (Ausführliche Erklärung):
  Wenn ein User auf Tab B einen Threshold/Alarm-Level löscht, soll diese Löschung automatisch auf alle anderen Tabs (A, C, etc.) synchronisiert werden. Das Problem war: Auf Tab A wurde die Löschung empfangen, aber wenn der User auf Tab A später SELBER etwas löschte, wurde dieser Push fälschlicherweise übersprungen.
  
  ##### WARUM DAS PASSIERTE (Technische Ursache):
  Das Sync-System verwendet Hashes um zu erkennen ob Daten bereits gepusht wurden. Es gibt zwei Hash-Refs:
  - `lastReceivedHash`: Der Hash der zuletzt empfangenen Remote-Daten
  - `lastPushedHash`: Der Hash der zuletzt gepushten lokalen Daten
  
  **Vor dem Fix:** Wenn Tab A Remote-Daten empfing, wurde NUR `lastReceivedHash` aktualisiert. `lastPushedHash` blieb auf dem alten Wert.
  
  ##### SZENARIO (Schritt für Schritt):
  ```
  AUSGANGSZUSTAND Tab A:
  - settings = {BTC_USDT: [threshold1]}
  - lastPushedHash = Hash({BTC_USDT: [threshold1]})
  
  SCHRITT 1: Tab B erstellt threshold2 und pusht zum Backend
  
  SCHRITT 2: Tab A empfängt Remote-Daten via Polling
  - settings wird zu {BTC_USDT: [threshold1, threshold2]}
  - lastReceivedHash = Hash({BTC_USDT: [threshold1, threshold2]})
  - lastPushedHash = UNVERÄNDERT = Hash({BTC_USDT: [threshold1]})  ← BUG!
  
  SCHRITT 3: User löscht threshold2 auf Tab A
  - settings wird zu {BTC_USDT: [threshold1]}
  - currentHash = Hash({BTC_USDT: [threshold1]})
  
  SCHRITT 4: Push-Check
  - currentHash === lastPushedHash? 
  - Hash({BTC_USDT: [threshold1]}) === Hash({BTC_USDT: [threshold1]}) → TRUE!
  - Push wird ÜBERSPRUNGEN weil System denkt "schon gepusht"
  
  ERGEBNIS: Andere Tabs (B, C) sehen die Löschung NIE!
  ```
  
  ##### DIE LÖSUNG (Code-Fix):
  Bei jedem Remote-Empfang wird jetzt AUCH `lastPushedHash` auf den empfangenen Hash aktualisiert:
  ```typescript
  // useCrossDeviceSync.ts - Thresholds Polling (Zeile ~527)
  if (remoteMergedThresholds) {
    const receivedHash = hashContent(remoteMergedThresholds);
    lastReceivedThresholdsHash.current = receivedHash;
    lastPushedThresholdsHash.current = receivedHash;  // ← NEUER FIX!
    setTrendPriceSettingsRef.current(remoteMergedThresholds);
  }
  
  // useCrossDeviceSync.ts - Alarm Levels Polling (Zeile ~563)
  if (remoteMergedAlarmLevels) {
    const receivedHash = hashContent(remoteMergedAlarmLevels);
    lastReceivedAlarmLevelsHash.current = receivedHash;
    lastPushedAlarmLevelsHash.current = receivedHash;  // ← NEUER FIX!
    setAlarmLevelConfigsRef.current(remoteMergedAlarmLevels);
  }
  ```
  
  ##### WARUM DAS FUNKTIONIERT:
  Nach dem Fix im gleichen Szenario:
  ```
  SCHRITT 2 (nach Fix): Tab A empfängt Remote-Daten
  - lastPushedHash = Hash({BTC_USDT: [threshold1, threshold2]})  ← JETZT AKTUALISIERT!
  
  SCHRITT 4 (nach Fix): Push-Check
  - currentHash === lastPushedHash?
  - Hash({BTC_USDT: [threshold1]}) === Hash({BTC_USDT: [threshold1, threshold2]}) → FALSE!
  - Push wird AUSGEFÜHRT ✓
  
  ERGEBNIS: Alle Tabs sehen die Löschung sofort!
  ```

  ---
  
  #### BUG-FIX V2.2 (2026-01-27): localStorage Flash-Fix bei Page-Refresh
  
  ##### DAS PROBLEM:
  Wenn User die Seite neu lädt (F5 / Refresh), wurden kurz die ALTEN Daten aus localStorage angezeigt, bevor die aktuellen Server-Daten geladen wurden. Das führte zu einem verwirrenden "Flash" - z.B. ein gelöschter Threshold erschien kurz wieder.
  
  ##### WARUM DAS PASSIERTE:
  Der Initial-Sync und das Polling haben zwar die Server-Daten empfangen und in den React-State geschrieben, aber localStorage wurde NICHT sofort aktualisiert. Beim nächsten Refresh wurde das alte localStorage geladen.
  
  ##### DIE LÖSUNG:
  Bei jedem Empfang von Remote-Daten wird localStorage SOFORT aktualisiert:
  ```typescript
  // useCrossDeviceSync.ts - Initial Sync (Zeile ~231, ~251)
  localStorage.setItem('notifications-threshold-settings', JSON.stringify(remoteMergedThresholds));
  localStorage.setItem('notification-alarm-level-configs', JSON.stringify(remoteMergedAlarmLevels));
  
  // useCrossDeviceSync.ts - Polling (Zeile ~540, ~585)
  localStorage.setItem('notifications-threshold-settings', JSON.stringify(remoteMergedThresholds));
  localStorage.setItem('notification-alarm-level-configs', JSON.stringify(remoteMergedAlarmLevels));
  ```
  
  ##### ERGEBNIS:
  - Kein Flash mehr bei Page-Refresh
  - localStorage ist IMMER synchron mit den aktuellsten Server-Daten
  - Konsistente Anzeige auf allen Geräten

  ---
  
  #### SPOT UND FUTURES PAIRS:
  Beide Fixes funktionieren IDENTISCH für:
  - **Spot Pairs:** z.B. "BTC_USDT", "ETH_USDT"
  - **Futures Pairs:** z.B. "BTC_USDT_SWAP", "ETH_USDT_SWAP"
  
  Das Backend behandelt beide Pair-Typen gleich. Die Unterschiede (Preis-APIs, Symbol-Format) sind nur auf der Preis-Anzeige-Ebene relevant, nicht für den Sync.

  ---
  
  #### VALIDIERUNG (2026-01-27):
  - **20+ Cross-Device Tests:** Tab A erstellt → Tab B löscht → Tab C refresh → alle zeigen konsistente Daten
  - **Langzeit-Test:** 60+ Sekunden kontinuierliches Polling ohne Fehler
  - **User-Bestätigung:** "jz hat es funktioniert" mit Log-Nachweis:
    ```
    [SYNC-MERGE] Thresholds: Remote is newer, taking remote data
    [CROSS-DEVICE-SYNC] Merged thresholds: 1 items
    [CROSS-DEVICE-SYNC] Updated localStorage with merged thresholds
    [CROSS-DEVICE-SYNC] Thresholds skip - already synced
    ```
  - **Architect-Review:** PASS - "The implemented cross-device sync fixes appear stable and achieve the stated objectives"
  #### DIALOG-VERHALTEN (KRITISCH - NIEMALS ÄNDERN):
  - **Kein Auto-Save:** Änderungen werden NUR bei "Speichern" Klick gespeichert
  - **Kein Auto-Close:** Dialog schließt NICHT automatisch bei Wert-Eingabe
  - **X/ESC/Außenklick:** Dialog schließen OHNE Änderungen zu speichern
  - **Draft Cleanup:** Unvollständige Thresholds (ohne Wert oder Richtung) werden automatisch entfernt wenn Dialog geschlossen wird
  - **hasAnyThresholds Check:** Excludiert aktuell bearbeiteten Threshold um Dialog-Auto-Close während Bearbeitung zu verhindern
  #### SYNC-ARCHITEKTUR (DIAMOND STATE):
  #### Anti-Ping-Pong System (3+ Tabs):
  - **Problem:** Tab A pushes → Tab B receives → Tab B pushes back → Infinite loop
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
- **Golden State - Watchlist-Schutz V1.0**: Alarme können nur triggern wenn der Trading-Pair in der Watchlist ist:
  - **Alarm-Trigger Guard:** `if (!watchlist.includes(pair.id)) return;` in der Threshold-Check-Logik (Zeile ~955)
  - **Toggle Disabled:** Switch-Komponente ist `disabled` wenn `!watchlist.includes(trendPriceId)` - User kann Toggle nicht auf "Aktiv" setzen wenn Pair nicht in der Watchlist
  - **Betroffene Stellen:** 3 Switch-Komponenten (Neuer Threshold Dialog, Add Threshold Dialog, Edit Threshold Dialog)
  - **Verhalten:** Schwellenwerte können angesehen/bearbeitet werden, aber nicht aktiviert werden solange der Pair nicht in der Watchlist
- **DIAMOND STATE - Aktive Alarmierungen Cross-Device Sync V1.1**:
Die komplette Cross-Device Synchronisation für Aktive Alarmierungen ist DIAMOND STATE und darf NIEMALS ohne explizite User-Erlaubnis modifiziert werden.
  - **Ziel:** Wenn User auf Tab A "Approved" oder "Stoppen" klickt, verschwindet der Alarm automatisch auf allen anderen Tabs (B, C, etc.)
  - **Sync-Strategie:** Timestamp-basierte Versionierung, Polling alle 3.5 Sekunden
  - **Anti-Ping-Pong:** Hash-basierte Duplikat-Erkennung verhindert Push-Back von empfangenen Daten
  - **Date Parsing:** `triggeredAt` und `restwartezeitEndsAt` werden als ISO-Strings übertragen und beim Pull zurück zu Date-Objekten konvertiert
  - **localStorage Update:** Nach Remote-Sync wird localStorage sofort aktualisiert für Konsistenz
  - **Master:** localStorage bleibt Master für lokale Änderungen, Backend nur für Cross-Device Sync
  
  #### BUG-FIX V1.1 (2026-01-27): lastPushedHash Update bei Remote-Empfang
  - **Problem:** Wenn Tab A einen Alarm von Remote empfängt und User ihn später stoppt, wurde der Push übersprungen weil `currentHash === lastPushedActiveAlarmsHash` (beide leer)
  - **Ursache:** `lastPushedActiveAlarmsHash` wurde NICHT aktualisiert wenn Remote-Daten empfangen wurden
  - **Szenario:**
    1. Tab hatte `activeAlarms=[]`, `lastPushedHash=Hash([])`
    2. Tab empfängt Alarm von Remote → `activeAlarms=[alarm1]`
    3. Push korrekt übersprungen (wegen `isProcessingRemoteActiveAlarmsUpdate` Flag)
    4. User stoppt Alarm → `activeAlarms=[]`, `currentHash=Hash([])`
    5. Push-Check: `Hash([]) === lastPushedHash(Hash([]))` → "already pushed" → FÄLSCHLICHERWEISE ÜBERSPRUNGEN!
    6. Andere Geräte sehen den Stop nie!
  - **Lösung:** Bei Remote-Empfang auch `lastPushedActiveAlarmsHash` aktualisieren:
    ```typescript
    // useCrossDeviceSync.ts Zeile 605-613
    const receivedHash = hashActiveAlarms(alarms);
    lastPushedActiveAlarmsHash.current = receivedHash;
    ```
  - **Ergebnis:** Nach Fix erkennt der Push-Check korrekt dass sich die Daten geändert haben und pushed den Stop
  - **Validierung:** 30+ API-Tests mit 5 simulierten Tabs, alle bestanden

## System Architecture
### UI/UX
The frontend is built with React, TypeScript, `shadcn/ui`, and Tailwind CSS, utilizing Recharts for interactive data visualization. It supports PWA features, a dynamic dashboard, and a Notifications page with a live watchlist and customizable price alerts across four alarm levels.

### Technical Implementations
The frontend uses React and TypeScript, while the backend is Express.js and TypeScript. State management uses TypeScript-typed `useMemo` hooks, with data persisted in `localStorage`. The notification system provides configurable thresholds, multi-channel delivery (email, SMS, push), and an alarm approval system with auto-dismiss and repetition logic. Active alarms are synchronized across devices via a backend API and PostgreSQL using a 3.5-second polling mechanism. OneSignal is integrated for push notifications. A 5-tier fallback price system ensures robust cryptocurrency price data, supported by server-side background updates and a frontend backup system with exponential backoff and a watchdog.

### Feature Specifications
Key features include interactive charts with zoom and pan, AI-driven analytical insights via OpenAI, contextual info-tooltips, and a comprehensive notification system. This system incorporates a real-time price tracking watchlist, customizable price alerts with German number formatting, Web Push, Native Push (PWA for iOS/Android), SMS Notifications, an Alarm Approval System with auto-dismiss and repetition, Cross-Device Alarm Synchronization, and re-trigger prevention for "Wiederholend" thresholds using `activeAlarmId`.

### System Design Choices
The architecture is modular for maintainability and scalability. Stable ID handling, particularly symbol-based lookup for futures pairs, ensures data consistency. The `server/db.ts` dynamically switches between Neon Serverless and local PostgreSQL using Drizzle ORM. OneSignal is configured for multiple production domains.

## External Dependencies
- **Database**: Neon Serverless, PostgreSQL.
- **Backend Framework**: Express.js.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Cryptocurrency Data**: OKX API, CoinGecko.
- **Web Push Notifications**: OneSignal Web Push SDK.
- **SMS Notifications**: Twilio.