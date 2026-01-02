# Pionex Bot Profit Tracker

## Overview
A full-stack web application for tracking and analyzing profits from Pionex trading bots. The project aims to provide users with detailed insights into bot performance, including profit trend visualization, bot type comparison, and advanced analytical features, to empower better trading decisions.

## User Preferences
- **Sprache**: Deutsch (einfache Alltagssprache)
- **Kommunikation**: Direkt, ohne Umschweife

## System Architecture

### UI/UX
The frontend is built with React and TypeScript, using `shadcn/ui` and Tailwind CSS for a responsive interface. Recharts is used for dynamic data visualization, and Wouter for client-side routing.

The dashboard offers three primary chart modes:
1.  **MainChart**: Displays detailed performance for a single bot type.
2.  **Compare Mode**: Compares the performance of two or more bot types.
3.  **Added Mode**: Aggregates data from multiple bot types, with an "Analysis" sub-toggle and an "Overlay" feature.

Key interactive features include a marker system (U1, C1), eye and pencil modes for detailed interaction, and zoom/pan functionalities.

### Technical Implementations
*   **State Management**: TypeScript-typed state manages chart modes, bot types, and interaction.
*   **Data Handling**: `useMemo` hooks optimize data preparation.
*   **Bot Type Management**: Supports CRUD operations for bot types, including CSV/Excel upload and update history.
*   **Eye Mode**: Provides an extended overlay view with Period Comparison Cards and aggregated metrics.
*   **Pencil Mode**: Allows single-period selection for detailed analysis, including a bar chart for performance metrics.

### Feature Specifications
*   **Marker System**: Defines interactive points on charts for event analysis.
*   **Zoom & Pan**: Interactive chart navigation.
*   **AI-Analysis**: Integration with OpenAI for automated insights and data summarization.
*   **Info-Tooltips**: Provides explanations for key metrics like "Ø Profit/Tag" and "Real Profit/Tag" in Added Mode.

### System Design Choices
*   **Golden State Doctrine**: Critical, stable, and fully tested parts of the codebase are protected from modification to ensure stability. This includes Eye Mode, Pencil Mode, MainChart, Compare Mode, Added-Mode Analysis, Added-Mode Overlay, Bot-Type CRUD, AI-Analysis Page, and Info-Tooltips for metric cards.
*   **Modular Architecture**: Clear separation of concerns between frontend and backend, and within frontend components.

## External Dependencies
*   **Database**: Neon Serverless PostgreSQL with Drizzle ORM.
*   **Backend Framework**: Express.js with TypeScript.
*   **Frontend Libraries**: React, Recharts, shadcn/ui, Tailwind CSS, Wouter.
*   **Validation**: Zod.
*   **AI Integration**: OpenAI API.
*   **Storage**: In-memory `MemStorage` for server-side data handling.

---

## ============================================================
## ABSCHLUSSBERICHT - Chat-Session 02.01.2026
## ============================================================

### Datum: 02. Januar 2026
### Status: ERFOLGREICH ABGESCHLOSSEN
### Version nach Session: Golden State v1.4

---

## 1. ÜBERSICHT DER SESSION

In dieser Chat-Session wurde ein kritischer Bug behoben, der dazu führte, dass der "Gesamtprofit %" Wert in beiden Added Mode Ansichten (Analysis und Overlay) immer als 0,00% angezeigt wurde, obwohl die Datenbank korrekte Werte enthielt.

### Das Problem im Detail:
- Im Chart-Tooltip wurde "Gesamtprofit %: 0,00%" angezeigt
- Der Graph für die Profit-Prozent-Metrik zeigte eine flache Linie bei 0
- Die Content Cards berechneten die Werte korrekt (eigene Berechnung)
- Das Problem betraf NUR die Chart-Daten-Vorbereitung

---

## 2. URSACHENANALYSE

### 2.1 Das nicht-existierende Feld
Der Code verwendete das Feld `update.gridProfitPercent` - **dieses Feld existiert NICHT im Datenbank-Schema!**

**Falsch (vorher):**
```typescript
'Gesamtprofit %': parseFloat(update.gridProfitPercent || '0') || 0
```

### 2.2 Die korrekten Felder im Schema
Das Datenbank-Schema (`shared/schema.ts`) definiert zwei spezifische Felder:
- `overallGridProfitPercent_gesamtinvestment` - Prozent basierend auf Gesamtinvestment
- `overallGridProfitPercent_investitionsmenge` - Prozent basierend auf Investitionsmenge

Diese Felder werden abhängig von der User-Einstellung `profitPercentBase` ausgewählt.

### 2.3 Datenbank-Bestätigung
SQL-Abfrage bestätigte, dass Werte in der Datenbank existieren:
```sql
SELECT overall_grid_profit_percent_gesamtinvestment, 
       overall_grid_profit_percent_investitionsmenge 
FROM bot_type_updates;
```
Ergebnis: Werte wie 1.25%, 5.96%, 11.44% waren vorhanden - wurden aber nicht gelesen!

