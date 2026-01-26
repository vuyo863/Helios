# Cross-Device Synchronisation - Technische Dokumentation

**Erstellt:** 26. Januar 2026, 17:40 Uhr UTC
**Letzte Aktualisierung:** 26. Januar 2026, 17:40 Uhr UTC
**Version:** 1.0

---

## WICHTIGER HINWEIS

### Sync ist SEPARAT von der Hauptseite

Die Cross-Device Synchronisation ist eine **eigenständige, separate Schicht** die ÜBER der bestehenden Notifications-Seite liegt. 

**KEINE Änderungen an der Kern-Funktionalität:**
- Die Hauptseite (Notifications) bleibt unverändert
- Alle Golden State / Diamond State Regeln bleiben intakt
- Nur die Sync-Methoden werden angepasst/überarbeitet
- Die Sync-Logik ist in separaten Dateien isoliert

**Betroffene Bereiche (nur Sync):**
1. `client/src/hooks/useCrossDeviceSync.ts` - Der Sync-Hook
2. `client/src/lib/sync.ts` - Sync-Hilfsfunktionen
3. `server/routes.ts` - Backend Sync-API Routen (nur die `/api/sync/*` Routen)

**NICHT betroffene Bereiche (Golden State geschützt):**
- Trendpreise & Watchlist UI/Logik
- Benachrichtigungen konfigurieren UI/Logik
- Aktive Alarmierungen UI/Logik
- Alarmierungsstufen konfigurieren UI/Logik
- Threshold-Dialog-System
- Speichern-Button-Verhalten

---

## Inhaltsverzeichnis

