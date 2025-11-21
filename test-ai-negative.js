import fs from 'fs';

// Test 1: VERGLEICH Modus ohne previousUploadData
async function testMissingPreviousData() {
  console.log('\n=== NEGATIVTEST 1: VERGLEICH ohne vorherige Daten ===\n');
  
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
        trend: 'Neu',
        grid: 'Neu'
      },
      isStartMetric: false,
      previousUploadData: null
    })
  });
  
  const data = await response.json();
  
  if (response.status === 400) {
    console.log('✅ ERFOLGREICH ABGELEHNT!');
    console.log('Error:', data.error);
    console.log('Details:', data.details);
  } else {
    console.log('❌ FEHLER: Request wurde NICHT abgelehnt!');
    console.log('Response:', data);
  }
}

// Test 2: VERGLEICH Modus mit unvollständigen previousUploadData
async function testIncompletePreviousData() {
  console.log('\n=== NEGATIVTEST 2: VERGLEICH mit unvollständigen Daten ===\n');
  
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
  
  // Unvollständige previousUploadData (fehlt profit Feld)
  const incompletePrevious = {
    date: "2025-11-18T22:42",
    botDirection: "Short",
    leverage: "75x Short",
    investment: "120.00",
    extraMargin: "650.00",
    totalInvestment: "770.00"
    // FEHLT: profit, overallTrendPnlUsdt, overallGridProfitUsdt
  };
  
  const response = await fetch('http://localhost:5000/api/phase4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extractedData),
      modes: {
        investment: 'Neu',
        profit: 'Vergleich',
        trend: 'Vergleich',
        grid: 'Vergleich'
      },
      isStartMetric: false,
      previousUploadData: JSON.stringify(incompletePrevious)
    })
  });
  
  const data = await response.json();
  
  if (response.status === 400) {
    console.log('✅ ERFOLGREICH ABGELEHNT!');
    console.log('Error:', data.error);
    console.log('Details:', data.details);
    console.log('Suggestion:', data.suggestion);
  } else {
    console.log('❌ FEHLER: Request wurde NICHT abgelehnt!');
    console.log('Response:', data);
  }
}

// Test 3: Ungültiges JSON in previousUploadData
async function testInvalidJSON() {
  console.log('\n=== NEGATIVTEST 3: Ungültiges JSON ===\n');
  
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
  
  const response = await fetch('http://localhost:5000/api/phase4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extractedData),
      modes: {
        investment: 'Vergleich',
        profit: 'Neu',
        trend: 'Neu',
        grid: 'Neu'
      },
      isStartMetric: false,
      previousUploadData: "{this is not valid json at all!!!"
    })
  });
  
  const data = await response.json();
  
  if (response.status === 400) {
    console.log('✅ ERFOLGREICH ABGELEHNT!');
    console.log('Error:', data.error);
  } else {
    console.log('❌ FEHLER: Request wurde NICHT abgelehnt!');
    console.log('Response:', data);
  }
}

async function runNegativeTests() {
  try {
    await testMissingPreviousData();
    await testIncompletePreviousData();
    await testInvalidJSON();
    
    console.log('\n✅ ALLE NEGATIVTESTS ABGESCHLOSSEN!\n');
  } catch (error) {
    console.error('\n❌ TEST FEHLER:', error.message);
    console.error(error.stack);
  }
}

runNegativeTests();
