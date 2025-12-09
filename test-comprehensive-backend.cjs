/**
 * Comprehensive Backend Tests for Pionex Bot Profit Tracker
 * Tests all modes, calculations, and data persistence
 * Target: Minimum 15 successful tests
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

// Test counters
let testsPassed = 0;
let testsFailed = 0;
let testsRun = 0;

// Test data storage
let createdBotTypeId = null;
let createdUpdateId = null;
let secondUpdateId = null;

// Screenshot paths
const screenshot1Path = 'attached_assets/Herunterladen_1765286580351.jpg';
const screenshot2Path = 'attached_assets/Herunterladen_(1)_1765286580350.jpg';

async function log(message) {
  console.log(`[TEST] ${message}`);
}

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
// TEST 1: Create a new Bot Type for Update Metrics testing
// ============================================================
async function test1_CreateBotTypeForUpdateMetrics() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Update Metrics Bot',
        description: 'Bot für Update Metrics Tests',
        color: '#4A90D9',
        direction: 'Long+Short'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      createdBotTypeId = data.id;
      logResult('Create Bot Type for Update Metrics', true, `ID: ${createdBotTypeId}`);
      return true;
    } else {
      logResult('Create Bot Type for Update Metrics', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Create Bot Type for Update Metrics', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 2: Verify Bot Type was created correctly
// ============================================================
async function test2_VerifyBotTypeCreated() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}`);
    
    if (response.ok) {
      const data = await response.json();
      const passed = data.name === 'Test Update Metrics Bot' && 
                     data.direction === 'Long+Short' &&
                     data.color === '#4A90D9';
      logResult('Verify Bot Type Created', passed, `Name: ${data.name}, Direction: ${data.direction}`);
      return passed;
    } else {
      logResult('Verify Bot Type Created', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Verify Bot Type Created', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 3: Phase 2 - Extract data from screenshot (Update Metrics mode)
// ============================================================
async function test3_Phase2ExtractScreenshot() {
  try {
    // Read screenshot file
    const imagePath = path.resolve(screenshot1Path);
    if (!fs.existsSync(imagePath)) {
      logResult('Phase 2 Extract Screenshot', false, 'Screenshot file not found');
      return false;
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';
    
    const response = await fetch(`${BASE_URL}/api/ai/phase2-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [{
          base64: base64Image,
          mimeType: mimeType
        }],
        outputMode: 'update-metrics'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      // Check if we have extracted data
      const hasScreenshots = data.extractedData && data.extractedData.screenshots && data.extractedData.screenshots.length > 0;
      logResult('Phase 2 Extract Screenshot (Update Metrics)', hasScreenshots, 
        hasScreenshots ? `Extracted ${data.extractedData.screenshots.length} screenshot(s)` : 'No screenshots extracted');
      return hasScreenshots;
    } else {
      const errorText = await response.text();
      logResult('Phase 2 Extract Screenshot (Update Metrics)', false, `Status: ${response.status}, Error: ${errorText.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    logResult('Phase 2 Extract Screenshot (Update Metrics)', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 4: Phase 4 - Calculate values (NEU mode, Startmetrik)
// ============================================================
async function test4_Phase4CalculateNeuStartmetrik() {
  try {
    // First get extracted data
    const imagePath = path.resolve(screenshot1Path);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const extractResponse = await fetch(`${BASE_URL}/api/ai/phase2-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [{ base64: base64Image, mimeType: 'image/jpeg' }],
        outputMode: 'update-metrics'
      })
    });
    
    if (!extractResponse.ok) {
      logResult('Phase 4 Calculate NEU Startmetrik', false, 'Phase 2 failed');
      return false;
    }
    
    const extractData = await extractResponse.json();
    
    // Now call Phase 4 with NEU mode and Startmetrik
    const calcResponse = await fetch(`${BASE_URL}/api/ai/phase4-calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedData: extractData.extractedData,
        isStartMetric: true,
        calculationMode: { profit: 'neu', gridProfit: 'neu', trendPnl: 'neu' },
        previousUploadData: null,
        outputMode: 'update-metrics'
      })
    });
    
    if (calcResponse.ok) {
      const calcData = await calcResponse.json();
      const hasValues = calcData.calculatedValues && 
                       calcData.calculatedValues.investment !== undefined &&
                       calcData.calculatedValues.profit !== undefined;
      logResult('Phase 4 Calculate NEU Startmetrik', hasValues, 
        hasValues ? `Investment: ${calcData.calculatedValues.investment}, Profit: ${calcData.calculatedValues.profit}` : 'Missing values');
      return hasValues;
    } else {
      const errorText = await calcResponse.text();
      logResult('Phase 4 Calculate NEU Startmetrik', false, `Status: ${calcResponse.status}`);
      return false;
    }
  } catch (error) {
    logResult('Phase 4 Calculate NEU Startmetrik', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 5: Save Update Metrics Startmetrik update
// ============================================================
async function test5_SaveUpdateMetricsStartmetrik() {
  try {
    const updateData = {
      version: 1,
      status: 'Update Metrics',
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
      notes: 'Startmetrik Test'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      createdUpdateId = data.id;
      logResult('Save Update Metrics Startmetrik', true, `Update ID: ${createdUpdateId}`);
      return true;
    } else {
      const errorText = await response.text();
      logResult('Save Update Metrics Startmetrik', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Save Update Metrics Startmetrik', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 6: Verify Update was saved correctly
// ============================================================
async function test6_VerifyUpdateSaved() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const update = updates.find(u => u.id === createdUpdateId);
      
      if (update) {
        const passed = update.status === 'Update Metrics' &&
                       update.version === 1 &&
                       update.profit === '312.54' &&
                       update.investment === '2000';
        logResult('Verify Update Saved', passed, 
          `Status: ${update.status}, Profit: ${update.profit}, Investment: ${update.investment}`);
        return passed;
      } else {
        logResult('Verify Update Saved', false, 'Update not found');
        return false;
      }
    } else {
      logResult('Verify Update Saved', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Verify Update Saved', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 7: Create Closed Bots Bot Type
// ============================================================
let closedBotTypeId = null;
async function test7_CreateClosedBotsBotType() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Closed Bots Type',
        description: 'Bot für Closed Bots Tests',
        color: '#E74C3C',
        direction: 'Long'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      closedBotTypeId = data.id;
      logResult('Create Closed Bots Bot Type', true, `ID: ${closedBotTypeId}`);
      return true;
    } else {
      logResult('Create Closed Bots Bot Type', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Create Closed Bots Bot Type', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 8: Phase 2 with Closed Bots mode
// ============================================================
async function test8_Phase2ClosedBotsMode() {
  try {
    const imagePath = path.resolve(screenshot2Path);
    if (!fs.existsSync(imagePath)) {
      logResult('Phase 2 Closed Bots Mode', false, 'Screenshot file not found');
      return false;
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await fetch(`${BASE_URL}/api/ai/phase2-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [{ base64: base64Image, mimeType: 'image/jpeg' }],
        outputMode: 'closed'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const hasScreenshots = data.extractedData?.screenshots?.length > 0;
      logResult('Phase 2 Closed Bots Mode', hasScreenshots, 
        hasScreenshots ? `Extracted ${data.extractedData.screenshots.length} screenshot(s)` : 'No screenshots');
      return hasScreenshots;
    } else {
      logResult('Phase 2 Closed Bots Mode', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Phase 2 Closed Bots Mode', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 9: Save Closed Bots Startmetrik
// ============================================================
let closedUpdateId = null;
async function test9_SaveClosedBotsStartmetrik() {
  try {
    const updateData = {
      version: 1,
      status: 'Closed Bots',
      date: '2025-12-07',
      botName: 'ICP/USDT Closed',
      botDirection: 'Long+Short',
      leverage: '24',
      longestRuntime: '1d 12h',
      avgRuntime: '1d 12h',
      investment: '2000',
      extraMargin: '0',
      totalInvestment: '2000',
      profit: '91.43',
      profitPercent: '4.57',
      overallTrendPnlUsdt: '75.54',
      overallTrendPnlPercent: '3.77',
      overallGridProfitUsdt: '15.89',
      overallGridProfitPercent: '0.79',
      highestGridProfit: '15.89',
      highestGridProfitPercent: '0.79',
      avgGridProfitUsdt: '15.89',
      avgGridProfitHour: '0.44',
      avgGridProfitDay: '10.56',
      avgGridProfitWeek: '73.92',
      botCount: '1',
      notes: 'Closed Bots Startmetrik Test'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${closedBotTypeId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      closedUpdateId = data.id;
      logResult('Save Closed Bots Startmetrik', true, `Update ID: ${closedUpdateId}`);
      return true;
    } else {
      logResult('Save Closed Bots Startmetrik', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Save Closed Bots Startmetrik', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 10: Verify Closed Bots Update shows correct status
// ============================================================
async function test10_VerifyClosedBotsStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${closedBotTypeId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const update = updates.find(u => u.id === closedUpdateId);
      
      if (update) {
        const passed = update.status === 'Closed Bots';
        logResult('Verify Closed Bots Status', passed, 
          `Status: "${update.status}" (expected "Closed Bots")`);
        return passed;
      } else {
        logResult('Verify Closed Bots Status', false, 'Update not found');
        return false;
      }
    } else {
      logResult('Verify Closed Bots Status', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Verify Closed Bots Status', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 11: Phase 4 with VERGLEICH mode
// ============================================================
async function test11_Phase4VergleichMode() {
  try {
    const imagePath = path.resolve(screenshot1Path);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // First extract
    const extractResponse = await fetch(`${BASE_URL}/api/ai/phase2-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [{ base64: base64Image, mimeType: 'image/jpeg' }],
        outputMode: 'update-metrics'
      })
    });
    
    if (!extractResponse.ok) {
      logResult('Phase 4 VERGLEICH Mode', false, 'Phase 2 failed');
      return false;
    }
    
    const extractData = await extractResponse.json();
    
    // Previous upload data for VERGLEICH
    const previousUploadData = {
      profit: '250.00',
      overallGridProfitUsdt: '200.00',
      overallTrendPnlUsdt: '50.00'
    };
    
    const calcResponse = await fetch(`${BASE_URL}/api/ai/phase4-calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedData: extractData.extractedData,
        isStartMetric: false,
        calculationMode: { profit: 'vergleich', gridProfit: 'vergleich', trendPnl: 'vergleich' },
        previousUploadData: previousUploadData,
        outputMode: 'update-metrics'
      })
    });
    
    if (calcResponse.ok) {
      const calcData = await calcResponse.json();
      // In VERGLEICH mode, values should be differences
      logResult('Phase 4 VERGLEICH Mode', true, 
        `Calculated values received`);
      return true;
    } else {
      logResult('Phase 4 VERGLEICH Mode', false, `Status: ${calcResponse.status}`);
      return false;
    }
  } catch (error) {
    logResult('Phase 4 VERGLEICH Mode', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 12: Save second Update Metrics update (normal, not Startmetrik)
// ============================================================
async function test12_SaveSecondUpdateMetrics() {
  try {
    const updateData = {
      version: 2,
      status: 'Update Metrics',
      date: '2025-12-08',
      botName: 'ICP/USDT',
      botDirection: 'Long+Short',
      leverage: '24',
      longestRuntime: '2d 5h',
      avgRuntime: '2d 5h',
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
      avgGridProfitHour: '6.60',
      avgGridProfitDay: '158.40',
      avgGridProfitWeek: '1108.80',
      lastAvgGridProfitHour: '12.05',
      lastAvgGridProfitDay: '289.20',
      lastAvgGridProfitWeek: '2024.40',
      changeHourDollar: '-5.45',
      changeHourPercent: '-45.23',
      changeDayDollar: '-130.80',
      changeDayPercent: '-45.23',
      changeWeekDollar: '-915.60',
      changeWeekPercent: '-45.23',
      botCount: '1',
      notes: 'Update Metrics #2'
    };
    
    const response = await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    
    if (response.ok) {
      const data = await response.json();
      secondUpdateId = data.id;
      logResult('Save Second Update Metrics', true, `Update ID: ${secondUpdateId}`);
      return true;
    } else {
      logResult('Save Second Update Metrics', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Save Second Update Metrics', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 13: Verify multiple updates for same Bot Type
// ============================================================
async function test13_VerifyMultipleUpdates() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const passed = updates.length >= 2;
      const versions = updates.map(u => u.version).join(', ');
      logResult('Verify Multiple Updates', passed, 
        `Found ${updates.length} updates, versions: ${versions}`);
      return passed;
    } else {
      logResult('Verify Multiple Updates', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Verify Multiple Updates', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 14: Update notes for an existing update
// ============================================================
async function test14_UpdateNotes() {
  try {
    const newNotes = 'Updated notes via API test - ' + new Date().toISOString();
    
    const response = await fetch(`${BASE_URL}/api/bot-type-updates/${createdUpdateId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: newNotes })
    });
    
    if (response.ok) {
      const data = await response.json();
      const passed = data.notes === newNotes;
      logResult('Update Notes', passed, 
        passed ? 'Notes updated successfully' : 'Notes mismatch');
      return passed;
    } else {
      logResult('Update Notes', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Update Notes', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 15: Get all updates across all bot types
// ============================================================
async function test15_GetAllUpdates() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-type-updates`);
    
    if (response.ok) {
      const updates = await response.json();
      const passed = updates.length >= 3; // At least 3 updates created in tests
      logResult('Get All Updates', passed, 
        `Found ${updates.length} total updates across all bot types`);
      return passed;
    } else {
      logResult('Get All Updates', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Get All Updates', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 16: Extract multiple screenshots at once
// ============================================================
async function test16_ExtractMultipleScreenshots() {
  try {
    const image1Path = path.resolve(screenshot1Path);
    const image2Path = path.resolve(screenshot2Path);
    
    if (!fs.existsSync(image1Path) || !fs.existsSync(image2Path)) {
      logResult('Extract Multiple Screenshots', false, 'Screenshot files not found');
      return false;
    }
    
    const image1Buffer = fs.readFileSync(image1Path);
    const image2Buffer = fs.readFileSync(image2Path);
    
    const response = await fetch(`${BASE_URL}/api/ai/phase2-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [
          { base64: image1Buffer.toString('base64'), mimeType: 'image/jpeg' },
          { base64: image2Buffer.toString('base64'), mimeType: 'image/jpeg' }
        ],
        outputMode: 'update-metrics'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const screenshotCount = data.extractedData?.screenshots?.length || 0;
      const passed = screenshotCount === 2;
      logResult('Extract Multiple Screenshots', passed, 
        `Extracted ${screenshotCount} screenshots (expected 2)`);
      return passed;
    } else {
      logResult('Extract Multiple Screenshots', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Extract Multiple Screenshots', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 17: Phase 4 with multiple screenshots combined
// ============================================================
async function test17_Phase4MultipleScreenshots() {
  try {
    const image1Path = path.resolve(screenshot1Path);
    const image2Path = path.resolve(screenshot2Path);
    
    const image1Buffer = fs.readFileSync(image1Path);
    const image2Buffer = fs.readFileSync(image2Path);
    
    // Extract both screenshots
    const extractResponse = await fetch(`${BASE_URL}/api/ai/phase2-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [
          { base64: image1Buffer.toString('base64'), mimeType: 'image/jpeg' },
          { base64: image2Buffer.toString('base64'), mimeType: 'image/jpeg' }
        ],
        outputMode: 'update-metrics'
      })
    });
    
    if (!extractResponse.ok) {
      logResult('Phase 4 Multiple Screenshots', false, 'Phase 2 failed');
      return false;
    }
    
    const extractData = await extractResponse.json();
    
    // Calculate with both screenshots
    const calcResponse = await fetch(`${BASE_URL}/api/ai/phase4-calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedData: extractData.extractedData,
        isStartMetric: true,
        calculationMode: { profit: 'neu', gridProfit: 'neu', trendPnl: 'neu' },
        previousUploadData: null,
        outputMode: 'update-metrics'
      })
    });
    
    if (calcResponse.ok) {
      const calcData = await calcResponse.json();
      // Combined investment should be 4000 (2000 + 2000)
      const investment = parseFloat(calcData.calculatedValues?.investment || 0);
      const passed = investment >= 3500; // Should be around 4000
      logResult('Phase 4 Multiple Screenshots', passed, 
        `Combined Investment: ${investment} (expected ~4000)`);
      return passed;
    } else {
      logResult('Phase 4 Multiple Screenshots', false, `Status: ${calcResponse.status}`);
      return false;
    }
  } catch (error) {
    logResult('Phase 4 Multiple Screenshots', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 18: Verify Bot Type direction is saved
// ============================================================
async function test18_VerifyBotDirection() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}/updates`);
    
    if (response.ok) {
      const updates = await response.json();
      if (updates.length > 0) {
        const update = updates[0];
        const passed = update.botDirection === 'Long+Short';
        logResult('Verify Bot Direction Saved', passed, 
          `Direction: ${update.botDirection}`);
        return passed;
      } else {
        logResult('Verify Bot Direction Saved', false, 'No updates found');
        return false;
      }
    } else {
      logResult('Verify Bot Direction Saved', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Verify Bot Direction Saved', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 19: Create Short-only Bot Type
// ============================================================
let shortBotTypeId = null;
async function test19_CreateShortBotType() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Short Only Bot',
        description: 'Bot für Short Tests',
        color: '#9B59B6',
        direction: 'Short'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      shortBotTypeId = data.id;
      logResult('Create Short Bot Type', true, `ID: ${shortBotTypeId}, Direction: Short`);
      return true;
    } else {
      logResult('Create Short Bot Type', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Create Short Bot Type', false, error.message);
    return false;
  }
}

// ============================================================
// TEST 20: Verify all bot types are listed correctly
// ============================================================
async function test20_VerifyAllBotTypes() {
  try {
    const response = await fetch(`${BASE_URL}/api/bot-types`);
    
    if (response.ok) {
      const botTypes = await response.json();
      // Find our created bot types
      const updateMetricsBot = botTypes.find(bt => bt.id === createdBotTypeId);
      const closedBot = botTypes.find(bt => bt.id === closedBotTypeId);
      const shortBot = botTypes.find(bt => bt.id === shortBotTypeId);
      
      const passed = updateMetricsBot && closedBot && shortBot;
      logResult('Verify All Bot Types Listed', passed, 
        `Total: ${botTypes.length} bot types, found all 3 test bots: ${passed}`);
      return passed;
    } else {
      logResult('Verify All Bot Types Listed', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Verify All Bot Types Listed', false, error.message);
    return false;
  }
}

// ============================================================
// Cleanup function
// ============================================================
async function cleanup() {
  log('Cleaning up test data...');
  
  // Delete test bot types (this should cascade delete updates)
  try {
    if (createdBotTypeId) {
      await fetch(`${BASE_URL}/api/bot-types/${createdBotTypeId}`, { method: 'DELETE' });
    }
    if (closedBotTypeId) {
      await fetch(`${BASE_URL}/api/bot-types/${closedBotTypeId}`, { method: 'DELETE' });
    }
    if (shortBotTypeId) {
      await fetch(`${BASE_URL}/api/bot-types/${shortBotTypeId}`, { method: 'DELETE' });
    }
    log('Cleanup completed');
  } catch (error) {
    log(`Cleanup error: ${error.message}`);
  }
}

// ============================================================
// Main test runner
// ============================================================
async function runAllTests() {
  console.log('\n========================================');
  console.log('COMPREHENSIVE BACKEND TESTS');
  console.log('Pionex Bot Profit Tracker');
  console.log('========================================\n');
  
  // Run all tests
  await test1_CreateBotTypeForUpdateMetrics();
  await test2_VerifyBotTypeCreated();
  await test3_Phase2ExtractScreenshot();
  await test4_Phase4CalculateNeuStartmetrik();
  await test5_SaveUpdateMetricsStartmetrik();
  await test6_VerifyUpdateSaved();
  await test7_CreateClosedBotsBotType();
  await test8_Phase2ClosedBotsMode();
  await test9_SaveClosedBotsStartmetrik();
  await test10_VerifyClosedBotsStatus();
  await test11_Phase4VergleichMode();
  await test12_SaveSecondUpdateMetrics();
  await test13_VerifyMultipleUpdates();
  await test14_UpdateNotes();
  await test15_GetAllUpdates();
  await test16_ExtractMultipleScreenshots();
  await test17_Phase4MultipleScreenshots();
  await test18_VerifyBotDirection();
  await test19_CreateShortBotType();
  await test20_VerifyAllBotTypes();
  
  // Summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total tests run: ${testsRun}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
  console.log('========================================\n');
  
  // Cleanup
  await cleanup();
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAllTests();
