/**
 * Test: Ø Grid Profit USDT Berechnung
 * Formel: Gesamter Grid Profit USDT / Anzahl Screenshots
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
  console.log('TEST: Ø Grid Profit USDT Berechnung');
  console.log('Formel: Gesamter Grid Profit / Anzahl Screenshots');
  console.log('='.repeat(70));

  // Test 1: 1 Screenshot mit Grid Profit = 60.00
  console.log('\n--- Test 1: 1 Screenshot, Grid Profit = 60.00 ---');
  const oneScreenshot = {
    screenshots: [{
      screenshotNumber: 1,
      tradingPair: "ETH/USDT",
      botName: "Test Bot",
      runtime: "10 Tage 5 Stunden",
      totalInvestment: 1000.00,
      actualInvestment: 500.00,
      extraMargin: 100.00,
      totalProfit: 50.00,
      totalProfitPercent: 5.0,
      trendPnl: 10.00,
      gridProfitUsdt: 60.00,  // Gesamter Grid Profit
      gridProfitPercent: 6.0,
      highestGridProfit: 65.00,
      highestGridProfitPercent: 6.5
    }]
  };

  const payload1 = {
    screenshotData: JSON.stringify(oneScreenshot),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null
  };

  const response1 = await apiRequest('POST', '/api/phase4', payload1);
  if (response1.status === 200 && response1.data.values) {
    const values = response1.data.values;
    console.log(`Gesamter Grid Profit: ${values.overallGridProfitUsdt}`);
    console.log(`Anzahl Screenshots: 1`);
    console.log(`Erwarteter Ø Grid Profit: 60.00 / 1 = 60.00`);
    console.log('(Berechnung erfolgt im Frontend nach AI-Antwort)');
  }

  // Test 2: 2 Screenshots mit Grid Profit = 40.00 und 80.00
  console.log('\n--- Test 2: 2 Screenshots, Grid Profit = 40.00 + 80.00 = 120.00 ---');
  const twoScreenshots = {
    screenshots: [
      {
        screenshotNumber: 1,
        tradingPair: "ETH/USDT",
        botName: "Bot 1",
        runtime: "10 Tage",
        totalInvestment: 1000.00,
        actualInvestment: 500.00,
        extraMargin: 100.00,
        totalProfit: 30.00,
        gridProfitUsdt: 40.00
      },
      {
        screenshotNumber: 2,
        tradingPair: "BTC/USDT",
        botName: "Bot 2",
        runtime: "15 Tage",
        totalInvestment: 2000.00,
        actualInvestment: 1500.00,
        extraMargin: 200.00,
        totalProfit: 70.00,
        gridProfitUsdt: 80.00
      }
    ]
  };

  const payload2 = {
    screenshotData: JSON.stringify(twoScreenshots),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null
  };

  const response2 = await apiRequest('POST', '/api/phase4', payload2);
  if (response2.status === 200 && response2.data.values) {
    const values = response2.data.values;
    console.log(`Gesamter Grid Profit (AI): ${values.overallGridProfitUsdt}`);
    console.log(`Anzahl Screenshots: 2`);
    console.log(`Erwarteter Ø Grid Profit: Gesamter / 2 = ${parseFloat(values.overallGridProfitUsdt) / 2}`);
    console.log('(Frontend berechnet: overallGridProfitUsdt / screenshotCount)');
  }

  // Test 3: 3 Screenshots
  console.log('\n--- Test 3: 3 Screenshots, Grid Profit = 30 + 60 + 90 = 180 ---');
  const threeScreenshots = {
    screenshots: [
      { screenshotNumber: 1, botName: "Bot 1", gridProfitUsdt: 30.00, runtime: "5 Tage", totalInvestment: 500, actualInvestment: 400 },
      { screenshotNumber: 2, botName: "Bot 2", gridProfitUsdt: 60.00, runtime: "10 Tage", totalInvestment: 1000, actualInvestment: 800 },
      { screenshotNumber: 3, botName: "Bot 3", gridProfitUsdt: 90.00, runtime: "15 Tage", totalInvestment: 1500, actualInvestment: 1200 }
    ]
  };

  const payload3 = {
    screenshotData: JSON.stringify(threeScreenshots),
    modes: { investment: 'Neu', profit: 'Neu', trend: 'Neu', grid: 'Neu' },
    isStartMetric: true,
    previousUploadData: null
  };

  const response3 = await apiRequest('POST', '/api/phase4', payload3);
  if (response3.status === 200 && response3.data.values) {
    const values = response3.data.values;
    const gesamtGridProfit = parseFloat(values.overallGridProfitUsdt) || 0;
    console.log(`Gesamter Grid Profit (AI): ${values.overallGridProfitUsdt}`);
    console.log(`Anzahl Screenshots: 3`);
    console.log(`Erwarteter Ø Grid Profit: ${gesamtGridProfit} / 3 = ${(gesamtGridProfit / 3).toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('HINWEIS: Die Ø Grid Profit USDT Berechnung erfolgt im FRONTEND');
  console.log('Formel: overallGridProfitUsdt / Anzahl Screenshots');
  console.log('='.repeat(70));
}

runTest().catch(console.error);
