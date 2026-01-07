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

## iOS/Android Native Push Notifications (PWA)

### Status: ✅ FUNKTIONIERT - Erfolgreich getestet am 07.01.2026

Native Push Notifications funktionieren auf iOS (iPhone, iPad) und Android via PWA (Progressive Web App) Ansatz.

---

### Wie es funktioniert

**Voraussetzungen für den User:**
1. App auf `helios-ai.replit.app` öffnen (Safari auf iOS, Chrome auf Android)
2. PWA zum Home-Screen hinzufügen ("Zum Home-Bildschirm")
3. Push-Benachrichtigungen erlauben wenn gefragt
4. iOS 16.4+ erforderlich

**Technischer Ablauf:**
1. User klickt "NATIVE PUSH ALARM" Button auf der Notifications-Seite
2. Frontend sendet POST Request an `/api/test-native-push`
3. Backend sendet Notification via OneSignal API an alle Subscriber
4. OneSignal liefert die Nachricht an alle PWA-installierten Geräte

---

### Implementierung (07.01.2026)

**Backend-Route:** `/api/test-native-push` (server/routes.ts)
- Komplett separater Code vom bestehenden Web Push (Golden State Doctrine)
- Sendet Broadcast an alle Subscriber via `included_segments: ['All']`
- iOS/Android Flags aktiviert: `isIos: true`, `isAndroid: true`, `isAnyWeb: true`
- Logs enthalten keine sensiblen Daten (Security Fix)

**PWA-Infrastruktur:**
- `client/public/manifest.json` - PWA Manifest mit iOS-Einstellungen
- `client/public/icon-192.png` und `icon-512.png` - App Icons
- `client/index.html` - Apple Meta-Tags für PWA-Support

**Frontend:** `client/src/pages/notifications.tsx`
- `triggerNativePushAlarm()` Funktion mit Error Handling
- Optimistic UI Update mit Rollback bei Fehlern
- Separater "NATIVE PUSH ALARM" Button

---

### Getestete Geräte

| Gerät | Status | Datum |
|-------|--------|-------|
| iPhone | ✅ Funktioniert | 07.01.2026 |
| iPad | ✅ Funktioniert | 07.01.2026 |

---

### API Response Beispiel

```json
{
  "success": true,
  "testId": 1767749177415,
  "notificationId": "bcc672ba-7d67-499a-a8ed-100a0818937d",
  "recipients": 0,
  "message": "Native Push notification sent successfully"
}
```

**Hinweis:** `recipients: 0` bedeutet, dass zum Zeitpunkt des Tests noch keine PWA-Subscriber registriert waren. Nach der PWA-Installation auf iPhone/iPad werden Nachrichten korrekt zugestellt.

---

### Relevante Dateien

- `server/routes.ts` - Backend Native Push Route (Zeile ~2501-2613)
- `client/src/pages/notifications.tsx` - Frontend Native Push Funktion
- `client/public/manifest.json` - PWA Manifest
- `client/index.html` - Apple Meta-Tags
- `client/public/icon-192.png` / `icon-512.png` - PWA Icons

---

### OneSignal Technische Limitierung (Wichtig!)

**Problem:** OneSignal behandelt iOS Safari PWA und Desktop Chrome identisch (`device_type = 5`). Es gibt **keine native Möglichkeit** sie zu unterscheiden.

**Konsequenz:**
- Web Push und Native Push Toggles sind beide aktiv, aber nutzen dasselbe OneSignal-System
- Wenn **einer** der beiden Toggles AN ist → Nachricht wird an ALLE Subscriber gesendet (Desktop + Mobile PWA)
- Die Trennung ist nur auf Toggle-Ebene - nicht auf Empfänger-Ebene

**Aktuelle Lösung (07.01.2026):**
- Frontend prüft: `webPush || nativePush` → sendet nur EINE Nachricht
- Verhindert Duplikate wenn beide Toggles AN sind
- Nutzt `/api/notifications/web-push` Route für alle Push-Nachrichten

**Zukünftige Verbesserung (nicht implementiert):**
- OneSignal Tags nutzen: beim PWA-Subscribe einen Tag `platform: ios-pwa` setzen
- Dann Filter nach Tags für echte Kanaltrennung

---

### Web Push und Native Push Unified (07.01.2026)

Die beiden Kanäle sind jetzt vereint um Duplikate zu vermeiden:
- **Wenn Web Push AN + Native Push AUS** → Nachricht wird gesendet
- **Wenn Web Push AUS + Native Push AN** → Nachricht wird gesendet  
- **Wenn beide AN** → nur EINE Nachricht wird gesendet
- **Wenn beide AUS** → keine Nachricht

Die Toggles geben dem User Kontrolle, ob er Push-Benachrichtigungen will - aber aufgrund der OneSignal-Limitierung erreichen sie immer alle Subscriber (Desktop + Mobile).