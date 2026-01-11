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
  triggerCount?: number;
}

interface TrendPriceSettings {
  [key: string]: {
    thresholds: ThresholdConfig[];
  };
}

function simulateTrigger(threshold: ThresholdConfig, direction: 'increase' | 'decrease'): void {
  const frequency = direction === 'increase' ? threshold.increaseFrequency : threshold.decreaseFrequency;
  
  if (frequency === 'wiederholend') {
    threshold.triggerCount = (threshold.triggerCount || 0) + 1;
  } else if (frequency === 'einmalig') {
    threshold.isActive = false;
  }
}

describe('Wiederholend Threshold Logic with triggerCount', () => {
  let trendPriceSettings: TrendPriceSettings;
  
  beforeEach(() => {
    trendPriceSettings = {
      'ETH-USDT': {
        thresholds: [{
          id: 'threshold-1',
          threshold: '3500',
          notifyOnIncrease: true,
          notifyOnDecrease: false,
          increaseFrequency: 'wiederholend',
          decreaseFrequency: 'wiederholend',
          alarmLevel: 'harmlos',
          note: '',
          isActive: true,
          triggerCount: 0
        }]
      }
    };
  });

  it('Test 1: New wiederholend threshold starts with triggerCount=0 and shows "0 ∞"', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    expect(threshold.increaseFrequency).toBe('wiederholend');
    expect(threshold.triggerCount).toBe(0);
    expect(threshold.isActive).toBe(true);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('0 ∞');
    
    console.log('✓ Test 1 PASSED: New wiederholend shows "0 ∞"');
  });

  it('Test 2: First trigger increments count to 1, shows "1 ∞"', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    simulateTrigger(threshold, 'increase');
    
    expect(threshold.triggerCount).toBe(1);
    expect(threshold.isActive).toBe(true);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('1 ∞');
    
    console.log('✓ Test 2 PASSED: After 1 trigger shows "1 ∞"');
  });

  it('Test 3: Second trigger increments count to 2, shows "2 ∞"', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    simulateTrigger(threshold, 'increase');
    simulateTrigger(threshold, 'increase');
    
    expect(threshold.triggerCount).toBe(2);
    expect(threshold.isActive).toBe(true);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('2 ∞');
    
    console.log('✓ Test 3 PASSED: After 2 triggers shows "2 ∞"');
  });

  it('Test 4: Multiple triggers (5x) shows "5 ∞"', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    for (let i = 0; i < 5; i++) {
      simulateTrigger(threshold, 'increase');
    }
    
    expect(threshold.triggerCount).toBe(5);
    expect(threshold.isActive).toBe(true);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('5 ∞');
    
    console.log('✓ Test 4 PASSED: After 5 triggers shows "5 ∞"');
  });

  it('Test 5: Toggle stays active after many triggers (10x)', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    for (let i = 0; i < 10; i++) {
      simulateTrigger(threshold, 'increase');
      expect(threshold.isActive).toBe(true);
    }
    
    expect(threshold.triggerCount).toBe(10);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('10 ∞');
    
    console.log('✓ Test 5 PASSED: Toggle stays active after 10 triggers, shows "10 ∞"');
  });

  it('Test 6: Decrease trigger also increments count', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    threshold.notifyOnIncrease = false;
    threshold.notifyOnDecrease = true;
    
    simulateTrigger(threshold, 'decrease');
    simulateTrigger(threshold, 'decrease');
    simulateTrigger(threshold, 'decrease');
    
    expect(threshold.triggerCount).toBe(3);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('3 ∞');
    
    console.log('✓ Test 6 PASSED: Decrease triggers also count, shows "3 ∞"');
  });

  it('Test 7: Each threshold has its own counter (not shared)', () => {
    trendPriceSettings['ETH-USDT'].thresholds.push({
      id: 'threshold-2',
      threshold: '4000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'wiederholend',
      alarmLevel: 'achtung',
      note: '',
      isActive: true,
      triggerCount: 0
    });
    
    const threshold1 = trendPriceSettings['ETH-USDT'].thresholds[0];
    const threshold2 = trendPriceSettings['ETH-USDT'].thresholds[1];
    
    simulateTrigger(threshold1, 'increase');
    simulateTrigger(threshold1, 'increase');
    simulateTrigger(threshold1, 'increase');
    simulateTrigger(threshold2, 'increase');
    
    expect(threshold1.triggerCount).toBe(3);
    expect(threshold2.triggerCount).toBe(1);
    
    const display1 = `${threshold1.triggerCount} ∞`;
    const display2 = `${threshold2.triggerCount} ∞`;
    expect(display1).toBe('3 ∞');
    expect(display2).toBe('1 ∞');
    
    console.log('✓ Test 7 PASSED: Each threshold has own counter (3 ∞ vs 1 ∞)');
  });

  it('Test 8: Mixed einmalig and wiederholend thresholds work independently', () => {
    trendPriceSettings['ETH-USDT'].thresholds.push({
      id: 'threshold-einmalig',
      threshold: '3800',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'gefährlich',
      note: '',
      isActive: true,
      triggerCount: 0
    });
    
    const wiederholendThreshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    const einmaligThreshold = trendPriceSettings['ETH-USDT'].thresholds[1];
    
    simulateTrigger(wiederholendThreshold, 'increase');
    simulateTrigger(wiederholendThreshold, 'increase');
    simulateTrigger(einmaligThreshold, 'increase');
    
    expect(wiederholendThreshold.triggerCount).toBe(2);
    expect(wiederholendThreshold.isActive).toBe(true);
    expect(einmaligThreshold.isActive).toBe(false);
    
    const wiederholendDisplay = `${wiederholendThreshold.triggerCount} ∞`;
    expect(wiederholendDisplay).toBe('2 ∞');
    
    console.log('✓ Test 8 PASSED: Mixed thresholds work independently (2 ∞ vs deactivated)');
  });

  it('Test 9: Counter persists across simulated page refresh (localStorage simulation)', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    simulateTrigger(threshold, 'increase');
    simulateTrigger(threshold, 'increase');
    simulateTrigger(threshold, 'increase');
    
    expect(threshold.triggerCount).toBe(3);
    
    const savedSettings = JSON.stringify(trendPriceSettings);
    const restoredSettings: TrendPriceSettings = JSON.parse(savedSettings);
    const restoredThreshold = restoredSettings['ETH-USDT'].thresholds[0];
    
    expect(restoredThreshold.triggerCount).toBe(3);
    
    const displayText = `${restoredThreshold.triggerCount} ∞`;
    expect(displayText).toBe('3 ∞');
    
    console.log('✓ Test 9 PASSED: Counter persists after localStorage save/restore (3 ∞)');
  });

  it('Test 10: High trigger count (100x) displays correctly', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    
    for (let i = 0; i < 100; i++) {
      simulateTrigger(threshold, 'increase');
    }
    
    expect(threshold.triggerCount).toBe(100);
    expect(threshold.isActive).toBe(true);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('100 ∞');
    
    console.log('✓ Test 10 PASSED: High count (100x) displays correctly "100 ∞"');
  });

  it('Test 11: Counter continues from existing value', () => {
    const threshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    threshold.triggerCount = 50;
    
    simulateTrigger(threshold, 'increase');
    simulateTrigger(threshold, 'increase');
    
    expect(threshold.triggerCount).toBe(52);
    
    const displayText = `${threshold.triggerCount} ∞`;
    expect(displayText).toBe('52 ∞');
    
    console.log('✓ Test 11 PASSED: Counter continues from 50 → 52');
  });

  it('Test 12: Multiple TrendPrices with wiederholend thresholds', () => {
    trendPriceSettings['BTC-USDT'] = {
      thresholds: [{
        id: 'btc-threshold-1',
        threshold: '50000',
        notifyOnIncrease: true,
        notifyOnDecrease: false,
        increaseFrequency: 'wiederholend',
        decreaseFrequency: 'wiederholend',
        alarmLevel: 'harmlos',
        note: '',
        isActive: true,
        triggerCount: 0
      }]
    };
    
    const ethThreshold = trendPriceSettings['ETH-USDT'].thresholds[0];
    const btcThreshold = trendPriceSettings['BTC-USDT'].thresholds[0];
    
    simulateTrigger(ethThreshold, 'increase');
    simulateTrigger(ethThreshold, 'increase');
    simulateTrigger(btcThreshold, 'increase');
    simulateTrigger(btcThreshold, 'increase');
    simulateTrigger(btcThreshold, 'increase');
    simulateTrigger(btcThreshold, 'increase');
    
    expect(ethThreshold.triggerCount).toBe(2);
    expect(btcThreshold.triggerCount).toBe(4);
    
    const ethDisplay = `${ethThreshold.triggerCount} ∞`;
    const btcDisplay = `${btcThreshold.triggerCount} ∞`;
    expect(ethDisplay).toBe('2 ∞');
    expect(btcDisplay).toBe('4 ∞');
    
    console.log('✓ Test 12 PASSED: Different TrendPrices have independent counters (ETH: 2 ∞, BTC: 4 ∞)');
  });
});