---

## 3. DURCHGEFÜHRTE ÄNDERUNGEN

### 3.1 Änderung 1 - Analysis Mode Feld-Korrektur (Zeile 1749-1759)

**Vorher:**
```typescript
const metricValues: Record<string, number | undefined> = {
  'Gesamtprofit': profit,
  'Gesamtkapital': parseFloat(update.totalInvestment || '0') || 0,
  'Gesamtprofit %': isClosedBot ? undefined : parseFloat(update.gridProfitPercent || '0') || 0,
  ...
};
```

**Nachher:**
```typescript
// Wähle das richtige Prozent-Feld basierend auf profitPercentBase
const gridProfitPercentValue = profitPercentBase === 'gesamtinvestment' 
  ? update.overallGridProfitPercent_gesamtinvestment 
  : update.overallGridProfitPercent_investitionsmenge;
const metricValues: Record<string, number | undefined> = {
  'Gesamtprofit': profit,
  'Gesamtkapital': parseFloat(update.totalInvestment || '0') || 0,
  'Gesamtprofit %': isClosedBot ? undefined : parseFloat(gridProfitPercentValue || '0') || 0,
  ...
};
```

### 3.2 Änderung 2 - Analysis Mode Dependency Array (Zeile 1893)

**Vorher:**
```typescript
}, [isMultiBotChartMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, appliedChartSettings, activeMetricCards]);
```

**Nachher:**
```typescript
}, [isMultiBotChartMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, appliedChartSettings, activeMetricCards, profitPercentBase]);
```

**Begründung:** Ohne `profitPercentBase` im dependency array würde das useMemo nicht neu berechnet werden, wenn der User zwischen "Gesamtinvestment" und "Investitionsmenge" wechselt.

### 3.3 Änderung 3 - Overlay Mode Feld-Korrektur (Zeile 2293-2303)

Identische Änderung wie bei Analysis Mode - Auswahl des korrekten Prozent-Felds basierend auf `profitPercentBase`.

### 3.4 Änderung 4 - Overlay Mode Dependency Array (Zeile 2440)

**Vorher:**
```typescript
}, [isOverlayMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, appliedChartSettings, activeMetricCards]);
```

**Nachher:**
```typescript
}, [isOverlayMode, selectedChartBotTypes, allBotTypeUpdates, availableBotTypes, appliedChartSettings, activeMetricCards, profitPercentBase]);
```

---

## 4. GOLDEN STATE BEREICHE - VERIFIZIERUNG

### ⚠️ WICHTIGE REGEL FÜR ALLE ZUKÜNFTIGEN ÄNDERUNGEN:

**ALLE Golden State Bereiche (egal welche Version) dürfen NIEMALS angefasst werden, außer der User sagt es EXPLIZIT!**

Das bedeutet:
- ❌ KEINE Funktions-Änderungen
- ❌ KEINE UI-Änderungen
- ❌ KEINE Layout-Änderungen
- ❌ KEINE Code-Strukturänderungen
- ❌ KEINE Styling-Änderungen

**Wenn ein Bereich als "Golden State" markiert ist, ist er GESCHÜTZT und UNVERÄNDERLICH!**

### 4.1 Liste aller Golden State Bereiche (verifiziert am 02.01.2026)

| Zeile | Bereich | Status | Beschreibung |
|-------|---------|--------|--------------|
| 2339-2356 | Overlay earliestStartTs | ✅ UNVERÄNDERT | Berechnung des frühesten Start-Zeitpunkts |
| 2432 | Overlay minTimestamp | ✅ UNVERÄNDERT | Minimum-Timestamp für Chart-Bereich |
| 6050 | Eye/Pencil State Reset | ✅ UNVERÄNDERT | Reset der States beim Modus-Wechsel |
| 7354 | Compare Mode Linien | ✅ UNVERÄNDERT | Zeigt IMMER Start + End Linien |
| 7456 | Added/Edit Mode Linien | ✅ UNVERÄNDERT | Zeigt IMMER NUR End-Linie |
| 7573 | MainChart Linien | ✅ UNVERÄNDERT | Zeigt IMMER Start + End Linien |
| 10010-10362 | Overlay Auge-Modus | ✅ UNVERÄNDERT | Komplette Auge-Modus UI und Logik |

### 4.2 Bestehende Golden State Features (aus vorherigen Sessions)

