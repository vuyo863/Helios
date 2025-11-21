import fs from 'fs';

async function testPhase4Startmetrik() {
  console.log('\n=== TEST 1: STARTMETRIK (isStartMetric = true, VERGLEICH Modi) ===\n');
  
  const extractedData = {
    screenshots: [{
      screenshotNumber: 1,
      date: "2025-11-18",
      time: "22:42:13",
      actualInvestment: 120,
      extraMargin: 650,
      totalProfitUsdt: 71.03,
      totalProfitPercent: 59.19,
      gridProfitUsdt: 5.51,
      gridProfitPercent: 4.59,
      trendPnlUsdt: 65.52,
      trendPnlPercent: 54.60,
      leverage: "75x Short",
      runtime: "1d 6h 53m",
      direction: "Short"
    }]
  };
  
  const response = await fetch('http://localhost:5000/api/phase4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extractedData),
      modes: {
        investment: 'Vergleich',
        profit: 'Vergleich',
        trend: 'Vergleich',
        grid: 'Vergleich'
      },
      isStartMetric: true,
      previousUploadData: null
    })
  });
  
  const data = await response.json();
  console.log('✅ KI Antwort:\n', JSON.stringify(data.values, null, 2));
  
  console.log('\n📊 ERWARTUNG: Alle USDT-Werte sollten 0.00 sein (nichts zum Vergleichen!)');
  console.log('- Investment:', data.values.investment, '(erwartet: 0.00)');
  console.log('- Profit:', data.values.profit, '(erwartet: 0.00)');
  console.log('- Trend P&L:', data.values.overallTrendPnlUsdt, '(erwartet: 0.00)');
  console.log('- Grid Profit:', data.values.overallGridProfitUsdt, '(erwartet: 0.00)');
  
  return data.values;
}

async function testPhase4VergleichWithPrevious() {
  console.log('\n=== TEST 2: UPDATE (isStartMetric = false, VERGLEICH Modi) ===\n');
  
  const extractedData = {
    screenshots: [{
      screenshotNumber: 1,
      date: "2025-11-20",
      time: "10:30:00",
      actualInvestment: 200,
      extraMargin: 800,
      totalProfitUsdt: 150,
      totalProfitPercent: 75,
      gridProfitUsdt: 30,
      gridProfitPercent: 15,
      trendPnlUsdt: 120,
      trendPnlPercent: 60,
      leverage: "75x Short",
      runtime: "3d 5h 20m",
      direction: "Short"
    }]
  };
  
  const previousData = {
    date: "2025-11-18T22:42",
    botDirection: "Short",
    leverage: "75x Short",
    longestRuntime: "1d 6h 53m",
    avgRuntime: "1d 6h 53m",
    investment: "120.00",
    extraMargin: "650.00",
    totalInvestment: "770.00",
    profit: "71.03",
    profitPercent_gesamtinvestment: "9.22",
    profitPercent_investitionsmenge: "59.19",
    overallTrendPnlUsdt: "65.52",
    overallTrendPnlPercent_gesamtinvestment: "8.51",
    overallTrendPnlPercent_investitionsmenge: "54.60",
    overallGridProfitUsdt: "5.51",
    overallGridProfitPercent_gesamtinvestment: "0.72",
    overallGridProfitPercent_investitionsmenge: "4.59",
    highestGridProfit: "5.51",
    highestGridProfitPercent_gesamtinvestment: "0.72",
    highestGridProfitPercent_investitionsmenge: "4.59",
    avgGridProfitHour: "0.18",
    avgGridProfitDay: "4.27",
    avgGridProfitWeek: null
  };
  
  const response = await fetch('http://localhost:5000/api/phase4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extractedData),
      modes: {
        investment: 'Vergleich',
        profit: 'Vergleich',
        trend: 'Vergleich',
        grid: 'Vergleich'
      },
      isStartMetric: false,
      previousUploadData: JSON.stringify(previousData)
    })
  });
  
  const data = await response.json();
  console.log('✅ KI Antwort:\n', JSON.stringify(data.values, null, 2));
  
  console.log('\n📊 ERWARTETE DIFFERENZEN:');
  console.log('- Investment: 200 - 120 = +80 USDT');
  console.log('  → Berechnet:', data.values.investment);
  console.log('- Profit: 150 - 71.03 = +78.97 USDT');
  console.log('  → Berechnet:', data.values.profit);
  console.log('- Trend P&L: 120 - 65.52 = +54.48 USDT');
  console.log('  → Berechnet:', data.values.overallTrendPnlUsdt);
  console.log('- Grid Profit: 30 - 5.51 = +24.49 USDT');
  console.log('  → Berechnet:', data.values.overallGridProfitUsdt);
  
  return data.values;
}

async function runAllTests() {
  try {
    await testPhase4Startmetrik();
    await testPhase4VergleichWithPrevious();
    
    console.log('\n✅ ALLE TESTS ABGESCHLOSSEN!\n');
  } catch (error) {
    console.error('\n❌ TEST FEHLER:', error.message);
    console.error(error.stack);
  }
}

runAllTests();
