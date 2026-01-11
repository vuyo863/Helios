import { describe, it, expect, beforeEach } from 'vitest';

interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich';
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

const harmlosConfig: AlarmLevelConfig = {
  requiresApproval: false,
  repeatCount: 3,
  channels: {
    push: true,
    email: true,
    sms: false,
    webPush: false,
    nativePush: false
  }
};

const achtungConfig: AlarmLevelConfig = {
  requiresApproval: true,
  repeatCount: 5,
  channels: {
    push: true,
    email: true,
    sms: true,
    webPush: true,
    nativePush: true
  }
};

function shouldBlockReTrigger(
  threshold: ThresholdConfig,
  alarmConfig: AlarmLevelConfig,
  direction: 'increase' | 'decrease'
): boolean {
  const frequency = direction === 'increase' ? threshold.increaseFrequency : threshold.decreaseFrequency;
  
  // UPDATED: Block re-trigger for ALL wiederholend thresholds (both requiresApproval=true and false)
  // This prevents duplicate alarms after page refresh regardless of approval setting
  if (frequency === 'wiederholend') {
    if (threshold.activeAlarmId) {
      return true;
    }
  }
  return false;
}

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
    trendPriceName: 'ETH/USDT',
    threshold: threshold.threshold,
    alarmLevel: threshold.alarmLevel,
    requiresApproval: alarmConfig.requiresApproval
  };
  
  let updatedThreshold = { ...threshold };
  
  // UPDATED: Set activeAlarmId for ALL wiederholend thresholds (both requiresApproval=true and false)
  // This prevents duplicate alarms after page refresh regardless of approval setting
  if (frequency === 'wiederholend') {
    updatedThreshold.activeAlarmId = newAlarmId;
  }
  
  updatedThreshold.triggerCount = (updatedThreshold.triggerCount || 0) + 1;
  
  return { alarm, updatedThreshold };
}

function clearActiveAlarmId(threshold: ThresholdConfig, alarmId: string): ThresholdConfig {
  if (threshold.activeAlarmId === alarmId) {
    return { ...threshold, activeAlarmId: undefined };
  }
  return threshold;
}

function simulatePageRefresh(threshold: ThresholdConfig): ThresholdConfig {
  return JSON.parse(JSON.stringify(threshold));
}

