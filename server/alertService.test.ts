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
  deleteAllThresholdsForPair,
  deleteAllThresholdsFromMap,
  getThresholdCount,
  getActiveThresholdCount,
  hasTradingPair,
  areThresholdsEmpty,
  batchDeleteThresholds,
  deleteSingleThreshold,
  countTotalThresholds,
  parseThresholdInput,
  parseThresholdValue,
  formatThresholdDisplay,
  isValidThresholdInput,
  evaluateThresholdWithComma,
  removeThresholdWithPersistence,
  deleteAllThresholdsWithPersistence,
  deserializeSettings,
  verifyPersistedState,
  verifyThresholdDeleted,
  addThresholdToSettings,
  isThresholdComplete,
  filterIncompleteThresholds,
  ThresholdConfig,
  AlertResult,
  TrendPriceSettings
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

// Helper to create test settings
const createTestSettings = (trendPriceId: string, thresholdCount: number): TrendPriceSettings => ({
  trendPriceId,
  thresholds: Array.from({ length: thresholdCount }, (_, i) => 
    createThreshold(`threshold-${i}`, `${50000 + i * 1000}`, {
      notifyOnIncrease: true,
      notifyOnDecrease: true,
      isActive: true
    })
  )
});

describe('Alert Service - Bulk Threshold Deletion Tests', () => {
  
  // TEST 1: Delete all thresholds for a single pair
  it('should delete all thresholds for a trading pair', () => {
    const settings = createTestSettings('BTCUSDT', 5);
    expect(settings.thresholds.length).toBe(5);
    
    const result = deleteAllThresholdsForPair(settings);
    
    expect(result.thresholds.length).toBe(0);
    expect(result.trendPriceId).toBe('BTCUSDT');
  });

  // TEST 2: Delete preserves trading pair in map
  it('should preserve trading pair entry when deleting thresholds from map', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': createTestSettings('BTCUSDT', 3),
      'ETHUSDT': createTestSettings('ETHUSDT', 2)
    };
    
    const result = deleteAllThresholdsFromMap(settingsMap, 'BTCUSDT');
    
    expect(result['BTCUSDT']).toBeDefined();
    expect(result['BTCUSDT'].thresholds.length).toBe(0);
    expect(result['BTCUSDT'].trendPriceId).toBe('BTCUSDT');
    expect(result['ETHUSDT'].thresholds.length).toBe(2);
  });

  // TEST 3: Delete non-existent pair returns unchanged map
  it('should return unchanged map when deleting from non-existent pair', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': createTestSettings('BTCUSDT', 3)
    };
    
    const result = deleteAllThresholdsFromMap(settingsMap, 'NONEXISTENT');
    
    expect(result).toEqual(settingsMap);
    expect(result['BTCUSDT'].thresholds.length).toBe(3);
  });

  // TEST 4: Get threshold count
  it('should correctly count thresholds', () => {
    const settings = createTestSettings('BTCUSDT', 7);
    expect(getThresholdCount(settings)).toBe(7);
    
    const emptySettings = createTestSettings('ETHUSDT', 0);
    expect(getThresholdCount(emptySettings)).toBe(0);
    
    expect(getThresholdCount(undefined)).toBe(0);
  });

  // TEST 5: Get active threshold count (only configured ones)
  it('should count only active/configured thresholds', () => {
    const settings: TrendPriceSettings = {
      trendPriceId: 'BTCUSDT',
      thresholds: [
        createThreshold('t1', '50000', { notifyOnIncrease: true }),
        createThreshold('t2', '', { notifyOnIncrease: true }),
        createThreshold('t3', '51000', { notifyOnDecrease: true }),
        createThreshold('t4', '52000', { notifyOnIncrease: false, notifyOnDecrease: false }),
      ]
    };
    
    expect(getActiveThresholdCount(settings)).toBe(2);
  });

  // TEST 6: Check if trading pair exists
  it('should correctly check if trading pair exists in map', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': createTestSettings('BTCUSDT', 3),
      'ETHUSDT': createTestSettings('ETHUSDT', 2)
    };
    
    expect(hasTradingPair(settingsMap, 'BTCUSDT')).toBe(true);
    expect(hasTradingPair(settingsMap, 'ETHUSDT')).toBe(true);
    expect(hasTradingPair(settingsMap, 'XRPUSDT')).toBe(false);
  });

  // TEST 7: Check if thresholds are empty
  it('should correctly identify empty thresholds', () => {
    const emptySettings: TrendPriceSettings = {
      trendPriceId: 'BTCUSDT',
      thresholds: []
    };
    
    const nonEmptySettings = createTestSettings('ETHUSDT', 3);
    
    expect(areThresholdsEmpty(emptySettings)).toBe(true);
    expect(areThresholdsEmpty(nonEmptySettings)).toBe(false);
    expect(areThresholdsEmpty(undefined)).toBe(true);
  });

  // TEST 8: Batch delete thresholds for multiple pairs
  it('should batch delete thresholds for multiple trading pairs', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': createTestSettings('BTCUSDT', 3),
      'ETHUSDT': createTestSettings('ETHUSDT', 2),
      'XRPUSDT': createTestSettings('XRPUSDT', 4)
    };
    
    const result = batchDeleteThresholds(settingsMap, ['BTCUSDT', 'XRPUSDT']);
    
    expect(result['BTCUSDT'].thresholds.length).toBe(0);
    expect(result['ETHUSDT'].thresholds.length).toBe(2);
    expect(result['XRPUSDT'].thresholds.length).toBe(0);
    expect(hasTradingPair(result, 'BTCUSDT')).toBe(true);
    expect(hasTradingPair(result, 'XRPUSDT')).toBe(true);
  });

  // TEST 9: Delete single threshold from pair
  it('should delete a single threshold from trading pair', () => {
    const settings: TrendPriceSettings = {
      trendPriceId: 'BTCUSDT',
      thresholds: [
        createThreshold('keep-1', '50000', { notifyOnIncrease: true }),
        createThreshold('delete-me', '51000', { notifyOnIncrease: true }),
        createThreshold('keep-2', '52000', { notifyOnIncrease: true }),
      ]
    };
    
    const result = deleteSingleThreshold(settings, 'delete-me');
    
    expect(result.thresholds.length).toBe(2);
    expect(result.thresholds.map(t => t.id)).toContain('keep-1');
    expect(result.thresholds.map(t => t.id)).toContain('keep-2');
    expect(result.thresholds.map(t => t.id)).not.toContain('delete-me');
  });

  // TEST 10: Count total thresholds across all pairs
  it('should count total thresholds across all trading pairs', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': createTestSettings('BTCUSDT', 3),
      'ETHUSDT': createTestSettings('ETHUSDT', 2),
      'XRPUSDT': createTestSettings('XRPUSDT', 5)
    };
    
    expect(countTotalThresholds(settingsMap)).toBe(10);
    
    const afterDelete = batchDeleteThresholds(settingsMap, ['BTCUSDT']);
    expect(countTotalThresholds(afterDelete)).toBe(7);
  });

  // TEST 11: Verify watchlist entry persists after deletion
  it('should verify that watchlist entry persists after threshold deletion', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': createTestSettings('BTCUSDT', 5),
      'ETHUSDT': createTestSettings('ETHUSDT', 3)
    };
    
    const result = deleteAllThresholdsFromMap(settingsMap, 'BTCUSDT');
    
    expect(Object.keys(result).length).toBe(2);
    expect('BTCUSDT' in result).toBe(true);
    expect('ETHUSDT' in result).toBe(true);
    expect(result['BTCUSDT'].trendPriceId).toBe('BTCUSDT');
  });

  // TEST 12: Delete from empty thresholds list
  it('should handle deletion from already empty thresholds', () => {
    const settings: TrendPriceSettings = {
      trendPriceId: 'BTCUSDT',
      thresholds: []
    };
    
    const result = deleteAllThresholdsForPair(settings);
    
    expect(result.thresholds.length).toBe(0);
    expect(result.trendPriceId).toBe('BTCUSDT');
  });
});

