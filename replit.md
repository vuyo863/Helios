# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project aims to provide users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features, to empower better trading decisions. It also includes a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts. The business vision is to provide a comprehensive tool for cryptocurrency traders using Pionex bots, offering market potential through enhanced analytical capabilities and timely notifications.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife
- **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are protected from modification to ensure stability. These protected areas (Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Added-Mode Overlay, Bot-Type CRUD, AI-Analysis Page, Info-Tooltips, and specific Notifications page components) must **NEVER** be altered unless explicitly instructed by the user.
- **Golden State - Notifications Page V1**: The following three sections on the Notifications page are Golden State and must NEVER be modified without explicit user permission:
  1. **Trendpreise & Watchlist**: Search, Spot/Futures toggle, watchlist display with prices
  2. **Benachrichtigungen konfigurieren**: Threshold dialog system, dialog behavior (no auto-close, no auto-save on X/ESC), explicit "Speichern" requirement, cleanup of unsaved thresholds, draft exclusion from alerts
  3. **Aktive Alarmierungen**: Dynamic border color based on highest danger level, red blinking animation for "Sehr Gefährlich", sorting dropdown (Dringlichkeit default), scroll container with fixed height
- **Workflow**: For the Notifications page, adding or editing a threshold, or changing its alarm level, requires an explicit "Speichern" (Save) button click; there is no auto-save for these actions. Dialog cleanup is automatic: when a "new threshold" dialog is closed (via X, ESC, or outside click) without saving, any incomplete threshold (missing value or notification type) is automatically removed from state. The `hasAnyThresholds` check excludes the currently editing threshold to prevent dialog auto-close during editing.

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive interface. Recharts is used for dynamic data visualization, and Wouter for client-side routing. The dashboard offers three primary chart modes: MainChart (single bot type), Compare Mode (multiple bot types), and Added Mode (aggregated data with Analysis and Overlay features). Interactive features include a marker system (U1, C1), eye and pencil modes, zoom/pan, and Info-Tooltips. The Notifications page includes a watchlist with live price updates from Binance API, a threshold system with four alarm levels, and active alerts display. Web Push Notifications are integrated via OneSignal for real-time alerts.

### Technical Implementations
- **State Management**: TypeScript-typed state for chart modes, bot types, and interactions.
- **Data Handling**: `useMemo` hooks optimize data preparation.
- **Bot Type Management**: CRUD operations, CSV/Excel upload, and update history.
- **Eye Mode**: Extended overlay view with Period Comparison Cards and aggregated metrics.
- **Pencil Mode**: Single-period selection for detailed analysis with bar charts.
- **Notifications Data Persistence**: Watchlist and pair market types are persisted in `localStorage`. Futures pair identification uses a robust symbol-based fallback.
- **OneSignal Integration**: Configured for web push notifications, initialized only on the production URL, player ID stored and used for targeted delivery.
- **Backend Service Worker Route**: Express.js serves `OneSignalSDKWorker.js` with correct headers.
- **Backend Notification Route**: Handles web push requests, targeting specific players or all subscribed users.

### Feature Specifications
- **Marker System**: Interactive points on charts for event analysis.
- **Zoom & Pan**: Interactive chart navigation.
- **AI-Analysis**: Integration with OpenAI for automated insights.
- **Info-Tooltips**: Explanations for key metrics.
- **Notifications Watchlist**: Real-time price tracking from Binance.
- **Threshold System**: Configurable price alerts with priority levels.
- **German Formatting**: Prices and thresholds displayed in German number format.
- **Web Push Notifications**: Real-time alerts via OneSignal when browser is minimized, on another tab, or device is locked.

### System Design Choices
- **Modular Architecture**: Clear separation of concerns.
- **Stable ID Handling**: Symbol-based lookup for futures pairs in Notifications.
- **OneSignal Configuration**: Specific App ID, Site URL, and REST API Key for secure and targeted notifications.
- **Targeted Notifications**: Utilizes `include_player_ids` for direct delivery to specific users.

## External Dependencies
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
- **Backend Framework**: Express.js with TypeScript.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Storage**: In-memory `MemStorage` for server-side data handling.
- **Crypto Data**: Binance API (Spot and Futures market data).
- **Web Push Notifications**: OneSignal Web Push SDK v16.

---

## OneSignal Web Push Notifications - Debugging Report

### Status: ⚠️ UNGELÖST - Benachrichtigungen werden nicht zugestellt

Die OneSignal Web Push Integration funktioniert technisch (API-Calls erfolgreich), aber Benachrichtigungen werden nicht an den Browser zugestellt. Die Glocke (Toggle für Push-Benachrichtigungen) funktioniert hingegen korrekt.

---

### Was funktioniert ✅

1. **OneSignal SDK Initialisierung**
   - SDK v16.0.5.10 wird korrekt geladen
   - Nur auf Production-URL `helios-ai.replit.app` initialisiert (Domain-Gating)
   - Player ID wird erfolgreich gespeichert: `b24a27c3-b1cd-4da3-b017-328cee52079b`

2. **Subscription Status bei OneSignal**
   - API-Check bestätigt: `invalid_identifier: false` (GÜLTIG)
   - WNS Token vorhanden (Windows Notification Service)
   - device_type: 5 (Chrome/Edge Web Push)
   - last_active: kürzlich aktiv
   - sdk: "160510"