describe('Wiederholend Re-Trigger Prevention - activeAlarmId based', () => {
  
  describe('Basic Blocking Logic', () => {
    
    it('Test 1: Should NOT block first trigger for wiederholend threshold', () => {
      const threshold: ThresholdConfig = {
        id: 'th-001',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test threshold',
        isActive: true,
        triggerCount: 0
      };
      
      const blocked = shouldBlockReTrigger(threshold, harmlosConfig, 'increase');
      expect(blocked).toBe(false);
      console.log('✓ Test 1 PASSED: First trigger NOT blocked');
    });
    
    it('Test 2: Should block re-trigger when activeAlarmId is set', () => {
      const threshold: ThresholdConfig = {
        id: 'th-002',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test threshold',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-existing-123'
      };
      
      const blocked = shouldBlockReTrigger(threshold, harmlosConfig, 'increase');
      expect(blocked).toBe(true);
      console.log('✓ Test 2 PASSED: Re-trigger blocked with activeAlarmId');
    });
    
    it('Test 3: Should BLOCK re-trigger when requiresApproval is true AND activeAlarmId is set', () => {
      // UPDATED: Now blocks for ALL wiederholend thresholds (including requiresApproval=true)
      // This prevents duplicate alarms after page refresh
      const threshold: ThresholdConfig = {
        id: 'th-003',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'achtung',
        note: 'Test threshold',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-existing-456'
      };
      
      const blocked = shouldBlockReTrigger(threshold, achtungConfig, 'increase');
      expect(blocked).toBe(true);
      console.log('✓ Test 3 PASSED: Blocked when requiresApproval=true AND activeAlarmId set');
    });
    
    it('Test 4: Should NOT block einmalig thresholds', () => {
      const threshold: ThresholdConfig = {
        id: 'th-004',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'einmalig',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test threshold',
        isActive: true,
        triggerCount: 0
      };
      
      const blocked = shouldBlockReTrigger(threshold, harmlosConfig, 'increase');
      expect(blocked).toBe(false);
      console.log('✓ Test 4 PASSED: Einmalig thresholds NOT blocked');
    });
  });
  
  describe('Alarm Creation and activeAlarmId Setting', () => {
    
    it('Test 5: Should set activeAlarmId when creating alarm for wiederholend + no approval', () => {
      const threshold: ThresholdConfig = {
        id: 'th-005',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 0
      };
      
      const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-001', 'increase');
      
      expect(updatedThreshold.activeAlarmId).toBe(alarm.id);
      expect(updatedThreshold.triggerCount).toBe(1);
      console.log('✓ Test 5 PASSED: activeAlarmId set correctly');
    });
    
    it('Test 6: Should NOT set activeAlarmId for einmalig thresholds', () => {
      const threshold: ThresholdConfig = {
        id: 'th-006',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'einmalig',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 0
      };
      
      const { updatedThreshold } = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-001', 'increase');
      
      expect(updatedThreshold.activeAlarmId).toBeUndefined();
      console.log('✓ Test 6 PASSED: No activeAlarmId for einmalig');
    });
    
    it('Test 7: Should SET activeAlarmId when requiresApproval is true (prevents duplicates after refresh)', () => {
      // UPDATED: Now sets activeAlarmId for ALL wiederholend thresholds (including requiresApproval=true)
      // This prevents duplicate alarms after page refresh
      const threshold: ThresholdConfig = {
        id: 'th-007',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'achtung',
        note: 'Test',
        isActive: true,
        triggerCount: 0
      };
      
      const { updatedThreshold } = createAlarmAndSetActiveId(threshold, achtungConfig, 'pair-001', 'increase');
      
      expect(updatedThreshold.activeAlarmId).toBeDefined();
      console.log('✓ Test 7 PASSED: activeAlarmId SET for requiresApproval=true (prevents duplicates)');
    });
  });
  
  describe('Page Refresh Persistence', () => {
    
    it('Test 8: activeAlarmId should survive page refresh (JSON serialization)', () => {
      const threshold: ThresholdConfig = {
        id: 'th-008',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-persist-789'
      };
      
      const afterRefresh = simulatePageRefresh(threshold);
      
      expect(afterRefresh.activeAlarmId).toBe('alarm-persist-789');
      expect(shouldBlockReTrigger(afterRefresh, harmlosConfig, 'increase')).toBe(true);
      console.log('✓ Test 8 PASSED: activeAlarmId survives page refresh');
    });
    
    it('Test 9: Should block re-trigger after page refresh when alarm still active', () => {
      let threshold: ThresholdConfig = {
        id: 'th-009',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 0
      };
      
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(false);
      
      const result = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-009', 'increase');
      threshold = result.updatedThreshold;
      
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(true);
      
      const afterRefresh = simulatePageRefresh(threshold);
      
      expect(shouldBlockReTrigger(afterRefresh, harmlosConfig, 'increase')).toBe(true);
      console.log('✓ Test 9 PASSED: Block persists after page refresh');
    });
  });
  
  describe('Alarm Dismissal and Re-Triggering', () => {
    
    it('Test 10: Should allow re-trigger after activeAlarmId is cleared', () => {
      let threshold: ThresholdConfig = {
        id: 'th-010',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 0
      };
      
      const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-010', 'increase');
      threshold = updatedThreshold;
      
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(true);
      
      threshold = clearActiveAlarmId(threshold, alarm.id);
      
      expect(threshold.activeAlarmId).toBeUndefined();
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(false);
      console.log('✓ Test 10 PASSED: Re-trigger allowed after clear');
    });
    
    it('Test 11: Should NOT clear activeAlarmId if alarm ID does not match', () => {
      const threshold: ThresholdConfig = {
        id: 'th-011',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-original-111'
      };
      
      const result = clearActiveAlarmId(threshold, 'alarm-different-222');
      
      expect(result.activeAlarmId).toBe('alarm-original-111');
      console.log('✓ Test 11 PASSED: Wrong ID does not clear activeAlarmId');
    });
    
    it('Test 12: Full lifecycle - trigger, refresh, dismiss, re-trigger allowed', () => {
      let threshold: ThresholdConfig = {
        id: 'th-012',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Lifecycle test',
        isActive: true,
        triggerCount: 0
      };
      
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(false);
      
      const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-012', 'increase');
      threshold = updatedThreshold;
      expect(threshold.activeAlarmId).toBe(alarm.id);
      expect(threshold.triggerCount).toBe(1);
      
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(true);
      
      threshold = simulatePageRefresh(threshold);
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(true);
      
      threshold = clearActiveAlarmId(threshold, alarm.id);
      expect(threshold.activeAlarmId).toBeUndefined();
      
      expect(shouldBlockReTrigger(threshold, harmlosConfig, 'increase')).toBe(false);
      
      const { alarm: alarm2, updatedThreshold: threshold2 } = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-012', 'increase');
      threshold = threshold2;
      expect(threshold.activeAlarmId).toBe(alarm2.id);
      expect(threshold.triggerCount).toBe(2);
      console.log('✓ Test 12 PASSED: Full lifecycle works correctly');
    });
  });
  
  describe('Decrease Direction Tests', () => {
    
    it('Test 13: Should block decrease re-trigger when activeAlarmId is set', () => {
      const threshold: ThresholdConfig = {
        id: 'th-013',
        threshold: '3000',
        notifyOnIncrease: false,
        notifyOnDecrease: true,
        increaseFrequency: 'einmalig',
        decreaseFrequency: 'wiederholend',
        alarmLevel: 'harmlos',
        note: 'Decrease test',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-decrease-123'
      };
      
      const blocked = shouldBlockReTrigger(threshold, harmlosConfig, 'decrease');
      expect(blocked).toBe(true);
      console.log('✓ Test 13 PASSED: Decrease re-trigger blocked');
    });
    
    it('Test 14: Should set activeAlarmId for decrease wiederholend', () => {
      const threshold: ThresholdConfig = {
        id: 'th-014',
        threshold: '3000',
        notifyOnIncrease: false,
        notifyOnDecrease: true,
        increaseFrequency: 'einmalig',
        decreaseFrequency: 'wiederholend',
        alarmLevel: 'harmlos',
        note: 'Decrease test',
        isActive: true,
        triggerCount: 0
      };
      
      const { alarm, updatedThreshold } = createAlarmAndSetActiveId(threshold, harmlosConfig, 'pair-014', 'decrease');
      
      expect(updatedThreshold.activeAlarmId).toBe(alarm.id);
      console.log('✓ Test 14 PASSED: activeAlarmId set for decrease');
    });
  });
  
  describe('Channel Configuration Tests', () => {
    
    it('Test 15: Harmlos config should have correct channels (push+email only)', () => {
      expect(harmlosConfig.channels.push).toBe(true);
      expect(harmlosConfig.channels.email).toBe(true);
      expect(harmlosConfig.channels.sms).toBe(false);
      expect(harmlosConfig.channels.webPush).toBe(false);
      expect(harmlosConfig.channels.nativePush).toBe(false);
      expect(harmlosConfig.requiresApproval).toBe(false);
      expect(harmlosConfig.repeatCount).toBe(3);
      console.log('✓ Test 15 PASSED: Harmlos channels: push=true, email=true, sms=false, webPush=false, nativePush=false');
    });
    
    it('Test 16: Achtung config should have all channels enabled', () => {
      expect(achtungConfig.channels.push).toBe(true);
      expect(achtungConfig.channels.email).toBe(true);
      expect(achtungConfig.channels.sms).toBe(true);
      expect(achtungConfig.channels.webPush).toBe(true);
      expect(achtungConfig.channels.nativePush).toBe(true);
      expect(achtungConfig.requiresApproval).toBe(true);
      console.log('✓ Test 16 PASSED: Achtung channels: all enabled');
    });
  });
  
  describe('Multiple Thresholds Independence', () => {
    
    it('Test 17: Different thresholds for same pair are independent', () => {
      const threshold1: ThresholdConfig = {
        id: 'th-017a',
        threshold: '3000',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'First threshold',
        isActive: true,
        triggerCount: 0
      };
      
      const threshold2: ThresholdConfig = {
        id: 'th-017b',
        threshold: '3500',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Second threshold',
        isActive: true,
        triggerCount: 0
      };
      
      const { updatedThreshold: updated1 } = createAlarmAndSetActiveId(threshold1, harmlosConfig, 'pair-017', 'increase');
      
      expect(updated1.activeAlarmId).toBeDefined();
      expect(threshold2.activeAlarmId).toBeUndefined();
      
      expect(shouldBlockReTrigger(updated1, harmlosConfig, 'increase')).toBe(true);
      expect(shouldBlockReTrigger(threshold2, harmlosConfig, 'increase')).toBe(false);
      console.log('✓ Test 17 PASSED: Thresholds are independent');
    });
    
    it('Test 18: Clearing one threshold does not affect another', () => {
      let threshold1: ThresholdConfig = {
        id: 'th-018a',
        threshold: '3000',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'First',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-018a'
      };
      
      const threshold2: ThresholdConfig = {
        id: 'th-018b',
        threshold: '3500',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Second',
        isActive: true,
        triggerCount: 1,
        activeAlarmId: 'alarm-018b'
      };
      
      threshold1 = clearActiveAlarmId(threshold1, 'alarm-018a');
      
      expect(threshold1.activeAlarmId).toBeUndefined();
      expect(threshold2.activeAlarmId).toBe('alarm-018b');
      console.log('✓ Test 18 PASSED: Clearing one does not affect other');
    });
  });
  
  describe('Edge Cases', () => {
    
    it('Test 19: Undefined activeAlarmId should not block', () => {
      const threshold: ThresholdConfig = {
        id: 'th-019',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 5,
        activeAlarmId: undefined
      };
      
      const blocked = shouldBlockReTrigger(threshold, harmlosConfig, 'increase');
      expect(blocked).toBe(false);
      console.log('✓ Test 19 PASSED: Undefined activeAlarmId does not block');
    });
    
    it('Test 20: Empty string activeAlarmId should not block (falsy)', () => {
      const threshold: ThresholdConfig = {
        id: 'th-020',
        threshold: '3200',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'einmalig',
        alarmLevel: 'harmlos',
        note: 'Test',
        isActive: true,
        triggerCount: 5,
        activeAlarmId: '' as any
      };
      
      const blocked = shouldBlockReTrigger(threshold, harmlosConfig, 'increase');
      expect(blocked).toBe(false);
      console.log('✓ Test 20 PASSED: Empty string activeAlarmId does not block');
    });
  });
});