// ==========================================
// German Decimal Format (Comma) Tests
// ==========================================
describe('Alert Service - German Decimal Format (Comma) Tests', () => {
  
  // TEST 1: parseThresholdInput converts comma to dot
  it('should convert comma to dot in threshold input', () => {
    expect(parseThresholdInput('3,405')).toBe('3.405');
    expect(parseThresholdInput('50000,99')).toBe('50000.99');
    expect(parseThresholdInput('0,001')).toBe('0.001');
  });

  // TEST 2: parseThresholdInput handles dot input unchanged
  it('should keep dot unchanged in threshold input', () => {
    expect(parseThresholdInput('3.405')).toBe('3.405');
    expect(parseThresholdInput('50000.99')).toBe('50000.99');
  });

  // TEST 3: parseThresholdInput handles whole numbers
  it('should handle whole numbers without decimal separator', () => {
    expect(parseThresholdInput('50000')).toBe('50000');
    expect(parseThresholdInput('3')).toBe('3');
    expect(parseThresholdInput('100000')).toBe('100000');
  });

  // TEST 4: parseThresholdValue converts comma format to number
  it('should parse comma-formatted value to number', () => {
    expect(parseThresholdValue('3,405')).toBe(3.405);
    expect(parseThresholdValue('50000,99')).toBe(50000.99);
    expect(parseThresholdValue('0,001')).toBe(0.001);
  });

  // TEST 5: formatThresholdDisplay formats number in German locale
  it('should format threshold in German locale (dot as thousands separator)', () => {
    expect(formatThresholdDisplay('50000')).toBe('50.000');
    expect(formatThresholdDisplay('3107')).toBe('3.107');
    expect(formatThresholdDisplay('1000000')).toBe('1.000.000');
  });

  // TEST 6: formatThresholdDisplay handles decimal values
  it('should format decimal values with comma as decimal separator', () => {
    expect(formatThresholdDisplay('3.405')).toBe('3,405');
    expect(formatThresholdDisplay('50000.99')).toBe('50.000,99');
  });

  // TEST 7: isValidThresholdInput validates comma format
  it('should validate comma-formatted threshold as valid', () => {
    expect(isValidThresholdInput('3,405')).toBe(true);
    expect(isValidThresholdInput('50000,99')).toBe(true);
    expect(isValidThresholdInput('0,001')).toBe(true);
  });

  // TEST 8: isValidThresholdInput rejects invalid input
  it('should reject invalid threshold input', () => {
    expect(isValidThresholdInput('')).toBe(false);
    expect(isValidThresholdInput('abc')).toBe(false);
    expect(isValidThresholdInput('   ')).toBe(false);
    expect(isValidThresholdInput('-100')).toBe(false); // negative not allowed
  });

  // TEST 9: evaluateThresholdWithComma triggers alert with comma-formatted threshold
  it('should trigger alert with comma-formatted threshold (increase)', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      threshold: '3,405', // German format
      notifyOnIncrease: true,
      notifyOnDecrease: false
    });
    
    const result = evaluateThresholdWithComma({
      currentPrice: 3.50,
      previousPrice: 3.30,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(true);
    expect(result.triggerType).toBe('increase');
  });

  // TEST 10: evaluateThresholdWithComma triggers alert with comma-formatted threshold (decrease)
  it('should trigger alert with comma-formatted threshold (decrease)', () => {
    const threshold = createTestThreshold({ 
      isActive: true, 
      threshold: '3,405', // German format
      notifyOnIncrease: false,
      notifyOnDecrease: true
    });
    
    const result = evaluateThresholdWithComma({
      currentPrice: 3.30,
      previousPrice: 3.50,
      threshold
    });
    
    expect(result.shouldTrigger).toBe(true);
    expect(result.triggerType).toBe('decrease');
  });
});

