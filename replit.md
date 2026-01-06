# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project aims to provide users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features, to empower better trading decisions. It also includes a Notifications page for monitoring cryptocurrency prices from Binance Spot and Futures markets with custom threshold alerts.

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
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive interface. Recharts is used for dynamic data visualization, and Wouter for client-side routing.

The dashboard offers three primary chart modes:
1.  **MainChart**: Displays detailed performance for a single bot type.
2.  **Compare Mode**: Compares the performance of two or more bot types.
3.  **Added Mode**: Aggregates data from multiple bot types, with an "Analysis" sub-toggle and an "Overlay" feature.

Key interactive features include a marker system (U1, C1), eye and pencil modes for detailed interaction, and zoom/pan functionalities. Info-Tooltips provide explanations for key metrics.

The Notifications page features a watchlist with live price updates (every 2 seconds) from Binance API for Spot and Futures pairs, displaying 24h price changes and market type badges. It also includes a threshold system with comma-input support, four alarm levels (harmlos, achtung, gefährlich, sehr_gefährlich), and an `isActive` toggle. Active alerts are displayed in a fixed-height scroll area with a blue border and a red badge in the Navbar.

### Technical Implementations
- **State Management**: TypeScript-typed state manages chart modes, bot types, and interaction.
- **Data Handling**: `useMemo` hooks optimize data preparation.
- **Bot Type Management**: Supports CRUD operations for bot types, including CSV/Excel upload and update history.
- **Eye Mode**: Provides an extended overlay view with Period Comparison Cards and aggregated metrics.
- **Pencil Mode**: Allows single-period selection for detailed analysis, including a bar chart for performance metrics.
- **Notifications Data Persistence**: Watchlist and pair market types are persisted in `localStorage`. Futures pair identification includes a robust symbol-based fallback mechanism to ensure stability across page reloads, with automatic migration for older data formats.

### Feature Specifications
- **Marker System**: Defines interactive points on charts for event analysis.
- **Zoom & Pan**: Interactive chart navigation.
- **AI-Analysis**: Integration with OpenAI for automated insights and data summarization.
- **Info-Tooltips**: Provides explanations for key metrics like "Ø Profit/Tag" and "Real Profit/Tag" in Added Mode.
- **Notifications Watchlist**: Real-time price tracking from Binance for Spot and Futures pairs.
- **Threshold System**: Configurable price alerts with different priority levels and activation states.
- **German Formatting**: Prices and thresholds are displayed in German number format (e.g., 50.000,00).

### System Design Choices
- **Modular Architecture**: Clear separation of concerns between frontend and backend, and within frontend components.
- **Stable ID Handling**: For Notifications, futures pairs use a symbol-based lookup to counteract unstable index-based IDs after reloads, ensuring data integrity.

## External Dependencies
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
- **Backend Framework**: Express.js with TypeScript.
- **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
- **Validation**: Zod.
- **AI Integration**: OpenAI API.
- **Storage**: In-memory `MemStorage` for server-side data handling.
- **Crypto Data**: Binance API (for Spot and Futures market data).

---

## Web Push Notifications - OneSignal Integration (AUSFÜHRLICHER BERICHT)

### Übersicht & Ziel
Web Push Notifications sollen funktionieren, wenn:
- Der Browser minimiert ist
- Der User auf einem anderen Tab ist
- Das Gerät gesperrt ist (Desktop bleibt an)

**Technologie**: OneSignal Web Push SDK v16

### Konfiguration & IDs

#### OneSignal Dashboard
- **App Name**: Helios
- **App ID**: `6f15f4f1-93dc-491f-ba4a-c78354f46858`
- **Site URL**: `https://helios-ai.replit.app` (MUSS exakt übereinstimmen!)
- **REST API Key**: Gespeichert als Secret `ONESIGNAL_REST_API_KEY`

#### Replit Deployment
- **Published URL**: `https://helios-ai.replit.app`
- **Deployment Type**: Autoscale (4 vCPU / 8 GiB RAM / 3 Max)
- **Visibility**: Public

### Architektur & Dateien

#### 1. Service Worker (`client/public/OneSignalSDKWorker.js`)
```javascript
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
```
- **Pfad**: Muss im Root `/` sein
- **Serving**: Express serviert mit korrekten Headers:
  - `Content-Type: application/javascript`
  - `Service-Worker-Allowed: /`
- **Prüfung**: `curl -I https://helios-ai.replit.app/OneSignalSDKWorker.js`

#### 2. Frontend Initialisierung (`client/src/App.tsx`)
```typescript
// WICHTIG: OneSignal nur auf der Produktions-URL initialisieren!
function isOneSignalAllowedDomain(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'helios-ai.replit.app';
}

useEffect(() => {
  if (!isOneSignalAllowedDomain()) {
    console.log('OneSignal: Skipping initialization (only works on helios-ai.replit.app)');
    return;
  }

  OneSignal.init({
    appId: "6f15f4f1-93dc-491f-ba4a-c78354f46858",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: true, ... },
  }).then(() => {
    // Player ID im localStorage speichern für spätere API-Calls
    const playerId = OneSignal.User.PushSubscription.id;
    if (playerId) {
      localStorage.setItem('onesignal-player-id', playerId);
      console.log('OneSignal Player ID stored:', playerId);
    }
    
    // Auf Subscription-Änderungen reagieren
    OneSignal.User.PushSubscription.addEventListener('change', (event) => {
      const newPlayerId = OneSignal.User.PushSubscription.id;
      if (newPlayerId) {
        localStorage.setItem('onesignal-player-id', newPlayerId);
      }
    });
  });
}, []);
```

