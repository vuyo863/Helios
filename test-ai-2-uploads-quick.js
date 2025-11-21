/**
 * QUICK 2-UPLOAD TEST
 * Validiert dass die AI-Pipeline grundsätzlich funktioniert
 */

import fs from 'fs';

const API_BASE = 'http://localhost:5000';
const BOT_TYPE_NAME = 'Quick Test Bot';

// Screenshot zu Base64
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

const screenshotA = imageToBase64('test-screenshot-a.png');
const screenshotB = imageToBase64('test-screenshot-b.png');

let createdBotTypeId = null;
let lastUpdateData = null;

async function main() {
  console.log('\n🚀 QUICK AI TEST - 2 UPLOADS\n');
  
  // 1. Create Bot Type
  console.log('1️⃣  Creating Bot Type...');
  const botTypeRes = await fetch(`${API_BASE}/api/bot-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `${BOT_TYPE_NAME} ${Date.now()}`,
      description: 'Quick test',
      color: '#3B82F6'
    })
  });
  const botType = await botTypeRes.json();
  createdBotTypeId = botType.id;
  console.log(`✅ Bot Type created: ${botType.name} (${createdBotTypeId})\n`);
  
  // 2. UPLOAD 1 - STARTMETRIK (NEU)
  console.log('2️⃣  UPLOAD 1 - STARTMETRIK (Alle NEU)');
  
  // Phase 2
  console.log('   Phase 2: Extracting data from 2 screenshots...');
  const phase2Res1 = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Extract data' }],
      images: [screenshotA, screenshotB],
      phase: 'phase2_data_extraction',
      selectedBotTypeName: BOT_TYPE_NAME,
      selectedBotTypeId: createdBotTypeId,
      selectedBotTypeColor: '#3B82F6',
      updateHistory: {}
    })
  });
  const phase2Data1 = await phase2Res1.json();
  const jsonMatch1 = phase2Data1.response.match(/\{[\s\S]*\}/);
  const extracted1 = JSON.parse(jsonMatch1[0]);
  console.log(`   ✅ Phase 2: ${extracted1.screenshots.length} screenshots extracted`);
  
  // Phase 4
  console.log('   Phase 4: AI calculations (NEU mode)...');
  const phase4Res1 = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extracted1),
      modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
      isStartMetric: true,
      previousUploadData: null
    })
  });
  const phase4Data1 = await phase4Res1.json();
  console.log(`   ✅ Phase 4: Investment=${phase4Data1.values.investment}, Profit=${phase4Data1.values.profit}`);
  
  // Save
  console.log('   Saving to database...');
  const saveRes1 = await fetch(`${API_BASE}/api/bot-types/${createdBotTypeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      status: 'Update Metrics',
      ...phase4Data1.values
    })
  });
  
  if (!saveRes1.ok) {
    const error = await saveRes1.json();
    console.log(`   ❌ Save failed: ${error.error}`);
    if (error.details) {
      console.log(`      Details: ${JSON.stringify(error.details, null, 2)}`);
    }
    console.log(`\n   DEBUG: Sending data:`);
    console.log(JSON.stringify({
      version: 1,
      status: 'Update Metrics',
      ...phase4Data1.values
    }, null, 2));
    process.exit(1);
  }
  
  lastUpdateData = await saveRes1.json();
  console.log(`   ✅ Saved (ID: ${lastUpdateData.id})`);
  console.log(`      Investment: ${lastUpdateData.investment}, Profit: ${lastUpdateData.profit}\n`);
  
  await new Promise(r => setTimeout(r, 2000));
  
  // 3. UPLOAD 2 - VERGLEICH
  console.log('3️⃣  UPLOAD 2 - VERGLEICH (Alle VERGLEICH)');
  
  // Phase 2
  console.log('   Phase 2: Extracting data from 2 screenshots...');
  const phase2Res2 = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Extract data' }],
      images: [screenshotB, screenshotA],
      phase: 'phase2_data_extraction',
      selectedBotTypeName: BOT_TYPE_NAME,
      selectedBotTypeId: createdBotTypeId,
      selectedBotTypeColor: '#3B82F6',
      updateHistory: {}
    })
  });
  const phase2Data2 = await phase2Res2.json();
  const jsonMatch2 = phase2Data2.response.match(/\{[\s\S]*\}/);
  const extracted2 = JSON.parse(jsonMatch2[0]);
  console.log(`   ✅ Phase 2: ${extracted2.screenshots.length} screenshots extracted`);
  
  // Phase 4 mit VERGLEICH
  console.log('   Phase 4: AI calculations (VERGLEICH mode)...');
  const previousData = JSON.stringify({
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
  });
  
  const phase4Res2 = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extracted2),
      modes: { investment: 'Vergleich', profit: 'Vergleich', trend: 'Vergleich', grid: 'Vergleich' },
      isStartMetric: false,
      previousUploadData: previousData
    })
  });
  
  if (!phase4Res2.ok) {
    const error = await phase4Res2.json();
    console.log(`   ❌ Phase 4 failed: ${error.error}`);
    if (error.details) console.log(`      Details: ${error.details}`);
    process.exit(1);
  }
  
  const phase4Data2 = await phase4Res2.json();
  console.log(`   ✅ Phase 4: Investment DIFF=${phase4Data2.values.investment}, Profit DIFF=${phase4Data2.values.profit}`);
  console.log(`              (These should be DIFFERENZEN, not absolute values)`);
  
  // Save
  console.log('   Saving to database...');
  const saveRes2 = await fetch(`${API_BASE}/api/bot-types/${createdBotTypeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 2,
      status: 'Update Metrics',
      ...phase4Data2.values
    })
  });
  const save2 = await saveRes2.json();
  console.log(`   ✅ Saved (ID: ${save2.id})\n`);
  
  // 4. Verify Update History
  console.log('4️⃣  Verifying Update History...');
  const historyRes = await fetch(`${API_BASE}/api/bot-types/${createdBotTypeId}/updates`);
  const history = await historyRes.json();
  console.log(`✅ ${history.length} updates found in database\n`);
  
  history.forEach((update, i) => {
    console.log(`   ${i + 1}. Version ${update.version}: Investment=${update.investment}, Profit=${update.profit}`);
  });
  
  console.log('\n🎉 TEST ERFOLGREICH! Beide Uploads (NEU + VERGLEICH) funktionieren!\n');
}

main().catch(error => {
  console.error(`\n❌ ERROR: ${error.message}`);
  console.error(error);
  process.exit(1);
});