1. [Systemübersicht](#1-systemübersicht)
2. [Architektur](#2-architektur)
3. [Datenfluss](#3-datenfluss)
4. [Sync-Hook Details](#4-sync-hook-details)
5. [Backend API Routen](#5-backend-api-routen)
6. [Blocking-Mechanismen](#6-blocking-mechanismen)
7. [Bekannte Probleme](#7-bekannte-probleme)
8. [Debugging-Anleitung](#8-debugging-anleitung)

---

## 1. Systemübersicht

### 1.1 Zweck
Das Cross-Device Sync System ermöglicht die Synchronisation von Benutzereinstellungen zwischen mehreren Geräten/Tabs:

- **Watchlist:** Welche Trading-Pairs beobachtet werden
- **Thresholds:** Konfigurierte Schwellenwerte für Benachrichtigungen
- **Alarm Levels:** Einstellungen der 4 Alarmstufen
- **Active Alarms:** Aktive/laufende Alarme

### 1.2 Was wird NICHT synchronisiert
- Aktuelle Preise (werden vom Backend gepullt)
- UI-State (z.B. offene Dialoge)
- Session-spezifische Daten

### 1.3 Sync-Intervall
- Polling alle **3.5 Sekunden**
- Push bei lokalen Änderungen (nach 500ms Debounce)

---

## 2. Architektur

### 2.1 Komponenten

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  notifications.tsx                        │   │
│  │  (Golden State - NICHT ÄNDERN)                           │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │           useCrossDeviceSync Hook               │    │   │
│  │  │           (SEPARATE SCHICHT)                    │    │   │
│  │  │                                                 │    │   │
│  │  │  • Initial Sync beim Mount                      │    │   │
│  │  │  • Polling alle 3.5s                            │    │   │
│  │  │  • Push bei lokalen Änderungen                  │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    sync.ts                               │   │
│  │  (Hilfsfunktionen für Push/Pull/Merge)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼ HTTP Requests
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    routes.ts                             │   │
│  │  /api/sync/watchlist     (GET/POST/DELETE)              │   │
│  │  /api/sync/thresholds    (GET/POST/DELETE)              │   │
│  │  /api/sync/alarm-levels  (GET/POST/DELETE)              │   │
│  │  /api/sync/active-alarms (GET/POST/DELETE)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              In-Memory Storage (MemStorage)              │   │
│  │  ACHTUNG: Daten gehen bei Server-Restart verloren!      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Dateien

| Datei | Zweck | Änderbar? |
|-------|-------|-----------|
| `client/src/hooks/useCrossDeviceSync.ts` | Haupt-Sync-Hook | JA (Sync-Logik) |
| `client/src/lib/sync.ts` | Push/Pull/Merge Funktionen | JA (Sync-Logik) |
| `server/routes.ts` | Backend API (nur /api/sync/* Routen) | JA (nur Sync-Routen) |
| `client/src/pages/notifications.tsx` | Notifications UI | NEIN (Golden State) |

---

## 3. Datenfluss

### 3.1 Initial Sync (beim Laden der Seite)

**Zeitpunkt:** 26.01.2026, beim Mount der Notifications-Seite

```
1. Hook wird initialisiert
2. performInitialSync() wird aufgerufen
3. Für jeden Datentyp:
   a. Pull vom Backend (GET /api/sync/*)
   b. Wenn Remote-Daten existieren:
      - Merge mit lokalen Daten
      - Neuere Timestamp gewinnt
   c. Wenn keine Remote-Daten:
      - Lokale Daten behalten
4. initialSyncComplete.current = true
5. Ab jetzt: Pushes sind erlaubt
```

### 3.2 Push (lokale Änderungen → Backend)

**Zeitpunkt:** Nach Klick auf "Speichern" Button

```
1. User ändert Daten (z.B. neuer Threshold)
2. User klickt "Speichern"
3. setTrendPriceSettings() wird aufgerufen
4. useEffect triggert (weil trendPriceSettings sich geändert hat)
5. 500ms Timeout startet (Debounce)
6. pushAllToBackend() wird aufgerufen
7. Blocking-Checks (siehe Abschnitt 6)
8. Wenn alle Checks OK:
   - Hash berechnen
   - Prüfen ob Daten neu sind
   - POST /api/sync/thresholds
   - Hash speichern (lastPushedThresholdsHash)
```

### 3.3 Poll (Backend → andere Tabs)

**Zeitpunkt:** Alle 3.5 Sekunden

```
1. performSync() wird aufgerufen (im Interval)
2. Für jeden Datentyp:
   a. Pull vom Backend (GET /api/sync/*)
   b. Vergleiche Timestamp mit lastKnownRemoteTimestamp
   c. Wenn Remote neuer:
      - isProcessingRemoteUpdate.current = true
      - Merge Daten
      - Update State
      - Update Hash (lastReceivedHash)
      - isProcessingRemoteUpdate.current = false
```

---

## 4. Sync-Hook Details

### 4.1 Datei: `client/src/hooks/useCrossDeviceSync.ts`

**Erstellt:** 25.01.2026
**Zeilen:** 521

### 4.2 Props Interface

```typescript
interface UseCrossDeviceSyncProps {
  watchlist: string[];
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures'; symbol: string }>;
  trendPriceSettings: Record<string, { trendPriceId: string; thresholds: any[] }>;
  alarmLevelConfigs: Record<string, AlarmLevelConfig>;
  activeAlarms: ActiveAlarm[];
  setWatchlist: (fn: (prev: string[]) => string[]) => void;
  setPairMarketTypes: (fn: (prev: ...) => ...) => void;
  setTrendPriceSettings: (fn: (prev: ...) => ...) => void;
  setAlarmLevelConfigs: (configs: ...) => void;
  setActiveAlarms: (fn: (prev: ...) => ...) => void;
  editingThresholdId?: string | null;  // KRITISCH für Golden State
}
```

### 4.3 Wichtige Refs

| Ref | Zweck | Zeile |
|-----|-------|-------|
| `isInitialMount` | Verhindert Push beim ersten Render | 84 |
| `initialSyncComplete` | Blockiert Pushes bis Initial Sync fertig | 87 |
| `isProcessingRemoteUpdate` | Verhindert Push während Remote-Update | 91 |
| `lastPushedWatchlistHash` | Verhindert doppelte Pushes | 95 |
| `lastPushedThresholdsHash` | Verhindert doppelte Pushes | 96 |
| `lastPushedAlarmLevelsHash` | Verhindert doppelte Pushes | 97 |
| `lastPushedActiveAlarmsHash` | Verhindert doppelte Pushes | 98 |
| `lastReceivedWatchlistHash` | Erkennt Remote-Daten | 101 |
| `lastReceivedThresholdsHash` | Erkennt Remote-Daten | 102 |
| `lastReceivedAlarmLevelsHash` | Erkennt Remote-Daten | 103 |
| `lastReceivedActiveAlarmsHash` | Erkennt Remote-Daten | 104 |
| `lastKnownRemoteWatchlistTimestamp` | Timestamp-Vergleich | 107 |
| `lastKnownRemoteThresholdsTimestamp` | Timestamp-Vergleich | 108 |
| `lastKnownRemoteAlarmLevelsTimestamp` | Timestamp-Vergleich | 109 |
| `lastKnownRemoteActiveAlarmsTimestamp` | Timestamp-Vergleich | 110 |
| `editingThresholdIdRef` | GOLDEN STATE: Blockiert Push während Bearbeitung | 121 |

### 4.4 Konstanten

| Konstante | Wert | Zweck |
|-----------|------|-------|
| `PUSH_DEBOUNCE_MS` | 1000ms | Verhindert schnelle aufeinanderfolgende Pushes |
| Polling-Intervall | 3500ms | Sync alle 3.5 Sekunden |
| Push-Timeout | 500ms | Verzögerung nach State-Änderung |

---

## 5. Backend API Routen

### 5.1 Übersicht

**Datei:** `server/routes.ts`
**Prefix:** `/api/sync/`

| Route | Methode | Zweck |
|-------|---------|-------|
| `/api/sync/watchlist` | GET | Watchlist abrufen |
| `/api/sync/watchlist` | POST | Watchlist speichern |
| `/api/sync/watchlist` | DELETE | Watchlist löschen |
| `/api/sync/thresholds` | GET | Thresholds abrufen |
| `/api/sync/thresholds` | POST | Thresholds speichern |
| `/api/sync/thresholds` | DELETE | Thresholds löschen |
| `/api/sync/alarm-levels` | GET | Alarm Levels abrufen |
| `/api/sync/alarm-levels` | POST | Alarm Levels speichern |
| `/api/sync/alarm-levels` | DELETE | Alarm Levels löschen |
| `/api/sync/active-alarms` | GET | Active Alarms abrufen |
| `/api/sync/active-alarms` | POST | Active Alarms speichern |
| `/api/sync/active-alarms` | DELETE | Active Alarms löschen |

### 5.2 Response Format

**GET Response (Erfolg):**
```json
{
  "watchlist": ["BTCUSDT", "ETHUSDT"],
  "pairMarketTypes": { ... },
  "timestamp": 1737913200000,
  "deviceId": "device-abc123"
}
```

**GET Response (Keine Daten):**
```json
{
  "error": "No watchlist data"
}
```
**HTTP Status:** 404

### 5.3 Speicherung

**ACHTUNG:** Das Backend verwendet **In-Memory Storage** (MemStorage).

```
┌─────────────────────────────────────────────┐
│            KRITISCHES PROBLEM               │
│                                             │
│  Server-Restart = ALLE SYNC-DATEN VERLOREN  │
│                                             │
│  Lösung: Tab refreshen nach Server-Restart  │
│  → Sync-Hook pushed localStorage zum Backend│
└─────────────────────────────────────────────┘
```

---

## 6. Blocking-Mechanismen

### 6.1 Übersicht der Blocking-Checks

Die `pushAllToBackend()` Funktion hat mehrere Sicherheits-Checks:

```
pushAllToBackend() aufgerufen
        │
        ▼
┌───────────────────────────────────────┐
│ Check 1: initialSyncComplete.current  │
│ Zeile 232                             │
│ Wenn FALSE → BLOCKIERT                │
│ "Skipping push - initial sync not     │
│  complete"                            │
└───────────────────────────────────────┘
        │ OK
        ▼
┌───────────────────────────────────────┐
│ Check 2: isProcessingRemoteUpdate     │
│ Zeile 239                             │
│ Wenn TRUE → BLOCKIERT                 │
│ "Skipping push - processing remote    │
│  update"                              │
└───────────────────────────────────────┘
        │ OK
        ▼
┌───────────────────────────────────────┐
│ Check 3: editingThresholdIdRef        │
│ Zeile 281 (nur für Thresholds)        │
│ Wenn NOT NULL → Thresholds BLOCKIERT  │
│ "Thresholds skip - user is editing"   │
└───────────────────────────────────────┘
        │ OK
        ▼
┌───────────────────────────────────────┐
│ Check 4: isThresholdsFromRemote       │
│ Zeile 285                             │
│ Wenn TRUE → Thresholds BLOCKIERT      │
│ (Verhindert Push von gerade           │
│  empfangenen Remote-Daten)            │
└───────────────────────────────────────┘
        │ OK
        ▼
┌───────────────────────────────────────┐
│ Check 5: thresholdsAlreadyPushed      │
│ Zeile 286                             │
│ Wenn TRUE → Thresholds BLOCKIERT      │
│ (Verhindert doppelte Pushes)          │
└───────────────────────────────────────┘
        │ OK
        ▼
    PUSH ERLAUBT
```

### 6.2 Golden State: editingThresholdId

**KRITISCH für Diamond State Compliance:**

Der `editingThresholdId` Parameter wird von notifications.tsx übergeben:
- Wenn ein User einen Threshold bearbeitet: `editingThresholdId = "threshold-123"`
- Wenn kein Dialog offen: `editingThresholdId = null`

**Verhalten:**
1. User öffnet Threshold-Dialog
2. `editingThresholdId` wird auf die Threshold-ID gesetzt
3. Sync-Hook BLOCKIERT Threshold-Pushes
4. User kann Werte eingeben OHNE dass sie synchronisiert werden
5. User klickt "Speichern"
6. Dialog schließt, `editingThresholdId = null`
7. Sync-Hook ERLAUBT Threshold-Push
8. Daten werden zum Backend gepushed

**Warum das wichtig ist:**
- Verhindert Auto-Save bei Wertänderungen
- Explizites "Speichern" ist PFLICHT (Golden State Regel)
- Andere Geräte sehen nur bestätigte Änderungen

---

## 7. Bekannte Probleme

### 7.1 Server-Restart Problem

**Status:** 26.01.2026, 17:40 Uhr - BEKANNT

**Problem:**
- Backend verwendet In-Memory Storage
- Server-Restart löscht alle Sync-Daten
- localStorage auf Clients bleibt erhalten
- → Desync zwischen Clients und Backend

**Symptome:**
- GET /api/sync/* gibt 404 zurück
- Thresholds erscheinen nur auf einem Gerät
- Cross-Device Sync funktioniert nicht

**Workaround:**
1. Tab mit den Daten refreshen
2. Sync-Hook macht Initial Sync
3. Daten werden zum Backend gepushed
4. Andere Tabs können jetzt synchronisieren

### 7.2 Kleine Bugs in Trendpreise & Watchlist

**Status:** 26.01.2026, 17:40 Uhr - BEKANNT

**Hinweis:** Es wurden 1-2 kleine Bugs identifiziert. Möglicherweise wird ein Rollback durchgeführt.

### 7.3 Fehlende Console Logs

**Problem:** `[CROSS-DEVICE-SYNC]` Logs erscheinen nicht in Browser Console

**Mögliche Ursachen:**
1. Notifications-Seite nicht geöffnet
2. Hook nicht initialisiert
3. Server-Restart während Hook lief

---

## 8. Debugging-Anleitung

### 8.1 Browser Console Logs prüfen

Erwartete Logs beim Laden der Notifications-Seite:

```
[CROSS-DEVICE-SYNC] Initial sync starting...
[CROSS-DEVICE-SYNC] Merged watchlist: [...]
[CROSS-DEVICE-SYNC] Merged thresholds: [...]
[CROSS-DEVICE-SYNC] Initial sync complete
[CROSS-DEVICE-SYNC] Setting up polling interval...
```

Erwartete Logs beim Polling:

```
[CROSS-DEVICE-SYNC] Polling sync...
[CROSS-DEVICE-SYNC] Watchlist skip - already synced
[CROSS-DEVICE-SYNC] Thresholds skip - already synced
```

Erwartete Logs beim Push:

```
[CROSS-DEVICE-SYNC] Pushing data to backend...
[CROSS-DEVICE-SYNC] Thresholds pushed
[CROSS-DEVICE-SYNC] Push complete
```

### 8.2 Server Logs prüfen

Erwartete Logs bei Sync-Requests:

```
[express] GET /api/sync/watchlist 200 in Xms
[express] GET /api/sync/thresholds 200 in Xms
[express] POST /api/sync/thresholds 200 in Xms
```

Wenn 404:
```
[express] GET /api/sync/watchlist 404 in Xms :: {"error":"No watchlist data"}
```

### 8.3 Debugging-Schritte

1. **Prüfen ob Hook läuft:**
   - Browser Console öffnen
   - Nach `[CROSS-DEVICE-SYNC]` filtern
   - Wenn keine Logs: Seite refreshen

2. **Prüfen ob Backend Daten hat:**
   - Server-Logs prüfen
   - Wenn 404: Tab refreshen → Push triggern

3. **Prüfen ob Push blockiert wird:**
   - Nach "skip" oder "Skipping" in Logs suchen
   - Blockierungsgrund identifizieren

---

## Änderungshistorie

| Datum | Uhrzeit | Änderung |
|-------|---------|----------|
| 25.01.2026 | - | useCrossDeviceSync.ts erstellt |
| 26.01.2026 | 17:40 UTC | Diese Dokumentation erstellt |

---

## Zusammenfassung

### Das Sync-System ist SEPARAT

```
┌─────────────────────────────────────────────────┐
│              NOTIFICATIONS PAGE                  │
│         (Golden State - UNVERÄNDERT)            │
│                                                 │
│  • Trendpreise & Watchlist                      │
│  • Benachrichtigungen konfigurieren             │
│  • Aktive Alarmierungen                         │
│  • Alarmierungsstufen konfigurieren             │
│                                                 │
└─────────────────────────────────────────────────┘
                      │
                      │ Verwendet (als separate Schicht)
                      ▼
┌─────────────────────────────────────────────────┐
│           CROSS-DEVICE SYNC LAYER               │
│              (Kann überarbeitet werden)          │
│                                                 │
│  • useCrossDeviceSync.ts                        │
│  • sync.ts                                      │
│  • /api/sync/* Routen                           │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Die Hauptseite wird NICHT geändert. Nur die Sync-Methoden werden überarbeitet.**
