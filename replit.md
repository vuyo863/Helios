# Pionex Bot Profit Tracker

## Overview
Full-stack web application to track and analyze profits from Pionex trading bots. React frontend + Express backend.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife

---

# ⚠️ AKTUELLE ARBEITSPOSITION (WICHTIG!)

## Wo arbeiten wir gerade?
**Edit-Modus → Stift-Button → Analyze-Funktion**

### Der Pfad zur aktuellen Arbeit:
1. **Dashboard** → Bot-Type auswählen (1 Bot-Type)
2. **Stift-Button klicken** (`markerEditActive = true`)
3. **Update-Marker auswählen** (z.B. U1, U2, C1...)
4. **"Analyse" Button klicken** für einzelne Metrik-Betrachtung

### Aktive State-Variablen:
```typescript
markerEditActive = true           // Stift-Modus aktiv
appliedUpdateId = "updateId"      // Ausgewähltes Update
analyzeModeBounds = { startTs, endTs }  // Zeitraum des Updates
isAnalyzeSingleMetricMode = true  // Analyze-Funktion aktiv (im Compare)
```

### Was wir hier machen:
- **Zoom & Pan** für die X/Y-Achse (wie im Compare-Mode)
- **X-Achsen-Labels**: Datum + Uhrzeit bei kurzen Zeiträumen (≤7 Tage)
- **Einzelne Metriken analysieren** mit farbcodierten Linien

---

# 🔒 GOLDEN STATE DOKTRIN

## Was ist "Golden State"?
**Golden State** = Code der **NIEMALS WIEDER ANGEFASST** werden darf.

- ✅ Vollständig fertig entwickelt
- ✅ Getestet und stabil
- ❌ **ABSOLUTES ÄNDERUNGSVERBOT**

**REGEL**: Vor JEDER Code-Änderung prüfen: Ist das Golden State? Wenn ja → **STOPP!**

---

# 🚫 GOLDEN STATE BEREICHE (TABU!)

## 1. MainChart (GOLDEN STATE)
**Was ist das?** Haupt-Chart für **EINEN** ausgewählten Bot-Type.

**Features:**
- Gesamtprofit, Ø Profit/Tag, Real Profit/Tag, Gesamtkapital, Gesamtprofit %
- Metrik-Karten (klickbar)
- Marker-System (U1, U2, U3... / C1, C2, C3...)
- Eye-Mode & Pencil-Mode
- Zoom & Pan
- Tooltip mit Datum, Werten, Runtime

**Aktivierung:**
```typescript
selectedChartBotTypes.length === 1 && !compareActive
```

**CODE (NICHT ANFASSEN!):**
- `chartData` useMemo: Zeilen ~800-1200
- MainChart Rendering: Zeilen ~5800-6500
- Alle Single-Bot-Type Logiken

---

## 2. Compare Mode (GOLDEN STATE)
**Was ist das?** Vergleich von **2+ Bot-Types** mit farbcodierten Linien.

**Features:**
- Multi-Bot-Type Vergleich
- compareColorMap (Farben pro Bot-Type)
- Start/End Punkte pro Update
- Grüne Start-Box, Rote End-Box im Tooltip
- Runtime bei End-Punkten

**Aktivierung:**
```typescript
selectedChartBotTypes.length >= 2 && compareActive === true
```

**CODE (NICHT ANFASSEN!):**
- Compare Mode useMemo: Zeilen ~1200-1400
- `isMultiSelectCompareMode` Flag
- compareColorMap
- Compare Tooltip: Zeilen ~5840-5906, ~6050-6240

---

## 3. Bot-Type Verwaltung (GOLDEN STATE)
**Was ist das?** CRUD für Bot-Types.

**Features:**
- Bot-Type erstellen/bearbeiten/löschen
- CSV/Excel Upload
- Update-History

**CODE (NICHT ANFASSEN!):**
- Alle CRUD Operationen
- Upload-Funktionalität
- Update-Liste

---

## 4. AI-Analysis Page (GOLDEN STATE)
**Datei:** `client/src/pages/ai-analysis.tsx`

**Features:**
- OpenAI Integration
- Automatische Insights
- Chart-Daten Zusammenfassung

**GESAMTE DATEI IST GOLDEN STATE!**

---

# ✅ ARBEITSBEREICHE (Erlaubt zu bearbeiten)

## 1. Edit-Modus / Stift-Modus
**Aktueller Fokus!**

**Was gehört dazu:**
- Toggle: Overlay / Analyze
- Analyze-Funktion für einzelne Metriken
- X-Achsen Zoom & Pan
- X-Achsen Labels (Datum + Uhrzeit)

**Relevante State-Variablen:**
```typescript
markerEditActive              // Stift-Modus aktiv
analyzeModeBounds             // Zeitraum des ausgewählten Updates
isAnalyzeSingleMetricMode     // Analyze-Funktion aktiv
```

**CODE-BEREICHE:**
- xAxisTicks für analyzeModeBounds: Zeilen ~2346-2430
- analyzeTicksHaveDuplicateDays: Zeilen ~2955-2972
- X-Achsen Formatierung (Analyze): Zeilen ~5993-6090

---

## 2. Added/Portfolio Mode
**Was ist das?** Mehrere Bot-Types aggregiert OHNE Compare-Toggle.

