const http = require('http');

const BASE_URL = 'http://localhost:5000';
let testNumber = 0;
let passedTests = 0;
let failedTests = 0;

function log(message) {
  console.log(`[TEST] ${message}`);
}

function passed(testName) {
  passedTests++;
  console.log(`✅ Test ${++testNumber}: ${testName} - PASSED`);
}

function failed(testName, reason) {
  failedTests++;
  console.log(`❌ Test ${++testNumber}: ${testName} - FAILED: ${reason}`);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  log('Starting Absolute Values Backend Tests...\n');

  // Test 1: API Health Check
  try {
    const res = await makeRequest('GET', '/api/bot-types');
    if (res.status === 200) {
      passed('API Health Check - Bot Types endpoint accessible');
    } else {
      failed('API Health Check', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('API Health Check', e.message);
  }

  // Test 2: Create Bot Type
  let botTypeId = null;
  const testBotTypeName = `TestAbsoluteBot_${Date.now()}`;
  try {
    const res = await makeRequest('POST', '/api/bot-types', {
      name: testBotTypeName,
      description: 'Test Bot for absolute values',
      color: '#FF5733',
    });
    if (res.status === 201 || res.status === 200) {
      botTypeId = res.data.id;
      passed('Create Bot Type for testing');
    } else {
      failed('Create Bot Type', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Create Bot Type', e.message);
  }

  // Test 3: Verify Bot Type was created
  if (botTypeId) {
    try {
      const res = await makeRequest('GET', `/api/bot-types/${botTypeId}`);
      if (res.status === 200 && res.data.name === testBotTypeName) {
        passed('Verify Bot Type was created correctly');
      } else {
        failed('Verify Bot Type', `Status: ${res.status}`);
      }
    } catch (e) {
      failed('Verify Bot Type', e.message);
    }
  } else {
    failed('Verify Bot Type', 'No botTypeId available');
  }

  // Test 4: Create first Update (Startmetrik)
  let updateId1 = null;
  try {
    const updateData = {
      botTypeId: botTypeId,
      version: 1,
      status: 'Update Metrics',
      investment: '1000.00',
      extraMargin: '500.00',
      totalInvestment: '1500.00',
      profit: '50.00',
      profitPercent_gesamtinvestment: '3.33',
      profitPercent_investitionsmenge: '5.00',
      overallTrendPnlUsdt: '30.00',
      overallTrendPnlPercent_gesamtinvestment: '2.00',
      overallTrendPnlPercent_investitionsmenge: '3.00',
      overallGridProfitUsdt: '20.00',
      overallGridProfitPercent_gesamtinvestment: '1.33',
      overallGridProfitPercent_investitionsmenge: '2.00',
      avgGridProfitHour: '0.83',
      avgGridProfitDay: '20.00',
      avgGridProfitWeek: null,
      calculationMode: 'Startmetrik',
      investmentAbsolute: '1000.00',
      extraMarginAbsolute: '500.00',
      totalInvestmentAbsolute: '1500.00',
      profitAbsolute: '50.00',
      profitPercent_gesamtinvestment_absolute: '3.33',
      profitPercent_investitionsmenge_absolute: '5.00',
      overallTrendPnlUsdtAbsolute: '30.00',
      overallTrendPnlPercent_gesamtinvestment_absolute: '2.00',
      overallTrendPnlPercent_investitionsmenge_absolute: '3.00',
      overallGridProfitUsdtAbsolute: '20.00',
      overallGridProfitPercent_gesamtinvestment_absolute: '1.33',
      overallGridProfitPercent_investitionsmenge_absolute: '2.00',
      avgGridProfitHourAbsolute: '0.83',
      avgGridProfitDayAbsolute: '20.00',
      avgGridProfitWeekAbsolute: null,
    };
    const res = await makeRequest('POST', '/api/bot-type-updates', updateData);
    if (res.status === 201 || res.status === 200) {
      updateId1 = res.data.id;
      passed('Create first Update (Startmetrik) with absolute values');
    } else {
      failed('Create first Update', `Status: ${res.status}, Data: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    failed('Create first Update', e.message);
  }

  // Test 5: Verify first Update contains absolute values
  if (updateId1) {
    try {
      const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
      if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
        const update = res.data.find(u => u.id === updateId1);
        if (update && update.investmentAbsolute === '1000.00' && update.profitAbsolute === '50.00') {
          passed('Verify first Update contains absolute values');
        } else {
          failed('Verify first Update', `Absolute values missing or incorrect: ${JSON.stringify(update)}`);
        }
      } else {
        failed('Verify first Update', `Status: ${res.status}`);
      }
    } catch (e) {
      failed('Verify first Update', e.message);
    }
  } else {
    failed('Verify first Update', 'No updateId1 available');
  }

  // Test 6: Create second Update (Vergleichsmodus - mit Differenzwerten)
  let updateId2 = null;
  try {
    const updateData = {
      botTypeId: botTypeId,
      version: 2,
      status: 'Update Metrics',
      investment: '200.00',
      extraMargin: '100.00',
      totalInvestment: '300.00',
      profit: '25.00',
      profitPercent_gesamtinvestment: '1.39',
      profitPercent_investitionsmenge: '2.08',
      overallTrendPnlUsdt: '15.00',
      overallTrendPnlPercent_gesamtinvestment: '0.83',
      overallTrendPnlPercent_investitionsmenge: '1.25',
      overallGridProfitUsdt: '10.00',
      overallGridProfitPercent_gesamtinvestment: '0.56',
      overallGridProfitPercent_investitionsmenge: '0.83',
      avgGridProfitHour: '0.17',
      avgGridProfitDay: '5.00',
      avgGridProfitWeek: null,
      calculationMode: 'Normal',
      investmentAbsolute: '1200.00',
      extraMarginAbsolute: '600.00',
      totalInvestmentAbsolute: '1800.00',
      profitAbsolute: '75.00',
      profitPercent_gesamtinvestment_absolute: '4.17',
      profitPercent_investitionsmenge_absolute: '6.25',
      overallTrendPnlUsdtAbsolute: '45.00',
      overallTrendPnlPercent_gesamtinvestment_absolute: '2.50',
      overallTrendPnlPercent_investitionsmenge_absolute: '3.75',
      overallGridProfitUsdtAbsolute: '30.00',
      overallGridProfitPercent_gesamtinvestment_absolute: '1.67',
      overallGridProfitPercent_investitionsmenge_absolute: '2.50',
      avgGridProfitHourAbsolute: '1.00',
      avgGridProfitDayAbsolute: '25.00',
      avgGridProfitWeekAbsolute: null,
    };
    const res = await makeRequest('POST', '/api/bot-type-updates', updateData);
    if (res.status === 201 || res.status === 200) {
      updateId2 = res.data.id;
      passed('Create second Update (Vergleichsmodus) with absolute values');
    } else {
      failed('Create second Update', `Status: ${res.status}, Data: ${JSON.stringify(res.data)}`);
    }
  } catch (e) {
    failed('Create second Update', e.message);
  }

  // Test 7: Verify second Update contains correct absolute values (different from differential)
  if (updateId2) {
    try {
      const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
      if (res.status === 200 && Array.isArray(res.data)) {
        const update = res.data.find(u => u.id === updateId2);
        if (update) {
          const checks = [
            update.investment === '200.00',
            update.investmentAbsolute === '1200.00',
            update.profitAbsolute === '75.00',
            update.overallGridProfitUsdtAbsolute === '30.00',
          ];
          if (checks.every(c => c)) {
            passed('Verify second Update: differential and absolute values are different');
          } else {
            failed('Verify second Update', `Values mismatch: inv=${update.investment}, invAbs=${update.investmentAbsolute}`);
          }
        } else {
          failed('Verify second Update', 'Update not found');
        }
      } else {
        failed('Verify second Update', `Status: ${res.status}`);
      }
    } catch (e) {
      failed('Verify second Update', e.message);
    }
  } else {
    failed('Verify second Update', 'No updateId2 available');
  }

  // Test 8: Check all absolute fields exist
  if (updateId2) {
    try {
      const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
      if (res.status === 200 && Array.isArray(res.data)) {
        const update = res.data.find(u => u.id === updateId2);
        const absoluteFields = [
          'investmentAbsolute',
          'extraMarginAbsolute',
          'totalInvestmentAbsolute',
          'profitAbsolute',
          'profitPercent_gesamtinvestment_absolute',
          'profitPercent_investitionsmenge_absolute',
          'overallTrendPnlUsdtAbsolute',
          'overallTrendPnlPercent_gesamtinvestment_absolute',
          'overallTrendPnlPercent_investitionsmenge_absolute',
          'overallGridProfitUsdtAbsolute',
          'overallGridProfitPercent_gesamtinvestment_absolute',
          'overallGridProfitPercent_investitionsmenge_absolute',
          'avgGridProfitHourAbsolute',
          'avgGridProfitDayAbsolute',
          'avgGridProfitWeekAbsolute',
        ];
        const missingFields = absoluteFields.filter(f => !(f in update));
        if (missingFields.length === 0) {
          passed('All absolute fields exist in Update response');
        } else {
          failed('All absolute fields exist', `Missing: ${missingFields.join(', ')}`);
        }
      } else {
        failed('All absolute fields exist', `Status: ${res.status}`);
      }
    } catch (e) {
      failed('All absolute fields exist', e.message);
    }
  } else {
    failed('All absolute fields exist', 'No updateId2 available');
  }

  // Test 9: Update with null avgGridProfitWeek (should be accepted)
  try {
    const updateData = {
      botTypeId: botTypeId,
      version: 3,
      status: 'Update Metrics',
      investment: '100.00',
      profit: '10.00',
      avgGridProfitWeek: null,
      avgGridProfitWeekAbsolute: null,
    };
    const res = await makeRequest('POST', '/api/bot-type-updates', updateData);
    if (res.status === 201 || res.status === 200) {
      passed('Create Update with null avgGridProfitWeek (accepted)');
    } else {
      failed('Create Update with null avgGridProfitWeek', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Create Update with null avgGridProfitWeek', e.message);
  }

  // Test 10: Delete test Bot Type (cleanup)
  if (botTypeId) {
    try {
      const res = await makeRequest('DELETE', `/api/bot-types/${botTypeId}`);
      if (res.status === 200 || res.status === 204) {
        passed('Cleanup: Delete test Bot Type');
      } else {
        failed('Cleanup: Delete test Bot Type', `Status: ${res.status}`);
      }
    } catch (e) {
      failed('Cleanup: Delete test Bot Type', e.message);
    }
  } else {
    failed('Cleanup', 'No botTypeId to delete');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('='.repeat(50));

  if (failedTests === 0) {
    console.log('\n✅ ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
