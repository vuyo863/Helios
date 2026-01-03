/**
 * Alert Service - Handles threshold-based price alerts
 * 
 * This service evaluates whether a price crosses a threshold and
 * determines if an alert should be triggered based on the threshold's
 * isActive status and notification settings.
 */

export interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich';
  note: string;
  isActive: boolean;
}

export interface AlertResult {
  shouldTrigger: boolean;
  triggerType: 'increase' | 'decrease' | null;
  thresholdId: string;
  alarmLevel: string;
  message: string;
}

export interface PriceCheckParams {
  currentPrice: number;
  previousPrice: number;
  threshold: ThresholdConfig;
}

/**
 * Check if a threshold is active and can trigger alerts
 */
export function isThresholdActive(threshold: ThresholdConfig): boolean {
  if (threshold.isActive === undefined) {
    return true;
  }
  return threshold.isActive === true;
}

/**
 * Check if price crossed threshold from below (increase)
 */
export function didPriceCrossAbove(
  currentPrice: number,
  previousPrice: number,
  thresholdValue: number
): boolean {
  return previousPrice < thresholdValue && currentPrice >= thresholdValue;
}

/**
 * Check if price crossed threshold from above (decrease)
 */
export function didPriceCrossBelow(
  currentPrice: number,
  previousPrice: number,
  thresholdValue: number
): boolean {
  return previousPrice > thresholdValue && currentPrice <= thresholdValue;
}

/**
 * Evaluate if an alert should be triggered for a threshold
 */
export function evaluateThresholdAlert(params: PriceCheckParams): AlertResult {
  const { currentPrice, previousPrice, threshold } = params;
  
  const noTriggerResult: AlertResult = {
    shouldTrigger: false,
    triggerType: null,
    thresholdId: threshold.id,
    alarmLevel: threshold.alarmLevel,
    message: ''
  };

  if (!isThresholdActive(threshold)) {
    return {
      ...noTriggerResult,
      message: 'Threshold is paused (isActive=false)'
    };
  }

  const thresholdValue = parseFloat(threshold.threshold);
  if (isNaN(thresholdValue)) {
    return {
      ...noTriggerResult,
      message: 'Invalid threshold value'
    };
  }

  if (threshold.notifyOnIncrease && didPriceCrossAbove(currentPrice, previousPrice, thresholdValue)) {
    return {
      shouldTrigger: true,
      triggerType: 'increase',
      thresholdId: threshold.id,
      alarmLevel: threshold.alarmLevel,
      message: `Price increased above threshold: ${previousPrice} -> ${currentPrice} (threshold: ${thresholdValue})`
    };
  }

  if (threshold.notifyOnDecrease && didPriceCrossBelow(currentPrice, previousPrice, thresholdValue)) {
    return {
      shouldTrigger: true,
      triggerType: 'decrease',
      thresholdId: threshold.id,
      alarmLevel: threshold.alarmLevel,
      message: `Price decreased below threshold: ${previousPrice} -> ${currentPrice} (threshold: ${thresholdValue})`
    };
  }

  return {
    ...noTriggerResult,
    message: 'No threshold crossed'
  };
}

/**
 * Evaluate multiple thresholds for a single price update
 */
export function evaluateAllThresholds(
  currentPrice: number,
  previousPrice: number,
  thresholds: ThresholdConfig[]
): AlertResult[] {
  return thresholds.map(threshold => 
    evaluateThresholdAlert({ currentPrice, previousPrice, threshold })
  );
}

/**
 * Filter to get only triggered alerts
 */
export function getTriggeredAlerts(results: AlertResult[]): AlertResult[] {
  return results.filter(result => result.shouldTrigger);
}

/**
 * Get paused thresholds (for reporting/debugging)
 */
export function getPausedThresholds(thresholds: ThresholdConfig[]): ThresholdConfig[] {
  return thresholds.filter(t => !isThresholdActive(t));
}

/**
 * Get active thresholds only
 */
export function getActiveThresholds(thresholds: ThresholdConfig[]): ThresholdConfig[] {
  return thresholds.filter(t => isThresholdActive(t));
}

/**
 * Toggle threshold active status
 */
export function toggleThresholdStatus(threshold: ThresholdConfig, isActive: boolean): ThresholdConfig {
  return {
    ...threshold,
    isActive
  };
}

/**
 * Create a new threshold with default active status
 */
