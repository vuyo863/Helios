# Golden State: Alarmierungsstufen konfigurieren

**Status:** DIAMOND STATE (2026-01-11)
**Schutzlevel:** NIEMALS ohne explizite User-Erlaubnis modifizieren

## Übersicht

Die komplette "Alarmierungsstufen konfigurieren" Section ist Diamond/Golden State. Diese Section zeigt vier Alarm-Level-Karten (Harmlos, Achtung, Gefährlich, Sehr Gefährlich) mit vollständiger Konfiguration für Benachrichtigungskanäle, Wiederholungen, Sequenzen und Restwartezeit.

## UI-Komponenten (Geschützt)

### 1. Section Header
- Titel: "Alarmierungsstufen konfigurieren"
- Card-Container mit abgerundeten Ecken

### 2. Vier Alarm-Level-Karten (2x2 Grid)
Jede Karte zeigt:
- **Farbiger Indikator** (Quadrat) + Level-Name + Bearbeiten-Icon (Stift)
- **Aktive Kanäle:** Liste der aktivierten Benachrichtigungskanäle
- **Approval:** "Erforderlich" oder "Nicht erforderlich"
- **Wiederholung:** Anzahl (z.B. "5x") oder "∞ (Bis Approval)"
- **Sequenz:** Zeit im Format "Xh Xm Xs"
- **Restwartezeit:** Nur sichtbar wenn Approval=false, Format "Xh Xm Xs (Auto-Dismiss)"