// ==========================================
// Threshold Deletion Persistence Tests
// ==========================================
describe('Alert Service - Threshold Deletion Persistence Tests', () => {
  
  // TEST 1: Remove single threshold and verify persistence
  it('should persist deletion of single threshold correctly', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'ETHUSDT': {
        trendPriceId: 'ETHUSDT',
        thresholds: [
          createThreshold('t1', '3000', { notifyOnIncrease: true }),
          createThreshold('t2', '3500', { notifyOnDecrease: true }),
          createThreshold('t3', '4000', { notifyOnIncrease: true })
        ]
      }
    };

    const { newState, serialized } = removeThresholdWithPersistence(settingsMap, 'ETHUSDT', 't2');

    expect(newState['ETHUSDT'].thresholds.length).toBe(2);
    expect(verifyThresholdDeleted(serialized, 'ETHUSDT', 't2')).toBe(true);
    expect(verifyPersistedState(serialized, 2, 'ETHUSDT').isValid).toBe(true);
  });

  // TEST 2: Delete all thresholds and verify persistence
  it('should persist deletion of all thresholds correctly', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': {
        trendPriceId: 'BTCUSDT',
        thresholds: [
          createThreshold('t1', '50000', { notifyOnIncrease: true }),
          createThreshold('t2', '55000', { notifyOnDecrease: true })
        ]
      }
    };

    const { newState, serialized } = deleteAllThresholdsWithPersistence(settingsMap, 'BTCUSDT');

    expect(newState['BTCUSDT'].thresholds.length).toBe(0);
    expect(verifyPersistedState(serialized, 0, 'BTCUSDT').isValid).toBe(true);
  });

  // TEST 3: Deserialized state matches original deletion
  it('should deserialize persisted state after deletion correctly', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'XRPUSDT': {
        trendPriceId: 'XRPUSDT',
        thresholds: [
          createThreshold('t1', '0.5', { notifyOnIncrease: true }),
          createThreshold('t2', '0.6', { notifyOnDecrease: true })
        ]
      }
    };

    const { serialized } = removeThresholdWithPersistence(settingsMap, 'XRPUSDT', 't1');
    const deserialized = deserializeSettings(serialized);

    expect(deserialized).not.toBeNull();
    expect(deserialized!['XRPUSDT'].thresholds.length).toBe(1);
    expect(deserialized!['XRPUSDT'].thresholds[0].id).toBe('t2');
  });

  // TEST 4: Multiple deletions persist sequentially
  it('should persist multiple sequential deletions correctly', () => {
    let settingsMap: Record<string, TrendPriceSettings> = {
      'ADAUSDT': {
        trendPriceId: 'ADAUSDT',
        thresholds: [
          createThreshold('t1', '0.3', { notifyOnIncrease: true }),
          createThreshold('t2', '0.4', { notifyOnDecrease: true }),
          createThreshold('t3', '0.5', { notifyOnIncrease: true })
        ]
      }
    };

    // Delete first threshold
    let result = removeThresholdWithPersistence(settingsMap, 'ADAUSDT', 't1');
    settingsMap = result.newState;
    expect(verifyPersistedState(result.serialized, 2, 'ADAUSDT').isValid).toBe(true);

    // Delete second threshold
    result = removeThresholdWithPersistence(settingsMap, 'ADAUSDT', 't2');
    settingsMap = result.newState;
    expect(verifyPersistedState(result.serialized, 1, 'ADAUSDT').isValid).toBe(true);

    // Delete last threshold
    result = removeThresholdWithPersistence(settingsMap, 'ADAUSDT', 't3');
    expect(verifyPersistedState(result.serialized, 0, 'ADAUSDT').isValid).toBe(true);
  });

  // TEST 5: Deletion from non-existent pair returns original state
  it('should return unchanged state when deleting from non-existent pair', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'BTCUSDT': {
        trendPriceId: 'BTCUSDT',
        thresholds: [createThreshold('t1', '50000', { notifyOnIncrease: true })]
      }
    };

    const { newState, serialized } = removeThresholdWithPersistence(settingsMap, 'NONEXISTENT', 't1');

    expect(newState).toEqual(settingsMap);
    expect(JSON.parse(serialized)).toEqual(settingsMap);
  });

  // TEST 6: Trading pair entry persists after all thresholds deleted
  it('should keep trading pair entry after all thresholds deleted', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'SOLUSDT': {
        trendPriceId: 'SOLUSDT',
        thresholds: [createThreshold('t1', '100', { notifyOnIncrease: true })]
      }
    };

    const { serialized } = deleteAllThresholdsWithPersistence(settingsMap, 'SOLUSDT');
    const deserialized = deserializeSettings(serialized);

    expect(deserialized).not.toBeNull();
    expect('SOLUSDT' in deserialized!).toBe(true);
    expect(deserialized!['SOLUSDT'].trendPriceId).toBe('SOLUSDT');
    expect(deserialized!['SOLUSDT'].thresholds.length).toBe(0);
  });

  // TEST 7: Verify persisted state detects mismatch
  it('should detect mismatch in persisted state', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'DOTUSDT': {
        trendPriceId: 'DOTUSDT',
        thresholds: [
          createThreshold('t1', '5', { notifyOnIncrease: true }),
          createThreshold('t2', '6', { notifyOnDecrease: true })
        ]
      }
    };

    const { serialized } = removeThresholdWithPersistence(settingsMap, 'DOTUSDT', 't1');

    // Expect 1 threshold, but check for wrong count
    const result = verifyPersistedState(serialized, 5, 'DOTUSDT');
    expect(result.isValid).toBe(false);
    expect(result.actualCount).toBe(1);
  });

  // TEST 8: Deserialize invalid JSON returns null
  it('should return null for invalid JSON', () => {
    expect(deserializeSettings('not valid json')).toBeNull();
    expect(deserializeSettings('')).toBeNull();
    expect(deserializeSettings('{broken')).toBeNull();
  });

  // TEST 9: Add threshold to settings
  it('should add threshold to settings correctly', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {
      'LINKUSDT': {
        trendPriceId: 'LINKUSDT',
        thresholds: []
      }
    };

    const newThreshold = createThreshold('new-t1', '15', { notifyOnIncrease: true });
    const result = addThresholdToSettings(settingsMap, 'LINKUSDT', newThreshold);

    expect(result['LINKUSDT'].thresholds.length).toBe(1);
    expect(result['LINKUSDT'].thresholds[0].id).toBe('new-t1');
  });

  // TEST 10: Add threshold to non-existent pair creates new entry
  it('should create new pair entry when adding threshold to non-existent pair', () => {
    const settingsMap: Record<string, TrendPriceSettings> = {};

    const newThreshold = createThreshold('t1', '100', { notifyOnIncrease: true });
    const result = addThresholdToSettings(settingsMap, 'NEWPAIR', newThreshold);

    expect('NEWPAIR' in result).toBe(true);
    expect(result['NEWPAIR'].trendPriceId).toBe('NEWPAIR');
    expect(result['NEWPAIR'].thresholds.length).toBe(1);
  });

  // TEST 11: isThresholdComplete checks value and notification
  it('should correctly identify complete vs incomplete thresholds', () => {
    const complete = createThreshold('c1', '100', { notifyOnIncrease: true });
    const noValue = createThreshold('c2', '', { notifyOnIncrease: true });
    const noNotification = createThreshold('c3', '100', { notifyOnIncrease: false, notifyOnDecrease: false });
    const whitespaceValue = createThreshold('c4', '   ', { notifyOnIncrease: true });

    expect(isThresholdComplete(complete)).toBe(true);
    expect(isThresholdComplete(noValue)).toBe(false);
    expect(isThresholdComplete(noNotification)).toBe(false);
    expect(isThresholdComplete(whitespaceValue)).toBe(false);
  });

  // TEST 12: filterIncompleteThresholds removes incomplete ones
  it('should filter out incomplete thresholds correctly', () => {
    const thresholds = [
      createThreshold('complete-1', '100', { notifyOnIncrease: true }),
      createThreshold('incomplete-1', '', { notifyOnIncrease: true }),
      createThreshold('complete-2', '200', { notifyOnDecrease: true }),
      createThreshold('incomplete-2', '300', { notifyOnIncrease: false, notifyOnDecrease: false })
    ];

    const filtered = filterIncompleteThresholds(thresholds);

    expect(filtered.length).toBe(2);
    expect(filtered.map(t => t.id)).toContain('complete-1');
    expect(filtered.map(t => t.id)).toContain('complete-2');
    expect(filtered.map(t => t.id)).not.toContain('incomplete-1');
    expect(filtered.map(t => t.id)).not.toContain('incomplete-2');
  });
});
