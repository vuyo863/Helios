/**
 * Test: Phase 4 API mit manuellen Überschreibungen
 * Testet den echten Workflow: /api/phase4 mit Überschreibungen
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  console.log('='.repeat(70));
  console.log('TEST: /api/phase4 mit manuellen Überschreibungen');
  console.log('='.repeat(70));

  // Original Screenshot-Daten
  const originalData = {
    screenshots: [{
      screenshotNumber: 1,
      tradingPair: "ETH/USDT",
      botName: "Override Test Bot",
      runtime: "10 Tage 5 Stunden",
      totalInvestment: 1000.00,
      actualInvestment: 500.00,    // Original
      extraMargin: 100.00,          // Original
      totalProfit: 50.00,
      totalProfitPercent: 5.0,
      trendPnl: 10.00,
      gridProfitUsdt: 40.00,        // Original
      gridProfitPercent: 4.0,
      highestGridProfit: 45.00,
      highestGridProfitPercent: 4.5
    }]
  };

  // Test 1: Phase 4 OHNE Überschreibungen
  console.log('\n--- Test 1: Phase 4 OHNE Überschreibungen ---');
  const payload1 = {
    screenshotData: JSON.stringify(originalData),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null
    // Keine manualOverrides
  };

  const response1 = await apiRequest('POST', '/api/phase4', payload1);
  if (response1.status === 200) {
    console.log('Anfrage erfolgreich (ohne Überschreibungen)');
    console.log('Antwort-Keys:', Object.keys(response1.data).slice(0, 5).join(', ') + '...');
  } else {
    console.log(`Status: ${response1.status}`);
    console.log('Antwort:', JSON.stringify(response1.data).substring(0, 200));
  }

  // Test 2: Phase 4 MIT Überschreibungen (1 Screenshot)
  console.log('\n--- Test 2: Phase 4 MIT Überschreibungen (1 Screenshot) ---');
  const overrides = {
    overallGridProfitUsdt: '75.50',  // Überschreibt 40.00
    investment: '750.00',             // Überschreibt 500.00
    extraMargin: '200.00'             // Überschreibt 100.00
  };

  console.log('Manuelle Überschreibungen:');
  console.log('  - Grid Profit: 40.00 → 75.50');
  console.log('  - Investitionsmenge: 500.00 → 750.00');
  console.log('  - Extra Margin: 100.00 → 200.00');

  const payload2 = {
    screenshotData: JSON.stringify(originalData),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null,
    manualOverrides: overrides
  };

  const response2 = await apiRequest('POST', '/api/phase4', payload2);
  if (response2.status === 200) {
    console.log('Anfrage erfolgreich');
    console.log('AI-Antwort (Auszug):');
    const data = response2.data;
    if (data.aiResponse) {
      console.log(data.aiResponse.substring(0, 300) + '...');
    } else if (data.message) {
      console.log(data.message.substring(0, 300) + '...');
    } else {
      console.log(JSON.stringify(data).substring(0, 300) + '...');
    }
  } else {
    console.log(`Status: ${response2.status}`);
    console.log('Antwort:', JSON.stringify(response2.data).substring(0, 300));
  }

  // Test 3: Phase 4 mit 2 Screenshots (Überschreibungen sollten ignoriert werden)
  console.log('\n--- Test 3: Phase 4 mit 2 Screenshots (Überschreibungen ignoriert) ---');
  const twoScreenshots = {
    screenshots: [
      { ...originalData.screenshots[0], screenshotNumber: 1 },
      { ...originalData.screenshots[0], screenshotNumber: 2, botName: "Bot 2" }
    ]
  };

  const payload3 = {
    screenshotData: JSON.stringify(twoScreenshots),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null,
    manualOverrides: { overallGridProfitUsdt: '999.99' }
  };

  const response3 = await apiRequest('POST', '/api/phase4', payload3);
  console.log(`Status: ${response3.status}`);
  if (response3.status === 200) {
    console.log('Anfrage erfolgreich - Überschreibungen wurden bei 2 Screenshots korrekt ignoriert');
  } else {
    console.log('Antwort:', JSON.stringify(response3.data).substring(0, 200));
  }

  // Test 4: Prüfe lastUpload Überschreibung
  console.log('\n--- Test 4: lastUpload Überschreibung ---');
  const payload4 = {
    screenshotData: JSON.stringify(originalData),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null,
    manualOverrides: { lastUpload: '05.12.2025 14:30' }
  };

  const response4 = await apiRequest('POST', '/api/phase4', payload4);
  console.log(`Status: ${response4.status}`);
  if (response4.status === 200) {
    console.log('lastUpload Überschreibung wurde akzeptiert');
  }

  console.log('\n' + '='.repeat(70));
  console.log('TESTS ABGESCHLOSSEN');
  console.log('='.repeat(70));
  console.log('\nHINWEIS: Prüfe die Server-Logs für die Nachricht:');
  console.log('"Manuelle Überschreibungen angewendet: [...]"');
}

runTest().catch(console.error);
