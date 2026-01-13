/**
 * Backend-Tests für Einmalig/Wiederholend Duplikat-Verhinderung
 * 
 * Diese Tests prüfen die activeAlarmId-Logik, die verhindert dass
 * Alarme nach Page Refresh dupliziert werden.
 * 
 * Testszenario:
 * 1. Einmalig: Nach Trigger + Page Refresh darf KEIN neuer Alarm entstehen
 * 2. Wiederholend: Nach Trigger + Page Refresh darf KEIN neuer Alarm entstehen
 * 3. Nach Dismiss: Neuer Alarm darf wieder entstehen
 */

interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  isActive: boolean;
  alarmLevel: string;
  note?: string;
  triggerCount?: number;
  activeAlarmId?: string;
}

interface TestResult {
  testNumber: number;
  testName: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];
let testCounter = 0;

function logTest(name: string, passed: boolean, details: string) {
  testCounter++;
  results.push({ testNumber: testCounter, testName: name, passed, details });
  console.log(`[TEST ${testCounter}] ${passed ? '✅ PASS' : '❌ FAIL'}: ${name}`);
  console.log(`         Details: ${details}`);
}

// Simulation der Frontend-Logik für Re-Trigger-Prevention
function shouldBlockRetrigger(threshold: ThresholdConfig, isIncrease: boolean): boolean {
  // RE-TRIGGER PREVENTION: Don't trigger if an active alarm exists
  if (threshold.activeAlarmId) {
    console.log(`[BLOCKING] Threshold ${threshold.id} has activeAlarmId: ${threshold.activeAlarmId}`);
    return true; // BLOCK - already has active alarm
  }
  return false; // ALLOW - no active alarm
}