**Aktivierung:**
```typescript
selectedChartBotTypes.length >= 2 && compareActive === false
```

**CODE-BEREICHE:**
- `multiBotChartData` useMemo: Zeilen ~1413-1591
- Added Mode Tooltip: Zeilen ~6262-6324
- Dot-Renderer: Zeilen ~6662-6704

---

# 📊 DASHBOARD SECTIONS ÜBERSICHT

| Section | Status | Beschreibung |
|---------|--------|--------------|
| MainChart | 🔒 GOLDEN STATE | 1 Bot-Type Visualisierung |
| Compare Mode | 🔒 GOLDEN STATE | 2+ Bot-Types Vergleich |
| Bot-Type CRUD | 🔒 GOLDEN STATE | Verwaltung |
| AI-Analysis | 🔒 GOLDEN STATE | KI-Analyse (separate Datei) |
| Edit-Modus | ✅ ARBEITSBEREICH | Stift-Modus, Analyze |
| Added Mode | ✅ ARBEITSBEREICH | Portfolio-Ansicht |

---

# 🎨 WICHTIGE VARIABLEN

## Chart-Modi:
```typescript
isMultiBotChartMode          // 2+ Bot-Types, KEIN Compare
isMultiSelectCompareMode     // 2+ Bot-Types, MIT Compare
isSingleBotMode              // 1 Bot-Type
```

## Interaktions-Modi:
```typescript
markerViewActive             // Eye Mode (Mehrfachauswahl)
markerEditActive             // Pencil Mode (Einzelauswahl)
compareActive                // Compare Toggle
```

## Daten-Quellen:
```typescript
chartData                    // MainChart (1 Bot)
multiBotChartData            // Added Mode (2+ Bots, kein Compare)
compareChartData             // Compare Mode (2+ Bots, mit Compare)
```

---

# 🎨 FARB-SYSTEM

## Metrik-Farben:
```typescript
'Gesamtprofit': '#22c55e'      // Grün
'Ø Profit/Tag': '#3b82f6'      // Blau
'Real Profit/Tag': '#8b5cf6'   // Lila
'Gesamtkapital': '#f59e0b'     // Orange
'Gesamtprofit %': '#ec4899'    // Pink
```

## Spezielle Farben:
- **Neon-Blue**: `#3b82f6` - Aktive Elemente
- **Cyan**: `#06b6d4` - "Gesamt" Linie
- **Rot**: `#ef4444` - End-Punkte
- **Grün**: `#22c55e` - Start-Punkte

---

# 📁 DATEI-STRUKTUR

| Datei | Beschreibung |
|-------|--------------|
| `client/src/pages/dashboard.tsx` | Hauptdatei (~9000+ Zeilen) |
| `client/src/pages/ai-analysis.tsx` | KI-Analyse (GOLDEN STATE) |
| `shared/schema.ts` | Datenbank-Schema |
| `server/storage.ts` | Storage-Interface |
| `server/routes.ts` | API-Endpunkte |

---

# 🔧 SYSTEM ARCHITEKTUR

## Frontend
- **Framework**: React + TypeScript (Vite)
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **Routing**: Wouter

## Backend
- **Framework**: Express.js + TypeScript
- **Storage**: MemStorage (in-memory)
- **Validation**: Zod

## Database
- **ORM**: Drizzle ORM
- **DB**: Neon Serverless PostgreSQL

---

# 📝 CHANGELOG

## Dezember 2025 - Edit-Modus Zoom & X-Achsen-Labels
**Was wurde gemacht:**
1. Zoom & Pan für Analyze-Modus (1:1 wie Compare-Mode)
2. X-Achsen-Labels: Datum + Uhrzeit bei ≤7 Tagen sichtbar
3. Automatische Sequence-Downgrade beim Zoomen

**Relevante Änderungen:**
- xAxisTicks für analyzeModeBounds mit Zoom-Berechnung
- X-Achsen Formatierung: `visibleDays <= 7` → Datum + Uhrzeit

## Dezember 2025 - Analyze Mode Multi-Metrik
**Was wurde gemacht:**
1. Mehrere Metriken gleichzeitig anzeigen
2. Farbcodierte Linien pro Metrik
3. Safe Key Mapping für Recharts

## Dezember 2025 - Added Mode Redesign
**Was wurde gemacht:**
1. Nur End-Events anzeigen
2. Individuelle Datenpunkte (nicht aggregiert)
3. Neues Tooltip-Format

---

# ⚠️ REGELN FÜR ENTWICKLUNG

## ABSOLUT VERBOTEN:
1. ❌ MainChart Code ändern
2. ❌ Compare Mode Code ändern
3. ❌ Bot-Type CRUD ändern
4. ❌ AI-Analysis Page ändern

## ERLAUBT:
1. ✅ Edit-Modus / Stift-Modus
2. ✅ Added/Portfolio Mode
3. ✅ Neue Features (wenn kein Golden State betroffen)

## BEI JEDER ÄNDERUNG:
1. **Prüfen**: Ist Golden State betroffen?
2. **Wenn ja**: STOPP! Nicht anfassen!
3. **Wenn nein**: Vorsichtig vorgehen, testen