3. **Bell-Toggle (Glocke) Notifications**
   - Funktioniert korrekt
   - Verwendet `included_segments: ['All']` (Broadcast)
   - Benachrichtigungen werden erfolgreich zugestellt

4. **OneSignal API Responses**
   - API gibt `success: true` zurück
   - Notification ID wird generiert
   - Keine API-Fehler

5. **Service Worker**
   - `OneSignalSDKWorker.js` wird korrekt served
   - Headers: `application/javascript`, `Service-Worker-Allowed: /`

---

### Was NICHT funktioniert ❌

1. **Test-Alarm Web Push**
   - Wird an OneSignal gesendet (API erfolgreich)
   - Aber Benachrichtigung erscheint NICHT im Browser
   - `recipients: -1` oder `recipients: 0` in API Response

2. **Automatische Threshold-Alarme**
   - Gleches Problem wie Test-Alarm
   - API-Call erfolgreich, aber keine Zustellung

---

### Durchgeführte Debugging-Schritte (Replit Agent Session)

#### 1. Subscription ID Prüfung
- Debug-Endpoint erstellt: `/api/check-subscription/:subscriptionId`
- Ergebnis: Subscription ist GÜLTIG bei OneSignal
```json
{
  "id": "b24a27c3-b1cd-4da3-b017-328cee52079b",
  "invalid_identifier": false,
  "device_type": 5,
  "identifier": "https://wns2-am3p.notify.windows.com/..."
}
```

#### 2. API Payload Korrektur
- Geändert von `include_player_ids` zu `include_subscription_ids` (neue OneSignal API)
- Ergebnis: Kein Unterschied

#### 3. Absolute URL für Notification
- Geändert von `/notifications` zu `https://helios-ai.replit.app/notifications`
- Ergebnis: Kein Unterschied

#### 4. Broadcast statt Single-User Targeting
- Entfernt: `playerId` Parameter und `include_subscription_ids`
- Hinzugefügt: `included_segments: ['All']` (wie die Glocke)
- Frontend: 3 Stellen angepasst - kein `playerId` mehr gesendet
- Ergebnis: Kein Unterschied - immer noch keine Zustellung

#### 5. REST API Key Prüfung
- Bestätigt: "Webpushkey" wird verwendet
- Authorization Header: `Basic ${ONESIGNAL_REST_API_KEY}`

#### 6. Windows Einstellungen geprüft
- Fokus-Assistent/Nicht stören: Deaktiviert
- Edge Benachrichtigungen: Aktiviert
- Andere Benachrichtigungen funktionieren (z.B. Kontostand)

---

### Technische Details

**Backend Route (server/routes.ts):**
```typescript
// Aktueller Stand - Broadcast an alle Subscriber
const notificationPayload = {
  app_id: ONESIGNAL_APP_ID,
  headings: { en: title },
  contents: { en: message },
  data: { alarmLevel, timestamp: new Date().toISOString() },
  chrome_web_icon: 'https://cdn-icons-png.flaticon.com/512/2645/2645890.png',
  url: 'https://helios-ai.replit.app/notifications',
  included_segments: ['All']
};
```

**Frontend (notifications.tsx):**
- Alle 3 Web Push Stellen senden jetzt OHNE `playerId`
- Test-Alarm, Threshold-Increase, Threshold-Decrease

**OneSignal Konfiguration:**
- App ID: Konfiguriert in Environment Variables
- REST API Key: "Webpushkey" 
- Site URL: https://helios-ai.replit.app
- SDK Version: v16.0.5.10

---

### Unterschied: Glocke vs. Test-Alarm

| Aspekt | Glocke (funktioniert) | Test-Alarm (funktioniert nicht) |
|--------|----------------------|--------------------------------|
| Trigger | User klickt Toggle | Automatisch/Manuell |
| API Payload | `included_segments: ['All']` | `included_segments: ['All']` (jetzt gleich) |
| Ergebnis | Benachrichtigung erscheint | Keine Benachrichtigung |

**Vermutung:** Der Unterschied liegt möglicherweise in der Art wie OneSignal die Benachrichtigung intern verarbeitet, nicht im API-Call selbst.

---

### Noch nicht getestete Ansätze

1. **OneSignal Dashboard prüfen** - Notification History auf onesignal.com
2. **Neuen Browser/Gerät testen** - Frische Subscription erstellen
3. **OneSignal Support kontaktieren** - Mit Debug-Logs
4. **Alternative Push-Dienste** - Firebase Cloud Messaging als Alternative
5. **Webhook/Event Tracking** - OneSignal Webhooks für Delivery-Status

---

### Relevante Dateien

- `server/routes.ts` - Backend Web Push Route (Zeilen ~2383-2476)
- `client/src/App.tsx` - OneSignal SDK Initialisierung
- `client/src/pages/notifications.tsx` - Frontend Web Push Calls
- `client/public/OneSignalSDKWorker.js` - Service Worker

---

### Letzte Änderung

**Datum:** 06.01.2026
**Änderung:** Umstellung von Single-User-Targeting auf Broadcast (`included_segments: ['All']`)
**Ergebnis:** Keine Verbesserung - Problem besteht weiterhin