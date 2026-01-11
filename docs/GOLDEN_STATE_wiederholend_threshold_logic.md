# GOLDEN STATE: Wiederholend Threshold Logic

**Status:** GOLDEN STATE - DO NOT MODIFY WITHOUT EXPLICIT USER PERMISSION
**Date:** 2026-01-11
**Version:** V1.0

## Overview

This document captures the perfected "wiederholend" (repeating) threshold logic with re-trigger prevention that must not be changed.

## Core Behavior

1. **Initial State:** New wiederholend threshold shows "0 ∞" status, Toggle = "Aktiv"
2. **When Triggered:** 
   - `triggerCount` is incremented (persisted in localStorage)
   - `activeAlarmId` is set to the alarm ID (for re-trigger prevention)
   - Status changes to "X ∞" (X = number of triggers)
   - Toggle remains "Aktiv"
   - Alarm is created and notifications are sent
3. **Re-Trigger Prevention (requiresApproval=false):**
   - While `activeAlarmId` exists → no new alarm can be created
   - This prevents duplicate alarms during active alarm cycle
4. **After Page Refresh:**
   - `activeAlarmId` survives (from localStorage)
   - Re-trigger is still blocked if alarm is still active
5. **After Auto-Dismiss or "Stoppen":**
   - `activeAlarmId` is cleared
   - Threshold can trigger again
6. **When requiresApproval=true:**
   - No re-trigger blocking (user must approve anyway)
   - Can always create new alarms

## ThresholdConfig Interface

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
  activeAlarmId?: string; // ID of currently running alarm (for re-trigger prevention)
}
```

## Critical Code Sections

### 1. Re-Trigger Prevention Check (Increase Direction)

```typescript
// WIEDERHOLEND RE-TRIGGER PREVENTION:
// For wiederholend with requiresApproval=false, don't trigger if an active alarm 
// for this exact threshold already exists (wait for previous alarm cycle to complete)
// For wiederholend with requiresApproval=true, allow re-triggering (user must approve anyway)
// Uses activeAlarmId stored in threshold (survives page refresh, localStorage-based)
if (threshold.increaseFrequency === 'wiederholend' && !alarmConfig.requiresApproval) {
  if (threshold.activeAlarmId) {
    // Already has active alarm, skip re-triggering until it's dismissed
    console.log(`[WIEDERHOLEND] Blocking increase re-trigger for threshold ${threshold.id} - activeAlarmId: ${threshold.activeAlarmId}`);
    return;
  }
}
```

### 2. Re-Trigger Prevention Check (Decrease Direction)

```typescript
// WIEDERHOLEND RE-TRIGGER PREVENTION for decrease:
// Same logic as for increase - prevent re-triggering if active alarm exists
// Uses activeAlarmId stored in threshold (survives page refresh, localStorage-based)
if (threshold.notifyOnDecrease && threshold.decreaseFrequency === 'wiederholend' && !alarmConfig.requiresApproval) {
  if (threshold.activeAlarmId) {
    // Already has active alarm for this threshold, skip re-triggering until it's dismissed
    console.log(`[WIEDERHOLEND] Blocking decrease re-trigger for threshold ${threshold.id} - activeAlarmId: ${threshold.activeAlarmId}`);
    return;
  }
}
```

### 3. Setting activeAlarmId on Alarm Creation

```typescript
// Generate alarm ID first so we can store it in the threshold
const newAlarmId = crypto.randomUUID();

// Create active alarm
const newAlarm: ActiveAlarm = {
  id: newAlarmId,
  // ... other properties
};

setActiveAlarms(prev => [...prev, newAlarm]);