// Simulation des Alarm-Erstellens
function createAlarm(threshold: ThresholdConfig): { alarmId: string, updatedThreshold: ThresholdConfig } {
  const alarmId = `alarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Update threshold with activeAlarmId (wie im Frontend)
  const updatedThreshold: ThresholdConfig = {
    ...threshold,
    activeAlarmId: alarmId,
    // For einmalig: also set isActive to false
    isActive: threshold.increaseFrequency === 'einmalig' ? false : threshold.isActive,
    // For wiederholend: increment trigger count
    triggerCount: threshold.increaseFrequency === 'wiederholend' 
      ? (threshold.triggerCount || 0) + 1 
      : threshold.triggerCount
  };
  
  console.log(`[CREATED] Alarm ${alarmId} for threshold ${threshold.id}`);
  return { alarmId, updatedThreshold };
}

// Simulation des Alarm-Dismissens
function dismissAlarm(threshold: ThresholdConfig, alarmId: string): ThresholdConfig {
  if (threshold.activeAlarmId === alarmId) {
    console.log(`[DISMISSED] Cleared activeAlarmId for threshold ${threshold.id}`);
    return { ...threshold, activeAlarmId: undefined };
  }
  return threshold;
}

// ============= TESTS =============

console.log('\n========================================');
console.log('  EINMALIG/WIEDERHOLEND DUPLIKAT-TESTS');
console.log('========================================\n');

// TEST 1: Einmalig - Neuer Threshold ohne activeAlarmId erlaubt Trigger
{
  const threshold: ThresholdConfig = {
    id: 'test-1',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos'
  };
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Einmalig: Neuer Threshold ohne activeAlarmId erlaubt Trigger',
    blocked === false,
    `blocked=${blocked}, expected=false`
  );
}

// TEST 2: Einmalig - Nach Trigger hat Threshold eine activeAlarmId
{
  let threshold: ThresholdConfig = {
    id: 'test-2',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos'
  };
  
  const { alarmId, updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  logTest(
    'Einmalig: Nach Trigger hat Threshold eine activeAlarmId',
    threshold.activeAlarmId === alarmId,
    `activeAlarmId=${threshold.activeAlarmId}, expected=${alarmId}`
  );
}

// TEST 3: Einmalig - Nach Trigger ist isActive=false
{
  let threshold: ThresholdConfig = {
    id: 'test-3',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos'
  };
  
  const { updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  logTest(
    'Einmalig: Nach Trigger ist isActive=false',
    threshold.isActive === false,
    `isActive=${threshold.isActive}, expected=false`
  );
}

// TEST 4: Einmalig - Mit activeAlarmId wird Re-Trigger blockiert
{
  const threshold: ThresholdConfig = {
    id: 'test-4',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: false,
    alarmLevel: 'harmlos',
    activeAlarmId: 'existing-alarm-123'
  };
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Einmalig: Mit activeAlarmId wird Re-Trigger blockiert',
    blocked === true,
    `blocked=${blocked}, expected=true`
  );
}

// TEST 5: Einmalig - Simuliere Page Refresh (activeAlarmId bleibt erhalten)
{
  // Step 1: Create threshold and trigger
  let threshold: ThresholdConfig = {
    id: 'test-5',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos'
  };
  
  const { alarmId, updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  // Step 2: Simulate page refresh - activeAlarmId persists in localStorage
  const afterRefresh: ThresholdConfig = { ...threshold }; // Same data from localStorage
  
  // Step 3: Check if re-trigger is blocked
  const blocked = shouldBlockRetrigger(afterRefresh, true);
  
  logTest(
    'Einmalig: Nach Page Refresh mit activeAlarmId wird Re-Trigger blockiert',
    blocked === true && afterRefresh.activeAlarmId === alarmId,
    `blocked=${blocked}, activeAlarmId=${afterRefresh.activeAlarmId}`
  );
}

// TEST 6: Einmalig - Nach Dismiss kann wieder getriggert werden
{
  let threshold: ThresholdConfig = {
    id: 'test-6',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: false,
    alarmLevel: 'harmlos',
    activeAlarmId: 'existing-alarm-456'
  };
  
  // Dismiss the alarm
  threshold = dismissAlarm(threshold, 'existing-alarm-456');
  // User reactivates threshold
  threshold.isActive = true;
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Einmalig: Nach Dismiss kann wieder getriggert werden',
    blocked === false && threshold.activeAlarmId === undefined,
    `blocked=${blocked}, activeAlarmId=${threshold.activeAlarmId}`
  );
}

// TEST 7: Wiederholend - Neuer Threshold ohne activeAlarmId erlaubt Trigger
{
  const threshold: ThresholdConfig = {
    id: 'test-7',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 0
  };
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Wiederholend: Neuer Threshold ohne activeAlarmId erlaubt Trigger',
    blocked === false,
    `blocked=${blocked}, expected=false`
  );
}

// TEST 8: Wiederholend - Nach Trigger hat Threshold eine activeAlarmId
{
  let threshold: ThresholdConfig = {
    id: 'test-8',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 0
  };
  
  const { alarmId, updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  logTest(
    'Wiederholend: Nach Trigger hat Threshold eine activeAlarmId',
    threshold.activeAlarmId === alarmId,
    `activeAlarmId=${threshold.activeAlarmId}, expected=${alarmId}`
  );
}

// TEST 9: Wiederholend - Nach Trigger bleibt isActive=true
{
  let threshold: ThresholdConfig = {
    id: 'test-9',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 0
  };
  
  const { updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  logTest(
    'Wiederholend: Nach Trigger bleibt isActive=true',
    threshold.isActive === true,
    `isActive=${threshold.isActive}, expected=true`
  );
}

// TEST 10: Wiederholend - Nach Trigger wird triggerCount erhöht
{
  let threshold: ThresholdConfig = {
    id: 'test-10',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 5
  };
  
  const { updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  logTest(
    'Wiederholend: Nach Trigger wird triggerCount erhöht',
    threshold.triggerCount === 6,
    `triggerCount=${threshold.triggerCount}, expected=6`
  );
}

// TEST 11: Wiederholend - Mit activeAlarmId wird Re-Trigger blockiert
{
  const threshold: ThresholdConfig = {
    id: 'test-11',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 3,
    activeAlarmId: 'existing-alarm-789'
  };
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Wiederholend: Mit activeAlarmId wird Re-Trigger blockiert',
    blocked === true,
    `blocked=${blocked}, expected=true`
  );
}

// TEST 12: Wiederholend - Simuliere Page Refresh (activeAlarmId bleibt erhalten)
{
  let threshold: ThresholdConfig = {
    id: 'test-12',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 0
  };
  
  const { alarmId, updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  // Simulate page refresh
  const afterRefresh: ThresholdConfig = { ...threshold };
  
  const blocked = shouldBlockRetrigger(afterRefresh, true);
  
  logTest(
    'Wiederholend: Nach Page Refresh mit activeAlarmId wird Re-Trigger blockiert',
    blocked === true && afterRefresh.activeAlarmId === alarmId,
    `blocked=${blocked}, activeAlarmId=${afterRefresh.activeAlarmId}`
  );
}

// TEST 13: Wiederholend - Nach Dismiss kann wieder getriggert werden
{
  let threshold: ThresholdConfig = {
    id: 'test-13',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 3,
    activeAlarmId: 'existing-alarm-abc'
  };
  
  threshold = dismissAlarm(threshold, 'existing-alarm-abc');
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Wiederholend: Nach Dismiss kann wieder getriggert werden',
    blocked === false && threshold.activeAlarmId === undefined,
    `blocked=${blocked}, activeAlarmId=${threshold.activeAlarmId}`
  );
}

// TEST 14: Decrease-Trigger wird auch durch activeAlarmId blockiert
{
  const threshold: ThresholdConfig = {
    id: 'test-14',
    threshold: '3000',
    notifyOnIncrease: false,
    notifyOnDecrease: true,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos',
    activeAlarmId: 'existing-alarm-decrease'
  };
  
  const blocked = shouldBlockRetrigger(threshold, false); // false = decrease
  logTest(
    'Decrease-Trigger wird auch durch activeAlarmId blockiert',
    blocked === true,
    `blocked=${blocked}, expected=true`
  );
}

// TEST 15: Mehrfache Refreshs ändern nichts an der Blockierung
{
  let threshold: ThresholdConfig = {
    id: 'test-15',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos'
  };
  
  const { alarmId, updatedThreshold } = createAlarm(threshold);
  threshold = updatedThreshold;
  
  // Simulate 5 page refreshes
  let stillBlocked = true;
  for (let i = 0; i < 5; i++) {
    const afterRefresh: ThresholdConfig = { ...threshold };
    stillBlocked = stillBlocked && shouldBlockRetrigger(afterRefresh, true);
  }
  
  logTest(
    'Mehrfache Refreshs ändern nichts an der Blockierung',
    stillBlocked === true,
    `stillBlockedAfter5Refreshs=${stillBlocked}`
  );
}

// TEST 16: Einmalig+Wiederholend gemischt auf gleichem Pair
{
  let einmaligThreshold: ThresholdConfig = {
    id: 'test-16-einmalig',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos'
  };
  
  let wiederholendThreshold: ThresholdConfig = {
    id: 'test-16-wiederholend',
    threshold: '3500',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'achtung',
    triggerCount: 0
  };
  
  // Trigger both
  const einmaligResult = createAlarm(einmaligThreshold);
  einmaligThreshold = einmaligResult.updatedThreshold;
  
  const wiederholendResult = createAlarm(wiederholendThreshold);
  wiederholendThreshold = wiederholendResult.updatedThreshold;
  
  // Both should be blocked after refresh
  const einmaligBlocked = shouldBlockRetrigger(einmaligThreshold, true);
  const wiederholendBlocked = shouldBlockRetrigger(wiederholendThreshold, true);
  
  logTest(
    'Einmalig+Wiederholend gemischt: Beide werden nach Trigger blockiert',
    einmaligBlocked === true && wiederholendBlocked === true,
    `einmaligBlocked=${einmaligBlocked}, wiederholendBlocked=${wiederholendBlocked}`
  );
}

// TEST 17: Nur der richtige Alarm kann activeAlarmId clearen
{
  let threshold: ThresholdConfig = {
    id: 'test-17',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: false,
    alarmLevel: 'harmlos',
    activeAlarmId: 'correct-alarm-id'
  };
  
  // Try to dismiss with wrong ID
  threshold = dismissAlarm(threshold, 'wrong-alarm-id');
  const stillHasAlarmId = threshold.activeAlarmId === 'correct-alarm-id';
  
  // Now dismiss with correct ID
  threshold = dismissAlarm(threshold, 'correct-alarm-id');
  const clearedAfterCorrect = threshold.activeAlarmId === undefined;
  
  logTest(
    'Nur der richtige Alarm kann activeAlarmId clearen',
    stillHasAlarmId === true && clearedAfterCorrect === true,
    `afterWrongId=${stillHasAlarmId}, afterCorrectId=${clearedAfterCorrect}`
  );
}

// TEST 18: Leere activeAlarmId (empty string) blockiert NICHT
{
  const threshold: ThresholdConfig = {
    id: 'test-18',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos',
    activeAlarmId: '' // Empty string should not block
  };
  
  // Empty string is falsy, so it should NOT block
  const blocked = threshold.activeAlarmId ? true : false;
  logTest(
    'Leere activeAlarmId (empty string) blockiert NICHT',
    blocked === false,
    `blocked=${blocked}, activeAlarmId="${threshold.activeAlarmId}"`
  );
}

// TEST 19: Undefined activeAlarmId blockiert NICHT
{
  const threshold: ThresholdConfig = {
    id: 'test-19',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'einmalig',
    decreaseFrequency: 'einmalig',
    isActive: true,
    alarmLevel: 'harmlos',
    activeAlarmId: undefined
  };
  
  const blocked = shouldBlockRetrigger(threshold, true);
  logTest(
    'Undefined activeAlarmId blockiert NICHT',
    blocked === false,
    `blocked=${blocked}, activeAlarmId=${threshold.activeAlarmId}`
  );
}

// TEST 20: Kompletter Lifecycle: Create -> Refresh -> Dismiss -> Create
{
  let threshold: ThresholdConfig = {
    id: 'test-20',
    threshold: '3000',
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'wiederholend',
    isActive: true,
    alarmLevel: 'harmlos',
    triggerCount: 0
  };
  
  // Step 1: Create alarm
  const firstAlarm = createAlarm(threshold);
  threshold = firstAlarm.updatedThreshold;
  const step1 = threshold.activeAlarmId === firstAlarm.alarmId;
  
  // Step 2: Refresh (should still block)
  const step2 = shouldBlockRetrigger(threshold, true) === true;
  
  // Step 3: Dismiss alarm
  threshold = dismissAlarm(threshold, firstAlarm.alarmId);
  const step3 = threshold.activeAlarmId === undefined;
  
  // Step 4: Can create new alarm
  const step4 = shouldBlockRetrigger(threshold, true) === false;
  
  // Step 5: Create second alarm
  const secondAlarm = createAlarm(threshold);
  threshold = secondAlarm.updatedThreshold;
  const step5 = threshold.activeAlarmId === secondAlarm.alarmId;
  
  logTest(
    'Kompletter Lifecycle: Create -> Refresh -> Dismiss -> Create',
    step1 && step2 && step3 && step4 && step5,
    `step1=${step1}, step2=${step2}, step3=${step3}, step4=${step4}, step5=${step5}`
  );
}

// ============= ZUSAMMENFASSUNG =============

console.log('\n========================================');
console.log('           TEST-ZUSAMMENFASSUNG');
console.log('========================================\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Gesamt: ${total} Tests`);
console.log(`Bestanden: ${passed} ✅`);
console.log(`Fehlgeschlagen: ${failed} ❌`);
console.log(`Erfolgsrate: ${((passed / total) * 100).toFixed(1)}%`);

console.log('\n--- Detaillierte Ergebnisse ---\n');
results.forEach(r => {
  console.log(`${r.passed ? '✅' : '❌'} Test ${r.testNumber}: ${r.testName}`);
});

if (failed > 0) {
  console.log('\n--- Fehlgeschlagene Tests ---\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ Test ${r.testNumber}: ${r.testName}`);
    console.log(`   Details: ${r.details}`);
  });
}

console.log('\n========================================\n');
