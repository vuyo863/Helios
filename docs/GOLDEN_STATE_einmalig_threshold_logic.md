# GOLDEN STATE: Einmalig Threshold Logic

**Status:** GOLDEN STATE - DO NOT MODIFY WITHOUT EXPLICIT USER PERMISSION
**Date:** 2026-01-11
**Commit:** 8eff9f6d6e29ba5de083a52f61ee9eba16446a1c

## Overview

This document captures the perfected "einmalig" (one-time) threshold logic that must not be changed.

## Core Behavior

1. **Initial State:** New einmalig threshold shows "0/1" status, Toggle = "Aktiv"
2. **When Triggered:** 
   - `isActive` is set to `false` (persisted in localStorage)
   - Status changes to "✓" (green checkmark)
   - Toggle switches to "Pause"
   - Threshold is skipped in future trigger checks
3. **After Page Refresh:**
   - Toggle remains on "Pause" (from localStorage)
   - Status correctly shows "✓" (based on `isActive === false`)
4. **Re-enabling:**
   - User toggles back to "Aktiv"
   - Status resets to "0/1"
   - Threshold can trigger again

## Critical Code Sections

### 1. ThresholdConfig Interface (Line ~35)
```typescript
interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: AlarmLevel;
  note: string;
  isActive: boolean;
  triggerCount?: number;
}
```

### 2. Skip Inactive Thresholds (Line ~751)
```typescript
// Skip if threshold is inactive (paused or already triggered einmalig)
if (threshold.isActive === false) return;
```

### 3. Single State Update for Trigger (Lines ~774-793)
```typescript
// IMPORTANT: Single state update to prevent race conditions
// Handle both einmalig (deactivate) and wiederholend (increment counter) in ONE update
setTrendPriceSettings(prev => ({
  ...prev,
  [pair.id]: {
    ...prev[pair.id],
    thresholds: prev[pair.id].thresholds.map(t => {
      if (t.id !== threshold.id) return t;
      // For einmalig: set isActive to false
      if (threshold.increaseFrequency === 'einmalig') {
        return { ...t, isActive: false };
      }
      // For wiederholend: increment trigger counter
      if (threshold.increaseFrequency === 'wiederholend') {
        return { ...t, triggerCount: (t.triggerCount || 0) + 1 };
      }
      return t;
    })
  }
}));
```

### 4. Status Display Logic (Lines ~3073-3097)
```typescript
} else {
  // Einmalig: Check if triggered
  // IMPORTANT: Use isActive===false as primary indicator (persists in localStorage)
  // triggeredThresholds is only for current session (not persisted)
  const wasTriggeredAndDeactivated = threshold.isActive === false;
  const isTriggeredInSession = Array.from(triggeredThresholds).some(key => key.includes(threshold.id));
  
  if (wasTriggeredAndDeactivated || isTriggeredInSession) {
    // Already triggered: Green checkmark
    return (
      <span className="text-sm font-medium text-green-500" title="Einmalig - Ausgelöst">
        ✓
      </span>
    );
  } else {
    // Not yet triggered: 0/1
    return (
      <span className="text-sm font-medium text-muted-foreground" title="Einmalig - Noch nicht ausgelöst">
        0/1
      </span>
    );
  }
}
```

### 5. Default Frequency Values
New thresholds default to `'einmalig'` for both increase and decrease frequencies.

## Unit Tests

All 10 einmalig tests pass in `server/threshold-einmalig.test.ts`:
- Test 1: New threshold has isActive=true, not triggered
- Test 2: When triggered, isActive becomes false
- Test 3: Re-enable resets triggered status
- Test 4: Inactive threshold is skipped
- Test 5: Full cycle - create, trigger, deactivate, reactivate
- Test 6: Wiederholend does NOT deactivate (contrast test)
- Test 7: Multiple thresholds - only triggered one deactivates
- Test 8: Decrease threshold with einmalig
- Test 9: Re-enable clears trigger keys
- Test 10: Complete scenario with alarm creation

## Key Design Decisions

1. **isActive as Primary Source of Truth:** The `isActive` field persists in localStorage, making it the reliable indicator after page refresh.

2. **Single State Update:** Both isActive and triggerCount updates happen in ONE `setTrendPriceSettings` call to prevent race conditions.

3. **Dual Check for Status Display:** Checks both `isActive === false` (persisted) AND `triggeredThresholds` (session) to handle both post-refresh and current-session scenarios.

4. **No Auto-Close on Trigger:** Dialog remains open when threshold triggers; user must explicitly close.

---

**WARNING:** This code is in Golden State. Any modifications require explicit user permission.
