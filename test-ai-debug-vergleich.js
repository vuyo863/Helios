/**
 * DEBUG TEST - VERGLEICH Problem analysieren
 */

import fs from 'fs';

const API_BASE = 'http://localhost:5000';

function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

const screenshotA = imageToBase64('test-screenshot-a.png');
const screenshotB = imageToBase64('test-screenshot-b.png');

async function main() {
  console.log('\n🔍 DEBUG TEST - VERGLEICH Problem\n');
  
  // 1. Create Bot Type
  console.log('Step 1: Creating Bot Type...');
  const botTypeRes = await fetch(`${API_BASE}/api/bot-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Debug Bot ${Date.now()}`,
      description: 'Debug test',
      color: '#FF0000'
    })
  });
  const botType = await botTypeRes.json();
  const botTypeId = botType.id;
  console.log(`✅ Bot Type created: ${botTypeId}\n`);
  
  // 2. UPLOAD 1 - NEU
  console.log('Step 2: UPLOAD 1 (NEU) - 2 Screenshots: A + B');
  console.log('  Screenshot A: Investment=1000, ExtraMargin=1000');
  console.log('  Screenshot B: Investment=10, ExtraMargin=840');
  console.log('  Expected Total: Investment=1010, ExtraMargin=1840\n');
  
  const phase2Res1 = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Extract' }],
      images: [screenshotA, screenshotB],
      phase: 'phase2_data_extraction',
      selectedBotTypeName: 'Debug Bot',
      selectedBotTypeId: botTypeId,
      updateHistory: {}
    })
  });
  const phase2Data1 = await phase2Res1.json();
  const extracted1 = JSON.parse(phase2Data1.response.match(/\{[\s\S]*\}/)[0]);
  
  console.log('✅ Phase 2 extracted:');
  extracted1.screenshots.forEach((s, i) => {
    console.log(`   Screenshot ${i+1}: Investment=${s.actualInvestment}, ExtraMargin=${s.extraMargin}`);
  });
  console.log('');
  
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
  
  console.log('✅ Phase 4 calculated:');
  console.log(`   Investment: ${phase4Data1.values.investment}`);
  console.log(`   ExtraMargin: ${phase4Data1.values.extraMargin}`);
  console.log(`   TotalInvestment: ${phase4Data1.values.totalInvestment}\n`);
  
  const saveRes1 = await fetch(`${API_BASE}/api/bot-types/${botTypeId}/updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: 1,
      status: 'Update Metrics',
      ...phase4Data1.values
    })
  });
  const saved1 = await saveRes1.json();
  console.log(`✅ Saved Upload 1 (ID: ${saved1.id})\n`);
  console.log('═'.repeat(70) + '\n');
  
  // 3. UPLOAD 2 - VERGLEICH (SAME SCREENSHOTS, DIFFERENT ORDER)
  await new Promise(r => setTimeout(r, 1000));
  
  console.log('Step 3: UPLOAD 2 (VERGLEICH) - 2 Screenshots: B + A (umgekehrte Reihenfolge)');
  console.log('  Screenshot B: Investment=10, ExtraMargin=840');
  console.log('  Screenshot A: Investment=1000, ExtraMargin=1000');
  console.log('  Expected Total: Investment=1010, ExtraMargin=1840 (SAME AS UPLOAD 1)\n');
  
  const phase2Res2 = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Extract' }],
      images: [screenshotB, screenshotA],  // Umgekehrte Reihenfolge!
      phase: 'phase2_data_extraction',
      selectedBotTypeName: 'Debug Bot',
      selectedBotTypeId: botTypeId,
      updateHistory: {}
    })
  });
  const phase2Data2 = await phase2Res2.json();
  const extracted2 = JSON.parse(phase2Data2.response.match(/\{[\s\S]*\}/)[0]);
  
  console.log('✅ Phase 2 extracted:');
  extracted2.screenshots.forEach((s, i) => {
    console.log(`   Screenshot ${i+1}: Investment=${s.actualInvestment}, ExtraMargin=${s.extraMargin}`);
  });
  const currentInvestment = extracted2.screenshots.reduce((sum, s) => sum + s.actualInvestment, 0);
  const currentExtraMargin = extracted2.screenshots.reduce((sum, s) => sum + (s.extraMargin || 0), 0);
  console.log(`   TOTAL: Investment=${currentInvestment}, ExtraMargin=${currentExtraMargin}\n`);
  
  // Prepare previousUploadData
  const previousData = {
    investment: saved1.investment,
    extraMargin: saved1.extraMargin,
    totalInvestment: saved1.totalInvestment,
    profit: saved1.profit,
    overallTrendPnlUsdt: saved1.overallTrendPnlUsdt,
    overallGridProfitUsdt: saved1.overallGridProfitUsdt
  };
  
  console.log('📦 previousUploadData:');
  console.log(`   Investment: ${previousData.investment}`);
  console.log(`   ExtraMargin: ${previousData.extraMargin}`);
  console.log(`   TotalInvestment: ${previousData.totalInvestment}\n`);
  
  console.log('🧮 EXPECTED CALCULATIONS (VERGLEICH):');
  const expectedInvestmentDiff = currentInvestment - parseFloat(previousData.investment);
  const expectedExtraMarginDiff = currentExtraMargin - parseFloat(previousData.extraMargin || 0);
  console.log(`   Investment Diff: ${currentInvestment} - ${previousData.investment} = ${expectedInvestmentDiff.toFixed(2)}`);
  console.log(`   ExtraMargin Diff: ${currentExtraMargin} - ${previousData.extraMargin} = ${expectedExtraMarginDiff.toFixed(2)}\n`);
  
  console.log('🤖 Sending to AI Phase 4...\n');
  
  const phase4Res2 = await fetch(`${API_BASE}/api/phase4`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extracted2),
      modes: { investment: 'Vergleich', profit: 'Vergleich', trend: 'Vergleich', grid: 'Vergleich' },
      isStartMetric: false,
      previousUploadData: JSON.stringify(previousData)
    })
  });
  
  if (!phase4Res2.ok) {
    const error = await phase4Res2.json();
    console.log('❌ AI Phase 4 FAILED:');
    console.log(`   Error: ${error.error}`);
    console.log(`   Details: ${error.details}\n`);
    
    console.log('🔍 ANALYSIS:');
    console.log(`   The AI should calculate: current (${currentInvestment}) - previous (${previousData.investment}) = ${expectedInvestmentDiff.toFixed(2)}`);
    console.log(`   But AI calculated something different, which failed server validation.\n`);
    
    console.log('💡 POSSIBLE CAUSES:');
    console.log('   1. AI is not summing all screenshots correctly');
    console.log('   2. AI is using wrong field from previousUploadData');
    console.log('   3. AI is calculating in wrong direction (previous - current)');
    console.log('   4. AI is returning absolute value instead of difference\n');
    
    process.exit(1);
  }
  
  const phase4Data2 = await phase4Res2.json();
  console.log('✅ AI Phase 4 SUCCESS:');
  console.log(`   Investment Diff: ${phase4Data2.values.investment}`);
  console.log(`   ExtraMargin Diff: ${phase4Data2.values.extraMargin}\n`);
  
  console.log('🎉 TEST PASSED! VERGLEICH mode working correctly!\n');
}

main().catch(error => {
  console.error(`\n❌ ERROR: ${error.message}`);
  console.error(error);
  process.exit(1);
});