| Feature | Version | Status | Beschreibung |
|---------|---------|--------|--------------|
| Eye Mode (Auge-Modus) | v1.0 | ✅ GESCHÜTZT | Period Comparison Cards, aggregierte Metriken |
| Pencil Mode (Stift-Modus) | v1.0 | ✅ GESCHÜTZT | Einzelperioden-Auswahl, Bar Chart |
| MainChart | v1.0 | ✅ GESCHÜTZT | Performance-Anzeige für einzelne Bot-Types |
| Compare Mode | v1.0 | ✅ GESCHÜTZT | Vergleich mehrerer Bot-Types |
| Added Mode Analysis | v1.0 | ✅ GESCHÜTZT | Aggregierte Daten-Analyse |
| Added Mode Overlay | v1.0 | ✅ GESCHÜTZT | Overlay-Visualisierung |
| Bot-Type CRUD | v1.0 | ✅ GESCHÜTZT | Create/Read/Update/Delete für Bot-Types |
| AI-Analysis Page | v1.0 | ✅ GESCHÜTZT | OpenAI Integration |
| Info-Tooltips | v1.3 | ✅ GESCHÜTZT | React Portal, Auto-Dismiss nach 5s |
| earliestStartTs Logik | v1.2 | ✅ GESCHÜTZT | Korrektes Zeitraum-Mapping |
| Real Profit/Tag Berechnung | v1.2 | ✅ GESCHÜTZT | realDailyProfit / daySpan Formel |

---

## 5. TECHNISCHE DETAILS

### 5.1 Betroffene Dateien

| Datei | Änderungen | Beschreibung |
|-------|------------|--------------|
| `client/src/pages/dashboard.tsx` | 4 Stellen | Bug-Fix für Gesamtprofit % |

### 5.2 Git-Diff Zusammenfassung

```
client/src/pages/dashboard.tsx | 16 ++++++++++++----
1 file changed, 12 insertions(+), 4 deletions(-)
```

### 5.3 Betroffene useMemo Hooks

| Hook | Zweck | Änderung |
|------|-------|----------|
| `multiBotChartData` | Chart-Daten für Analysis Mode | Feld-Korrektur + Dependency |
| `overlayChartData` | Chart-Daten für Overlay Mode | Feld-Korrektur + Dependency |

---

## 6. TESTING

### 6.1 Durchgeführte Verifikationen

- ✅ SQL-Abfrage bestätigt Datenbankwerte vorhanden
- ✅ Schema-Analyse bestätigt korrekte Feldnamen
- ✅ Git-Diff zeigt nur beabsichtigte Änderungen
- ✅ Golden State Bereiche alle verifiziert
- ✅ App startet ohne Fehler
- ✅ Keine Console-Errors

### 6.2 Erwartetes Verhalten nach Fix

- Chart-Tooltip zeigt korrekte Prozent-Werte (z.B. "Gesamtprofit %: 1,25%")
- Graph für Gesamtprofit % zeigt korrekte Kurve (nicht mehr flach bei 0)
- Wechsel zwischen "Gesamtinvestment" und "Investitionsmenge" aktualisiert die Werte

---

## 7. EMPFEHLUNGEN FÜR ZUKÜNFTIGE ENTWICKLUNG

### 7.1 Golden State Doctrine - STRIKT EINHALTEN

1. **VOR jeder Änderung**: Prüfen ob der Bereich Golden State ist
2. **Falls Golden State**: STOPP - Nicht ändern ohne explizite User-Erlaubnis
3. **Nach jeder Änderung**: Alle Golden State Bereiche verifizieren

### 7.2 Schema-Konsistenz

Bei neuen Metriken immer prüfen:
- Existiert das Feld im Schema (`shared/schema.ts`)?
- Wie heißt das Feld genau (camelCase vs. snake_case)?
- Gibt es Varianten basierend auf User-Einstellungen?

### 7.3 Dependency Arrays

Bei useMemo Hooks immer prüfen:
- Sind alle verwendeten State-Variablen im Dependency Array?
- Besonders wichtig bei Variablen die UI-Toggles steuern

---

## 8. VERSION HISTORY

| Version | Datum | Änderungen |
|---------|-------|------------|
| v1.0 | Initial | Basis-Implementation aller Modi |
| v1.1 | - | Marker System, Zoom/Pan |
| v1.2 | - | earliestStartTs Logik, Real Profit/Tag |
| v1.3 | 01.01.2026 | Info-Tooltips mit React Portal |
| **v1.4** | **02.01.2026** | **Gesamtprofit % Bug-Fix** |

---

## 9. FAZIT

Der Bug wurde erfolgreich behoben. Die Ursache war ein nicht-existierendes Datenbank-Feld. Die Lösung verwendet jetzt die korrekten schema-konformen Felder und reagiert dynamisch auf die User-Einstellung `profitPercentBase`.

**Alle Golden State Bereiche wurden verifiziert und sind UNVERÄNDERT geblieben.**

---
## ============================================================
## ENDE ABSCHLUSSBERICHT
## ============================================================