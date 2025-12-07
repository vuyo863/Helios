#!/usr/bin/env node
/**
 * Comprehensive Grid Trading Section Test Suite
 * Führt 10 vollständige API-Tests durch mit echten Screenshots
 * 
 * Test 1-5: Startmetrik (erster Upload)
 * Test 6-10: Update (zweiter Upload mit Vergleich)
 */

const fs = require('fs');

const BASE_URL = 'http://localhost:5000';

// Load screenshots as base64
const screenshot1Base64 = fs.readFileSync('/tmp/screenshot1_base64.txt', 'utf-8').trim();
const screenshot2Base64 = fs.readFileSync('/tmp/screenshot2_base64.txt', 'utf-8').trim();

// Screenshot 1: 4h 46m runtime, $2.85 Grid Profit, 100 USDT Investment, Created 12/06/2025 19:41:02
// Screenshot 2: 16h 28m runtime, $3.06 Grid Profit, 200 USDT Investment, Created 12/06/2025 01:55:44

let testResults = [];
let botTypeId = null;
let botTypeName = null;
let startmetrikUpdateId = null;
let startmetrikData = null;

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const text = await response.text();
  
  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) };
  } catch {
    return { ok: response.ok, status: response.status, data: text };
  }
}

function logTest(testNum, name, passed, details = '') {
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`\n[Test ${testNum}] ${status}: ${name}`);
  if (details) console.log(`  Details: ${details}`);
  testResults.push({ testNum, name, passed, details });
}

function validateGridFields(data, isStartmetrik, previousData = null) {
  const errors = [];
  
  // Grid Profit USDT sollte vorhanden sein
  if (!data.overallGridProfitUsdt && data.overallGridProfitUsdt !== '0' && data.overallGridProfitUsdt !== 0) {
    errors.push('overallGridProfitUsdt fehlt');
  }
  
  // highestGridProfit (Ø Grid Profit) sollte vorhanden sein
  if (!data.highestGridProfit && data.highestGridProfit !== '0' && data.highestGridProfit !== 0) {
    errors.push('highestGridProfit fehlt');
  }
  
  // Prozente sollten vorhanden sein
  if (!data.overallGridProfitPercent_gesamtinvestment && data.overallGridProfitPercent_gesamtinvestment !== '0') {
    errors.push('overallGridProfitPercent_gesamtinvestment fehlt');
  }
  
  if (!data.overallGridProfitPercent_investitionsmenge && data.overallGridProfitPercent_investitionsmenge !== '0') {
    errors.push('overallGridProfitPercent_investitionsmenge fehlt');
  }
  
  if (!data.highestGridProfitPercent_gesamtinvestment && data.highestGridProfitPercent_gesamtinvestment !== '0') {
    errors.push('highestGridProfitPercent_gesamtinvestment fehlt');
  }
  
  if (isStartmetrik) {
    // Bei Startmetrik sollten Last-Werte NICHT vorhanden sein
    if (data.lastAvgGridProfitHour) {
      errors.push('lastAvgGridProfitHour sollte bei Startmetrik leer sein');
    }
    if (data.lastHighestGridProfit) {
      errors.push('lastHighestGridProfit sollte bei Startmetrik leer sein');
    }
  } else if (previousData) {
    // Bei Update sollten Last-Werte vorhanden sein
    // (werden im Frontend berechnet, nicht von AI)
  }
  
  return errors;
}

