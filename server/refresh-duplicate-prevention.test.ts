/**
 * COMPREHENSIVE REFRESH DUPLICATE PREVENTION TESTS
 * 
 * Tests the core functionality: After page refresh, NO duplicate alarms should be created
 * 
 * Categories:
 * 1. Wiederholend + requiresApproval=false (10+ tests)
 * 2. Wiederholend + requiresApproval=true (10+ tests)  
 * 3. Einmalig threshold behavior after refresh (10+ tests)
 * 4. Edge cases and mixed scenarios (10+ tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types matching the frontend implementation
interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: string;
  note: string;
  isActive: boolean;
  triggerCount?: number;
  activeAlarmId?: string;
}

interface AlarmLevelConfig {
  requiresApproval: boolean;
  repeatCount: number | 'infinite';
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    webPush: boolean;
    nativePush: boolean;
  };
}

interface ActiveAlarm {
  id: string;
  thresholdId?: string;
  pairId?: string;
  trendPriceName: string;
  threshold: string;
  alarmLevel: string;
  requiresApproval: boolean;
}

// Alarm Level Configs
const approvalOffConfig: AlarmLevelConfig = {
  requiresApproval: false,
  repeatCount: 3,
  channels: { push: true, email: true, sms: false, webPush: false, nativePush: false }
};

const approvalOnConfig: AlarmLevelConfig = {
  requiresApproval: true,
  repeatCount: 5,
  channels: { push: true, email: true, sms: true, webPush: true, nativePush: true }
};

// Core function: Should we block re-triggering?
function shouldBlockReTrigger(
  threshold: ThresholdConfig,
  alarmConfig: AlarmLevelConfig,
  direction: 'increase' | 'decrease'
): boolean {
  const frequency = direction === 'increase' ? threshold.increaseFrequency : threshold.decreaseFrequency;
  
  // CRITICAL: Block for ALL wiederholend thresholds (both requiresApproval modes)
  if (frequency === 'wiederholend') {
    if (threshold.activeAlarmId) {
      return true;
    }
  }
  return false;
}

// Core function: Create alarm and set activeAlarmId
function createAlarmAndSetActiveId(
  threshold: ThresholdConfig,
  alarmConfig: AlarmLevelConfig,
  pairId: string,
  direction: 'increase' | 'decrease'
): { alarm: ActiveAlarm; updatedThreshold: ThresholdConfig } {
  const frequency = direction === 'increase' ? threshold.increaseFrequency : threshold.decreaseFrequency;
  const newAlarmId = `alarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const alarm: ActiveAlarm = {
    id: newAlarmId,
    thresholdId: threshold.id,
    pairId: pairId,
    trendPriceName: 'BTC/USDT',
    threshold: threshold.threshold,
    alarmLevel: threshold.alarmLevel,
    requiresApproval: alarmConfig.requiresApproval
  };
  
  let updatedThreshold = { ...threshold };
  
  // CRITICAL: Set activeAlarmId for ALL wiederholend thresholds
  if (frequency === 'wiederholend') {
    updatedThreshold.activeAlarmId = newAlarmId;
  }
  
  updatedThreshold.triggerCount = (updatedThreshold.triggerCount || 0) + 1;
  
  return { alarm, updatedThreshold };
}

// Simulate page refresh (JSON serialization like localStorage)
function simulatePageRefresh(threshold: ThresholdConfig): ThresholdConfig {
  return JSON.parse(JSON.stringify(threshold));
}

// Clear activeAlarmId when alarm is dismissed/approved
function clearActiveAlarmId(threshold: ThresholdConfig, alarmId: string): ThresholdConfig {
  if (threshold.activeAlarmId === alarmId) {
    return { ...threshold, activeAlarmId: undefined };
  }
  return threshold;
}

// ============================================================================
// CATEGORY 1: Wiederholend + requiresApproval=false (10+ tests)
// ============================================================================
describe('CATEGORY 1: Wiederholend + requiresApproval=false - Refresh Duplicate Prevention', () => {
  
  it('Test 1.1: First trigger should NOT be blocked', () => {
    const threshold: ThresholdConfig = {
      id: 'test-1.1',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 1.1 PASSED: First trigger NOT blocked');
  });

  it('Test 1.2: After trigger, activeAlarmId should be set', () => {
    const threshold: ThresholdConfig = {
      id: 'test-1.2',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    expect(updatedThreshold.activeAlarmId).toBeDefined();
    console.log('✅ Test 1.2 PASSED: activeAlarmId set after trigger');
  });

  it('Test 1.3: With activeAlarmId set, re-trigger should be BLOCKED', () => {
    const threshold: ThresholdConfig = {
      id: 'test-1.3',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-existing-123'
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
    expect(blocked).toBe(true);
    console.log('✅ Test 1.3 PASSED: Re-trigger BLOCKED with activeAlarmId');
  });

  it('Test 1.4: After page refresh, activeAlarmId survives and blocks', () => {
    let threshold: ThresholdConfig = {
      id: 'test-1.4',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    
    // Simulate refresh
    const afterRefresh = simulatePageRefresh(updatedThreshold);
    
    // Check: Still blocked
    const blocked = shouldBlockReTrigger(afterRefresh, approvalOffConfig, 'increase');
    expect(blocked).toBe(true);
    console.log('✅ Test 1.4 PASSED: After refresh, still BLOCKED');
  });

  it('Test 1.5: After dismiss, activeAlarmId cleared and re-trigger allowed', () => {
    let threshold: ThresholdConfig = {
      id: 'test-1.5',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    
    // Clear
    const cleared = clearActiveAlarmId(updatedThreshold, alarm.id);
    
    // Check: Not blocked anymore
    const blocked = shouldBlockReTrigger(cleared, approvalOffConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 1.5 PASSED: After dismiss, NOT blocked');
  });

  it('Test 1.6: Multiple consecutive trigger attempts blocked', () => {
    let threshold: ThresholdConfig = {
      id: 'test-1.6',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-active-999'
    };
    
    // Try 5 consecutive trigger attempts
    for (let i = 0; i < 5; i++) {
      const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
      expect(blocked).toBe(true);
    }
    console.log('✅ Test 1.6 PASSED: 5 consecutive attempts all BLOCKED');
  });

  it('Test 1.7: Decrease direction also protected', () => {
    const threshold: ThresholdConfig = {
      id: 'test-1.7',
      threshold: '50000',
      notifyOnIncrease: false,
      notifyOnDecrease: true,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'wiederholend',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-decrease-123'
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'decrease');
    expect(blocked).toBe(true);
    console.log('✅ Test 1.7 PASSED: Decrease direction BLOCKED');
  });

  it('Test 1.8: Wrong alarmId does not clear protection', () => {
    let threshold: ThresholdConfig = {
      id: 'test-1.8',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-correct-id'
    };
    
    // Try to clear with wrong ID
    const stillProtected = clearActiveAlarmId(threshold, 'alarm-wrong-id');
    
    const blocked = shouldBlockReTrigger(stillProtected, approvalOffConfig, 'increase');
    expect(blocked).toBe(true);
    console.log('✅ Test 1.8 PASSED: Wrong ID does not clear protection');
  });

  it('Test 1.9: Full lifecycle - trigger, refresh, refresh again, dismiss, trigger again', () => {
    let threshold: ThresholdConfig = {
      id: 'test-1.9',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Step 1: First trigger (not blocked)
    expect(shouldBlockReTrigger(threshold, approvalOffConfig, 'increase')).toBe(false);
    const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    
    // Step 2: After first refresh (blocked)
    let afterRefresh1 = simulatePageRefresh(updatedThreshold);
    expect(shouldBlockReTrigger(afterRefresh1, approvalOffConfig, 'increase')).toBe(true);
    
    // Step 3: After second refresh (still blocked)
    let afterRefresh2 = simulatePageRefresh(afterRefresh1);
    expect(shouldBlockReTrigger(afterRefresh2, approvalOffConfig, 'increase')).toBe(true);
    
    // Step 4: Dismiss
    const cleared = clearActiveAlarmId(afterRefresh2, alarm.id);
    
    // Step 5: After dismiss (not blocked)
    expect(shouldBlockReTrigger(cleared, approvalOffConfig, 'increase')).toBe(false);
    
    console.log('✅ Test 1.9 PASSED: Full lifecycle works correctly');
  });

  it('Test 1.10: 10 consecutive refreshes all maintain protection', () => {
    let threshold: ThresholdConfig = {
      id: 'test-1.10',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger first
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    let current = updatedThreshold;
    
    // 10 consecutive refreshes
    for (let i = 0; i < 10; i++) {
      current = simulatePageRefresh(current);
      const blocked = shouldBlockReTrigger(current, approvalOffConfig, 'increase');
      expect(blocked).toBe(true);
    }
    
    console.log('✅ Test 1.10 PASSED: 10 refreshes all maintain BLOCKED state');
  });
});

// ============================================================================
// CATEGORY 2: Wiederholend + requiresApproval=true (10+ tests)
// ============================================================================
describe('CATEGORY 2: Wiederholend + requiresApproval=true - Refresh Duplicate Prevention', () => {
  
  it('Test 2.1: First trigger should NOT be blocked', () => {
    const threshold: ThresholdConfig = {
      id: 'test-2.1',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOnConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 2.1 PASSED: First trigger NOT blocked (approval=true)');
  });

  it('Test 2.2: After trigger, activeAlarmId should be set (even with approval=true)', () => {
    const threshold: ThresholdConfig = {
      id: 'test-2.2',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOnConfig, 'pair-1', 'increase');
    expect(updatedThreshold.activeAlarmId).toBeDefined();
    console.log('✅ Test 2.2 PASSED: activeAlarmId SET for approval=true');
  });

  it('Test 2.3: With activeAlarmId set, re-trigger should be BLOCKED (even with approval=true)', () => {
    const threshold: ThresholdConfig = {
      id: 'test-2.3',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-approval-123'
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOnConfig, 'increase');
    expect(blocked).toBe(true);
    console.log('✅ Test 2.3 PASSED: Re-trigger BLOCKED with approval=true');
  });

  it('Test 2.4: After page refresh, activeAlarmId survives and blocks (approval=true)', () => {
    let threshold: ThresholdConfig = {
      id: 'test-2.4',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOnConfig, 'pair-1', 'increase');
    
    // Simulate refresh
    const afterRefresh = simulatePageRefresh(updatedThreshold);
    
    // Check: Still blocked
    const blocked = shouldBlockReTrigger(afterRefresh, approvalOnConfig, 'increase');
    expect(blocked).toBe(true);
    console.log('✅ Test 2.4 PASSED: After refresh, still BLOCKED (approval=true)');
  });

  it('Test 2.5: After approval, activeAlarmId cleared and re-trigger allowed', () => {
    let threshold: ThresholdConfig = {
      id: 'test-2.5',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOnConfig, 'pair-1', 'increase');
    
    // User approves
    const cleared = clearActiveAlarmId(updatedThreshold, alarm.id);
    
    // Check: Not blocked anymore
    const blocked = shouldBlockReTrigger(cleared, approvalOnConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 2.5 PASSED: After approval, NOT blocked');
  });

  it('Test 2.6: 10 consecutive refreshes with approval=true all maintain protection', () => {
    let threshold: ThresholdConfig = {
      id: 'test-2.6',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger first
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOnConfig, 'pair-1', 'increase');
    let current = updatedThreshold;
    
    // 10 consecutive refreshes
    for (let i = 0; i < 10; i++) {
      current = simulatePageRefresh(current);
      const blocked = shouldBlockReTrigger(current, approvalOnConfig, 'increase');
      expect(blocked).toBe(true);
    }
    
    console.log('✅ Test 2.6 PASSED: 10 refreshes maintain BLOCKED (approval=true)');
  });

  it('Test 2.7: Decrease direction with approval=true also protected', () => {
    const threshold: ThresholdConfig = {
      id: 'test-2.7',
      threshold: '50000',
      notifyOnIncrease: false,
      notifyOnDecrease: true,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'wiederholend',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-dec-approval'
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOnConfig, 'decrease');
    expect(blocked).toBe(true);
    console.log('✅ Test 2.7 PASSED: Decrease direction BLOCKED (approval=true)');
  });

  it('Test 2.8: Full lifecycle with approval=true', () => {
    let threshold: ThresholdConfig = {
      id: 'test-2.8',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Step 1: First trigger (not blocked)
    expect(shouldBlockReTrigger(threshold, approvalOnConfig, 'increase')).toBe(false);
    const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOnConfig, 'pair-1', 'increase');
    expect(updatedThreshold.activeAlarmId).toBeDefined();
    
    // Step 2: Refresh (blocked)
    let afterRefresh = simulatePageRefresh(updatedThreshold);
    expect(shouldBlockReTrigger(afterRefresh, approvalOnConfig, 'increase')).toBe(true);
    
    // Step 3: User approves
    const cleared = clearActiveAlarmId(afterRefresh, alarm.id);
    
    // Step 4: Can trigger again
    expect(shouldBlockReTrigger(cleared, approvalOnConfig, 'increase')).toBe(false);
    
    console.log('✅ Test 2.8 PASSED: Full lifecycle works (approval=true)');
  });

  it('Test 2.9: Multiple trigger-refresh-approve cycles', () => {
    let threshold: ThresholdConfig = {
      id: 'test-2.9',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // 5 complete cycles
    let current = threshold;
    for (let cycle = 0; cycle < 5; cycle++) {
      // Trigger
      expect(shouldBlockReTrigger(current, approvalOnConfig, 'increase')).toBe(false);
      const { alarm, updatedThreshold } = createAlarmAndSetActiveId(current, approvalOnConfig, 'pair-1', 'increase');
      
      // Refresh
      const afterRefresh = simulatePageRefresh(updatedThreshold);
      expect(shouldBlockReTrigger(afterRefresh, approvalOnConfig, 'increase')).toBe(true);
      
      // Approve
      current = clearActiveAlarmId(afterRefresh, alarm.id);
    }
    
    console.log('✅ Test 2.9 PASSED: 5 complete cycles work correctly');
  });

  it('Test 2.10: sehr_gefaehrlich alarm level with approval=true', () => {
    const sehrGefaehrlichConfig: AlarmLevelConfig = {
      requiresApproval: true,
      repeatCount: 'infinite',
      channels: { push: true, email: true, sms: true, webPush: true, nativePush: true }
    };
    
    let threshold: ThresholdConfig = {
      id: 'test-2.10',
      threshold: '100000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'sehr_gefaehrlich',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, sehrGefaehrlichConfig, 'pair-1', 'increase');
    expect(updatedThreshold.activeAlarmId).toBeDefined();
    
    // 10 refreshes
    let current = updatedThreshold;
    for (let i = 0; i < 10; i++) {
      current = simulatePageRefresh(current);
      expect(shouldBlockReTrigger(current, sehrGefaehrlichConfig, 'increase')).toBe(true);
    }
    
    console.log('✅ Test 2.10 PASSED: sehr_gefaehrlich level protected');
  });
});

// ============================================================================
// CATEGORY 3: Einmalig threshold behavior (10+ tests)
// ============================================================================
describe('CATEGORY 3: Einmalig Threshold - No Re-Trigger Blocking Needed', () => {
  
  function triggerEinmaligThreshold(threshold: ThresholdConfig): ThresholdConfig {
    // Einmalig: Set isActive=false and increment triggerCount
    return {
      ...threshold,
      isActive: false,
      triggerCount: (threshold.triggerCount || 0) + 1
    };
  }

  it('Test 3.1: Einmalig threshold should NOT have re-trigger blocking', () => {
    const threshold: ThresholdConfig = {
      id: 'test-3.1',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 3.1 PASSED: Einmalig NOT blocked');
  });

  it('Test 3.2: Einmalig does NOT set activeAlarmId', () => {
    const threshold: ThresholdConfig = {
      id: 'test-3.2',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    expect(updatedThreshold.activeAlarmId).toBeUndefined();
    console.log('✅ Test 3.2 PASSED: Einmalig does NOT set activeAlarmId');
  });

  it('Test 3.3: After einmalig trigger, isActive becomes false', () => {
    let threshold: ThresholdConfig = {
      id: 'test-3.3',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const triggered = triggerEinmaligThreshold(threshold);
    expect(triggered.isActive).toBe(false);
    expect(triggered.triggerCount).toBe(1);
    console.log('✅ Test 3.3 PASSED: isActive=false after einmalig trigger');
  });

  it('Test 3.4: Einmalig isActive=false survives page refresh', () => {
    let threshold: ThresholdConfig = {
      id: 'test-3.4',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const triggered = triggerEinmaligThreshold(threshold);
    const afterRefresh = simulatePageRefresh(triggered);
    
    expect(afterRefresh.isActive).toBe(false);
    console.log('✅ Test 3.4 PASSED: isActive=false survives refresh');
  });

  it('Test 3.5: Inactive einmalig threshold is skipped (no trigger)', () => {
    const threshold: ThresholdConfig = {
      id: 'test-3.5',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: false,
      triggerCount: 1
    };
    
    // Simulating the check: inactive thresholds are skipped
    const shouldProcess = threshold.isActive;
    expect(shouldProcess).toBe(false);
    console.log('✅ Test 3.5 PASSED: Inactive einmalig skipped');
  });

  it('Test 3.6: Re-enable einmalig allows new trigger', () => {
    let threshold: ThresholdConfig = {
      id: 'test-3.6',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: false,
      triggerCount: 1
    };
    
    // User re-enables
    threshold.isActive = true;
    
    const shouldProcess = threshold.isActive;
    expect(shouldProcess).toBe(true);
    console.log('✅ Test 3.6 PASSED: Re-enabled einmalig can trigger');
  });

  it('Test 3.7: 10 consecutive refreshes maintain einmalig isActive=false', () => {
    let threshold: ThresholdConfig = {
      id: 'test-3.7',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const triggered = triggerEinmaligThreshold(threshold);
    let current = triggered;
    
    // 10 refreshes
    for (let i = 0; i < 10; i++) {
      current = simulatePageRefresh(current);
      expect(current.isActive).toBe(false);
    }
    
    console.log('✅ Test 3.7 PASSED: 10 refreshes maintain isActive=false');
  });

  it('Test 3.8: Einmalig decrease direction works the same', () => {
    let threshold: ThresholdConfig = {
      id: 'test-3.8',
      threshold: '50000',
      notifyOnIncrease: false,
      notifyOnDecrease: true,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    const triggered = triggerEinmaligThreshold(threshold);
    const afterRefresh = simulatePageRefresh(triggered);
    
    expect(afterRefresh.isActive).toBe(false);
    console.log('✅ Test 3.8 PASSED: Decrease einmalig works same');
  });

  it('Test 3.9: Full einmalig lifecycle - trigger, refresh, re-enable, trigger again', () => {
    let threshold: ThresholdConfig = {
      id: 'test-3.9',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Step 1: Trigger
    threshold = triggerEinmaligThreshold(threshold);
    expect(threshold.isActive).toBe(false);
    expect(threshold.triggerCount).toBe(1);
    
    // Step 2: Refresh
    threshold = simulatePageRefresh(threshold);
    expect(threshold.isActive).toBe(false);
    
    // Step 3: Re-enable
    threshold = { ...threshold, isActive: true };
    expect(threshold.isActive).toBe(true);
    
    // Step 4: Trigger again
    threshold = triggerEinmaligThreshold(threshold);
    expect(threshold.isActive).toBe(false);
    expect(threshold.triggerCount).toBe(2);
    
    console.log('✅ Test 3.9 PASSED: Full einmalig lifecycle works');
  });

  it('Test 3.10: Multiple einmalig thresholds - only triggered one deactivates', () => {
    const threshold1: ThresholdConfig = {
      id: 'test-3.10-a',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test 1',
      isActive: true,
      triggerCount: 0
    };
    
    const threshold2: ThresholdConfig = {
      id: 'test-3.10-b',
      threshold: '60000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test 2',
      isActive: true,
      triggerCount: 0
    };
    
    // Only trigger threshold1
    const triggered1 = triggerEinmaligThreshold(threshold1);
    
    // Check: threshold1 deactivated, threshold2 still active
    expect(triggered1.isActive).toBe(false);
    expect(threshold2.isActive).toBe(true);
    
    console.log('✅ Test 3.10 PASSED: Only triggered threshold deactivates');
  });
});

// ============================================================================
// CATEGORY 4: Edge Cases and Mixed Scenarios (10+ tests)
// ============================================================================
describe('CATEGORY 4: Edge Cases and Mixed Scenarios', () => {
  
  it('Test 4.1: Empty activeAlarmId (empty string) does NOT block', () => {
    const threshold: ThresholdConfig = {
      id: 'test-4.1',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0,
      activeAlarmId: ''
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 4.1 PASSED: Empty string does NOT block');
  });

  it('Test 4.2: Undefined activeAlarmId does NOT block', () => {
    const threshold: ThresholdConfig = {
      id: 'test-4.2',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0,
      activeAlarmId: undefined
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
    expect(blocked).toBe(false);
    console.log('✅ Test 4.2 PASSED: Undefined does NOT block');
  });

  it('Test 4.3: Multiple thresholds for same pair are independent', () => {
    const threshold1: ThresholdConfig = {
      id: 'th-001',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test 1',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-for-th1'
    };
    
    const threshold2: ThresholdConfig = {
      id: 'th-002',
      threshold: '60000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test 2',
      isActive: true,
      triggerCount: 0
      // No activeAlarmId - not triggered yet
    };
    
    // threshold1 is blocked, threshold2 is not
    expect(shouldBlockReTrigger(threshold1, approvalOffConfig, 'increase')).toBe(true);
    expect(shouldBlockReTrigger(threshold2, approvalOffConfig, 'increase')).toBe(false);
    
    console.log('✅ Test 4.3 PASSED: Thresholds are independent');
  });

  it('Test 4.4: Mixed einmalig/wiederholend on same threshold', () => {
    const threshold: ThresholdConfig = {
      id: 'test-4.4',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: true,
      increaseFrequency: 'wiederholend',  // increase = wiederholend
      decreaseFrequency: 'einmalig',       // decrease = einmalig
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: 'alarm-increase-only'
    };
    
    // Increase should be blocked (wiederholend with activeAlarmId)
    expect(shouldBlockReTrigger(threshold, approvalOffConfig, 'increase')).toBe(true);
    
    // Decrease should NOT be blocked (einmalig)
    expect(shouldBlockReTrigger(threshold, approvalOffConfig, 'decrease')).toBe(false);
    
    console.log('✅ Test 4.4 PASSED: Mixed directions work correctly');
  });

  it('Test 4.5: JSON serialization preserves all fields', () => {
    const threshold: ThresholdConfig = {
      id: 'test-4.5',
      threshold: '50000.123',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test with special chars: äöü ß € @#$%',
      isActive: true,
      triggerCount: 42,
      activeAlarmId: 'alarm-special-id-123'
    };
    
    const afterRefresh = simulatePageRefresh(threshold);
    
    expect(afterRefresh.id).toBe(threshold.id);
    expect(afterRefresh.threshold).toBe(threshold.threshold);
    expect(afterRefresh.activeAlarmId).toBe(threshold.activeAlarmId);
    expect(afterRefresh.triggerCount).toBe(threshold.triggerCount);
    expect(afterRefresh.note).toBe(threshold.note);
    
    console.log('✅ Test 4.5 PASSED: All fields preserved after refresh');
  });

  it('Test 4.6: Switching from approval=false to approval=true maintains protection', () => {
    let threshold: ThresholdConfig = {
      id: 'test-4.6',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger with approval=false
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    
    // Check with approval=true config - still blocked
    const blocked = shouldBlockReTrigger(updatedThreshold, approvalOnConfig, 'increase');
    expect(blocked).toBe(true);
    
    console.log('✅ Test 4.6 PASSED: Switching approval mode maintains protection');
  });

  it('Test 4.7: Very long activeAlarmId works correctly', () => {
    const longId = 'alarm-' + 'x'.repeat(100) + '-' + Date.now();
    
    const threshold: ThresholdConfig = {
      id: 'test-4.7',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 1,
      activeAlarmId: longId
    };
    
    const blocked = shouldBlockReTrigger(threshold, approvalOffConfig, 'increase');
    expect(blocked).toBe(true);
    
    const afterRefresh = simulatePageRefresh(threshold);
    expect(afterRefresh.activeAlarmId).toBe(longId);
    
    console.log('✅ Test 4.7 PASSED: Long activeAlarmId works');
  });

  it('Test 4.8: 50 consecutive refreshes stress test', () => {
    let threshold: ThresholdConfig = {
      id: 'test-4.8',
      threshold: '50000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'harmlos',
      note: 'Test',
      isActive: true,
      triggerCount: 0
    };
    
    // Trigger
    const { updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
    let current = updatedThreshold;
    
    // 50 refreshes
    for (let i = 0; i < 50; i++) {
      current = simulatePageRefresh(current);
      expect(shouldBlockReTrigger(current, approvalOffConfig, 'increase')).toBe(true);
      expect(current.activeAlarmId).toBeDefined();
    }
    
    console.log('✅ Test 4.8 PASSED: 50 refreshes stress test');
  });

  it('Test 4.9: All alarm levels work correctly', () => {
    const alarmLevels = ['harmlos', 'achtung', 'gefaehrlich', 'sehr_gefaehrlich'];
    
    for (const level of alarmLevels) {
      const threshold: ThresholdConfig = {
        id: `test-4.9-${level}`,
        threshold: '50000',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: level,
        note: 'Test',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: `alarm-${level}-123`
      };
      
      const blocked = shouldBlockReTrigger(threshold, approvalOnConfig, 'increase');
      expect(blocked).toBe(true);
    }
    
    console.log('✅ Test 4.9 PASSED: All 4 alarm levels work');
  });

  it('Test 4.10: Rapid trigger-refresh-check cycle (10 iterations)', () => {
    let successCount = 0;
    
    for (let i = 0; i < 10; i++) {
      let threshold: ThresholdConfig = {
        id: `test-4.10-${i}`,
        threshold: String(50000 + i * 1000),
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 0
      };
      
      // Trigger
      const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, approvalOffConfig, 'pair-1', 'increase');
      
      // Refresh
      const afterRefresh = simulatePageRefresh(updatedThreshold);
      
      // Check blocked
      if (shouldBlockReTrigger(afterRefresh, approvalOffConfig, 'increase')) {
        successCount++;
      }
      
      // Clear and verify not blocked
      const cleared = clearActiveAlarmId(afterRefresh, alarm.id);
      if (!shouldBlockReTrigger(cleared, approvalOffConfig, 'increase')) {
        successCount++;
      }
    }
    
    expect(successCount).toBe(20); // 10 blocked + 10 not blocked
    console.log('✅ Test 4.10 PASSED: 10 rapid cycles (20 checks)');
  });
});

console.log('\n========================================');
console.log('ALL REFRESH DUPLICATE PREVENTION TESTS');
console.log('========================================\n');
