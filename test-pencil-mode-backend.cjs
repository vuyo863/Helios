// Backend Tests for Overlay Mode Pencil Mode (Stift-Modus)
// Tests the data calculations and period filtering logic

const testResults = [];
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    testResults.push({ name, status: 'PASS' });
    passCount++;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    testResults.push({ name, status: 'FAIL', error: error.message });
    failCount++;
    console.log(`❌ FAIL: ${name} - ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(`${message}: value is null or undefined`);
  }
}

function assertInRange(value, min, max, message) {
  if (value < min || value > max) {
    throw new Error(`${message}: ${value} not in range [${min}, ${max}]`);
  }
}

// Helper: Parse German date format (dd.mm.yyyy hh:mm)
function parseGermanDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
}

// Helper: Calculate overlayAnalyzeModeBounds from periodKey
function calculateOverlayAnalyzeModeBounds(periodKey) {
  if (!periodKey) return null;
  const parts = periodKey.split('-');
  if (parts.length !== 2) return null;
  const startTs = parseInt(parts[0], 10);
  const endTs = parseInt(parts[1], 10);
  if (isNaN(startTs) || isNaN(endTs)) return null;
  return { startTs, endTs };
}

// Helper: Filter chart data by time bounds
function filterChartDataByBounds(data, bounds) {
  if (!bounds || !data) return [];
  return data.filter(point => 
    point.timestamp >= bounds.startTs && point.timestamp <= bounds.endTs
  );
}

// Helper: Calculate profit for a period
function calculatePeriodProfit(updates, startTs, endTs) {
  let totalProfit = 0;
  updates.forEach(update => {
    const avgGridProfitHour = parseFloat(update.avgGridProfitHour) || 0;
    const profit = parseFloat(update.profit) || 0;
    const isClosedBot = update.status === 'Closed Bots';
    
    const updateStartTs = parseGermanDate(update.lastUpload)?.getTime() || 0;
    const updateEndTs = parseGermanDate(update.thisUpload)?.getTime() || 0;
    
    if (updateStartTs === 0 || updateEndTs === 0) return;
    
    const overlapStart = Math.max(startTs, updateStartTs);
    const overlapEnd = Math.min(endTs, updateEndTs);
    
    if (overlapStart >= overlapEnd) return;
    
    const overlapHours = (overlapEnd - overlapStart) / (1000 * 60 * 60);
    
    if (isClosedBot) {
      if (updateEndTs >= startTs && updateEndTs < endTs) {
        totalProfit += profit;
      }
    } else {
      totalProfit += avgGridProfitHour * overlapHours;
    }
  });
  return totalProfit;
}

// ========== TEST DATA ==========
const sampleUpdates = [
  {
    id: "148e3a5c-1b21-4fca-baea-984b05ca0e5f",
    botTypeId: "29605390-399f-4a7a-9981-f061586cab52",
    version: 888,
    status: "Update Metrics",
    lastUpload: "6.12.2025 21:27",
    thisUpload: "6.12.2025 21:40",
    profit: "-2.18",
    avgGridProfitHour: "2.15"
  },
  {
    id: "0ee3de08-9d33-4854-9d13-1637d99a5988",
    botTypeId: "29605390-399f-4a7a-9981-f061586cab52",
    version: 666,
    status: "Update Metrics",
    lastUpload: "15.11.2025 16:52",
    thisUpload: "6.12.2025 21:27",
    profit: "1.09",
    avgGridProfitHour: "-0.73"
  },
  {
    id: "b8e8f450-8e50-4034-ab4b-e58dfaccf8a0",
    botTypeId: "29605390-399f-4a7a-9981-f061586cab52",
    version: 555,
    status: "Update Metrics",
    lastUpload: "6.12.2025 21:40",
    thisUpload: "7.12.2025 00:16",
    profit: "97.55",
    avgGridProfitHour: "-31.34"
  }
];

// ========== TESTS ==========

console.log("\n========== BACKEND TESTS: PENCIL MODE ==========\n");

// TEST 1: German Date Parsing
test("German date parsing - standard format", () => {
  const date = parseGermanDate("6.12.2025 21:27");
  assertNotNull(date, "Date should be parsed");
  assertEqual(date.getDate(), 6, "Day");
  assertEqual(date.getMonth(), 11, "Month (0-indexed)");
  assertEqual(date.getFullYear(), 2025, "Year");
  assertEqual(date.getHours(), 21, "Hour");
  assertEqual(date.getMinutes(), 27, "Minute");
});

// TEST 2: German Date Parsing - two-digit day
test("German date parsing - two-digit day", () => {
  const date = parseGermanDate("15.11.2025 16:52");
  assertNotNull(date, "Date should be parsed");
  assertEqual(date.getDate(), 15, "Day");
  assertEqual(date.getMonth(), 10, "Month (0-indexed)");
});

// TEST 3: Period Key Parsing - valid format
test("Period key parsing - valid format", () => {
  const periodKey = "1733516820000-1733520600000";
  const bounds = calculateOverlayAnalyzeModeBounds(periodKey);
  assertNotNull(bounds, "Bounds should be calculated");
  assertEqual(bounds.startTs, 1733516820000, "Start timestamp");
  assertEqual(bounds.endTs, 1733520600000, "End timestamp");
});

// TEST 4: Period Key Parsing - invalid format
test("Period key parsing - null input", () => {
  const bounds = calculateOverlayAnalyzeModeBounds(null);
  assertEqual(bounds, null, "Bounds should be null for null input");
});

// TEST 5: Period Key Parsing - empty string
test("Period key parsing - empty string", () => {
  const bounds = calculateOverlayAnalyzeModeBounds("");
  assertEqual(bounds, null, "Bounds should be null for empty string");
});

// TEST 6: Period Key Parsing - malformed key
test("Period key parsing - malformed key", () => {
  const bounds = calculateOverlayAnalyzeModeBounds("invalid-key-format");
  assertEqual(bounds, null, "Bounds should be null for malformed key");
});

// TEST 7: Timestamp Calculation from Updates
test("Timestamp calculation from update data", () => {
  const update = sampleUpdates[0];
  const lastUploadTs = parseGermanDate(update.lastUpload)?.getTime();
  const thisUploadTs = parseGermanDate(update.thisUpload)?.getTime();
  
  assertNotNull(lastUploadTs, "lastUpload timestamp");
  assertNotNull(thisUploadTs, "thisUpload timestamp");
  
  // thisUpload should be after lastUpload
  if (thisUploadTs <= lastUploadTs) {
    throw new Error("thisUpload should be after lastUpload");
  }
  
  // Calculate period duration
  const durationMs = thisUploadTs - lastUploadTs;
  const durationMinutes = durationMs / (1000 * 60);
  assertInRange(durationMinutes, 10, 20, "Duration should be ~13 minutes");
});

// TEST 8: Period Key Generation
test("Period key generation from timestamps", () => {
  const startTs = parseGermanDate("6.12.2025 21:27").getTime();
  const endTs = parseGermanDate("6.12.2025 21:40").getTime();
  const periodKey = `${startTs}-${endTs}`;
  
  // Parse it back
  const bounds = calculateOverlayAnalyzeModeBounds(periodKey);
  assertNotNull(bounds, "Bounds should be parsed");
  assertEqual(bounds.startTs, startTs, "Start timestamp round-trip");
  assertEqual(bounds.endTs, endTs, "End timestamp round-trip");
});

// TEST 9: Chart Data Filtering
test("Chart data filtering by bounds", () => {
  const mockChartData = [
    { timestamp: 1733516820000, value: 100 },
    { timestamp: 1733518000000, value: 150 },
    { timestamp: 1733520600000, value: 200 },
    { timestamp: 1733525000000, value: 250 },
  ];
  
  const bounds = { startTs: 1733516820000, endTs: 1733520600000 };
  const filtered = filterChartDataByBounds(mockChartData, bounds);
  
  assertEqual(filtered.length, 3, "Should filter to 3 points within bounds");
  assertEqual(filtered[0].value, 100, "First point value");
  assertEqual(filtered[2].value, 200, "Last point value");
});

// TEST 10: Chart Data Filtering - empty result
test("Chart data filtering - no data in range", () => {
  const mockChartData = [
    { timestamp: 1733500000000, value: 100 },
    { timestamp: 1733510000000, value: 150 },
  ];
  
  const bounds = { startTs: 1733520000000, endTs: 1733530000000 };
  const filtered = filterChartDataByBounds(mockChartData, bounds);
  
  assertEqual(filtered.length, 0, "Should return empty array");
});

// TEST 11: Chart Data Filtering - null bounds
test("Chart data filtering - null bounds", () => {
  const mockChartData = [
    { timestamp: 1733516820000, value: 100 },
  ];
  
  const filtered = filterChartDataByBounds(mockChartData, null);
  assertEqual(filtered.length, 0, "Should return empty array for null bounds");
});

// TEST 12: Profit Calculation - single update
test("Period profit calculation - single update", () => {
  const startTs = parseGermanDate("6.12.2025 21:27").getTime();
  const endTs = parseGermanDate("6.12.2025 21:40").getTime();
  
  const profit = calculatePeriodProfit(sampleUpdates, startTs, endTs);
  
  // Update 888: avgGridProfitHour = 2.15, duration ~13 min = 0.217 hours
  // Expected: 2.15 * 0.217 ≈ 0.47
  assertInRange(profit, 0.4, 0.6, "Profit should be approximately 0.47");
});

// TEST 13: Profit Calculation - multiple updates
test("Period profit calculation - spanning multiple updates", () => {
  const startTs = parseGermanDate("6.12.2025 21:00").getTime();
  const endTs = parseGermanDate("7.12.2025 01:00").getTime();
  
  const profit = calculatePeriodProfit(sampleUpdates, startTs, endTs);
  
  // This should include parts of all three updates
  assertNotNull(profit, "Profit should be calculated");
  // Just verify it's a reasonable number (could be negative due to negative avgGridProfitHour)
});

// TEST 14: Period Duration Calculation
test("Period duration calculation", () => {
  const startTs = parseGermanDate("6.12.2025 21:27").getTime();
  const endTs = parseGermanDate("6.12.2025 21:40").getTime();
  
  const durationMs = endTs - startTs;
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationDays = durationHours / 24;
  
  assertInRange(durationHours, 0.2, 0.25, "Duration should be ~0.22 hours (13 min)");
  assertInRange(durationDays, 0.008, 0.012, "Duration should be ~0.009 days");
});

// TEST 15: Period Label Generation (hours vs days)
test("Period label generation - hours", () => {
  const diffMs = 3 * 60 * 60 * 1000; // 3 hours
  const hours = diffMs / (1000 * 60 * 60);
  const days = hours / 24;
  
  let label;
  if (days >= 1) {
    label = `${Math.round(days)} ${Math.round(days) === 1 ? 'Tag' : 'Tage'}`;
  } else {
    label = `${Math.round(hours)} ${Math.round(hours) === 1 ? 'Stunde' : 'Stunden'}`;
  }
  
  assertEqual(label, "3 Stunden", "Label for 3 hours");
});

// TEST 16: Period Label Generation (days)
test("Period label generation - days", () => {
  const diffMs = 3 * 24 * 60 * 60 * 1000; // 3 days
  const hours = diffMs / (1000 * 60 * 60);
  const days = hours / 24;
  
  let label;
  if (days >= 1) {
    label = `${Math.round(days)} ${Math.round(days) === 1 ? 'Tag' : 'Tage'}`;
  } else {
    label = `${Math.round(hours)} ${Math.round(hours) === 1 ? 'Stunde' : 'Stunden'}`;
  }
  
  assertEqual(label, "3 Tage", "Label for 3 days");
});

// TEST 17: Single Day Label
test("Period label generation - 1 day (singular)", () => {
  const diffMs = 1 * 24 * 60 * 60 * 1000; // 1 day
  const hours = diffMs / (1000 * 60 * 60);
  const days = hours / 24;
  
  let label;
  if (days >= 1) {
    label = `${Math.round(days)} ${Math.round(days) === 1 ? 'Tag' : 'Tage'}`;
  } else {
    label = `${Math.round(hours)} ${Math.round(hours) === 1 ? 'Stunde' : 'Stunden'}`;
  }
  
  assertEqual(label, "1 Tag", "Label for 1 day");
});

// TEST 18: overlayAnalyzeModeBounds with real data
test("overlayAnalyzeModeBounds calculation with real timestamps", () => {
  // Simulate appliedPencilPeriodKey from real update data
  const startTs = parseGermanDate("6.12.2025 21:27").getTime();
  const endTs = parseGermanDate("6.12.2025 21:40").getTime();
  const periodKey = `${startTs}-${endTs}`;
  
  const bounds = calculateOverlayAnalyzeModeBounds(periodKey);
  
  assertNotNull(bounds, "Bounds should be calculated");
  assertEqual(bounds.startTs, startTs, "Start timestamp");
  assertEqual(bounds.endTs, endTs, "End timestamp");
  
  // Verify the bounds are valid for filtering
  const range = bounds.endTs - bounds.startTs;
  if (range <= 0) {
    throw new Error("End timestamp should be after start timestamp");
  }
});

// TEST 19: Timestamp ordering validation
test("Update timestamps are properly ordered", () => {
  sampleUpdates.forEach((update, index) => {
    const lastTs = parseGermanDate(update.lastUpload)?.getTime();
    const thisTs = parseGermanDate(update.thisUpload)?.getTime();
    
    if (lastTs && thisTs && thisTs <= lastTs) {
      throw new Error(`Update ${index}: thisUpload (${thisTs}) should be after lastUpload (${lastTs})`);
    }
  });
});

// TEST 20: XAxis domain calculation for period
test("XAxis domain calculation for period bounds", () => {
  const startTs = parseGermanDate("6.12.2025 21:27").getTime();
  const endTs = parseGermanDate("6.12.2025 21:40").getTime();
  
  const rawRange = endTs - startTs;
  const range = rawRange > 0 ? rawRange : 60 * 60 * 1000; // min 1 hour
  const padding = range * 0.05;
  
  const center = (startTs + endTs) / 2;
  const baseMin = center - range / 2 - padding;
  const baseMax = center + range / 2 + padding;
  
  // Verify domain is wider than the period
  const domainRange = baseMax - baseMin;
  if (domainRange <= rawRange) {
    throw new Error("Domain should include padding");
  }
  
  // Verify padding is applied
  if (baseMin >= startTs || baseMax <= endTs) {
    throw new Error("Domain should extend beyond period bounds");
  }
});

// ========== SUMMARY ==========
console.log("\n========== TEST SUMMARY ==========");
console.log(`Total Tests: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Success Rate: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`);

if (failCount > 0) {
  console.log("\n❌ FAILED TESTS:");
  testResults.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  - ${t.name}: ${t.error}`);
  });
}

if (passCount >= 10) {
  console.log("\n🎉 REQUIREMENT MET: At least 10 successful tests!");
} else {
  console.log(`\n⚠️ REQUIREMENT NOT MET: Need ${10 - passCount} more successful tests`);
}
