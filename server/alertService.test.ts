import { describe, it, expect } from 'vitest';
import {
  isThresholdActive,
  didPriceCrossAbove,
  didPriceCrossBelow,
  evaluateThresholdAlert,
  evaluateAllThresholds,
  getTriggeredAlerts,
  getPausedThresholds,
  getActiveThresholds,
  toggleThresholdStatus,
  createThreshold,
  ThresholdConfig,
  AlertResult
} from './alertService';

// Helper to create test thresholds
const createTestThreshold = (overrides: Partial<ThresholdConfig> = {}): ThresholdConfig => ({
  id: 'test-id-1',
  threshold: '50000',
  notifyOnIncrease: true,
  notifyOnDecrease: true,
  increaseFrequency: 'einmalig',
  decreaseFrequency: 'einmalig',
  alarmLevel: 'harmlos',
  note: 'Test threshold',
  isActive: true,
  ...overrides
});

describe('Alert Service - isActive Toggle Tests', () => {
  
  // TEST 1: Active threshold should return true
  it('should return true for active threshold', () => {
    const threshold = createTestThreshold({ isActive: true });
    expect(isThresholdActive(threshold)).toBe(true);
  });

  // TEST 2: Paused threshold should return false
  it('should return false for paused threshold (isActive=false)', () => {
    const threshold = createTestThreshold({ isActive: false });
    expect(isThresholdActive(threshold)).toBe(false);
  });

  // TEST 3: Undefined isActive should default to true (active)
  it('should default to active when isActive is undefined', () => {
    const threshold = createTestThreshold();
    // @ts-ignore - Testing undefined case
    delete threshold.isActive;
    expect(isThresholdActive(threshold)).toBe(true);
  });

  // TEST 4: Active threshold triggers alert on price increase
  it('should trigger alert when active threshold is crossed (increase)', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      threshold: '50000',
      notifyOnIncrease: true 
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 51000,
      previousPrice: 49000,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(true);
    expect(result.triggerType).toBe('increase');
  });

  // TEST 5: Paused threshold does NOT trigger alert on price increase
  it('should NOT trigger alert when paused threshold is crossed (increase)', () => {
    const threshold = createTestThreshold({ 
      isActive: false, 
      threshold: '50000',
      notifyOnIncrease: true 
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 51000,
      previousPrice: 49000,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(false);
    expect(result.message).toContain('paused');
  });

  // TEST 6: Active threshold triggers alert on price decrease
  it('should trigger alert when active threshold is crossed (decrease)', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      threshold: '50000',
      notifyOnDecrease: true 
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 49000,
      previousPrice: 51000,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(true);
    expect(result.triggerType).toBe('decrease');
  });

  // TEST 7: Paused threshold does NOT trigger alert on price decrease
  it('should NOT trigger alert when paused threshold is crossed (decrease)', () => {
    const threshold = createTestThreshold({ 
      isActive: false, 
      threshold: '50000',
      notifyOnDecrease: true 
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 49000,
      previousPrice: 51000,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(false);
    expect(result.message).toContain('paused');
  });

  // TEST 8: Evaluate multiple thresholds - only active ones trigger
  it('should only trigger alerts for active thresholds in a list', () => {
    const thresholds = [
      createTestThreshold({ id: 'active-1', isActive: true, threshold: '50000' }),
      createTestThreshold({ id: 'paused-1', isActive: false, threshold: '50000' }),
      createTestThreshold({ id: 'active-2', isActive: true, threshold: '50000' }),
    ];
    
    const results = evaluateAllThresholds(51000, 49000, thresholds);
    const triggered = getTriggeredAlerts(results);
    
    expect(triggered.length).toBe(2);
    expect(triggered.map(t => t.thresholdId)).toContain('active-1');
    expect(triggered.map(t => t.thresholdId)).toContain('active-2');
    expect(triggered.map(t => t.thresholdId)).not.toContain('paused-1');
  });

  // TEST 9: Get paused thresholds from list
  it('should correctly filter paused thresholds', () => {
    const thresholds = [
      createTestThreshold({ id: 'active-1', isActive: true }),
      createTestThreshold({ id: 'paused-1', isActive: false }),
      createTestThreshold({ id: 'paused-2', isActive: false }),
      createTestThreshold({ id: 'active-2', isActive: true }),
    ];
    
    const paused = getPausedThresholds(thresholds);
    
    expect(paused.length).toBe(2);
    expect(paused.map(t => t.id)).toContain('paused-1');
    expect(paused.map(t => t.id)).toContain('paused-2');
  });

  // TEST 10: Get active thresholds from list
  it('should correctly filter active thresholds', () => {
    const thresholds = [
      createTestThreshold({ id: 'active-1', isActive: true }),
      createTestThreshold({ id: 'paused-1', isActive: false }),
      createTestThreshold({ id: 'paused-2', isActive: false }),
      createTestThreshold({ id: 'active-2', isActive: true }),
    ];
    
    const active = getActiveThresholds(thresholds);
    
    expect(active.length).toBe(2);
    expect(active.map(t => t.id)).toContain('active-1');
    expect(active.map(t => t.id)).toContain('active-2');
  });

  // TEST 11: Toggle threshold status to paused
  it('should toggle threshold from active to paused', () => {
    const threshold = createTestThreshold({ isActive: true });
    const toggled = toggleThresholdStatus(threshold, false);
    
    expect(toggled.isActive).toBe(false);
    expect(isThresholdActive(toggled)).toBe(false);
  });

  // TEST 12: Toggle threshold status to active
  it('should toggle threshold from paused to active', () => {
    const threshold = createTestThreshold({ isActive: false });
    const toggled = toggleThresholdStatus(threshold, true);
    
    expect(toggled.isActive).toBe(true);
    expect(isThresholdActive(toggled)).toBe(true);
  });

  // TEST 13: Create threshold with default active status
  it('should create threshold with isActive=true by default', () => {
    const threshold = createThreshold('new-id', '60000', {
      notifyOnIncrease: true
    });
    
    expect(threshold.isActive).toBe(true);
    expect(threshold.id).toBe('new-id');
    expect(threshold.threshold).toBe('60000');
  });

  // TEST 14: Create threshold with explicit paused status
  it('should create threshold with explicit isActive=false', () => {
    const threshold = createThreshold('paused-new', '70000', {
      notifyOnDecrease: true,
      isActive: false
    });
    
    expect(threshold.isActive).toBe(false);
    expect(isThresholdActive(threshold)).toBe(false);
  });

  // TEST 15: Price crossing detection - above
  it('should detect price crossing above threshold correctly', () => {
    expect(didPriceCrossAbove(51000, 49000, 50000)).toBe(true);
    expect(didPriceCrossAbove(49000, 48000, 50000)).toBe(false);
    expect(didPriceCrossAbove(52000, 51000, 50000)).toBe(false);
  });

  // TEST 16: Price crossing detection - below
  it('should detect price crossing below threshold correctly', () => {
    expect(didPriceCrossBelow(49000, 51000, 50000)).toBe(true);
    expect(didPriceCrossBelow(51000, 52000, 50000)).toBe(false);
    expect(didPriceCrossBelow(48000, 49000, 50000)).toBe(false);
  });

  // TEST 17: Alert includes correct alarm level
  it('should include correct alarm level in triggered alert', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      alarmLevel: 'gefährlich',
      threshold: '50000'
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 51000,
      previousPrice: 49000,
      threshold
    });
    
    expect(result.alarmLevel).toBe('gefährlich');
  });

  // TEST 18: Invalid threshold value handling
  it('should not trigger for invalid threshold value', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      threshold: 'invalid'
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 51000,
      previousPrice: 49000,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(false);
    expect(result.message).toContain('Invalid');
  });

  // TEST 19: No trigger when notification options disabled
  it('should not trigger when both notification options are disabled', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      notifyOnIncrease: false,
      notifyOnDecrease: false,
      threshold: '50000'
    });
    
    const result = evaluateThresholdAlert({
      currentPrice: 51000,
      previousPrice: 49000,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(false);
  });

  // TEST 20: Combined test - paused overrides everything
  it('should not trigger even with valid settings when threshold is paused', () => {
    const threshold = createTestThreshold({ 
      isActive: false,
      notifyOnIncrease: true,
      notifyOnDecrease: true,
      alarmLevel: 'sehr_gefährlich',
      threshold: '50000'
    });
    
    // Test increase
    const resultIncrease = evaluateThresholdAlert({
      currentPrice: 51000,
      previousPrice: 49000,
      threshold
    });
    expect(resultIncrease.shouldTrigger).toBe(false);
    
    // Test decrease
    const resultDecrease = evaluateThresholdAlert({
      currentPrice: 49000,
      previousPrice: 51000,
      threshold
    });
    expect(resultDecrease.shouldTrigger).toBe(false);
  });
});
