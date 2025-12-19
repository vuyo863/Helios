# Pionex Bot Profit Tracker

## Overview
The Pionex Bot Profit Tracker is a full-stack web application designed to track and analyze profits from Pionex trading bots. It features a comprehensive dashboard, a flexible data upload interface, and generates detailed, filterable financial reports. The primary goal is to provide clear, professional financial insights to users through a React frontend and an Express backend.

## User Preferences
Preferred communication style: Simple, everyday language (German).

---

# AUSFÜHRLICHE FEATURE-DOKUMENTATION FÜR ÜBERGABE

## GOLDEN STATE - NICHT ÄNDERN
Alles oberhalb der "Alle Einträge" Section funktioniert korrekt:
- Graph-Einstellungen Panel
- Chart-Funktionalität (Zoom, Pan, Offset)
- Stat Cards
- Marker-System oberhalb des Charts
- Zeitraum-Filter

---

## 1. CHART-SYSTEM

### 1.1 Compare-Modus
- Aktivierung: `selectedChartBotTypes.length >= 2` + Toggle auf "Compare"
- Variable: `isMultiSelectCompareMode = true`
- Datenquelle: `compareChartData` useMemo
- Visualisierung: ZWEI Punkte pro Update (Start + Ende) für jeden Bot-Type
- Zeilen: ~880-1015 in dashboard.tsx

### 1.2 Added-Modus
- Aktivierung: `selectedChartBotTypes.length >= 2` + Toggle auf "Added"
- Variable: `isMultiBotChartMode = true`
- Datenquelle: `multiBotChartData` useMemo
- Visualisierung: Kumulierte Werte aller Bot-Types

### 1.3 Marker-System
- Update Metrics (U1, U2, ...): Horizontale Linie mit Start/End-Markern
- Closed Bots (C1, C2, ...): NUR End-Marker (ein Kreis)
- Normal-Modus Keys: `u-${version}` oder `c-${version}`
- Compare-Modus Keys: `${botTypeId}:u-${version}` oder `${botTypeId}:c-${version}`

### 1.4 Chart-Punkte
- Normale Updates: Gefüllter Kreis
- Closed Bots: HOHLER Kreis (fill=background, stroke=color)
- Aktiv: Neon-Blau rgb(8, 145, 178) mit Glow

---

## 2. AUGE-MODUS (markerViewActive)

### 2.1 States
- `markerViewActive: boolean` - Toggle
- `hoveredUpdateId: string | null` - Aktuell gehoverter Marker
- `lockedUpdateIds: Set<string>` - Gelockte Marker (Multi-Select)

### 2.2 Funktionalität
- Multi-Select: Klick auf Marker togglet in lockedUpdateIds Set
- Bidirektionale Interaktion:
  - Marker Hover → Chart-Punkt wird aktiv
  - Chart-Punkt Hover → Marker wird aktiv

### 2.3 Visuelle Effekte
- Aktive Marker: Neon-Blau mit Glow
- Gestrichelte Linie vom Marker zum Chart-Punkt
- Aktiver Chart-Punkt: Neon-Blau Glow

---

## 3. STIFT-MODUS (markerEditActive)

### 3.1 States
- `markerEditActive: boolean` - Toggle
- `editSelectedUpdateId: string | null` - Ausgewähltes Update
- `editHoveredUpdateId: string | null` - Gehovertes Update

### 3.2 Funktionalität
- Single-Select (nur EIN Update)
- Hat IMMER Priorität über Auge-Modus
- Content-Card zeigt Details des ausgewählten Updates

---

## 4. FARBSYSTEM

### 4.1 compareColorMap
```typescript
const compareColorMap = useMemo(() => {
  const map: Record<string, string> = {};
  selectedChartBotTypes.forEach((id, index) => {
    map[String(id)] = getCompareColor(index);
  });
  return map;
}, [selectedChartBotTypes]);
```

### 4.2 Farb-Regeln
| Kontext | Inaktiv | Aktiv |
|---------|---------|-------|
| Normal | Grau | Neon-Blau |
| Compare | Bot-Type-Farbe | Neon-Blau |
| Closed Bot | Hohler Kreis | Hohler Kreis mit Neon-Blau Rand |

---

## 5. ANALYZE SINGLE METRIC MODE (Neu: 2025-12-19)

### 5.1 Konzept
"Ausnahmezustand" innerhalb des Compare-Modus: Wenn Analyze Mode aktiviert wird mit einem Metrik aus Compare Mode (Key enthält `:` wie `{botTypeId}:u-{version}`), wird:
1. Compare Mode Rendering verlassen (normaler Single-Bot Chart)
2. Nur die Daten dieser einzelnen Metrik vom Start- bis Enddatum angezeigt
3. Content Cards mit den Werten der Metrik befüllt
4. Normale Metric Card Nutzung ermöglicht

### 5.2 States & Flags
```typescript
// Erkennung: Key enthält `:` = Compare-Format
const isAnalyzeSingleMetricMode = analyzeMode && appliedUpdateId?.includes(':');

// Extrahiere Bot-Type-Info aus dem Key
const analyzeSingleMetricInfo = useMemo(() => {
  if (!isAnalyzeSingleMetricMode) return null;
  const colonIndex = appliedUpdateId.indexOf(':');
  const botTypeId = appliedUpdateId.substring(0, colonIndex);
  // ... Rest-Logik
}, [analyzeMode, appliedUpdateId, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes]);

// Override für effectiveSelectedBotTypeData
const effectiveSelectedBotTypeData = isAnalyzeSingleMetricMode && analyzeSingleMetricInfo?.botType
  ? analyzeSingleMetricInfo.botType
  : selectedBotTypeData;
```

