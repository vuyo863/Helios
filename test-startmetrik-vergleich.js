/**
 * TEST: Startmetrik mit VERGLEICH Modi
 * 
 * Testet dass beim ersten Upload (isStartMetric=true) mit VERGLEICH Modi
 * alle VERGLEICH Felder auf "0.00" gesetzt werden (ohne previousUploadData).
 */

const API_BASE = 'http://localhost:5000';

async function main() {
  console.log('🧪 STARTMETRIK VERGLEICH TEST\n');

  // 1. Create Bot Type
  console.log('1️⃣  Creating Bot Type...');
  const botTypeRes = await fetch(`${API_BASE}/api/bot-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Startmetrik Test ${Date.now()}`,
      description: 'Testing Startmetrik with VERGLEICH modes',
      color: '#FF5733'
    })
  });
  const botType = await botTypeRes.json();
  console.log(`✅ Bot Type created: ${botType.name} (${botType.id})\n`);

  // 2. Phase 2: Extract data from 2 screenshots
  console.log('2️⃣  Phase 2: Extracting data from 2 screenshots...');
  const phase2Res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'phase2_data_extraction',
      messages: [],
      images: [
        { investment: 1000, extraMargin: 500, totalProfit: -5.00 },
        { investment: 500, extraMargin: 250, totalProfit: -2.00 }
      ]
    })
  });
  const phase2Data = await phase2Res.json();
  console.log(`✅ Phase 2: Extracted 2 screenshots\n`);

  // 3. Phase 4: STARTMETRIK with ALL VERGLEICH modes (no previousUploadData!)
  console.log('3️⃣  Phase 4: Startmetrik with ALL VERGLEICH modes...');
  console.log('   (isStartMetric=true, previousUploadData=null)\n');
  
  const phase4Res = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: phase2Data.response,
      modes: {
        investment: 'Vergleich',  // VERGLEICH mode
        profit: 'Vergleich',      // VERGLEICH mode
        trend: 'Vergleich',       // VERGLEICH mode
        grid: 'Vergleich'         // VERGLEICH mode
      },
      isStartMetric: true,        // STARTMETRIK!
      previousUploadData: null    // NO previous data!
    })
  });

  if (!phase4Res.ok) {
    const error = await phase4Res.json();
    console.log(`❌ Phase 4 failed: ${error.error}`);
    if (error.details) console.log(`   Details: ${error.details}`);
    process.exit(1);
  }

  const phase4Data = await phase4Res.json();
  
  // 4. Verify all VERGLEICH fields are "0.00"
  console.log('4️⃣  Verifying all VERGLEICH fields are "0.00"...\n');
  
  const expectedZeroFields = [
    // Investment Section
    'investment', 'extraMargin', 'totalInvestment',
    // Profit Section
    'profit', 'profitPercent_gesamtinvestment', 'profitPercent_investitionsmenge',
    // Trend Section
    'overallTrendPnlUsdt', 'overallTrendPnlPercent_gesamtinvestment', 'overallTrendPnlPercent_investitionsmenge',
    // Grid Section
    'overallGridProfitUsdt', 'overallGridProfitPercent_gesamtinvestment', 'overallGridProfitPercent_investitionsmenge',
    'highestGridProfit', 'highestGridProfitPercent_gesamtinvestment', 'highestGridProfitPercent_investitionsmenge',
    'avgGridProfitHour', 'avgGridProfitDay', 'avgGridProfitWeek'
  ];
  
  let allZero = true;
  const values = phase4Data.values;
  
  for (const field of expectedZeroFields) {
    const value = values[field];
    const isZero = value === '0.00' || value === 0 || value === null;
    
    if (!isZero) {
      console.log(`❌ ${field}: Expected "0.00", got ${value}`);
      allZero = false;
    } else {
      console.log(`✅ ${field}: ${value}`);
    }
  }
  
  if (allZero) {
    console.log('\n🎉 TEST PASSED! All VERGLEICH fields are "0.00" for Startmetrik!\n');
  } else {
    console.log('\n❌ TEST FAILED! Some VERGLEICH fields are not "0.00"!\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`\n❌ ERROR: ${error.message}`);
  console.error(error);
  process.exit(1);
});
