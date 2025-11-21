import fs from 'fs';

// Test Phase 2: Data Extraction
async function testPhase2DataExtraction(screenshotPath) {
  console.log('\n=== PHASE 2: DATA EXTRACTION TEST ===\n');
  
  const imageBuffer = fs.readFileSync(screenshotPath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = screenshotPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64Image}`;
  
  const response = await fetch('http://localhost:5000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Bitte extrahiere alle Daten aus diesem Screenshot.' }
      ],
      images: [dataUrl],
      phase: 'phase2_data_extraction'
    })
  });
  
  const data = await response.json();
  console.log('KI Response:', data.response);
  
  try {
    const parsed = JSON.parse(data.response);
    console.log('\n✅ JSON erfolgreich geparst!');
    console.log('Extrahierte Daten:', JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (e) {
    console.log('\n❌ JSON Parse Fehler:', e.message);
    console.log('Rohdaten:', data.response);
    return null;
  }
}

async function testPhase4Neu(extractedData) {
  console.log('\n=== PHASE 4: BERECHNUNGEN (MODUS NEU) ===\n');
  
  const response = await fetch('http://localhost:5000/api/phase4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenshotData: JSON.stringify(extractedData),
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
  
  const data = await response.json();
  console.log('Phase 4 Response:', JSON.stringify(data, null, 2));
  return data.values;
}

async function testPhase4Vergleich(extractedData, previousData) {
  console.log('\n=== PHASE 4: BERECHNUNGEN (MODUS VERGLEICH) ===\n');
  
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
  console.log('Phase 4 Response:', JSON.stringify(data, null, 2));
  return data.values;
}

async function runTests() {
  try {
    const screenshotPath = process.argv[2] || './attached_assets/IMG_0094_1763321956313.jpeg';
    
    console.log(`\n📸 Teste mit Screenshot: ${screenshotPath}\n`);
    
    const extractedData = await testPhase2DataExtraction(screenshotPath);
    
    if (!extractedData) {
      console.log('\n❌ Phase 2 fehlgeschlagen - Tests abgebrochen');
      return;
    }
    
    const neuResults = await testPhase4Neu(extractedData);
    await testPhase4Vergleich(extractedData, neuResults);
    
    console.log('\n✅ Alle Tests abgeschlossen!\n');
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error.stack);
  }
}

runTests();
