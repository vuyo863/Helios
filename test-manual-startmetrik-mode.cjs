const http = require('http');

const BASE_URL = 'http://localhost:5000';

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== MANUELLE STARTMETRIK-MODUS TESTS ===\n');
  let passed = 0;
  let failed = 0;
  
  const screenshotData = {
    screenshots: [{
      botName: "ICP/USDT Cross Margin Futures Grids",
      direction: "Long+Short",
      leverage: "24x",
      runtimeText: "19h 50m",
      runtimeHours: 19.833,
      createdAt: "2025-12-07T12:05:06",
      actualInvestment: 2000,
      extraMargin: 0,
      gridProfitUsdt: 238.31,
      gridProfitPercent: 11.91,
      unrealizedPnlUsdt: 74.22,
      unrealizedPnlPercent: 3.71,
      totalProfitUsdt: 312.54,
      totalProfitPercent: 15.62
    }]
  };
  
  const modes = {
    investment: 'Neu',
    profit: 'Neu',
    trend: 'Neu',
    grid: 'Neu'
  };
  
  // Test 1: Normal-Modus (manualStartmetrikMode = false)
  console.log('Test 1: Normal-Modus - calculationMode sollte "Normal" sein');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: false
    });
    
    if (result.status === 200 && result.data.calculationMode === 'Normal') {
      console.log('  PASS: calculationMode = "Normal"');
      passed++;
    } else {
      console.log('  FAIL: Erwartet calculationMode="Normal", bekam:', result.data.calculationMode);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 2: Manueller Startmetrik-Modus (manualStartmetrikMode = true)
  console.log('\nTest 2: Manueller Startmetrik-Modus - calculationMode sollte "Startmetrik" sein');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    if (result.status === 200 && result.data.calculationMode === 'Startmetrik') {
      console.log('  PASS: calculationMode = "Startmetrik"');
      passed++;
    } else {
      console.log('  FAIL: Erwartet calculationMode="Startmetrik", bekam:', result.data.calculationMode);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 3: Manueller Startmetrik-Modus - Datum sollte aus Screenshot stammen
  console.log('\nTest 3: Manueller Startmetrik-Modus - Datum sollte aus Screenshot stammen (nicht null)');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    if (result.status === 200 && result.data.values && result.data.values.date !== null) {
      console.log('  PASS: Datum vorhanden:', result.data.values.date);
      passed++;
    } else {
      console.log('  FAIL: Datum sollte nicht null sein, bekam:', result.data.values?.date);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 4: Normal-Modus (nicht Startmetrik) - Datum sollte null sein
  console.log('\nTest 4: Normal-Modus - Datum sollte null sein (Frontend setzt aktuelles Datum)');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: false
    });
    
    if (result.status === 200 && result.data.values && result.data.values.date === null) {
      console.log('  PASS: Datum ist null');
      passed++;
    } else {
      console.log('  FAIL: Datum sollte null sein, bekam:', result.data.values?.date);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 5: Manueller Startmetrik-Modus mit VERGLEICH - sollte 0.00 setzen
  console.log('\nTest 5: Manueller Startmetrik-Modus + Vergleich - Investment sollte 0.00 sein');
  try {
    const vergleichModes = { ...modes, investment: 'Vergleich' };
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes: vergleichModes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    if (result.status === 200 && result.data.values && result.data.values.investment === "0.00") {
      console.log('  PASS: Investment = "0.00" (Startmetrik Guard)');
      passed++;
    } else {
      console.log('  FAIL: Investment sollte "0.00" sein, bekam:', result.data.values?.investment);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 6: Manueller Startmetrik-Modus + Grid Vergleich - avgGridProfitHour sollte 0.00 sein
  console.log('\nTest 6: Manueller Startmetrik-Modus + Grid Vergleich - avgGridProfitHour sollte 0.00 sein');
  try {
    const gridVergleichModes = { ...modes, grid: 'Vergleich' };
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes: gridVergleichModes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    if (result.status === 200 && result.data.values && result.data.values.avgGridProfitHour === "0.00") {
      console.log('  PASS: avgGridProfitHour = "0.00" (Startmetrik Guard)');
      passed++;
    } else {
      console.log('  FAIL: avgGridProfitHour sollte "0.00" sein, bekam:', result.data.values?.avgGridProfitHour);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 7: Echter Startmetrik (isStartMetric=true) sollte auch calculationMode=Normal haben
  console.log('\nTest 7: Echter Startmetrik - calculationMode sollte "Normal" sein (nicht manuell)');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: true,
      previousUploadData: null,
      manualStartmetrikMode: false
    });
    
    if (result.status === 200 && result.data.calculationMode === 'Normal') {
      console.log('  PASS: calculationMode = "Normal" (echter Startmetrik wird nicht als manuell markiert)');
      passed++;
    } else {
      console.log('  FAIL: Erwartet calculationMode="Normal", bekam:', result.data.calculationMode);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 8: Manueller Startmetrik-Modus - Berechnungswerte sollten korrekt sein
  console.log('\nTest 8: Manueller Startmetrik-Modus - Profit sollte berechnet werden');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    const profit = parseFloat(result.data.values?.profit || '0');
    if (result.status === 200 && profit > 0) {
      console.log('  PASS: Profit berechnet:', result.data.values.profit);
      passed++;
    } else {
      console.log('  FAIL: Profit sollte > 0 sein, bekam:', result.data.values?.profit);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 9: Manueller Startmetrik-Modus - botDirection sollte erkannt werden
  console.log('\nTest 9: Manueller Startmetrik-Modus - botDirection sollte "Long+Short" sein');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    if (result.status === 200 && result.data.values && result.data.values.botDirection === 'Long+Short') {
      console.log('  PASS: botDirection = "Long+Short"');
      passed++;
    } else {
      console.log('  FAIL: botDirection sollte "Long+Short" sein, bekam:', result.data.values?.botDirection);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  // Test 10: Manueller Startmetrik-Modus - leverage sollte erkannt werden
  console.log('\nTest 10: Manueller Startmetrik-Modus - leverage sollte "24x" sein');
  try {
    const result = await makeRequest('/api/phase4', 'POST', {
      screenshotData: JSON.stringify(screenshotData),
      modes,
      isStartMetric: false,
      previousUploadData: null,
      manualStartmetrikMode: true
    });
    
    if (result.status === 200 && result.data.values && result.data.values.leverage === '24x') {
      console.log('  PASS: leverage = "24x"');
      passed++;
    } else {
      console.log('  FAIL: leverage sollte "24x" sein, bekam:', result.data.values?.leverage);
      failed++;
    }
  } catch (e) {
    console.log('  FAIL: API Fehler:', e.message);
    failed++;
  }
  
  console.log('\n=== ERGEBNIS ===');
  console.log(`Bestanden: ${passed}/10`);
  console.log(`Fehlgeschlagen: ${failed}/10`);
  
  if (passed >= 10) {
    console.log('\nALLE TESTS BESTANDEN!');
  } else {
    console.log('\nEinige Tests sind fehlgeschlagen.');
  }
}

runTests().catch(console.error);
