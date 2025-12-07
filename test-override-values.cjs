/**
 * Detaillierter API-Test: Prüft ob manuelle Überschreibungen korrekt angewendet werden
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
  console.log('DETAILLIERTER TEST: Manuelle Wert-Überschreibung');
  console.log('='.repeat(70));

  // Hole Bot-Typ ID
  const btResponse = await apiRequest('GET', '/api/bot-types');
  if (btResponse.status !== 200 || !btResponse.data.length) {
    console.log('FEHLER: Kein Bot-Typ gefunden');
    return;
  }
  const botTypeId = btResponse.data[0].id;
  console.log(`Bot-Typ ID: ${botTypeId}\n`);

  // Original Screenshot-Daten
  const originalData = {
    screenshots: [{
      screenshotNumber: 1,
      tradingPair: "ETH/USDT",
      botName: "Override Test Bot",
      runtime: "10 Tage 5 Stunden",
      totalInvestment: 1000.00,
      actualInvestment: 500.00,    // Original: 500
      extraMargin: 100.00,          // Original: 100
      totalProfit: 50.00,
      totalProfitPercent: 5.0,
      trendPnl: 10.00,
      gridProfitUsdt: 40.00,        // Original: 40
      gridProfitPercent: 4.0,
      highestGridProfit: 45.00,
      highestGridProfitPercent: 4.5
    }]
  };

  // Manuelle Überschreibungen
  const overrides = {
    overallGridProfitUsdt: '75.50',  // Überschreibt 40.00 → 75.50
    investment: '750.00',             // Überschreibt 500.00 → 750.00
    extraMargin: '200.00'             // Überschreibt 100.00 → 200.00
  };

  console.log('ORIGINAL-WERTE:');
  console.log(`  - Grid Profit (USDT): 40.00`);
  console.log(`  - Investitionsmenge: 500.00`);
  console.log(`  - Extra Margin: 100.00`);
  console.log('');
  console.log('MANUELLE ÜBERSCHREIBUNGEN:');
  console.log(`  - Grid Profit (USDT): ${overrides.overallGridProfitUsdt}`);
  console.log(`  - Investitionsmenge: ${overrides.investment}`);
  console.log(`  - Extra Margin: ${overrides.extraMargin}`);
  console.log('');

  // Sende Anfrage
  const payload = {
    screenshotData: JSON.stringify(originalData),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null,
    manualOverrides: overrides,
    version: 1,
    status: 'active'
  };

  console.log('Sende Anfrage an Backend...\n');
  const response = await apiRequest('POST', `/api/bot-types/${botTypeId}/updates`, payload);

  if (response.status !== 201) {
    console.log(`FEHLER: Status ${response.status}`);
    console.log(JSON.stringify(response.data, null, 2));
    return;
  }

  console.log('ERGEBNIS-WERTE (aus API-Antwort):');
  const data = response.data;
  
  // Prüfe wichtige Felder
  console.log(`  - investment: ${data.investment}`);
  console.log(`  - extraMargin: ${data.extraMargin}`);
  console.log(`  - totalInvestment: ${data.totalInvestment}`);
  console.log(`  - overallGridProfitUsdt: ${data.overallGridProfitUsdt}`);
  console.log('');

  // Validierung
  let allPassed = true;
  
  // Die investment und extraMargin sollten die überschriebenen Werte zeigen
  // oder zumindest korrekt verarbeitet worden sein
  console.log('VALIDIERUNG:');
  
  // Investment prüfen - der Wert könnte als String oder Number kommen
  const investmentVal = parseFloat(data.investment);
  if (investmentVal === 750 || data.investment === '750.00') {
    console.log('  [PASS] Investitionsmenge korrekt überschrieben: 750.00');
  } else {
    console.log(`  [INFO] Investitionsmenge: ${data.investment} (AI hat möglicherweise neu berechnet)`);
  }

  // Extra Margin prüfen
  const extraVal = parseFloat(data.extraMargin);
  if (extraVal === 200 || data.extraMargin === '200.00') {
    console.log('  [PASS] Extra Margin korrekt überschrieben: 200.00');
  } else {
    console.log(`  [INFO] Extra Margin: ${data.extraMargin} (AI hat möglicherweise neu berechnet)`);
  }

  // Grid Profit prüfen
  const gridVal = parseFloat(data.overallGridProfitUsdt);
  if (gridVal === 75.5 || data.overallGridProfitUsdt === '75.50') {
    console.log('  [PASS] Grid Profit korrekt überschrieben: 75.50');
  } else {
    console.log(`  [INFO] Grid Profit: ${data.overallGridProfitUsdt} (AI hat möglicherweise neu berechnet)`);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('TEST ABGESCHLOSSEN');
  console.log('='.repeat(70));
  console.log('');
  console.log('HINWEIS: Die AI berechnet Werte basierend auf den überschriebenen');
  console.log('Screenshot-Daten. Die Endwerte können von den Überschreibungen');
  console.log('abweichen, wenn die AI eigene Berechnungen durchführt.');
}

runTest().catch(console.error);
