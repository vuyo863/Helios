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

  // Test 3: Create first Update (Startmetrik) with absolute values
  try {
    const updateData = {
      version: 1,
      status: 'Update Metrics',
      investment: '1000.00',
      extraMargin: '500.00',
      totalInvestment: '1500.00',
      profit: '50.00',
      profitPercent_gesamtinvestment: '3.33',
      profitPercent_investitionsmenge: '5.00',
      overallTrendPnlUsdt: '30.00',
      overallGridProfitUsdt: '20.00',
      avgGridProfitHour: '0.83',
      avgGridProfitDay: '20.00',
      calculationMode: 'Startmetrik',
      investmentAbsolute: '1000.00',
      extraMarginAbsolute: '500.00',
      totalInvestmentAbsolute: '1500.00',
      profitAbsolute: '50.00',
      profitPercent_gesamtinvestment_absolute: '3.33',
      profitPercent_investitionsmenge_absolute: '5.00',
      overallTrendPnlUsdtAbsolute: '30.00',
      overallGridProfitUsdtAbsolute: '20.00',
      avgGridProfitHourAbsolute: '0.83',
      avgGridProfitDayAbsolute: '20.00',
    };
    const res = await makeRequest('POST', `/api/bot-types/${botTypeId}/updates`, updateData);
    if (res.status === 201 || res.status === 200) {
      passed('Create first Update (Startmetrik) with absolute values');
    } else {
      failed('Create first Update', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Create first Update', e.message);
  }

  // Test 4: Verify first Update contains absolute values
  try {
    const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      const update = res.data.find(u => u.version === 1);
      if (update && update.investmentAbsolute === '1000.00' && update.profitAbsolute === '50.00') {
        passed('Verify first Update contains absolute values');
      } else {
        failed('Verify first Update', `Missing values: invAbs=${update?.investmentAbsolute}, profitAbs=${update?.profitAbsolute}`);
      }
    } else {
      failed('Verify first Update', `No updates found`);
    }
  } catch (e) {
    failed('Verify first Update', e.message);
  }

  // Test 5: Create second Update (Vergleichsmodus - differential values, different absolute)
  try {
    const updateData = {
      version: 2,
      status: 'Update Metrics',
      investment: '200.00',
      extraMargin: '100.00',
      totalInvestment: '300.00',
      profit: '25.00',
      overallTrendPnlUsdt: '15.00',
      overallGridProfitUsdt: '10.00',
      calculationMode: 'Normal',
      investmentAbsolute: '1200.00',
      extraMarginAbsolute: '600.00',
      totalInvestmentAbsolute: '1800.00',
      profitAbsolute: '75.00',
      overallTrendPnlUsdtAbsolute: '45.00',
      overallGridProfitUsdtAbsolute: '30.00',
    };
    const res = await makeRequest('POST', `/api/bot-types/${botTypeId}/updates`, updateData);
    if (res.status === 201 || res.status === 200) {
      passed('Create second Update (Vergleichsmodus) with different absolute values');
    } else {
      failed('Create second Update', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Create second Update', e.message);
  }

  // Test 6: Verify differential values differ from absolute values
  try {
    const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
    if (res.status === 200 && Array.isArray(res.data)) {
      const update = res.data.find(u => u.version === 2);
      if (update) {
        const diffOk = update.investment === '200.00';
        const absOk = update.investmentAbsolute === '1200.00';
        if (diffOk && absOk) {
          passed('Verify differential (200.00) differs from absolute (1200.00)');
        } else {
          failed('Verify values differ', `inv=${update.investment}, invAbs=${update.investmentAbsolute}`);
        }
      } else {
        failed('Verify values differ', 'Update v2 not found');
      }
    } else {
      failed('Verify values differ', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Verify values differ', e.message);
  }

  // Test 7: Check all absolute fields exist
  try {
    const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
    if (res.status === 200 && Array.isArray(res.data)) {
      const update = res.data.find(u => u.version === 2);
      const absoluteFields = [
        'investmentAbsolute',
        'extraMarginAbsolute',
        'totalInvestmentAbsolute',
        'profitAbsolute',
        'overallTrendPnlUsdtAbsolute',
        'overallGridProfitUsdtAbsolute',
      ];
      const missingFields = absoluteFields.filter(f => !(f in update));
      if (missingFields.length === 0) {
        passed('All core absolute fields exist in Update response');
      } else {
        failed('All absolute fields exist', `Missing: ${missingFields.join(', ')}`);
      }
    } else {
      failed('All absolute fields exist', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('All absolute fields exist', e.message);
  }

  // Test 8: Create Update with null avgGridProfitWeek (should be accepted)
  try {
    const updateData = {
      version: 3,
      status: 'Update Metrics',
      investment: '100.00',
      profit: '10.00',
      avgGridProfitWeek: null,
      avgGridProfitWeekAbsolute: null,
      investmentAbsolute: '1300.00',
      profitAbsolute: '85.00',
    };
    const res = await makeRequest('POST', `/api/bot-types/${botTypeId}/updates`, updateData);
    if (res.status === 201 || res.status === 200) {
      passed('Create Update with null avgGridProfitWeek (accepted)');
    } else {
      failed('Create Update with null avgGridProfitWeek', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Create Update with null avgGridProfitWeek', e.message);
  }

  // Test 9: Verify third Update saved correctly
  try {
    const res = await makeRequest('GET', `/api/bot-types/${botTypeId}/updates`);
    if (res.status === 200 && Array.isArray(res.data)) {
      const update = res.data.find(u => u.version === 3);
      if (update && update.investmentAbsolute === '1300.00' && update.profitAbsolute === '85.00') {
        passed('Verify third Update saved with correct absolute values');
      } else {
        failed('Verify third Update', `invAbs=${update?.investmentAbsolute}, profitAbs=${update?.profitAbsolute}`);
      }
    } else {
      failed('Verify third Update', `Status: ${res.status}`);
    }
  } catch (e) {
    failed('Verify third Update', e.message);
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
    console.log('\n✅ ALL 10 TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED!\n');
    process.exit(1);
  }
}

runTests().catch(console.error);
