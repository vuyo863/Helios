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