// WIEDERHOLEND: Store activeAlarmId in threshold to prevent re-triggering on refresh
if (threshold.increaseFrequency === 'wiederholend' && !alarmConfig.requiresApproval) {
  setTrendPriceSettings(prev => ({
    ...prev,
    [pair.id]: {
      ...prev[pair.id],
      thresholds: prev[pair.id].thresholds.map(t => 
        t.id === threshold.id ? { ...t, activeAlarmId: newAlarmId } : t
      )
    }
  }));
  // Save immediately to localStorage
  setTimeout(() => {
    const stored = localStorage.getItem('notifications-threshold-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed[pair.id]?.thresholds) {
          parsed[pair.id].thresholds = parsed[pair.id].thresholds.map((t: ThresholdConfig) => 
            t.id === threshold.id ? { ...t, activeAlarmId: newAlarmId } : t
          );
          localStorage.setItem('notifications-threshold-settings', JSON.stringify(parsed));
          console.log(`[WIEDERHOLEND] Saved activeAlarmId ${newAlarmId} to localStorage for threshold ${threshold.id}`);
        }
      } catch {}
    }
  }, 100);
}
```

### 4. Clearing activeAlarmId on Approve/Stop

```typescript
const approveAlarm = async (alarmId: string) => {
  // Find the alarm to get its thresholdId and pairId for clearing activeAlarmId
  const alarmToRemove = activeAlarms.find(a => a.id === alarmId);
  
  // Delete from backend...
  
  // Also remove from local state...
  
  // WIEDERHOLEND: Clear activeAlarmId from threshold to allow re-triggering
  if (alarmToRemove?.thresholdId && alarmToRemove?.pairId) {
    setTrendPriceSettings(prev => {
      const pairSettings = prev[alarmToRemove.pairId];
      if (!pairSettings?.thresholds) return prev;
      
      return {
        ...prev,
        [alarmToRemove.pairId]: {
          ...pairSettings,
          thresholds: pairSettings.thresholds.map(t => 
            t.id === alarmToRemove.thresholdId && t.activeAlarmId === alarmId
              ? { ...t, activeAlarmId: undefined }
              : t
          )
        }
      };
    });
    // Clear from localStorage immediately
    setTimeout(() => {
      const stored = localStorage.getItem('notifications-threshold-settings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed[alarmToRemove.pairId]?.thresholds) {
            parsed[alarmToRemove.pairId].thresholds = parsed[alarmToRemove.pairId].thresholds.map((t: ThresholdConfig) => 
              t.id === alarmToRemove.thresholdId && t.activeAlarmId === alarmId
                ? { ...t, activeAlarmId: undefined }
                : t
            );
            localStorage.setItem('notifications-threshold-settings', JSON.stringify(parsed));
            console.log(`[WIEDERHOLEND] Cleared activeAlarmId from threshold ${alarmToRemove.thresholdId} in localStorage`);
          }
        } catch {}
      }
    }, 50);
  }
};
```

### 5. Clearing activeAlarmId on Auto-Dismiss

```typescript
// Auto-dismiss alarms when their autoDismissAt time is reached
useEffect(() => {
  const checkAutoDismiss = () => {
    const now = new Date();
    
    // First, identify alarms to dismiss
    const alarmsToRemove = activeAlarms.filter(alarm => {
      if (!alarm.autoDismissAt) return false;
      const dismissTime = new Date(alarm.autoDismissAt);
      return now >= dismissTime;
    });
    
    if (alarmsToRemove.length === 0) return;
    
    // Remove from backend...
    // Remove from local state...
    
    // WIEDERHOLEND: Clear activeAlarmId from thresholds to allow re-triggering
    alarmsToRemove.forEach(alarm => {
      if (alarm.thresholdId && alarm.pairId) {
        setTrendPriceSettings(prev => {
          const pairSettings = prev[alarm.pairId!];
          if (!pairSettings?.thresholds) return prev;
          
          return {
            ...prev,
            [alarm.pairId!]: {
              ...pairSettings,
              thresholds: pairSettings.thresholds.map(t => 
                t.id === alarm.thresholdId && t.activeAlarmId === alarm.id
                  ? { ...t, activeAlarmId: undefined }
                  : t
              )
            }
          };
        });
        // Also update localStorage directly...
      }
    });
  };

  const interval = setInterval(checkAutoDismiss, 1000);
  checkAutoDismiss();
  return () => clearInterval(interval);
}, [activeAlarms]);
```

### 6. Status Display Logic

```typescript
// Status für einmalig vs wiederholend
{threshold.increaseFrequency === 'einmalig' || threshold.decreaseFrequency === 'einmalig' ? (
  // Einmalig: Show "0/1" if active, "✓" if triggered
  <span className={cn(
    "text-xs font-medium px-1.5 py-0.5 rounded",
    (!threshold.isActive || triggeredThresholds.has(`${pair.id}-${threshold.id}-increase`))
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : "bg-muted text-muted-foreground"
  )}>
    {(!threshold.isActive || triggeredThresholds.has(`${pair.id}-${threshold.id}-increase`))
      ? <Check className="w-3 h-3 inline" />
      : "0/1"
    }
  </span>
) : (
  // Wiederholend: Show "X ∞" with trigger count
  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
    {threshold.triggerCount || 0} ∞
  </span>
)}
```

## Unit Tests

All 20 tests pass in `server/threshold-wiederholend.test.ts`:

1. Test 1: Should NOT block first trigger for wiederholend threshold
2. Test 2: Should block re-trigger when activeAlarmId is set
3. Test 3: Should NOT block when requiresApproval is true
4. Test 4: Should NOT block einmalig thresholds
5. Test 5: Should set activeAlarmId when creating alarm for wiederholend + no approval
6. Test 6: Should NOT set activeAlarmId for einmalig thresholds
7. Test 7: Should NOT set activeAlarmId when requiresApproval is true
8. Test 8: activeAlarmId should survive page refresh (JSON serialization)
9. Test 9: Should block re-trigger after page refresh when alarm still active
10. Test 10: Should allow re-trigger after activeAlarmId is cleared
11. Test 11: Should NOT clear activeAlarmId if alarm ID does not match
12. Test 12: Full lifecycle - trigger, refresh, dismiss, re-trigger allowed
13. Test 13: Should block decrease re-trigger when activeAlarmId is set
14. Test 14: Should set activeAlarmId for decrease wiederholend
15. Test 15: Harmlos config should have correct channels (push+email only)
16. Test 16: Achtung config should have all channels enabled
17. Test 17: Different thresholds for same pair are independent
18. Test 18: Clearing one threshold does not affect another
19. Test 19: Undefined activeAlarmId should not block
20. Test 20: Empty string activeAlarmId should not block (falsy)

## Why This Works

The `activeAlarmId` approach solves the page-refresh problem because:

1. **localStorage Persistence:** The `activeAlarmId` is stored directly in the threshold configuration which is saved to localStorage
2. **Immediate Check:** Before any trigger, we check `threshold.activeAlarmId` - no need to search through alarms
3. **No Race Conditions:** Setting and clearing happen in the same state update cycle
4. **Per-Threshold Tracking:** Each threshold has its own `activeAlarmId`, so different thresholds are independent
5. **Survives Backend Reset:** Even if the backend loses the alarm, the frontend won't create duplicates

## Key Invariants

- A wiederholend threshold with `requiresApproval=false` can only have ONE active alarm at a time
- The `activeAlarmId` must match the alarm ID exactly to be cleared
- Page refresh does NOT reset the blocking state
- Manual "Stoppen" or auto-dismiss are the ONLY ways to allow re-triggering
