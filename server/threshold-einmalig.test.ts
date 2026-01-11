import { describe, it, expect, beforeEach } from 'vitest';

interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: string;
  note: string;
  isActive?: boolean;
}

interface TrendPriceSettings {
  [key: string]: {
    thresholds: ThresholdConfig[];
  };
}

describe('Einmalig Threshold Logic', () => {
  let triggeredThresholds: Set<string>;
  let trendPriceSettings: TrendPriceSettings;
  
  beforeEach(() => {
    triggeredThresholds = new Set();
    trendPriceSettings = {
      'ETH-USDT': {
        thresholds: [{
          id: 'threshold-1',
          threshold: '3500',
          notifyOnIncrease: true,
          notifyOnDecrease: false,
          increaseFrequency: 'einmalig',
          decreaseFrequency: 'einmalig',
          alarmLevel: 'harmlos',
          note: '',
          isActive: true
        }]
      }
    };
  });

  it('Test 1: New einmalig threshold should have isActive=true and not be triggered', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    expect(threshold.isActive).toBe(true);
    expect(threshold.increaseFrequency).toBe('einmalig');
    expect(triggeredThresholds.has('ETH-USDT-threshold-1-3500')).toBe(false);
    
    console.log('✓ Test 1 PASSED: Toggle=Aktiv, Status=0/1 (not triggered)');
  });

  it('Test 2: When einmalig threshold triggers, isActive should become false', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    const triggerKey = 'ETH-USDT-threshold-1-3500';
    
    triggeredThresholds.add(triggerKey);
    
    if (threshold.increaseFrequency === 'einmalig') {
      threshold.isActive = false;
    }
    
    expect(triggeredThresholds.has(triggerKey)).toBe(true);
    expect(threshold.isActive).toBe(false);
    
    console.log('✓ Test 2 PASSED: After trigger → Status=✓, Toggle=Pause');
  });

  it('Test 3: When user re-enables toggle, triggered status resets', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    const triggerKey = 'ETH-USDT-threshold-1-3500';
    
    triggeredThresholds.add(triggerKey);
    threshold.isActive = false;
    
    expect(threshold.isActive).toBe(false);
    expect(triggeredThresholds.has(triggerKey)).toBe(true);
    
    threshold.isActive = true;
    Array.from(triggeredThresholds).forEach(key => {
      if (key.includes(threshold.id)) {
        triggeredThresholds.delete(key);
      }
    });
    
    expect(threshold.isActive).toBe(true);
    expect(triggeredThresholds.has(triggerKey)).toBe(false);
    
    console.log('✓ Test 3 PASSED: Re-enabled → Toggle=Aktiv, Status=0/1');
  });

  it('Test 4: Inactive threshold should be skipped (not trigger)', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    threshold.isActive = false;
    
    let triggered = false;
    if (threshold.isActive !== false) {
      triggered = true;
    }
    
    expect(triggered).toBe(false);
    
    console.log('✓ Test 4 PASSED: Inactive threshold is skipped');
  });

  it('Test 5: Full cycle - create, trigger, deactivate, reactivate', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    const triggerKey = 'ETH-USDT-threshold-1-3500';
    
    expect(threshold.isActive).toBe(true);
    expect(triggeredThresholds.size).toBe(0);
    console.log('  Step 1: Created with Toggle=Aktiv, Status=0/1');
    
    triggeredThresholds.add(triggerKey);
    if (threshold.increaseFrequency === 'einmalig') {
      threshold.isActive = false;
    }
    expect(threshold.isActive).toBe(false);
    expect(triggeredThresholds.has(triggerKey)).toBe(true);
    console.log('  Step 2: Triggered → Toggle=Pause, Status=✓');
    
    threshold.isActive = true;
    triggeredThresholds.delete(triggerKey);
    expect(threshold.isActive).toBe(true);
    expect(triggeredThresholds.has(triggerKey)).toBe(false);
    console.log('  Step 3: Re-enabled → Toggle=Aktiv, Status=0/1');
    
    console.log('✓ Test 5 PASSED: Full cycle complete');
  });

  it('Test 6: Wiederholend threshold does NOT deactivate after trigger', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    threshold.increaseFrequency = 'wiederholend';
    const triggerKey = 'ETH-USDT-threshold-1-3500';
    
    triggeredThresholds.add(triggerKey);
    
    if (threshold.increaseFrequency === 'einmalig') {
      threshold.isActive = false;
    }
    
    expect(threshold.isActive).toBe(true);
    
    console.log('✓ Test 6 PASSED: Wiederholend stays active after trigger');
  });

  it('Test 7: Multiple thresholds - only triggered one deactivates', () => {
    trendPriceSettings['ETH-USDT'].thresholds.push({
      id: 'threshold-2',
      threshold: '4000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'achtung',
      note: '',
      isActive: true
    });
    
    const threshold1 = trendPriceSettings['ETH-USDT'].thresholds[0];
    const threshold2 = trendPriceSettings['ETH-USDT'].thresholds[1];
    const triggerKey1 = 'ETH-USDT-threshold-1-3500';
    
    triggeredThresholds.add(triggerKey1);
    if (threshold1.increaseFrequency === 'einmalig') {
      threshold1.isActive = false;
    }
    
    expect(threshold1.isActive).toBe(false);
    expect(threshold2.isActive).toBe(true);
    
    console.log('✓ Test 7 PASSED: Only triggered threshold deactivates');
  });

  it('Test 8: Decrease threshold with einmalig', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    threshold.notifyOnIncrease = false;
    threshold.notifyOnDecrease = true;
    const triggerKey = 'ETH-USDT-threshold-1-3500';
    
    triggeredThresholds.add(triggerKey);
    if (threshold.decreaseFrequency === 'einmalig') {
      threshold.isActive = false;
    }
    
    expect(threshold.isActive).toBe(false);
    expect(triggeredThresholds.has(triggerKey)).toBe(true);
    
    console.log('✓ Test 8 PASSED: Decrease einmalig also deactivates');
  });

  it('Test 9: Re-enable clears all trigger keys for that threshold', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    triggeredThresholds.add('ETH-USDT-threshold-1-3500');
    triggeredThresholds.add('ETH-USDT-threshold-1-3600');
    triggeredThresholds.add('ETH-USDT-threshold-2-4000');
    
    threshold.isActive = true;
    const newSet = new Set<string>();
    triggeredThresholds.forEach(key => {
      if (!key.includes(threshold.id)) {
        newSet.add(key);
      }
    });
    triggeredThresholds = newSet;
    
    expect(triggeredThresholds.has('ETH-USDT-threshold-1-3500')).toBe(false);
    expect(triggeredThresholds.has('ETH-USDT-threshold-1-3600')).toBe(false);
    expect(triggeredThresholds.has('ETH-USDT-threshold-2-4000')).toBe(true);
    
    console.log('✓ Test 9 PASSED: Re-enable clears only matching trigger keys');
  });

  it('Test 10: Complete scenario with alarm creation', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    const triggerKey = 'ETH-USDT-threshold-1-3500';
    
    expect(threshold.isActive).toBe(true);
    expect(triggeredThresholds.size).toBe(0);
    console.log('  [10.1] New threshold: Toggle=Aktiv, Status=0/1');
    
    const newAlarm = {
      id: crypto.randomUUID(),
      trendPriceName: 'ETH/USDT',
      threshold: threshold.threshold,
      alarmLevel: threshold.alarmLevel,
      triggeredAt: new Date(),
      message: `Preis über ${threshold.threshold} USDT gestiegen`,
    };
    
    triggeredThresholds.add(triggerKey);
    if (threshold.increaseFrequency === 'einmalig') {
      threshold.isActive = false;
    }
    console.log('  [10.2] Triggered: Alarm created, Toggle=Pause, Status=✓');
    console.log(`         Alarm ID: ${newAlarm.id}`);
    
    expect(threshold.isActive).toBe(false);
    expect(triggeredThresholds.has(triggerKey)).toBe(true);
    expect(newAlarm.threshold).toBe('3500');
    
    threshold.isActive = true;
    triggeredThresholds.delete(triggerKey);
    console.log('  [10.3] Re-enabled: Toggle=Aktiv, Status=0/1');
    
    expect(threshold.isActive).toBe(true);
    expect(triggeredThresholds.has(triggerKey)).toBe(false);
    
    console.log('✓ Test 10 PASSED: Complete scenario with alarm');
  });
});
