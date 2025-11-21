/**
 * COMPREHENSIVE AI UPLOAD TEST - 10 VOLLSTÄNDIGE DURCHLÄUFE
 * 
 * Testet die komplette AI-Pipeline mit:
 * - Mindestens 2 Screenshots pro Upload
 * - NEU Modus Tests
 * - VERGLEICH Modus Tests  
 * - Multi-Screenshot Validierung
 * - Server-seitige Validierung
 * - Speicherung in Datenbank
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000';
const BOT_TYPE_NAME = 'E2E Test Bot';

// Farben für Console Output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(`  ${title}`, 'cyan');
  console.log('='.repeat(70) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Screenshot zu Base64 konvertieren
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

// Lade Screenshots
const screenshotA = imageToBase64('test-screenshot-a.png');
const screenshotB = imageToBase64('test-screenshot-b.png');

logInfo('Screenshots geladen:');
logInfo(`  Screenshot A: ${screenshotA.substring(0, 50)}...`);
logInfo(`  Screenshot B: ${screenshotB.substring(0, 50)}...`);

// Test State
const testResults = {
  total: 10,
  passed: 0,
  failed: 0,
  errors: []
};

let createdBotTypeId = null;
let lastUpdateData = null;

/**
 * Erstelle Bot Type
 */
async function createBotType() {
  logSection('BOT TYPE ERSTELLEN');
  
  try {
    const response = await fetch(`${API_BASE}/api/bot-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${BOT_TYPE_NAME} ${Date.now()}`,
        description: '10 Durchläufe E2E Test',
        color: '#3B82F6'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    createdBotTypeId = data.id;
    
    logSuccess(`Bot Type erstellt: ${data.name} (ID: ${createdBotTypeId})`);
    
    return true;
  } catch (error) {
    logError(`Bot Type Erstellung fehlgeschlagen: ${error.message}`);
    return false;
  }
}

/**
 * Phase 2: Screenshot Datenextraktion
 */
async function runPhase2(screenshots, uploadNumber) {
  logInfo(`Phase 2: Datenextraktion (${screenshots.length} Screenshots)`);
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Extrahiere Daten aus Screenshots' }],
        images: screenshots,
        phase: 'phase2_data_extraction',
        selectedBotTypeName: BOT_TYPE_NAME,
        selectedBotTypeId: createdBotTypeId,
        selectedBotTypeColor: '#3B82F6',
        updateHistory: {}
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Validiere dass JSON zurückgegeben wurde
    if (!data.response || !data.response.includes('screenshots')) {
      throw new Error('Keine gültige JSON Antwort erhalten');
    }

    // Parse JSON aus Antwort
    const jsonMatch = data.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Konnte JSON nicht aus Antwort extrahieren');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    
    // Validiere Screenshot Count
    if (!extractedData.screenshots || extractedData.screenshots.length !== screenshots.length) {
      throw new Error(`Expected ${screenshots.length} screenshots, got ${extractedData.screenshots?.length || 0}`);
    }

    logSuccess(`Phase 2 erfolgreich: ${extractedData.screenshots.length} Screenshots extrahiert`);
    
    // Zeige erste Screenshot Daten
    const first = extractedData.screenshots[0];
    logInfo(`  Erste Screenshot: Investment=${first.investment}, Profit=${first.totalProfit}, Runtime=${first.runtime}`);
    
    return extractedData;
  } catch (error) {
    logError(`Phase 2 fehlgeschlagen: ${error.message}`);
    throw error;
  }
}

/**
 * Phase 4: AI Berechnungen
 */