export function createThreshold(
  id: string,
  thresholdValue: string,
  options: Partial<Omit<ThresholdConfig, 'id' | 'threshold'>> = {}
): ThresholdConfig {
  return {
    id,
    threshold: thresholdValue,
    notifyOnIncrease: options.notifyOnIncrease ?? false,
    notifyOnDecrease: options.notifyOnDecrease ?? false,
    increaseFrequency: options.increaseFrequency ?? 'einmalig',
    decreaseFrequency: options.decreaseFrequency ?? 'einmalig',
    alarmLevel: options.alarmLevel ?? 'harmlos',
    note: options.note ?? '',
    isActive: options.isActive ?? true
  };
}

/**
 * Trading Pair Settings Interface
 */
export interface TrendPriceSettings {
  trendPriceId: string;
  thresholds: ThresholdConfig[];
}

/**
 * Delete all thresholds for a specific trading pair
 * Returns the updated settings with empty thresholds array
 */
export function deleteAllThresholdsForPair(settings: TrendPriceSettings): TrendPriceSettings {
  return {
    ...settings,
    thresholds: []
  };
}

/**
 * Delete all thresholds from a settings map for a specific pair
 * Preserves the watchlist entry (settings object) but clears thresholds
 */
export function deleteAllThresholdsFromMap(
  settingsMap: Record<string, TrendPriceSettings>,
  trendPriceId: string
): Record<string, TrendPriceSettings> {
  if (!settingsMap[trendPriceId]) {
    return settingsMap;
  }
  
  return {
    ...settingsMap,
    [trendPriceId]: {
      ...settingsMap[trendPriceId],
      thresholds: []
    }
  };
}

/**
 * Get threshold count for a trading pair
 */
export function getThresholdCount(settings: TrendPriceSettings | undefined): number {
  if (!settings) return 0;
  return settings.thresholds.length;
}

/**
 * Get active (configured) threshold count
 * Only counts thresholds with valid configuration
 */
export function getActiveThresholdCount(settings: TrendPriceSettings | undefined): number {
  if (!settings) return 0;
  return settings.thresholds.filter(t => 
    t.threshold && 
    t.threshold.trim() !== '' && 
    (t.notifyOnIncrease || t.notifyOnDecrease)
  ).length;
}

/**
 * Check if trading pair exists in settings map
 */
export function hasTradingPair(
  settingsMap: Record<string, TrendPriceSettings>,
  trendPriceId: string
): boolean {
  return trendPriceId in settingsMap;
}

/**
 * Check if thresholds are empty after deletion
 */
export function areThresholdsEmpty(settings: TrendPriceSettings | undefined): boolean {
  if (!settings) return true;
  return settings.thresholds.length === 0;
}

/**
 * Batch delete thresholds for multiple trading pairs
 */
export function batchDeleteThresholds(
  settingsMap: Record<string, TrendPriceSettings>,
  trendPriceIds: string[]
): Record<string, TrendPriceSettings> {
  let result = { ...settingsMap };
  
  for (const id of trendPriceIds) {
    result = deleteAllThresholdsFromMap(result, id);
  }
  
  return result;
}

/**
 * Delete a single threshold from a trading pair
 */
export function deleteSingleThreshold(
  settings: TrendPriceSettings,
  thresholdId: string
): TrendPriceSettings {
  return {
    ...settings,
    thresholds: settings.thresholds.filter(t => t.id !== thresholdId)
  };
}

/**
 * Count total thresholds across all trading pairs
 */
export function countTotalThresholds(
  settingsMap: Record<string, TrendPriceSettings>
): number {
  return Object.values(settingsMap).reduce(
    (total, settings) => total + settings.thresholds.length,
    0
  );
}

/**
 * Parse threshold input: accept comma as decimal separator (German format)
 * Converts German decimal format to standard format for internal processing
 */
export function parseThresholdInput(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(',', '.');
}

/**
 * Parse threshold value to number, accepting both comma and dot as decimal separator
 */
export function parseThresholdValue(value: string): number {
  if (!value || typeof value !== 'string') return NaN;
  const normalized = value.replace(',', '.');
  return parseFloat(normalized);
}

/**
 * Format threshold for display: German format (dot as thousands separator, comma as decimal)
 */
export function formatThresholdDisplay(value: string): string {
  if (!value || value.trim() === '') return '';
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return value;
  return num.toLocaleString('de-DE', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 8
  });
}

/**
 * Validate threshold input: check if value is a valid number
 */
export function isValidThresholdInput(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const normalized = value.replace(',', '.');
  const num = parseFloat(normalized);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * Evaluate threshold alert with comma-formatted threshold value
 * This handles German decimal format (comma as decimal separator)
 */
export function evaluateThresholdWithComma(params: PriceCheckParams): AlertResult {
  const { threshold } = params;
  const normalizedThreshold = {
    ...threshold,
    threshold: parseThresholdInput(threshold.threshold)
  };
  return evaluateThresholdAlert({ ...params, threshold: normalizedThreshold });
}