### 3. Alarm-Level Farben
- **Harmlos:** Blau (#3B82F6)
- **Achtung:** Gelb/Orange (#F59E0B)
- **Gefährlich:** Orange (#F97316)
- **Sehr Gefährlich:** Rot (#EF4444)

## Dialog-System (Geschützt)

### Alarm-Level Bearbeiten Dialog
Enthält folgende Elemente in dieser Reihenfolge:

#### Benachrichtigungskanäle
1. **E-Mail** - Toggle (Switch)
2. **SMS** - Toggle (Switch) + Telefonnummer-Eingabe wenn aktiv
3. **Push Benachrichtigungen (iOS, Android, Browser)** - Toggle (Switch)
   - Unified: Ein Toggle kontrolliert webPush + nativePush

#### Approval-Einstellung
- **Approval erforderlich** - Toggle (Switch)
- Beschreibung: "Alarm muss manuell bestätigt werden"

#### Wiederholung
- **Input-Feld** für Anzahl (numerisch)
- **∞ Unendlich Button** - Wechselt zu infinite mode
- **Status-Anzeige** rechts (z.B. "5x" oder "Bis Approval")
- WICHTIG: Bei "infinite" wird Approval automatisch auf true gesetzt

#### Sequenz (Pause zwischen Wiederholungen)
- **3-Spalten Grid:** Stunden | Minuten | Sekunden
- Jedes Feld ist numerisches Input

#### Restwartezeit (nur wenn Approval=false UND repeatCount !== 'infinite')
- **Label:** "Restwartezeit (Auto-Dismiss nach Wiederholungen)"
- **Beschreibung:** "Nach Ablauf aller Wiederholungen läuft dieser Countdown, dann verschwindet der Alarm automatisch."
- **3-Spalten Grid:** Stunden | Minuten | Sekunden

#### Dialog Buttons
- **Abbrechen** - Schließt Dialog ohne Speichern
- **Speichern** (primary/blau) - Speichert Änderungen

## Code-Snapshot: AlarmLevelConfig Interface

```typescript
interface AlarmLevelConfig {
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    webPush: boolean;
    nativePush: boolean;
  };
  requiresApproval: boolean;
  repeatCount: number | 'infinite';
  sequenceHours: number;
  sequenceMinutes: number;
  sequenceSeconds: number;
  restwartezeitHours: number;
  restwartezeitMinutes: number;
  restwartezeitSeconds: number;
}
```

## Code-Snapshot: Default Alarm Level Configs

```typescript
const defaultAlarmLevelConfigs: Record<AlarmLevel, AlarmLevelConfig> = {
  harmlos: {
    channels: { push: true, email: true, sms: false, webPush: false, nativePush: false },
    requiresApproval: false,
    repeatCount: 5,
    sequenceHours: 0,
    sequenceMinutes: 0,
    sequenceSeconds: 30,
    restwartezeitHours: 0,
    restwartezeitMinutes: 1,
    restwartezeitSeconds: 0
  },
  achtung: {
    channels: { push: true, email: true, sms: false, webPush: true, nativePush: true },
    requiresApproval: false,
    repeatCount: 10,
    sequenceHours: 0,
    sequenceMinutes: 0,
    sequenceSeconds: 0,
    restwartezeitHours: 0,
    restwartezeitMinutes: 0,
    restwartezeitSeconds: 10
  },
  gefaehrlich: {
    channels: { push: true, email: true, sms: false, webPush: true, nativePush: true },
    requiresApproval: true,
    repeatCount: 3,
    sequenceHours: 0,
    sequenceMinutes: 5,
    sequenceSeconds: 0,
    restwartezeitHours: 0,
    restwartezeitMinutes: 0,
    restwartezeitSeconds: 0
  },
  sehr_gefaehrlich: {
    channels: { push: true, email: true, sms: true, webPush: true, nativePush: true },
    requiresApproval: true,
    repeatCount: 'infinite',
    sequenceHours: 0,
    sequenceMinutes: 1,
    sequenceSeconds: 0,
    restwartezeitHours: 0,
    restwartezeitMinutes: 0,
    restwartezeitSeconds: 0
  }
};
```

## Code-Snapshot: Alarm Level Karte (Summary View)

```tsx
<Card className={`border ${getLevelBorderColor(level)}`}>
  <CardContent className="p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded ${getLevelColor(level)}`}></div>
        <span className="font-medium capitalize">
          {level === 'sehr_gefaehrlich' ? 'Sehr Gefährlich' : level.charAt(0).toUpperCase() + level.slice(1)}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setEditingAlarmLevel(level)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
    
    {/* Aktive Kanäle */}
    <div className="text-sm">
      <span className="font-medium">Aktive Kanäle: </span>
      <span className="text-muted-foreground">
        {getActiveChannelsText(config)}
      </span>
    </div>
    
    {/* Approval */}
    <div className="text-sm">
      <span className="font-medium">Approval: </span>
      <span className="text-muted-foreground">
        {config.requiresApproval ? 'Erforderlich' : 'Nicht erforderlich'}
      </span>
    </div>
    
    {/* Wiederholung */}
    <div className="text-sm">
      <span className="font-medium">Wiederholung: </span>
      <span className="text-muted-foreground">
        {config.repeatCount === 'infinite' ? '∞ (Bis Approval)' : `${config.repeatCount}x`}
      </span>
    </div>
    
    {/* Sequenz */}
    <div className="text-sm">
      <span className="font-medium">Sequenz: </span>
      <span className="text-muted-foreground">
        {config.sequenceHours}h {config.sequenceMinutes}m {config.sequenceSeconds}s
      </span>
    </div>
    
    {/* Restwartezeit - nur wenn Approval AUS */}
    {!config.requiresApproval && config.repeatCount !== 'infinite' && (
      <div className="text-sm">
        <span className="font-medium">Restwartezeit: </span>
        <span className="text-muted-foreground">
          {config.restwartezeitHours}h {config.restwartezeitMinutes}m {config.restwartezeitSeconds}s (Auto-Dismiss)
        </span>
      </div>
    )}
  </CardContent>
</Card>
```

## Code-Snapshot: Wiederholung Input (mit py-0.5 für Border-Fix)

```tsx
{/* Wiederholung */}
<div className="space-y-2 mb-3">
  <Label className="text-sm font-medium">Wiederholung</Label>
  <div className="flex items-center gap-2 py-0.5">
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={config.repeatCount === 'infinite' ? '' : config.repeatCount}
      onChange={(e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
          updateAlarmLevelConfig(level, 'repeatCount', val);
        } else if (e.target.value === '') {
          updateAlarmLevelConfig(level, 'repeatCount', 1);
        }
      }}
      placeholder="Anzahl"
      className="w-24"
      disabled={config.repeatCount === 'infinite'}
    />
    <Button
      variant={config.repeatCount === 'infinite' ? 'default' : 'outline'}
      size="sm"
      onClick={() => {
        if (config.repeatCount === 'infinite') {
          updateAlarmLevelConfig(level, 'repeatCount', 1);
        } else {
          updateAlarmLevelConfig(level, 'repeatCount', 'infinite');
          if (!config.requiresApproval) {
            updateAlarmLevelConfig(level, 'requiresApproval', true);
          }
        }
      }}
    >
      ∞ Unendlich
    </Button>
    <span className="text-xs text-muted-foreground">
      {config.repeatCount === 'infinite' ? 'Bis Approval' : `${config.repeatCount}x`}
    </span>
  </div>
</div>
```

## Wichtige Verhaltensregeln

1. **Infinite Safety:** Bei `repeatCount='infinite'` wird `requiresApproval` automatisch auf `true` gesetzt
2. **Restwartezeit Visibility:** Nur sichtbar wenn `requiresApproval=false` UND `repeatCount !== 'infinite'`
3. **Unified Push Toggle:** Ein Toggle kontrolliert beide Werte (`webPush` + `nativePush`)
4. **localStorage Persistence:** Alle Alarm-Level-Configs werden in localStorage unter `alarm-level-configs` gespeichert
5. **Dialog Speichern-Pflicht:** Änderungen werden nur durch explizites Klicken auf "Speichern" übernommen

## Geschützte Funktionen

- `updateAlarmLevelConfig(level, field, value)` - Update einzelner Felder
- `getActiveChannelsText(config)` - Generiert Text für aktive Kanäle
- `getLevelColor(level)` - Gibt Hintergrundfarbe für Level zurück
- `getLevelBorderColor(level)` - Gibt Border-Farbe für Level zurück

---

**WARNUNG:** Diese Section ist DIAMOND STATE. Jede Änderung ohne explizite User-Erlaubnis ist streng verboten.