async function runPhase4(screenshotData, modes, isStartMetric, previousData = null) {
  logInfo(`Phase 4: AI Berechnungen (isStartMetric=${isStartMetric})`);
  logInfo(`  Modi: Investment=${modes.investment}, Profit=${modes.profit}, Trend=${modes.trend}, Grid=${modes.grid}`);
  
  try {
    const response = await fetch(`${API_BASE}/api/phase4`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshotData: JSON.stringify(screenshotData),
        modes,
        isStartMetric,
        previousUploadData: previousData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.values) {
      throw new Error('Keine values in Phase 4 Antwort');
    }

    logSuccess('Phase 4 erfolgreich abgeschlossen');
    logInfo(`  Investment: ${data.values.investment}, Profit: ${data.values.profit}`);
    logInfo(`  Grid Profit: ${data.values.overallGridProfitUsdt}, Trend P&L: ${data.values.overallTrendPnlUsdt}`);
    
    // Validiere VERGLEICH Modus Berechnungen
    if (!isStartMetric && previousData) {
      const prev = JSON.parse(previousData);
      
      if (modes.investment === 'Vergleich') {
        const expectedDiff = parseFloat(screenshotData.screenshots[0].investment) - parseFloat(prev.investment);
        const actualDiff = parseFloat(data.values.investment);
        const tolerance = 0.5; // 50 cent Toleranz
        
        if (Math.abs(expectedDiff - actualDiff) > tolerance) {
          logWarning(`Investment Differenz Warnung: Expected=${expectedDiff.toFixed(2)}, Got=${actualDiff.toFixed(2)}`);
        } else {
          logSuccess(`  VERGLEICH Investment korrekt: ${actualDiff.toFixed(2)} USDT Differenz`);
        }
      }
    }
    
    return data.values;
  } catch (error) {
    logError(`Phase 4 fehlgeschlagen: ${error.message}`);
    throw error;
  }
}

/**
 * Speichere Update in Datenbank
 */