#### 3. Backend Service Worker Route (`server/index.ts`)
```typescript
// Service Worker mit korrekten Headers servieren
app.get('/OneSignalSDKWorker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(process.cwd(), 'client/public/OneSignalSDKWorker.js'));
});
```

#### 4. Backend Notification Route (`server/routes.ts`)
```typescript
app.post("/api/notifications/web-push", async (req, res) => {
  const { title, message, alarmLevel, playerId } = req.body;
  
  const notificationPayload = {
    app_id: process.env.ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: message },
    data: { alarmLevel, timestamp: new Date().toISOString() },
    url: '/notifications'
  };

  // GELÖST: Wenn playerId vorhanden, direkt an diesen User senden
  if (playerId) {
    notificationPayload.include_player_ids = [playerId];
    console.log(`Targeting specific player: ${playerId}`);
  } else {
    notificationPayload.included_segments = ['All'];
    console.log('Targeting all subscribed users');
  }
  
  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify(notificationPayload),
  });
});
```

#### 5. Alert Service (`server/alertService.ts`)
- Prüft alle 30 Sekunden auf aktive Thresholds
- Sendet Notifications wenn Preisschwellen überschritten werden
- Verwendet `/api/notifications/send` Endpoint

### Aktueller Status (GELÖST ✅)

#### Was funktioniert ✅
1. **Service Worker**: Korrekt registriert und serviert
2. **OneSignal Initialisierung**: Nur auf `helios-ai.replit.app` (Dev-Domains werden übersprungen)
3. **User Subscription**: `opted in: true`
4. **Player ID Speicherung**: Automatisch im `localStorage` unter Key `onesignal-player-id`
5. **Player ID Übertragung**: Frontend sendet Player ID an Backend bei jedem Web Push Request
6. **Backend Targeting**: Verwendet `include_player_ids: [playerId]` für direkte Zustellung
7. **OneSignal Dashboard**: Site URL korrekt konfiguriert

#### Implementation Details

**Flow (GELÖST)**:
```
1. App.tsx: OneSignal.init() nur auf helios-ai.replit.app
2. Nach Initialisierung: Player ID wird in localStorage gespeichert
3. Bei Subscription-Änderungen: Event Listener aktualisiert localStorage
4. notifications.tsx: Holt Player ID aus localStorage vor jedem Web Push Request
5. Backend: Verwendet include_player_ids: [playerId] für direkte Zustellung
```

**Logs (korrekt)**:
```
OneSignal initialized successfully
OneSignal Player ID stored: b24a27c3-b1cd-4da3-b017-328cee52079b
Using player ID for direct targeting: b24a27c3-b1cd-4da3-b017-328cee52079b
Targeting specific player: b24a27c3-b1cd-4da3-b017-328cee52079b  ← KORREKT!
```

### Debug-Checkliste

#### Browser-Seite
1. Console öffnen → `OneSignal initialized successfully` ?
2. Player ID gespeichert? → `OneSignal Player ID stored: xxx`
3. Bei Test Alarm: `Using player ID for direct targeting: xxx`
4. Browser Notifications erlaubt? → Schloss-Symbol in Adressleiste → Notifications → Allow

#### OneSignal Dashboard
1. Settings → Web Configuration → Site URL = `https://helios-ai.replit.app`
2. Audience → All Users → Ist der User gelistet?
3. Delivery → Messages → Wurden Notifications gesendet? Wie viele empfangen?

#### Server-Seite
1. Logs prüfen: `Targeting specific player: xxx` = KORREKT
2. `Targeting all subscribed users` = Fallback (nur wenn keine Player ID)

### Bekannte Einschränkungen

1. **Binance API Geo-Blocking**: Futures API gibt 418/451 in manchen Regionen
2. **Browser Extension Fehler**: `content-all.js` Fehler kommen von Browser Extensions (ignorieren)
3. **sw.ts:20 Warnung**: Kommt von internem Vite/Replit Service Worker, NICHT von unserer App
4. **Dev-Umgebung**: OneSignal funktioniert NUR auf `https://helios-ai.replit.app`

### Relevante Dateien

| Datei | Zweck |
|-------|-------|
| `client/src/App.tsx` | OneSignal Initialisierung, Player ID im localStorage speichern |
| `client/src/pages/notifications.tsx` | Test Alarm Button, Player ID aus localStorage lesen |
| `server/routes.ts` | Web Push Endpoint mit Player ID Support |
| `client/public/OneSignalSDKWorker.js` | Service Worker Datei |

### Zusammenfassung

**Status**: ✅ GELÖST - OneSignal Web Push funktioniert jetzt mit direktem Player ID Targeting. Die Player ID wird automatisch im localStorage gespeichert und bei jedem Web Push Request ans Backend gesendet.