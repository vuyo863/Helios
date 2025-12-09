/**
 * Core Backend Tests for Pionex Bot Profit Tracker
 * Focus: CRUD operations, status handling, data persistence
 * Target: Minimum 15 successful tests
 */

const BASE_URL = 'http://localhost:5000';

let testsPassed = 0;
let testsFailed = 0;
let testsRun = 0;

// Test data storage
let updateMetricsBotId = null;
let closedBotsBotId = null;
let longBotId = null;
let shortBotId = null;

let updateMetricsUpdate1Id = null;
let updateMetricsUpdate2Id = null;
let closedBotsUpdate1Id = null;
let closedBotsUpdate2Id = null;

async function logResult(testName, passed, details = '') {
  testsRun++;
  if (passed) {
    testsPassed++;
    console.log(`✓ TEST ${testsRun}: ${testName} - PASSED ${details ? `(${details})` : ''}`);
  } else {
    testsFailed++;
    console.log(`✗ TEST ${testsRun}: ${testName} - FAILED ${details ? `(${details})` : ''}`);
  }
}

// ============================================================
// TEST 1: Create Update Metrics Bot Type (Long+Short)
// ============================================================
async function test1() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Update Metrics Test Bot ' + Date.now(),
        description: 'Test für Update Metrics Modus',
        color: '#3498DB',
        direction: 'Long+Short'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      updateMetricsBotId = data.id;
      logResult('Create Update Metrics Bot Type', true, `ID: ${updateMetricsBotId}`);
      return true;
    }
    logResult('Create Update Metrics Bot Type', false, `Status: ${response.status}`);
    return false;
  } catch (error) {
    logResult('Create Update Metrics Bot Type', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 2: Create Closed Bots Bot Type (Long)
// ============================================================
async function test2() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Closed Bots Test Bot ' + Date.now(),
        description: 'Test für Closed Bots Modus',
        color: '#E74C3C',
        direction: 'Long'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      closedBotsBotId = data.id;
      logResult('Create Closed Bots Bot Type', true, `ID: ${closedBotsBotId}`);
      return true;
    }
    logResult('Create Closed Bots Bot Type', false, `Status: ${response.status}`);
    return false;
  } catch (error) {
    logResult('Create Closed Bots Bot Type', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 3: Create Long-only Bot Type
// ============================================================
async function test3() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Long Only Test ' + Date.now(),
        description: 'Nur Long-Positionen',
        color: '#27AE60',
        direction: 'Long'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      longBotId = data.id;
      logResult('Create Long-only Bot Type', true, `Direction: Long`);
      return true;
    }
    logResult('Create Long-only Bot Type', false);
    return false;
  } catch (error) {
    logResult('Create Long-only Bot Type', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 4: Create Short-only Bot Type
// ============================================================
async function test4() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Short Only Test ' + Date.now(),
        description: 'Nur Short-Positionen',
        color: '#9B59B6',
        direction: 'Short'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      shortBotId = data.id;
      logResult('Create Short-only Bot Type', true, `Direction: Short`);
      return true;
    }
    logResult('Create Short-only Bot Type', false);
    return false;
  } catch (error) {
    logResult('Create Short-only Bot Type', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 5: Save Update Metrics Startmetrik (Version 1)
// ============================================================
async function test5() {
  try {
    const updateData = {
      version: 1,
      status: 'Update Metrics',  // CRITICAL: This must be "Update Metrics"
      date: '2025-12-07',
      botName: 'ICP/USDT',
      botDirection: 'Long+Short',
      leverage: '24',
      longestRuntime: '19h 50m',
      avgRuntime: '19h 50m',
      investment: '2000',
      extraMargin: '0',
      totalInvestment: '2000',
      profit: '312.54',
      profitPercent: '15.62',
      overallTrendPnlUsdt: '74.22',
      overallTrendPnlPercent: '3.71',
      overallGridProfitUsdt: '238.31',
      overallGridProfitPercent: '11.91',
      highestGridProfit: '238.31',
      highestGridProfitPercent: '11.91',
      avgGridProfitUsdt: '238.31',
      avgGridProfitHour: '12.05',
      avgGridProfitDay: '289.20',
      avgGridProfitWeek: '2024.40',
      botCount: '1',
      notes: 'Startmetrik Test - Update Metrics'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      updateMetricsUpdate1Id = data.id;
      logResult('Save Update Metrics Startmetrik', true, `ID: ${updateMetricsUpdate1Id}`);
      return true;
    }
    logResult('Save Update Metrics Startmetrik', false, `Status: ${response.status}`);
    return false;
  } catch (error) {
    logResult('Save Update Metrics Startmetrik', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 6: Verify Update Metrics status is "Update Metrics"
// ============================================================
async function test6() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const update = updates.find(u => u.id === updateMetricsUpdate1Id);
      
      if (update && update.status === 'Update Metrics') {
        logResult('Verify Update Metrics Status', true, `Status: "${update.status}"`);
        return true;
      }
      logResult('Verify Update Metrics Status', false, `Status: "${update?.status}" (expected "Update Metrics")`);
      return false;
    }
    logResult('Verify Update Metrics Status', false);
    return false;
  } catch (error) {
    logResult('Verify Update Metrics Status', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 7: Save Closed Bots Startmetrik (Version 1)
// ============================================================
async function test7() {
  try {
    const updateData = {
      version: 1,
      status: 'Closed Bots',  // CRITICAL: This must be "Closed Bots"
      date: '2025-12-07',
      botName: 'ETH/USDT Closed',
      botDirection: 'Long',
      leverage: '10',
      longestRuntime: '5d 12h',
      avgRuntime: '5d 12h',
      investment: '5000',
      extraMargin: '500',
      totalInvestment: '5500',
      profit: '450.00',
      profitPercent: '8.18',
      overallTrendPnlUsdt: '150.00',
      overallTrendPnlPercent: '2.73',
      overallGridProfitUsdt: '300.00',
      overallGridProfitPercent: '5.45',
      highestGridProfit: '300.00',
      highestGridProfitPercent: '5.45',
      avgGridProfitUsdt: '300.00',
      avgGridProfitHour: '2.27',
      avgGridProfitDay: '54.55',
      avgGridProfitWeek: '381.82',
      botCount: '1',
      notes: 'Startmetrik Test - Closed Bots'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${closedBotsBotId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      closedBotsUpdate1Id = data.id;
      logResult('Save Closed Bots Startmetrik', true, `ID: ${closedBotsUpdate1Id}`);
      return true;
    }
    logResult('Save Closed Bots Startmetrik', false, `Status: ${response.status}`);
    return false;
  } catch (error) {
    logResult('Save Closed Bots Startmetrik', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 8: Verify Closed Bots status is "Closed Bots"
// ============================================================
async function test8() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${closedBotsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const update = updates.find(u => u.id === closedBotsUpdate1Id);
      
      if (update && update.status === 'Closed Bots') {
        logResult('Verify Closed Bots Status', true, `Status: "${update.status}"`);
        return true;
      }
      logResult('Verify Closed Bots Status', false, `Status: "${update?.status}" (expected "Closed Bots")`);
      return false;
    }
    logResult('Verify Closed Bots Status', false);
    return false;
  } catch (error) {
    logResult('Verify Closed Bots Status', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 9: Save second Update Metrics update (Version 2 - normal update)
// ============================================================
async function test9() {
  try {
    const updateData = {
      version: 2,
      status: 'Update Metrics',
      date: '2025-12-08',
      botName: 'ICP/USDT',
      botDirection: 'Long+Short',
      leverage: '24',
      longestRuntime: '1d 19h',
      avgRuntime: '1d 19h',
      investment: '2000',
      extraMargin: '0',
      totalInvestment: '2000',
      profit: '450.00',
      profitPercent: '22.50',
      overallTrendPnlUsdt: '100.00',
      overallTrendPnlPercent: '5.00',
      overallGridProfitUsdt: '350.00',
      overallGridProfitPercent: '17.50',
      highestGridProfit: '350.00',
      highestGridProfitPercent: '17.50',
      avgGridProfitUsdt: '350.00',
      avgGridProfitHour: '8.14',
      avgGridProfitDay: '195.36',
      avgGridProfitWeek: '1367.52',
      lastAvgGridProfitHour: '12.05',
      lastAvgGridProfitDay: '289.20',
      lastAvgGridProfitWeek: '2024.40',
      changeHourDollar: '-3.91',
      changeHourPercent: '-32.45',
      changeDayDollar: '-93.84',
      changeDayPercent: '-32.45',
      changeWeekDollar: '-656.88',
      changeWeekPercent: '-32.45',
      botCount: '1',
      notes: 'Normales Update #2 - Update Metrics'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      updateMetricsUpdate2Id = data.id;
      logResult('Save Second Update Metrics Update', true, `Version: 2`);
      return true;
    }
    logResult('Save Second Update Metrics Update', false);
    return false;
  } catch (error) {
    logResult('Save Second Update Metrics Update', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 10: Save second Closed Bots update (Version 2)
// ============================================================
async function test10() {
  try {
    const updateData = {
      version: 2,
      status: 'Closed Bots',
      date: '2025-12-09',
      botName: 'ETH/USDT Closed',
      botDirection: 'Long',
      leverage: '10',
      longestRuntime: '7d 0h',
      avgRuntime: '7d 0h',
      investment: '5000',
      extraMargin: '500',
      totalInvestment: '5500',
      profit: '650.00',
      profitPercent: '11.82',
      overallTrendPnlUsdt: '200.00',
      overallTrendPnlPercent: '3.64',
      overallGridProfitUsdt: '450.00',
      overallGridProfitPercent: '8.18',
      highestGridProfit: '450.00',
      highestGridProfitPercent: '8.18',
      avgGridProfitUsdt: '450.00',
      avgGridProfitHour: '2.68',
      avgGridProfitDay: '64.29',
      avgGridProfitWeek: '450.00',
      lastAvgGridProfitHour: '2.27',
      lastAvgGridProfitDay: '54.55',
      lastAvgGridProfitWeek: '381.82',
      changeHourDollar: '0.41',
      changeHourPercent: '18.06',
      changeDayDollar: '9.74',
      changeDayPercent: '17.85',
      changeWeekDollar: '68.18',
      changeWeekPercent: '17.85',
      botCount: '1',
      notes: 'Normales Update #2 - Closed Bots'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${closedBotsBotId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      closedBotsUpdate2Id = data.id;
      logResult('Save Second Closed Bots Update', true, `Version: 2`);
      return true;
    }
    logResult('Save Second Closed Bots Update', false);
    return false;
  } catch (error) {
    logResult('Save Second Closed Bots Update', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 11: Verify Update Metrics has 2 updates
// ============================================================
async function test11() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const passed = updates.length === 2;
      const allUpdateMetrics = updates.every(u => u.status === 'Update Metrics');
      logResult('Verify Update Metrics Has 2 Updates', passed && allUpdateMetrics, 
        `Count: ${updates.length}, All status "Update Metrics": ${allUpdateMetrics}`);
      return passed && allUpdateMetrics;
    }
    logResult('Verify Update Metrics Has 2 Updates', false);
    return false;
  } catch (error) {
    logResult('Verify Update Metrics Has 2 Updates', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 12: Verify Closed Bots has 2 updates
// ============================================================
async function test12() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${closedBotsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const passed = updates.length === 2;
      const allClosedBots = updates.every(u => u.status === 'Closed Bots');
      logResult('Verify Closed Bots Has 2 Updates', passed && allClosedBots, 
        `Count: ${updates.length}, All status "Closed Bots": ${allClosedBots}`);
      return passed && allClosedBots;
    }
    logResult('Verify Closed Bots Has 2 Updates', false);
    return false;
  } catch (error) {
    logResult('Verify Closed Bots Has 2 Updates', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 13: Verify profit calculation was saved correctly
// ============================================================
async function test13() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const v1 = updates.find(u => u.version === 1);
      const v2 = updates.find(u => u.version === 2);
      
      const v1Correct = v1 && v1.profit === '312.54' && v1.profitPercent === '15.62';
      const v2Correct = v2 && v2.profit === '450.00' && v2.profitPercent === '22.50';
      
      const passed = v1Correct && v2Correct;
      logResult('Verify Profit Calculations Saved', passed, 
        `V1: ${v1?.profit}/${v1?.profitPercent}%, V2: ${v2?.profit}/${v2?.profitPercent}%`);
      return passed;
    }
    logResult('Verify Profit Calculations Saved', false);
    return false;
  } catch (error) {
    logResult('Verify Profit Calculations Saved', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 14: Verify Grid Profit values saved correctly
// ============================================================
async function test14() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const v2 = updates.find(u => u.version === 2);
      
      const passed = v2 && 
        v2.overallGridProfitUsdt === '350.00' &&
        v2.avgGridProfitHour === '8.14' &&
        v2.avgGridProfitDay === '195.36' &&
        v2.avgGridProfitWeek === '1367.52';
      
      logResult('Verify Grid Profit Values Saved', passed, 
        `GridProfit: ${v2?.overallGridProfitUsdt}, Hour: ${v2?.avgGridProfitHour}`);
      return passed;
    }
    logResult('Verify Grid Profit Values Saved', false);
    return false;
  } catch (error) {
    logResult('Verify Grid Profit Values Saved', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 15: Verify Change values (Last Grid Profit Durchschnitt)
// ============================================================
async function test15() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const v2 = updates.find(u => u.version === 2);
      
      const passed = v2 && 
        v2.lastAvgGridProfitHour === '12.05' &&
        v2.changeHourDollar === '-3.91' &&
        v2.changeHourPercent === '-32.45';
      
      logResult('Verify Change Values Saved', passed, 
        `LastHour: ${v2?.lastAvgGridProfitHour}, Change$: ${v2?.changeHourDollar}, Change%: ${v2?.changeHourPercent}`);
      return passed;
    }
    logResult('Verify Change Values Saved', false);
    return false;
  } catch (error) {
    logResult('Verify Change Values Saved', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 16: Update notes via PATCH
// ============================================================
async function test16() {
  try {
    const newNotes = 'Updated via API test - ' + new Date().toISOString();
    
    const response = await fetch(`${BASE_URL}/api/bot-type-updates/${updateMetricsUpdate1Id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: newNotes })
    });
    
    if (response.ok) {
      const data = await response.json();
      const passed = data.notes === newNotes;
      logResult('Update Notes via PATCH', passed, 'Notes updated successfully');
      return passed;
    }
    logResult('Update Notes via PATCH', false);
    return false;
  } catch (error) {
    logResult('Update Notes via PATCH', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 17: Get all bot types
// ============================================================
async function test17() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`);
    
    if (response.ok) {
      const botTypes = await response.json();
      const foundUpdateMetrics = botTypes.find(bt => bt.id === updateMetricsBotId);
      const foundClosed = botTypes.find(bt => bt.id === closedBotsBotId);
      const foundLong = botTypes.find(bt => bt.id === longBotId);
      const foundShort = botTypes.find(bt => bt.id === shortBotId);
      
      const passed = foundUpdateMetrics && foundClosed && foundLong && foundShort;
      logResult('Get All Bot Types', passed, `Found all 4 test bot types`);
      return passed;
    }
    logResult('Get All Bot Types', false);
    return false;
  } catch (error) {
    logResult('Get All Bot Types', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 18: Verify bot directions are correct
// ============================================================
async function test18() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`);
    
    if (response.ok) {
      const botTypes = await response.json();
      const updateMetricsBot = botTypes.find(bt => bt.id === updateMetricsBotId);
      const closedBot = botTypes.find(bt => bt.id === closedBotsBotId);
      const longBot = botTypes.find(bt => bt.id === longBotId);
      const shortBot = botTypes.find(bt => bt.id === shortBotId);
      
      const passed = 
        updateMetricsBot?.direction === 'Long+Short' &&
        closedBot?.direction === 'Long' &&
        longBot?.direction === 'Long' &&
        shortBot?.direction === 'Short';
      
      logResult('Verify Bot Directions', passed, 
        `Directions: ${updateMetricsBot?.direction}, ${closedBot?.direction}, ${longBot?.direction}, ${shortBot?.direction}`);
      return passed;
    }
    logResult('Verify Bot Directions', false);
    return false;
  } catch (error) {
    logResult('Verify Bot Directions', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 19: Get all updates across all bot types
// ============================================================
async function test19() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-type-updates`);
    
    if (response.ok) {
      const updates = await response.json();
      // Should have at least 4 updates from our tests
      const passed = updates.length >= 4;
      logResult('Get All Updates', passed, `Total updates: ${updates.length}`);
      return passed;
    }
    logResult('Get All Updates', false);
    return false;
  } catch (error) {
    logResult('Get All Updates', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 20: Verify status separation in global updates
// ============================================================
async function test20() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-type-updates`);
    
    if (response.ok) {
      const updates = await response.json();
      
      // Count Update Metrics vs Closed Bots
      const updateMetricsCount = updates.filter(u => u.status === 'Update Metrics').length;
      const closedBotsCount = updates.filter(u => u.status === 'Closed Bots').length;
      
      const passed = updateMetricsCount >= 2 && closedBotsCount >= 2;
      logResult('Verify Status Separation', passed, 
        `Update Metrics: ${updateMetricsCount}, Closed Bots: ${closedBotsCount}`);
      return passed;
    }
    logResult('Verify Status Separation', false);
    return false;
  } catch (error) {
    logResult('Verify Status Separation', false, error.message);
    return false;
  }
}

// ============================================================
// Cleanup
// ============================================================
async function cleanup() {
  console.log('\n[CLEANUP] Removing test data...');
  
  try {
    if (updateMetricsBotId) {
      await fetch(`${BASE_URL}/api/bot-types/${updateMetricsBotId}`, { method: 'DELETE' });
    }
    if (closedBotsBotId) {
      await fetch(`${BASE_URL}/api/bot-types/${closedBotsBotId}`, { method: 'DELETE' });
    }
    if (longBotId) {
      await fetch(`${BASE_URL}/api/bot-types/${longBotId}`, { method: 'DELETE' });
    }
    if (shortBotId) {
      await fetch(`${BASE_URL}/api/bot-types/${shortBotId}`, { method: 'DELETE' });
    }
    console.log('[CLEANUP] Test data removed successfully');
  } catch (error) {
    console.log(`[CLEANUP] Error: ${error.message}`);
  }
}

// ============================================================
// Main
// ============================================================
async function runAllTests() {
  console.log('\n========================================');
  console.log('CORE BACKEND TESTS');
  console.log('Pionex Bot Profit Tracker');
  console.log('Focus: Status handling, CRUD, Persistence');
  console.log('========================================\n');
  
  await test1();
  await test2();
  await test3();
  await test4();
  await test5();
  await test6();
  await test7();
  await test8();
  await test9();
  await test10();
  await test11();
  await test12();
  await test13();
  await test14();
  await test15();
  await test16();
  await test17();
  await test18();
  await test19();
  await test20();
  
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total tests run: ${testsRun}`);
  console.log(`PASSED: ${testsPassed}`);
  console.log(`FAILED: ${testsFailed}`);
  console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
  
  if (testsPassed >= 15) {
    console.log('\n✓ MINIMUM 15 TESTS PASSED - TARGET ACHIEVED!');
  } else {
    console.log(`\n✗ TARGET NOT MET - Need ${15 - testsPassed} more passing tests`);
  }
  console.log('========================================\n');
  
  await cleanup();
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

runAllTests();
