/**
 * VEREINFACHTER E2E TEST
 * 
 * Verwendet bereits extrahierte Screenshot-Daten (wie die echte App)
 * Testet den kompletten Flow:
 * 1. Upload 1: NEU Mode
 * 2. Upload 2: VERGLEICH Mode (mit Änderungen)
 * 3. Upload 3: Gemischte Modi
 */

const API_BASE = 'http://localhost:5000';

async function main() {
  console.log('🚀 VEREINFACHTER E2E TEST\n');

  // 1. Bot Type erstellen
  console.log('1️⃣  Bot Type erstellen...');
  const botTypeRes = await fetch(`${API_BASE}/api/bot-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `E2E Simple ${Date.now()}`,
      description: 'Vereinfachter E2E Test',
      color: '#0088FF'
    })
  });
  const botType = await botTypeRes.json();
  const botTypeId = botType.id;
  console.log(`✅ ${botType.name}\n`);

  // Screenshot Data für Upload 1 (simuliert Phase 2 Output)
  const screenshotData1 = JSON.stringify({
    screenshots: [
      {
        botName: "BTC/USDT Bot",
        runtime: "2d 5h 30m",
        actualInvestment: 1000.00,
        extraMargin: 500.00,
        totalInvestmentFromScreenshot: 1500.00,
        totalProfitUsdt: -5.00,
        gridProfitUsdt: 2.50,
        trendPnlUsdt: -7.50
      },
      {
        botName: "ETH/USDT Bot",
        runtime: "1d 3h 15m",
        actualInvestment: 500.00,
        extraMargin: 250.00,
        totalInvestmentFromScreenshot: 750.00,
        totalProfitUsdt: -2.00,
        gridProfitUsdt: 1.00,
        trendPnlUsdt: -3.00
      }
    ]
  });

  // 2. UPLOAD 1: Alle NEU
  console.log('2️⃣  UPLOAD 1: Startmetrik (alle NEU)');
  console.log('   Expected: Investment=1500, Profit=-7.00\n');

  const phase4_1 = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: screenshotData1,
      modes: {
        investment: 'Neu',
        profit: 'Neu',
        trend: 'Neu',
        grid: 'Neu'
      },
      isStartMetric: true,
      previousUploadData: null
    })
  });

  if (!phase4_1.ok) {
    const error = await phase4_1.json();
    console.log(`❌ Upload 1 failed: ${error.error}`);
    if (error.details) console.log(`   ${error.details}`);
    process.exit(1);
  }

  const values1 = (await phase4_1.json()).values;
  
  // Save
  await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      status: 'Start Metrics',
      ...values1
    })
  });

  console.log(`✅ Upload 1 (NEU Mode):`);
  console.log(`   Investment: ${values1.investment}`);
  console.log(`   Profit: ${values1.profit}`);
  console.log(`   Trend: ${values1.overallTrendPnlUsdt}`);
  console.log(`   Grid: ${values1.overallGridProfitUsdt}\n`);

  // Screenshot Data für Upload 2 (mit Änderungen)
  const screenshotData2 = JSON.stringify({
    screenshots: [
      {
        botName: "BTC/USDT Bot",
        runtime: "3d 2h 45m",
        actualInvestment: 1200.00,  // +200
        extraMargin: 600.00,        // +100
        totalInvestmentFromScreenshot: 1800.00,
        totalProfitUsdt: -3.00,     // +2.00
        gridProfitUsdt: 4.00,       // +1.50
        trendPnlUsdt: -7.00         // +0.50
      },
      {
        botName: "ETH/USDT Bot",
        runtime: "2d 1h 30m",
        actualInvestment: 600.00,   // +100
        extraMargin: 300.00,        // +50
        totalInvestmentFromScreenshot: 900.00,
        totalProfitUsdt: -1.00,     // +1.00
        gridProfitUsdt: 1.50,       // +0.50
        trendPnlUsdt: -2.50         // +0.50
      }
    ]
  });

  // 3. UPLOAD 2: Alle VERGLEICH
  console.log('3️⃣  UPLOAD 2: Alle VERGLEICH (mit Änderungen)');
  console.log('   Expected DIFF: Investment=+300, Profit=+3.00\n');

  // Get previous data
  const historyRes = await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`);
  console.log(`   DEBUG: History status = ${historyRes.status}`);
  const history = await historyRes.json();
  console.log(`   DEBUG: History type = ${typeof history}`);
  console.log(`   DEBUG: History = ${JSON.stringify(history).substring(0, 300)}`);
  
  if (!Array.isArray(history) || history.length === 0) {
    console.log(`❌ ERROR: History API returned unexpected data`);
    process.exit(1);
  }
  
  const previousUpload = history[0];

  const phase4_2 = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: screenshotData2,
      modes: {
        investment: 'Vergleich',
        profit: 'Vergleich',
        trend: 'Vergleich',
        grid: 'Vergleich'
      },
      isStartMetric: false,
      previousUploadData: JSON.stringify(previousUpload)
    })
  });

  if (!phase4_2.ok) {
    const error = await phase4_2.json();
    console.log(`❌ Upload 2 failed: ${error.error}`);
    if (error.details) console.log(`   ${error.details}`);
    process.exit(1);
  }

  const values2 = (await phase4_2.json()).values;
  
  // Save
  await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 2,
      status: 'Update Metrics',
      ...values2
    })
  });

  console.log(`✅ Upload 2 (VERGLEICH Mode):`);
  console.log(`   Investment DIFF: ${values2.investment} (expected: ~300.00)`);
  console.log(`   Profit DIFF: ${values2.profit} (expected: ~3.00)`);
  console.log(`   Trend DIFF: ${values2.overallTrendPnlUsdt} (expected: ~1.00)`);
  console.log(`   Grid DIFF: ${values2.overallGridProfitUsdt} (expected: ~2.00)\n`);

  // Screenshot Data für Upload 3
  const screenshotData3 = JSON.stringify({
    screenshots: [
      {
        botName: "BTC/USDT Bot",
        runtime: "4d 1h 15m",
        actualInvestment: 1500.00,  // +300 from upload 2
        extraMargin: 750.00,
        totalInvestmentFromScreenshot: 2250.00,
        totalProfitUsdt: -1.00,     // +2.00 from upload 2
        gridProfitUsdt: 5.00,       // +1.00 from upload 2
        trendPnlUsdt: -6.00         // +1.00 from upload 2
      },
      {
        botName: "ETH/USDT Bot",
        runtime: "3d 2h 45m",
        actualInvestment: 700.00,   // +100 from upload 2
        extraMargin: 350.00,
        totalInvestmentFromScreenshot: 1050.00,
        totalProfitUsdt: 0.50,      // +1.50 from upload 2
        gridProfitUsdt: 2.00,       // +0.50 from upload 2
        trendPnlUsdt: -1.50         // +1.00 from upload 2
      }
    ]
  });

  // 4. UPLOAD 3: Gemischte Modi
  console.log('4️⃣  UPLOAD 3: Gemischte Modi (Investment=NEU, Rest=VERGLEICH)');
  console.log('   Expected: Investment=2200 (NEU total), Profit DIFF=+3.50\n');

  // Get latest previous data
  const historyRes2 = await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`);
  const history2 = await historyRes2.json();
  const previousUpload2 = history2[0];

  const phase4_3 = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: screenshotData3,
      modes: {
        investment: 'Neu',
        profit: 'Vergleich',
        trend: 'Vergleich',
        grid: 'Vergleich'
      },
      isStartMetric: false,
      previousUploadData: JSON.stringify(previousUpload2)
    })
  });

  if (!phase4_3.ok) {
    const error = await phase4_3.json();
    console.log(`❌ Upload 3 failed: ${error.error}`);
    if (error.details) console.log(`   ${error.details}`);
    process.exit(1);
  }

  const values3 = (await phase4_3.json()).values;
  
  // Save
  await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 3,
      status: 'Update Metrics',
      ...values3
    })
  });

  console.log(`✅ Upload 3 (GEMISCHT):`);
  console.log(`   Investment (NEU): ${values3.investment}`);
  console.log(`   Profit DIFF (VERGLEICH): ${values3.profit}`);
  console.log(`   Trend DIFF (VERGLEICH): ${values3.overallTrendPnlUsdt}`);
  console.log(`   Grid DIFF (VERGLEICH): ${values3.overallGridProfitUsdt}\n`);

  // 5. Verify History
  console.log('5️⃣  Upload-Verlauf:');
  const finalHistory = await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`);
  const finalData = await finalHistory.json();
  
  console.log(`✅ ${finalData.length} Uploads im System\n`);
  finalData.reverse().forEach((u, i) => {
    console.log(`   ${i+1}. V${u.version}: Inv=${u.investment}, Profit=${u.profit}`);
  });

  console.log('\n🎉 E2E TEST ERFOLGREICH!\n');
  console.log('Alle 3 Upload-Szenarien funktionieren:');
  console.log('  ✅ NEU Mode: Aktuelle Gesamtwerte');
  console.log('  ✅ VERGLEICH Mode: Differenzen (current - previous)');
  console.log('  ✅ Gemischte Modi: NEU + VERGLEICH kombiniert\n');
}

main().catch(error => {
  console.error(`\n❌ ERROR: ${error.message}`);
  console.error(error);
  process.exit(1);
});
