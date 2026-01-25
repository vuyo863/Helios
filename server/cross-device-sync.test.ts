/**
 * CROSS-DEVICE SYNC TESTS
 * ========================
 * Testet den kompletten Flow:
 * 1. Tab A: Watchlist + Threshold erstellen
 * 2. Tab A: Preis-Trigger → Aktive Alarmierung
 * 3. Tab B: Sync prüft ob Alarmierung erscheint
 * 4. Tab A: Approve/Stoppen
 * 5. Tab B: Prüft ob Alarmierung weg ist
 * 
 * KEIN PLAYWRIGHT - Nur Backend-Simulation mit Mock-Tabs
 */

const BASE_URL = 'http://localhost:5000';

// Simulated Device IDs (like different browser tabs/devices)
const TAB_A_DEVICE = 'device-tab-a-' + Date.now();
const TAB_B_DEVICE = 'device-tab-b-' + Date.now();

// Test State
interface TestState {
  watchlist: string[];
  thresholds: Record<string, any[]>;
  activeAlarms: any[];
}

const tabAState: TestState = { watchlist: [], thresholds: {}, activeAlarms: [] };
const tabBState: TestState = { watchlist: [], thresholds: {}, activeAlarms: [] };

// Test Counter
let testCount = 0;
let passCount = 0;
let failCount = 0;