### 5.3 Kritische Overrides
1. **isMultiSelectCompareMode**: Wird `false` wenn `isAnalyzeSingleMetricMode = true`
2. **effectiveBotTypeIdForQuery**: Extrahiert BotType-ID aus Compare-Key für API-Query
3. **xAxisDomain / xAxisTicks**: `analyzeModeBounds` hat höhere Priorität als Compare-Mode
4. **Content Cards**: Verwenden `analyzeSingleMetricValues` statt aggregierte Werte

### 5.4 Exit-Mechanismus
Wenn `analyzeMode` auf `false` gesetzt wird:
- `isAnalyzeSingleMetricMode` wird automatisch `false`
- `isMultiSelectCompareMode` wird wieder `true` (wenn 2+ Bot-Types ausgewählt)
- Compare Mode Rendering wird wiederhergestellt

---

## 6. AKTUELLER BUG (IN ARBEIT)

### 6.1 Problem
Im Compare-Modus + Auge-Modus: Hover über Closed Bot Marker (C1) aktiviert 3 Punkte statt 1.

### 6.2 Ursache
1. compareChartData erstellt ZWEI Punkte (Start + Ende) für JEDEN Update
2. Auch für Closed Bots werden zwei Punkte erstellt
3. findMatchingUpdateKey findet mehrere Punkte innerhalb Zeittoleranz

### 6.3 Bisherige Fix-Versuche
1. BotTypeId in Key: `${botTypeId}:c-${version}` ✅
2. isRelevantPoint Prüfung: `pointBotTypeName === botTypeName` ✅
3. Start-Punkte überspringen bei Closed Bots ✅
4. **Nicht ausreichend** - Bug besteht weiterhin

### 6.4 Empfohlene Lösung (NICHT implementiert)
1. compareChartData refaktorieren: Für Closed Bots NUR End-Punkt erstellen
2. `updateKeyWithBotType` im Payload speichern für direktes Key-Matching
3. Statt Zeitstempel-Matching: Direkte Key-Vergleiche

### 6.5 Relevante Code-Stellen
- dashboard.tsx ~880-1015: compareChartData useMemo
- dashboard.tsx ~3167-3175: Closed Bot Marker Key
- dashboard.tsx ~4505-4560: findMatchingUpdateKey Funktion
- dashboard.tsx ~4595-4615: Closed Bot Rendering (hohler Kreis)

---

## 7. STATE-ÜBERSICHT

```typescript
// Modus-States
markerViewActive: boolean  // Auge-Modus
markerEditActive: boolean  // Stift-Modus

// Auge-Modus
hoveredUpdateId: string | null
lockedUpdateIds: Set<string>

// Stift-Modus
editSelectedUpdateId: string | null
editHoveredUpdateId: string | null

// Chart
hoveredBotTypeId: string | null
selectedChartBotTypes: string[]
```

---

## 8. PRIORITÄTEN-REIHENFOLGE
1. Stift-Modus → Hat IMMER Vorrang
2. Auge-Modus → Nur wenn Stift NICHT aktiv
3. appliedUpdateId → Nur wenn BEIDE Modi inaktiv

---

## 9. CLOSED BOTS REGELN
- NUR End-Punkt (kein Start)
- Hohler Kreis: `fill="hsl(var(--background))"` + `stroke={color}`
- Compare-Modus Key: `${botTypeId}:c-${version}`

---

## 10. BEHOBENE FEHLER (NIEMALS WIEDERHOLEN!)

### 10.1 CONNECTION ISSUE CLOSED BOT (Fix: 2025-12-19)
**Problem:** Im Compare-Modus wurden für Closed Bot Marker ZWEI Kreise angezeigt statt einem.
**Ursache:** 
1. Marker-SVG (Zeilen ~3437-3447) zeichnete einen manuellen Kreis am Chart-Punkt
2. Line-Komponente dot-Renderer (Zeilen ~4604-4621) zeichnete ebenfalls einen Kreis
3. Zusätzlich: dot-Renderer prüfte nicht ob `pointValue === null` → Kreise für ALLE Bot-Types gerendert

**Fix:**
1. Manuellen Kreis in Marker-SVG entfernt (nur gestrichelte Linie bleibt)
2. In Line dot-Renderer: Skip wenn `pointValue === null || pointValue === undefined`

**Regel:** Jeder Datenpunkt gehört NUR zu EINEM Bot-Type. Vor dem Rendern IMMER prüfen ob der Wert existiert!

### 9.2 DASHED LINE WRONG BOT-TYPE (Fix: 2025-12-19)
**Problem:** Gestrichelte Linien von Update Markern gingen zum FALSCHEN Bot-Type (z.B. U1 von bhj ging zur roten teshh-Linie).
**Ursache:** `findValueAtTs()` Funktion nahm den ERSTEN Bot-Type-Wert statt den Wert vom richtigen Bot-Type.
**Fix:** Bot-Type-Name via `update.botTypeId` ermitteln und NUR dessen Wert aus dem Chart-Punkt lesen.
**Regel:** Updates gehören zu EINEM Bot-Type. Immer `update.botTypeId` verwenden um den richtigen Wert zu finden!

---

## System Architecture

### UI/UX
- Framework: React with TypeScript (Vite)
- Design System: shadcn/ui + Material Design 3 + Roboto font
- Styling: Tailwind CSS
- Charts: Recharts

### Backend
- Framework: Express.js + Node.js + TypeScript
- Storage: MemStorage (in-memory)
- Validation: Zod

### Database
- ORM: Drizzle ORM for PostgreSQL
- Schema: users, bot_types, bot_entries
- Migrations: Drizzle Kit

## External Dependencies
- Neon Serverless PostgreSQL
- Drizzle ORM
- Radix UI, Recharts, date-fns, Lucide React
- React Hook Form + Zod
- clsx, tailwind-merge, class-variance-authority