async function saveUpdate(calculatedValues, version) {
  logInfo(`Speichere Update (Version ${version})`);
  
  try {
    const response = await fetch(`${API_BASE}/api/bot-types/${createdBotTypeId}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version,
        status: 'Update Metrics',
        ...calculatedValues
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    lastUpdateData = data;
    
    logSuccess(`Update gespeichert (ID: ${data.id})`);
    return data;
  } catch (error) {
    logError(`Speicherung fehlgeschlagen: ${error.message}`);
    throw error;
  }
}

/**
 * Einzelner Upload Durchlauf
 */
async function runUpload(uploadConfig) {
  const { number, screenshots, modes, description } = uploadConfig;
  
  logSection(`UPLOAD ${number}/10: ${description}`);
  
  try {
    // Phase 2: Datenextraktion
    const extractedData = await runPhase2(screenshots, number);
    
    // Phase 4: Berechnungen
    const isStartMetric = (number === 1);
    const previousData = lastUpdateData ? JSON.stringify({
      investment: lastUpdateData.investment,
      extraMargin: lastUpdateData.extraMargin,
      totalInvestment: lastUpdateData.totalInvestment,
      profit: lastUpdateData.profit,
      overallTrendPnlUsdt: lastUpdateData.overallTrendPnlUsdt,
      overallGridProfitUsdt: lastUpdateData.overallGridProfitUsdt,
      highestGridProfit: lastUpdateData.highestGridProfit,
      avgGridProfitHour: lastUpdateData.avgGridProfitHour,
      avgGridProfitDay: lastUpdateData.avgGridProfitDay,
      avgGridProfitWeek: lastUpdateData.avgGridProfitWeek
    }) : null;
    
    const calculatedValues = await runPhase4(extractedData, modes, isStartMetric, previousData);
    
    // Speichern
    await saveUpdate(calculatedValues, number);
    
    logSuccess(`✅ Upload ${number} ERFOLGREICH\n`);
    testResults.passed++;
    
  } catch (error) {
    logError(`❌ Upload ${number} FEHLGESCHLAGEN: ${error.message}\n`);
    testResults.failed++;
    testResults.errors.push(`Upload ${number}: ${error.message}`);
  }
}

/**
 * Hole Update History
 */
async function getUpdateHistory() {
  logSection('UPDATE HISTORY VALIDIERUNG');
  
  try {
    const response = await fetch(`${API_BASE}/api/bot-types/${createdBotTypeId}/updates`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const updates = await response.json();
    
    logSuccess(`${updates.length} Updates gefunden`);
    
    updates.forEach((update, index) => {
      logInfo(`  ${index + 1}. Version ${update.version} - ${update.createdAt}`);
      logInfo(`     Investment: ${update.investment}, Profit: ${update.profit}`);
    });
    
    return updates;
  } catch (error) {
    logError(`Update History abrufen fehlgeschlagen: ${error.message}`);
    return [];
  }
}

/**
 * HAUPTPROGRAMM
 */
async function main() {
  console.clear();
  
  logSection('🚀 AI UPLOAD TEST - 10 VOLLSTÄNDIGE DURCHLÄUFE');
  logInfo(`Bot Type: ${BOT_TYPE_NAME}`);
  logInfo(`API Base: ${API_BASE}\n`);
  
  // Bot Type erstellen
  const botTypeCreated = await createBotType();
  if (!botTypeCreated) {
    logError('Bot Type Erstellung fehlgeschlagen - Test abgebrochen');
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ========== UPLOAD 1: STARTMETRIK (Alle NEU) ==========
  await runUpload({
    number: 1,
    screenshots: [screenshotA, screenshotB],
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    description: 'STARTMETRIK - Alle Modi NEU (2 Screenshots: A+B)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 2: NEU MODUS ==========
  await runUpload({
    number: 2,
    screenshots: [screenshotB, screenshotA],
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    description: 'NEU Modus - Umgekehrte Reihenfolge (2 Screenshots: B+A)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 3: MIXED MODUS (Teilweise VERGLEICH) ==========
  await runUpload({
    number: 3,
    screenshots: [screenshotA, screenshotA],
    modes: { investment: 'Vergleich', profit: 'Vergleich', trend: 'Neu', grid: 'Neu' },
    description: 'MIXED - Investment+Profit VERGLEICH, Rest NEU (2x A)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 4: FULL VERGLEICH ==========
  await runUpload({
    number: 4,
    screenshots: [screenshotB, screenshotB],
    modes: { investment: 'Vergleich', profit: 'Vergleich', trend: 'Vergleich', grid: 'Vergleich' },
    description: 'FULL VERGLEICH - Alle Modi VERGLEICH (2x B)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 5: NEU MODUS (Multi Screenshot Validierung) ==========
  await runUpload({
    number: 5,
    screenshots: [screenshotA, screenshotB],
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    description: 'NEU Modus - Standard Mix (2 Screenshots: A+B)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 6: VERGLEICH (Mixed Modi) ==========
  await runUpload({
    number: 6,
    screenshots: [screenshotB, screenshotA],
    modes: { investment: 'Vergleich', profit: 'Neu', trend: 'Vergleich', grid: 'Neu' },
    description: 'MIXED - Investment+Trend VERGLEICH (2 Screenshots: B+A)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 7: NEU MODUS (Runtime Validierung) ==========
  await runUpload({
    number: 7,
    screenshots: [screenshotA, screenshotB],
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    description: 'NEU Modus - Runtime Check (2 Screenshots: A+B)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 8: FULL VERGLEICH ==========
  await runUpload({
    number: 8,
    screenshots: [screenshotA, screenshotA],
    modes: { investment: 'Vergleich', profit: 'Vergleich', trend: 'Vergleich', grid: 'Vergleich' },
    description: 'FULL VERGLEICH - Validation Check (2x A)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 9: NEU MODUS ==========
  await runUpload({
    number: 9,
    screenshots: [screenshotB, screenshotB],
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    description: 'NEU Modus - Final Check (2x B)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ========== UPLOAD 10: VERGLEICH FINAL ==========
  await runUpload({
    number: 10,
    screenshots: [screenshotA, screenshotB],
    modes: { investment: 'Vergleich', profit: 'Vergleich', trend: 'Vergleich', grid: 'Vergleich' },
    description: 'FULL VERGLEICH - Final Validation (2 Screenshots: A+B)'
  });
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Validiere Update History
  const updates = await getUpdateHistory();
  
  // ========== TEST ZUSAMMENFASSUNG ==========
  logSection('📊 TEST ZUSAMMENFASSUNG');
  
  log(`\nGesamt Tests: ${testResults.total}`, 'white');
  logSuccess(`Erfolgreich: ${testResults.passed}`);
  logError(`Fehlgeschlagen: ${testResults.failed}`);
  
  if (testResults.failed > 0) {
    log('\nFehlerdetails:', 'yellow');
    testResults.errors.forEach(error => {
      logError(`  - ${error}`);
    });
  }
  
  log(`\nUpdate History: ${updates.length} Einträge gespeichert`, 'cyan');
  
  if (testResults.passed === testResults.total) {
    log('\n🎉 ALLE TESTS BESTANDEN! 🎉', 'green');
    log('Die komplette AI-Pipeline funktioniert einwandfrei!', 'green');
  } else {
    log(`\n⚠️  ${testResults.failed} von ${testResults.total} Tests fehlgeschlagen`, 'yellow');
  }
  
  log('\n' + '='.repeat(70) + '\n', 'white');
}

// Führe Tests aus
main().catch(error => {
  logError(`\n❌ KRITISCHER FEHLER: ${error.message}`);
  console.error(error);
  process.exit(1);
});