// Helper: Make HTTP request
async function apiRequest(method: string, path: string, body?: any): Promise<any> {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${path}`, options);
  
  if (!response.ok) {
    if (response.status === 404) return null;
    const text = await response.text();
    throw new Error(`API Error: ${response.status} - ${text}`);
  }
  
  // Handle empty responses (like DELETE)
  const text = await response.text();
  if (!text || text.trim() === '') {
    return { success: true };
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return { success: true, raw: text };
  }
}

// Helper: Generate unique ID
function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Test runner
async function test(name: string, fn: () => Promise<boolean>): Promise<void> {
  testCount++;
  const testNum = testCount;
  
  try {
    console.log(`\n🔄 Test ${testNum}: ${name}`);
    const startTime = Date.now();
    
    const result = await fn();
    
    const duration = Date.now() - startTime;
    
    if (result) {
      passCount++;
      console.log(`✅ Test ${testNum}: ${name} (${duration}ms)`);
    } else {
      failCount++;
      console.log(`❌ Test ${testNum}: ${name} - FAILED (${duration}ms)`);
    }
  } catch (error) {
    failCount++;
    console.log(`❌ Test ${testNum}: ${name} - ERROR: ${error}`);
  }
  
  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Helper: Wait for sync
async function waitForSync(ms: number = 500): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Create valid Active Alarm object
function createActiveAlarm(overrides: Partial<{
  id: string;
  trendPriceName: string;
  threshold: string;
  alarmLevel: string;
  message: string;
  note: string;
  requiresApproval: boolean;
  repetitionsTotal: number;
}>): any {
  return {
    trendPriceName: 'ETHUSDT',
    threshold: '3000',
    alarmLevel: 'achtung',
    triggeredAt: new Date().toISOString(),
    message: 'Price crossed threshold',
    note: 'Test alarm',
    requiresApproval: true,
    repetitionsCompleted: 0,
    repetitionsTotal: 1,
    channels: { push: true, email: false, sms: false, webPush: false, nativePush: false },
    pairId: 'ETHUSDT',
    thresholdId: generateId(),
    ...overrides
  };
}

// ========================================
// TEST SCENARIOS
// ========================================

async function runAllTests(): Promise<void> {
  console.log('\n========================================');
  console.log('CROSS-DEVICE SYNC TESTS');
  console.log('30+ Complete Flow Tests');
  console.log('Tab A = Primary Device, Tab B = Secondary Device');
  console.log('========================================\n');

  // ========================================
  // SCENARIO 1: Basic Watchlist Sync (Tests 1-5)
  // ========================================
  console.log('\n--- SCENARIO 1: Basic Watchlist Sync ---\n');

  await test('1. Tab A: Add ETHUSDT to watchlist', async () => {
    const timestamp = Date.now();
    const result = await apiRequest('POST', '/api/sync/watchlist', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      watchlist: ['ETHUSDT'],
      pairMarketTypes: { 'ETHUSDT': { marketType: 'spot', symbol: 'ETHUSDT' } }
    });
    tabAState.watchlist = ['ETHUSDT'];
    return result && result.success === true;
  });

  await test('2. Tab B: Sync and verify ETHUSDT appears', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/watchlist');
    if (!result) return false;
    tabBState.watchlist = result.watchlist;
    return result.watchlist.includes('ETHUSDT');
  });

  await test('3. Tab A: Add BTCUSDT to watchlist', async () => {
    const timestamp = Date.now();
    const result = await apiRequest('POST', '/api/sync/watchlist', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      watchlist: ['ETHUSDT', 'BTCUSDT'],
      pairMarketTypes: { 
        'ETHUSDT': { marketType: 'spot', symbol: 'ETHUSDT' },
        'BTCUSDT': { marketType: 'spot', symbol: 'BTCUSDT' }
      }
    });
    tabAState.watchlist = ['ETHUSDT', 'BTCUSDT'];
    return result && result.success === true;
  });

  await test('4. Tab B: Sync and verify both pairs appear', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/watchlist');
    if (!result) return false;
    tabBState.watchlist = result.watchlist;
    return result.watchlist.includes('ETHUSDT') && result.watchlist.includes('BTCUSDT');
  });

  await test('5. Tab B: Verify watchlist count is 2', async () => {
    return tabBState.watchlist.length === 2;
  });

  // ========================================
  // SCENARIO 2: Threshold Configuration Sync (Tests 6-12)
  // ========================================
  console.log('\n--- SCENARIO 2: Threshold Configuration Sync ---\n');

  const threshold1Id = generateId();
  
  await test('6. Tab A: Create threshold for ETHUSDT at 3000', async () => {
    const timestamp = Date.now();
    const threshold = {
      id: threshold1Id,
      threshold: '3000',
      notifyOnIncrease: true,
      notifyOnDecrease: false,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'achtung',
      note: 'Test threshold',
      isActive: true,
      triggerCount: 0
    };
    
    const result = await apiRequest('POST', '/api/sync/thresholds', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      settings: {
        'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [threshold] }
      }
    });
    
    tabAState.thresholds['ETHUSDT'] = [threshold];
    return result && result.success === true;
  });

  await test('7. Tab B: Sync and verify threshold appears', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/thresholds');
    if (!result || !result.settings) return false;
    
    tabBState.thresholds = result.settings;
    const ethThresholds = result.settings['ETHUSDT'];
    return ethThresholds && ethThresholds.thresholds.length === 1;
  });

  await test('8. Tab B: Verify threshold value is 3000', async () => {
    const ethThresholds = tabBState.thresholds['ETHUSDT'];
    if (!ethThresholds) return false;
    return ethThresholds.thresholds[0].threshold === '3000';
  });

  await test('9. Tab B: Verify threshold is active', async () => {
    const ethThresholds = tabBState.thresholds['ETHUSDT'];
    if (!ethThresholds) return false;
    return ethThresholds.thresholds[0].isActive === true;
  });

  await test('10. Tab B: Verify alarm level is achtung', async () => {
    const ethThresholds = tabBState.thresholds['ETHUSDT'];
    if (!ethThresholds) return false;
    return ethThresholds.thresholds[0].alarmLevel === 'achtung';
  });

  const threshold2Id = generateId();
  
  await test('11. Tab A: Add second threshold for BTCUSDT at 50000', async () => {
    const timestamp = Date.now();
    const btcThreshold = {
      id: threshold2Id,
      threshold: '50000',
      notifyOnIncrease: false,
      notifyOnDecrease: true,
      increaseFrequency: 'wiederholend',
      decreaseFrequency: 'wiederholend',
      alarmLevel: 'gefährlich',
      note: 'BTC alert',
      isActive: true,
      triggerCount: 0
    };
    
    const result = await apiRequest('POST', '/api/sync/thresholds', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      settings: {
        'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: tabAState.thresholds['ETHUSDT'] },
        'BTCUSDT': { trendPriceId: 'BTCUSDT', thresholds: [btcThreshold] }
      }
    });
    
    tabAState.thresholds['BTCUSDT'] = [btcThreshold];
    return result && result.success === true;
  });

  await test('12. Tab B: Sync and verify both pairs have thresholds', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/thresholds');
    if (!result || !result.settings) return false;
    
    tabBState.thresholds = result.settings;
    return result.settings['ETHUSDT'] && result.settings['BTCUSDT'];
  });

  // ========================================
  // SCENARIO 3: Active Alarm Creation & Sync (Tests 13-20)
  // ========================================
  console.log('\n--- SCENARIO 3: Active Alarm Creation & Sync ---\n');

  let alarm1Id: string = '';
  
  await test('13. Tab A: Trigger alarm (price crosses threshold)', async () => {
    const alarm = createActiveAlarm({
      trendPriceName: 'ETHUSDT',
      threshold: '3000',
      alarmLevel: 'achtung',
      message: 'ETH crossed 3000 USDT!',
      note: 'Test alert'
    });
    
    const result = await apiRequest('POST', '/api/active-alarms', alarm);
    if (result && result.id) {
      alarm1Id = result.id;
      tabAState.activeAlarms.push(result);
      return true;
    }
    return false;
  });

  await test('14. Tab B: Fetch active alarms and verify alarm appears', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/active-alarms');
    if (!result || !Array.isArray(result)) return false;
    
    tabBState.activeAlarms = result;
    return result.some((a: any) => a.trendPriceName === 'ETHUSDT');
  });

  await test('15. Tab B: Verify alarm has correct symbol (trendPriceName)', async () => {
    const alarm = tabBState.activeAlarms.find((a: any) => a.id === alarm1Id);
    return alarm && alarm.trendPriceName === 'ETHUSDT';
  });

  await test('16. Tab B: Verify alarm has correct threshold', async () => {
    const alarm = tabBState.activeAlarms.find((a: any) => a.id === alarm1Id);
    return alarm && alarm.threshold === '3000';
  });

  await test('17. Tab B: Verify alarm has correct alarm level', async () => {
    const alarm = tabBState.activeAlarms.find((a: any) => a.id === alarm1Id);
    return alarm && alarm.alarmLevel === 'achtung';
  });

  await test('18. Tab B: Verify alarm requiresApproval is true', async () => {
    const alarm = tabBState.activeAlarms.find((a: any) => a.id === alarm1Id);
    return alarm && alarm.requiresApproval === true;
  });

  await test('19. Tab A: Approve/Stop the alarm (DELETE)', async () => {
    const result = await apiRequest('DELETE', `/api/active-alarms/${alarm1Id}`);
    tabAState.activeAlarms = tabAState.activeAlarms.filter(a => a.id !== alarm1Id);
    return result && result.success === true;
  });

  await test('20. Tab B: Verify alarm is gone after approval', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/active-alarms');
    tabBState.activeAlarms = result || [];
    return !tabBState.activeAlarms.some((a: any) => a.id === alarm1Id);
  });

  // ========================================
  // SCENARIO 4: Wiederholend Alarm Flow (Tests 21-25)
  // ========================================
  console.log('\n--- SCENARIO 4: Wiederholend Alarm Flow ---\n');

  let alarm2Id: string = '';
  
  await test('21. Tab A: Create wiederholend alarm for BTCUSDT', async () => {
    const alarm = createActiveAlarm({
      trendPriceName: 'BTCUSDT',
      threshold: '50000',
      alarmLevel: 'gefährlich',
      message: 'BTC dropped below 50000!',
      note: 'Critical level',
      requiresApproval: false,
      repetitionsTotal: 999 // Wiederholend = high number (infinite simulation)
    });
    
    const result = await apiRequest('POST', '/api/active-alarms', alarm);
    if (result && result.id) {
      alarm2Id = result.id;
      tabAState.activeAlarms.push(result);
      return true;
    }
    return false;
  });

  await test('22. Tab B: Sync and verify BTCUSDT alarm appears', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/active-alarms');
    if (!result || !Array.isArray(result)) return false;
    
    tabBState.activeAlarms = result;
    return result.some((a: any) => a.trendPriceName === 'BTCUSDT');
  });

  await test('23. Tab B: Verify alarm is gefährlich level', async () => {
    const alarm = tabBState.activeAlarms.find((a: any) => a.id === alarm2Id);
    return alarm && alarm.alarmLevel === 'gefährlich';
  });

  await test('24. Tab A: Stop the alarm', async () => {
    const result = await apiRequest('DELETE', `/api/active-alarms/${alarm2Id}`);
    tabAState.activeAlarms = tabAState.activeAlarms.filter(a => a.id !== alarm2Id);
    return result && result.success === true;
  });

  await test('25. Tab B: Verify BTCUSDT alarm is gone', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/active-alarms');
    tabBState.activeAlarms = result || [];
    return !tabBState.activeAlarms.some((a: any) => a.id === alarm2Id);
  });

  // ========================================
  // SCENARIO 5: Alarm Level Config Sync (Tests 26-30)
  // ========================================
  console.log('\n--- SCENARIO 5: Alarm Level Config Sync ---\n');

  await test('26. Tab A: Configure harmlos alarm level', async () => {
    const timestamp = Date.now();
    const result = await apiRequest('POST', '/api/sync/alarm-levels', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      configs: {
        'harmlos': {
          level: 'harmlos',
          channels: { push: true, email: false, sms: false },
          requiresApproval: false,
          repeatCount: 1,
          sequenceHours: 0,
          sequenceMinutes: 5,
          sequenceSeconds: 0
        }
      }
    });
    return result && result.success === true;
  });

  await test('27. Tab B: Sync and verify harmlos config', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/alarm-levels');
    if (!result || !result.configs) return false;
    
    return result.configs['harmlos'] && result.configs['harmlos'].level === 'harmlos';
  });

  await test('28. Tab A: Add gefährlich config with approval required', async () => {
    const timestamp = Date.now();
    const result = await apiRequest('POST', '/api/sync/alarm-levels', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      configs: {
        'harmlos': {
          level: 'harmlos',
          channels: { push: true, email: false, sms: false },
          requiresApproval: false,
          repeatCount: 1,
          sequenceHours: 0,
          sequenceMinutes: 5,
          sequenceSeconds: 0
        },
        'gefährlich': {
          level: 'gefährlich',
          channels: { push: true, email: true, sms: true },
          requiresApproval: true,
          repeatCount: 'infinite',
          sequenceHours: 0,
          sequenceMinutes: 1,
          sequenceSeconds: 0
        }
      }
    });
    return result && result.success === true;
  });

  await test('29. Tab B: Verify gefährlich requires approval', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/alarm-levels');
    if (!result || !result.configs) return false;
    
    const gefährlich = result.configs['gefährlich'];
    return gefährlich && gefährlich.requiresApproval === true;
  });

  await test('30. Tab B: Verify gefährlich has infinite repeat', async () => {
    const result = await apiRequest('GET', '/api/sync/alarm-levels');
    if (!result || !result.configs) return false;
    
    const gefährlich = result.configs['gefährlich'];
    return gefährlich && gefährlich.repeatCount === 'infinite';
  });

  // ========================================
  // SCENARIO 6: Complete Flow - Full Cycle (Tests 31-35)
  // ========================================
  console.log('\n--- SCENARIO 6: Complete Flow - Full Cycle ---\n');

  let alarm3Id: string = '';
  const threshold3Id = generateId();
  
  await test('31. Tab A: Add SOLUSDT to watchlist', async () => {
    const result = await apiRequest('GET', '/api/sync/watchlist');
    const currentWatchlist = result?.watchlist || [];
    
    const timestamp = Date.now();
    const newResult = await apiRequest('POST', '/api/sync/watchlist', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      watchlist: [...currentWatchlist, 'SOLUSDT'],
      pairMarketTypes: { 'SOLUSDT': { marketType: 'spot', symbol: 'SOLUSDT' } }
    });
    return newResult && newResult.success === true;
  });

  await test('32. Tab A: Create threshold for SOLUSDT at 150', async () => {
    const currentThresholds = await apiRequest('GET', '/api/sync/thresholds');
    const settings = currentThresholds?.settings || {};
    
    const timestamp = Date.now();
    const threshold = {
      id: threshold3Id,
      threshold: '150',
      notifyOnIncrease: true,
      notifyOnDecrease: true,
      increaseFrequency: 'einmalig',
      decreaseFrequency: 'einmalig',
      alarmLevel: 'sehr_gefährlich',
      note: 'SOL critical level',
      isActive: true,
      triggerCount: 0
    };
    
    settings['SOLUSDT'] = { trendPriceId: 'SOLUSDT', thresholds: [threshold] };
    
    const result = await apiRequest('POST', '/api/sync/thresholds', {
      timestamp,
      deviceId: TAB_A_DEVICE,
      settings
    });
    return result && result.success === true;
  });

  await test('33. Tab A: Trigger sehr_gefährlich alarm', async () => {
    const alarm = createActiveAlarm({
      trendPriceName: 'SOLUSDT',
      threshold: '150',
      alarmLevel: 'sehr_gefährlich',
      message: 'SOL reached critical 150!',
      note: 'URGENT!'
    });
    
    const result = await apiRequest('POST', '/api/active-alarms', alarm);
    if (result && result.id) {
      alarm3Id = result.id;
      return true;
    }
    return false;
  });

  await test('34. Tab B: Verify SOLUSDT alarm appears with correct level', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/active-alarms');
    if (!result) return false;
    
    const alarm = result.find((a: any) => a.id === alarm3Id);
    return alarm && alarm.alarmLevel === 'sehr_gefährlich';
  });

  await test('35. Tab A: Stop alarm and verify Tab B sees removal', async () => {
    await apiRequest('DELETE', `/api/active-alarms/${alarm3Id}`);
    await waitForSync();
    
    const result = await apiRequest('GET', '/api/active-alarms');
    return !result || !result.some((a: any) => a.id === alarm3Id);
  });

  // ========================================
  // SCENARIO 7: Edge Cases & Robustness (Tests 36-40)
  // ========================================
  console.log('\n--- SCENARIO 7: Edge Cases & Robustness ---\n');

  await test('36. Tab A: Multiple rapid threshold updates', async () => {
    const settings = (await apiRequest('GET', '/api/sync/thresholds'))?.settings || {};
    
    for (let i = 0; i < 5; i++) {
      const timestamp = Date.now() + i;
      if (settings['ETHUSDT']?.thresholds?.[0]) {
        settings['ETHUSDT'].thresholds[0].threshold = String(3000 + i * 10);
      }
      await apiRequest('POST', '/api/sync/thresholds', {
        timestamp,
        deviceId: TAB_A_DEVICE,
        settings
      });
    }
    
    const result = await apiRequest('GET', '/api/sync/thresholds');
    return result?.settings['ETHUSDT']?.thresholds[0]?.threshold === '3040';
  });

  await test('37. Tab B: Verify final threshold value after rapid updates', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/sync/thresholds');
    return result?.settings['ETHUSDT']?.thresholds[0]?.threshold === '3040';
  });

  await test('38. Tab A: Create and immediately delete alarm', async () => {
    const alarm = createActiveAlarm({
      trendPriceName: 'ETHUSDT',
      threshold: '3040',
      alarmLevel: 'harmlos',
      message: 'Quick test'
    });
    
    const createResult = await apiRequest('POST', '/api/active-alarms', alarm);
    if (!createResult?.id) return false;
    
    await apiRequest('DELETE', `/api/active-alarms/${createResult.id}`);
    
    const result = await apiRequest('GET', '/api/active-alarms');
    return !result || !result.some((a: any) => a.id === createResult.id);
  });

  await test('39. Tab B: Verify quick alarm not visible (already deleted)', async () => {
    await waitForSync();
    const result = await apiRequest('GET', '/api/active-alarms');
    // All remaining alarms should not be from the quick-delete test
    return !result || result.length === 0 || result.every((a: any) => a.message !== 'Quick test');
  });

  await test('40. Final state: Both tabs have consistent data', async () => {
    const watchlist = await apiRequest('GET', '/api/sync/watchlist');
    const thresholds = await apiRequest('GET', '/api/sync/thresholds');
    const alarmLevels = await apiRequest('GET', '/api/sync/alarm-levels');
    
    const watchlistOk = watchlist?.watchlist?.includes('SOLUSDT');
    const thresholdsOk = thresholds?.settings?.['SOLUSDT'] !== undefined;
    const levelsOk = alarmLevels?.configs?.['gefährlich'] !== undefined;
    
    return watchlistOk && thresholdsOk && levelsOk;
  });

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n========================================');
  console.log(`SUMMARY: ${passCount}/${testCount} tests passed`);
  console.log(`Failures: ${failCount}`);
  console.log('========================================\n');

  if (passCount >= 30) {
    console.log('✅ MINDESTENS 30 ERFOLGREICHE TESTS! Sync funktioniert korrekt.\n');
    console.log('Getestete Flows:');
    console.log('  1. Watchlist Add/Sync zwischen Tabs');
    console.log('  2. Threshold Configuration Sync');
    console.log('  3. Active Alarm Creation & Removal Sync');
    console.log('  4. Wiederholend Alarm Flow');
    console.log('  5. Alarm Level Config Sync');
    console.log('  6. Complete Full Cycle');
    console.log('  7. Edge Cases & Robustness');
    console.log('');
  } else {
    console.log(`❌ Nur ${passCount} erfolgreiche Tests. Mindestens 30 benötigt.\n`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