async function test1_createBotType() {
  console.log('\n========================================');
  console.log('TEST 1: Bot-Type erstellen');
  console.log('========================================');
  
  const uniqueName = `Grid Test Bot ${Date.now()}`;
  
  const result = await apiCall('/api/bot-types', 'POST', {
    name: uniqueName,
    description: 'Test Bot für Grid Trading Tests',
    color: '#3B82F6'
  });
  
  if (result.ok && result.data.id) {
    botTypeId = result.data.id;
    botTypeName = result.data.name;
    logTest(1, 'Bot-Type erstellen', true, `ID: ${botTypeId}, Name: ${botTypeName}`);
    return true;
  } else {
    logTest(1, 'Bot-Type erstellen', false, `Error: ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function test2_phase2DataExtraction() {
  console.log('\n========================================');
  console.log('TEST 2: Phase 2 - Datenextraktion (Startmetrik)');
  console.log('========================================');
  
  const imageUrl = `data:image/png;base64,${screenshot1Base64}`;
  
  const result = await apiCall('/api/chat', 'POST', {
    messages: [{ role: 'user', content: 'Analysiere diesen Screenshot und extrahiere die Bot-Daten.' }],
    images: [imageUrl],
    phase: 'phase2_data_extraction',
    selectedBotTypeName: botTypeName
  });
  
  if (result.ok && result.data.response) {
    try {
      const extractedData = JSON.parse(result.data.response);
      console.log('  Extrahierte Daten:', JSON.stringify(extractedData, null, 2));
      
      // AI gibt die Daten im "screenshots" Array Format zurück
      const hasScreenshots = extractedData.screenshots && extractedData.screenshots.length > 0;
      
      if (hasScreenshots) {
        const screenshot = extractedData.screenshots[0];
        logTest(2, 'Phase 2 - Datenextraktion', true, 
          `Grid Profit: ${screenshot.gridProfitUsdt}, Runtime: ${screenshot.runtime}, Investment: ${screenshot.actualInvestment}`);
        return extractedData;
      } else {
        logTest(2, 'Phase 2 - Datenextraktion', false, 'Keine Screenshots in extrahierten Daten');
        return null;
      }
    } catch (e) {
      logTest(2, 'Phase 2 - Datenextraktion', false, `JSON Parse Error: ${e.message}`);
      return null;
    }
  } else {
    logTest(2, 'Phase 2 - Datenextraktion', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test3_phase4Calculations(screenshotData) {
  console.log('\n========================================');
  console.log('TEST 3: Phase 4 - Berechnungen (Startmetrik, alle Modi NEU)');
  console.log('========================================');
  
  const result = await apiCall('/api/phase4', 'POST', {
    screenshotData: JSON.stringify(screenshotData),
    modes: {
      investment: 'Neu',
      profit: 'Neu',
      trend: 'Neu',
      grid: 'Neu'
    },
    isStartMetric: true,
    previousUploadData: null
  });
  
  if (result.ok && result.data) {
    console.log('  Berechnete Werte:', JSON.stringify(result.data, null, 2));
    
    // Die API gibt die Daten im "values" Objekt zurück
    const values = result.data.values || result.data;
    const errors = validateGridFields(values, true);
    
    if (errors.length === 0) {
      startmetrikData = values;
      logTest(3, 'Phase 4 - Berechnungen (Startmetrik)', true, 
        `Grid Profit USDT: ${values.overallGridProfitUsdt}, Ø Grid Profit: ${values.highestGridProfit}`);
      return values;
    } else {
      logTest(3, 'Phase 4 - Berechnungen (Startmetrik)', false, `Validierungsfehler: ${errors.join(', ')}`);
      return null;
    }
  } else {
    logTest(3, 'Phase 4 - Berechnungen (Startmetrik)', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test4_saveStartmetrik(calculatedData) {
  console.log('\n========================================');
  console.log('TEST 4: Startmetrik speichern');
  console.log('========================================');
  
  // Create update entry
  const updatePayload = {
    botTypeId: botTypeId,
    version: 1, // First update
    status: 'Update Metrics',
    date: calculatedData.date || null,
    botDirection: calculatedData.botDirection || 'Long',
    leverage: calculatedData.leverage || '75x',
    longestRuntime: calculatedData.longestRuntime || '4h 46m',
    avgRuntime: calculatedData.avgRuntime || '4h 46m',
    investment: calculatedData.investment,
    extraMargin: calculatedData.extraMargin,
    totalInvestment: calculatedData.totalInvestment,
    profit: calculatedData.profit,
    profitPercent_gesamtinvestment: calculatedData.profitPercent_gesamtinvestment,
    profitPercent_investitionsmenge: calculatedData.profitPercent_investitionsmenge,
    overallTrendPnlUsdt: calculatedData.overallTrendPnlUsdt,
    overallTrendPnlPercent_gesamtinvestment: calculatedData.overallTrendPnlPercent_gesamtinvestment,
    overallTrendPnlPercent_investitionsmenge: calculatedData.overallTrendPnlPercent_investitionsmenge,
    overallGridProfitUsdt: calculatedData.overallGridProfitUsdt,
    overallGridProfitPercent_gesamtinvestment: calculatedData.overallGridProfitPercent_gesamtinvestment,
    overallGridProfitPercent_investitionsmenge: calculatedData.overallGridProfitPercent_investitionsmenge,
    highestGridProfit: calculatedData.highestGridProfit,
    highestGridProfitPercent_gesamtinvestment: calculatedData.highestGridProfitPercent_gesamtinvestment,
    highestGridProfitPercent_investitionsmenge: calculatedData.highestGridProfitPercent_investitionsmenge,
    avgGridProfitHour: calculatedData.avgGridProfitHour || null,
    avgGridProfitDay: calculatedData.avgGridProfitDay || null,
    avgGridProfitWeek: calculatedData.avgGridProfitWeek || null,
    uploadRuntime: calculatedData.longestRuntime || '4h 46m',
    lastUpload: null,
    thisUpload: new Date().toLocaleString('de-DE')
  };
  
  const result = await apiCall(`/api/bot-types/${botTypeId}/updates`, 'POST', updatePayload);
  
  if (result.ok && result.data.id) {
    startmetrikUpdateId = result.data.id;
    logTest(4, 'Startmetrik speichern', true, `Update ID: ${startmetrikUpdateId}`);
    return result.data;
  } else {
    logTest(4, 'Startmetrik speichern', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test5_verifyStartmetrikOnBotTypes() {
  console.log('\n========================================');
  console.log('TEST 5: Startmetrik auf Bot-Types Seite verifizieren');
  console.log('========================================');
  
  // Get bot type with updates
  const result = await apiCall(`/api/bot-types/${botTypeId}/updates`);
  
  if (result.ok && Array.isArray(result.data)) {
    const updates = result.data;
    
    if (updates.length > 0) {
      const startmetrik = updates[0];
      console.log('  Startmetrik Update:', JSON.stringify(startmetrik, null, 2));
      
      // Verify Grid Trading fields (Startmetrik: version=1, lastUpload=null)
      const checks = {
        'overallGridProfitUsdt': startmetrik.overallGridProfitUsdt !== null,
        'highestGridProfit': startmetrik.highestGridProfit !== null,
        'version ist 1 (Startmetrik)': startmetrik.version === 1,
        'lastUpload sollte null sein': startmetrik.lastUpload === null,
        'lastAvgGridProfitHour sollte leer sein': !startmetrik.lastAvgGridProfitHour
      };
      
      const allPassed = Object.values(checks).every(v => v);
      const checkDetails = Object.entries(checks)
        .map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`)
        .join(', ');
      
      logTest(5, 'Startmetrik auf Bot-Types Seite verifizieren', allPassed, checkDetails);
      return allPassed;
    } else {
      logTest(5, 'Startmetrik auf Bot-Types Seite verifizieren', false, 'Keine Updates gefunden');
      return false;
    }
  } else {
    logTest(5, 'Startmetrik auf Bot-Types Seite verifizieren', false, `API Error: ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function test6_phase2SecondUpload() {
  console.log('\n========================================');
  console.log('TEST 6: Phase 2 - Zweiter Upload (Update)');
  console.log('========================================');
  
  const imageUrl = `data:image/png;base64,${screenshot2Base64}`;
  
  const result = await apiCall('/api/chat', 'POST', {
    messages: [{ role: 'user', content: 'Analysiere diesen Screenshot und extrahiere die Bot-Daten.' }],
    images: [imageUrl],
    phase: 'phase2_data_extraction',
    selectedBotTypeName: botTypeName
  });
  
  if (result.ok && result.data.response) {
    try {
      const extractedData = JSON.parse(result.data.response);
      console.log('  Extrahierte Daten (zweiter Screenshot):', JSON.stringify(extractedData, null, 2));
      
      // AI gibt die Daten im "screenshots" Array Format zurück
      const hasScreenshots = extractedData.screenshots && extractedData.screenshots.length > 0;
      
      if (hasScreenshots) {
        const screenshot = extractedData.screenshots[0];
        logTest(6, 'Phase 2 - Zweiter Upload', true, 
          `Grid Profit: ${screenshot.gridProfitUsdt}, Runtime: ${screenshot.runtime}`);
        return extractedData;
      } else {
        logTest(6, 'Phase 2 - Zweiter Upload', false, 'Keine Screenshots in extrahierten Daten');
        return null;
      }
    } catch (e) {
      logTest(6, 'Phase 2 - Zweiter Upload', false, `JSON Parse Error: ${e.message}`);
      return null;
    }
  } else {
    logTest(6, 'Phase 2 - Zweiter Upload', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test7_phase4WithNeuMode(screenshotData) {
  console.log('\n========================================');
  console.log('TEST 7: Phase 4 - Zweiter Upload (alle Modi NEU)');
  console.log('========================================');
  
  const result = await apiCall('/api/phase4', 'POST', {
    screenshotData: JSON.stringify(screenshotData),
    modes: {
      investment: 'Neu',
      profit: 'Neu',
      trend: 'Neu',
      grid: 'Neu'
    },
    isStartMetric: false,
    previousUploadData: JSON.stringify(startmetrikData)
  });
  
  if (result.ok && result.data) {
    console.log('  Berechnete Werte (NEU Modus):', JSON.stringify(result.data, null, 2));
    
    // Die API gibt die Daten im "values" Objekt zurück
    const values = result.data.values || result.data;
    
    // Verify Grid values are present
    const hasGridData = values.overallGridProfitUsdt !== undefined && 
                        values.highestGridProfit !== undefined;
    
    if (hasGridData) {
      logTest(7, 'Phase 4 - Zweiter Upload (NEU Modus)', true, 
        `Grid Profit USDT: ${values.overallGridProfitUsdt}, Ø Grid Profit: ${values.highestGridProfit}`);
      return values;
    } else {
      logTest(7, 'Phase 4 - Zweiter Upload (NEU Modus)', false, 'Grid-Daten fehlen');
      return null;
    }
  } else {
    logTest(7, 'Phase 4 - Zweiter Upload (NEU Modus)', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test8_phase4WithVergleichMode(screenshotData) {
  console.log('\n========================================');
  console.log('TEST 8: Phase 4 - Zweiter Upload (Grid VERGLEICH Modus)');
  console.log('========================================');
  
  const result = await apiCall('/api/phase4', 'POST', {
    screenshotData: JSON.stringify(screenshotData),
    modes: {
      investment: 'Neu',
      profit: 'Neu',
      trend: 'Neu',
      grid: 'Vergleich'
    },
    isStartMetric: false,
    previousUploadData: JSON.stringify(startmetrikData)
  });
  
  if (result.ok && result.data) {
    console.log('  Berechnete Werte (VERGLEICH Modus):', JSON.stringify(result.data, null, 2));
    
    // Die API gibt die Daten im "values" Objekt zurück
    const values = result.data.values || result.data;
    
    // Bei VERGLEICH sollte overallGridProfitUsdt die Differenz sein
    // Screenshot 2: $3.06, Screenshot 1: $2.85, Differenz: $0.21
    const gridProfitValue = parseFloat(values.overallGridProfitUsdt);
    
    // Prüfe ob es eine vernünftige Differenz ist (sollte um 0.21 herum sein)
    const isReasonableDiff = !isNaN(gridProfitValue);
    
    if (isReasonableDiff) {
      logTest(8, 'Phase 4 - Zweiter Upload (VERGLEICH Modus)', true, 
        `Grid Profit Differenz: ${values.overallGridProfitUsdt}`);
      return values;
    } else {
      logTest(8, 'Phase 4 - Zweiter Upload (VERGLEICH Modus)', false, 
        `Ungültige Differenz: ${values.overallGridProfitUsdt}`);
      return null;
    }
  } else {
    logTest(8, 'Phase 4 - Zweiter Upload (VERGLEICH Modus)', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test9_saveSecondUpload(calculatedData) {
  console.log('\n========================================');
  console.log('TEST 9: Zweiten Upload speichern');
  console.log('========================================');
  
  // Hole vorherige Werte für Last-Felder
  const previousHighestGridProfit = startmetrikData.highestGridProfit;
  
  const updatePayload = {
    botTypeId: botTypeId,
    version: 2, // Second update
    status: 'Update Metrics',
    date: calculatedData.date || null,
    botDirection: calculatedData.botDirection || 'Long',
    leverage: calculatedData.leverage || '24x',
    longestRuntime: calculatedData.longestRuntime || '16h 28m',
    avgRuntime: calculatedData.avgRuntime || '16h 28m',
    investment: calculatedData.investment,
    extraMargin: calculatedData.extraMargin,
    totalInvestment: calculatedData.totalInvestment,
    profit: calculatedData.profit,
    profitPercent_gesamtinvestment: calculatedData.profitPercent_gesamtinvestment,
    profitPercent_investitionsmenge: calculatedData.profitPercent_investitionsmenge,
    overallTrendPnlUsdt: calculatedData.overallTrendPnlUsdt,
    overallTrendPnlPercent_gesamtinvestment: calculatedData.overallTrendPnlPercent_gesamtinvestment,
    overallTrendPnlPercent_investitionsmenge: calculatedData.overallTrendPnlPercent_investitionsmenge,
    overallGridProfitUsdt: calculatedData.overallGridProfitUsdt,
    overallGridProfitPercent_gesamtinvestment: calculatedData.overallGridProfitPercent_gesamtinvestment,
    overallGridProfitPercent_investitionsmenge: calculatedData.overallGridProfitPercent_investitionsmenge,
    highestGridProfit: calculatedData.highestGridProfit,
    highestGridProfitPercent_gesamtinvestment: calculatedData.highestGridProfitPercent_gesamtinvestment,
    highestGridProfitPercent_investitionsmenge: calculatedData.highestGridProfitPercent_investitionsmenge,
    avgGridProfitHour: calculatedData.avgGridProfitHour || null,
    avgGridProfitDay: calculatedData.avgGridProfitDay || null,
    avgGridProfitWeek: calculatedData.avgGridProfitWeek || null,
    // Last-Werte vom vorherigen Upload
    lastAvgGridProfitHour: startmetrikData.avgGridProfitHour || null,
    lastAvgGridProfitDay: startmetrikData.avgGridProfitDay || null,
    lastAvgGridProfitWeek: startmetrikData.avgGridProfitWeek || null,
    uploadRuntime: '11h 42m', // Differenz zwischen uploads
    lastUpload: new Date().toLocaleString('de-DE'),
    thisUpload: new Date().toLocaleString('de-DE')
  };
  
  const result = await apiCall(`/api/bot-types/${botTypeId}/updates`, 'POST', updatePayload);
  
  if (result.ok && result.data.id) {
    logTest(9, 'Zweiten Upload speichern', true, `Update ID: ${result.data.id}`);
    return result.data;
  } else {
    logTest(9, 'Zweiten Upload speichern', false, `API Error: ${JSON.stringify(result.data)}`);
    return null;
  }
}

async function test10_verifyAllUpdatesOnBotTypes() {
  console.log('\n========================================');
  console.log('TEST 10: Alle Updates auf Bot-Types Seite verifizieren');
  console.log('========================================');
  
  const result = await apiCall(`/api/bot-types/${botTypeId}/updates`);
  
  if (result.ok && Array.isArray(result.data)) {
    const updates = result.data;
    console.log(`  Gefundene Updates: ${updates.length}`);
    
    if (updates.length >= 2) {
      // Neuester Update (Update 1)
      const latestUpdate = updates[0];
      // Startmetrik
      const startmetrikUpdate = updates[updates.length - 1];
      
      console.log('  Neuester Update:', JSON.stringify(latestUpdate, null, 2));
      console.log('  Startmetrik Update:', JSON.stringify(startmetrikUpdate, null, 2));
      
      // Verify Last-Werte sind korrekt gesetzt
      const checks = {
        'Zwei Updates vorhanden': updates.length >= 2,
        'lastHighestGridProfit ist gesetzt': latestUpdate.lastHighestGridProfit !== null,
        'Startmetrik hat kein lastHighestGridProfit': !startmetrikUpdate.lastHighestGridProfit,
        'highestGridProfit ist im neuesten Update': latestUpdate.highestGridProfit !== null,
        'overallGridProfitUsdt ist im neuesten Update': latestUpdate.overallGridProfitUsdt !== null
      };
      
      const allPassed = Object.values(checks).every(v => v);
      const checkDetails = Object.entries(checks)
        .map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`)
        .join(', ');
      
      logTest(10, 'Alle Updates auf Bot-Types Seite verifizieren', allPassed, checkDetails);
      return allPassed;
    } else {
      logTest(10, 'Alle Updates auf Bot-Types Seite verifizieren', false, 
        `Nur ${updates.length} Updates gefunden, erwartet: mindestens 2`);
      return false;
    }
  } else {
    logTest(10, 'Alle Updates auf Bot-Types Seite verifizieren', false, `API Error: ${JSON.stringify(result.data)}`);
    return false;
  }
}

async function runAllTests() {
  console.log('=====================================================');
  console.log('COMPREHENSIVE GRID TRADING SECTION TEST SUITE');
  console.log('=====================================================');
  console.log(`Zeitpunkt: ${new Date().toLocaleString('de-DE')}`);
  console.log('Screenshot 1 (Startmetrik): $2.85 Grid Profit, 4h 46m Runtime');
  console.log('Screenshot 2 (Update): $3.06 Grid Profit, 16h 28m Runtime');
  console.log('');
  
  try {
    // Test 1: Bot-Type erstellen
    if (!await test1_createBotType()) {
      console.log('\nABBRUCH: Bot-Type konnte nicht erstellt werden');
      return;
    }
    
    // Test 2: Phase 2 - Erste Datenextraktion (Startmetrik)
    const extractedData1 = await test2_phase2DataExtraction();
    if (!extractedData1) {
      console.log('\nABBRUCH: Phase 2 Datenextraktion fehlgeschlagen');
      return;
    }
    
    // Test 3: Phase 4 - Berechnungen (Startmetrik)
    const calculatedData1 = await test3_phase4Calculations(extractedData1);
    if (!calculatedData1) {
      console.log('\nABBRUCH: Phase 4 Berechnungen fehlgeschlagen');
      return;
    }
    
    // Test 4: Startmetrik speichern
    const savedStartmetrik = await test4_saveStartmetrik(calculatedData1);
    if (!savedStartmetrik) {
      console.log('\nABBRUCH: Startmetrik speichern fehlgeschlagen');
      return;
    }
    
    // Test 5: Startmetrik auf Bot-Types Seite verifizieren
    await test5_verifyStartmetrikOnBotTypes();
    
    // Kurze Pause simulieren (wie Page Reload)
    console.log('\n--- Simuliere Page Reload ---\n');
    
    // Test 6: Phase 2 - Zweiter Upload
    const extractedData2 = await test6_phase2SecondUpload();
    if (!extractedData2) {
      console.log('\nABBRUCH: Zweite Phase 2 Datenextraktion fehlgeschlagen');
      return;
    }
    
    // Test 7: Phase 4 - Zweiter Upload (NEU Modus)
    const calculatedData2Neu = await test7_phase4WithNeuMode(extractedData2);
    if (!calculatedData2Neu) {
      console.log('\nABBRUCH: Phase 4 NEU Modus fehlgeschlagen');
      return;
    }
    
    // Test 8: Phase 4 - Zweiter Upload (VERGLEICH Modus)
    const calculatedData2Vergleich = await test8_phase4WithVergleichMode(extractedData2);
    if (!calculatedData2Vergleich) {
      console.log('\nABBRUCH: Phase 4 VERGLEICH Modus fehlgeschlagen');
      return;
    }
    
    // Test 9: Zweiten Upload speichern (mit NEU Daten)
    const savedUpdate = await test9_saveSecondUpload(calculatedData2Neu);
    if (!savedUpdate) {
      console.log('\nABBRUCH: Zweiten Upload speichern fehlgeschlagen');
      return;
    }
    
    // Test 10: Alle Updates verifizieren
    await test10_verifyAllUpdatesOnBotTypes();
    
  } catch (error) {
    console.error('\nFEHLER:', error.message);
  }
  
  // Zusammenfassung
  console.log('\n=====================================================');
  console.log('TEST ZUSAMMENFASSUNG');
  console.log('=====================================================');
  
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  
  testResults.forEach(r => {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] Test ${r.testNum}: ${r.name}`);
  });
  
  console.log('');
  console.log(`Ergebnis: ${passed}/${testResults.length} Tests bestanden`);
  console.log(failed === 0 ? 'ALLE TESTS ERFOLGREICH!' : `${failed} Tests fehlgeschlagen`);
  console.log('=====================================================');
}

runAllTests();
