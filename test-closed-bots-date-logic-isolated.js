/**
 * Isolated Test for Closed Bots Date Logic
 * Tests the exact same calculation logic used in upload.tsx
 */

// Helper function: Parse runtime string to hours (same as in upload.tsx)
function parseLongestRuntime(runtimeStr) {
  if (!runtimeStr) return 0;
  
  let totalHours = 0;
  
  // Try to parse day patterns (e.g., "3d 5h 30m" or "3 Tage")
  const dayMatch = runtimeStr.match(/(\d+)\s*[dD]/);
  if (dayMatch) {
    totalHours += parseInt(dayMatch[1]) * 24;
  }
  
  // Try to parse hour patterns (e.g., "12h" or "12 hours" or "12 Stunden")
  const hourMatch = runtimeStr.match(/(\d+)\s*[hH]/);
  if (hourMatch) {
    totalHours += parseInt(hourMatch[1]);
  }
  
  // Try to parse minute patterns (e.g., "31m" or "31 minutes")
  const minuteMatch = runtimeStr.match(/(\d+)\s*m(?!s)/);
  if (minuteMatch) {
    totalHours += parseInt(minuteMatch[1]) / 60;
  }
  
  // Try to parse second patterns (e.g., "22s" or "22 seconds")
  const secondMatch = runtimeStr.match(/(\d+)\s*s/);
  if (secondMatch) {
    totalHours += parseInt(secondMatch[1]) / 3600;
  }
  
  return totalHours;
}

// Helper function: Parse date from screenshot (same as in upload.tsx)
function parseDateFromScreenshot(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  
  // Clean time string (remove trailing text like "closed")
  const cleanTimeStr = timeStr.replace(/\s*(closed|geschlossen|open|offen|running|laufend).*$/i, '').trim();
  
  // Try US format "MM/DD/YYYY"
  const usDateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  // Try German format "TT.MM.JJJJ"
  const deDateMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  // Try ISO format "YYYY-MM-DD"
  const isoDateMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  
  const timeMatch = cleanTimeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return null;
  
  let result = null;
  
  if (usDateMatch) {
    const [, usMonth, usDay, usYear] = usDateMatch;
    const [, hr, min, sec] = timeMatch;
    result = new Date(
      parseInt(usYear),
      parseInt(usMonth) - 1,
      parseInt(usDay),
      parseInt(hr),
      parseInt(min),
      sec ? parseInt(sec) : 0
    );
  } else if (deDateMatch) {
    const [, deDay, deMonth, deYear] = deDateMatch;
    const [, hr, min, sec] = timeMatch;
    result = new Date(
      parseInt(deYear),
      parseInt(deMonth) - 1,
      parseInt(deDay),
      parseInt(hr),
      parseInt(min),
      sec ? parseInt(sec) : 0
    );
  } else if (isoDateMatch) {
    const [, isoYear, isoMonth, isoDay] = isoDateMatch;
    const [, hr, min, sec] = timeMatch;
    result = new Date(
      parseInt(isoYear),
      parseInt(isoMonth) - 1,
      parseInt(isoDay),
      parseInt(hr),
      parseInt(min),
      sec ? parseInt(sec) : 0
    );
  }
  
  return result && !isNaN(result.getTime()) ? result : null;
}

// Format date for German display (same as in upload.tsx)
function formatDateDE(date) {
  return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

// Main test function - simulates the exact Closed Bots date logic from upload.tsx
function testClosedBotsDateLogic(screenshotData) {
  console.log('\n=== TEST: Closed Bots Date Logic ===');
  console.log('Input:', JSON.stringify(screenshotData, null, 2));
  
  const { date, time, runtime } = screenshotData;
  
  // Parse date
  const endDateTime = parseDateFromScreenshot(date, time);
  if (!endDateTime) {
    console.log('ERROR: Could not parse date/time');
    return null;
  }
  
  // Parse runtime
  const runtimeHours = parseLongestRuntime(runtime);
  if (runtimeHours === 0) {
    console.log('ERROR: Could not parse runtime');
    return null;
  }
  
  // Calculate runtime in milliseconds
  const runtimeMs = runtimeHours * 60 * 60 * 1000;
  
  // Calculate start date = end date - runtime (SUBTRACTION!)
  const endTimeMs = endDateTime.getTime();
  const startTimeMs = endTimeMs - runtimeMs;
  const startDateTime = new Date(startTimeMs);
  
  // Format for display
  const startDateFormatted = formatDateDE(startDateTime);
  const endDateFormatted = formatDateDE(endDateTime);
  
  // These are the values that should be set in the UI:
  // closedBotsLastUpload = startDateFormatted  -> displayed in "Start Date" field
  // closedBotsThisUpload = endDateFormatted    -> displayed in "End Date" field
  
  const result = {
    endDateTime: endDateTime.toISOString(),
    startDateTime: startDateTime.toISOString(),
    runtimeHours,
    runtimeMs,
    calculation: `${endTimeMs} - ${runtimeMs} = ${startTimeMs}`,
    UI_StartDate: startDateFormatted,  // This goes to lastUpload -> "Start Date" field
    UI_EndDate: endDateFormatted        // This goes to thisUpload -> "End Date" field
  };
  
  console.log('Result:', JSON.stringify(result, null, 2));
  
  return result;
}

// Test Cases
console.log('===============================================');
console.log('CLOSED BOTS DATE LOGIC - ISOLATED TESTS');
console.log('===============================================');

// Test 1: Original screenshot data
const test1 = testClosedBotsDateLogic({
  date: "11/24/2025",
  time: "16:42:12 closed",
  runtime: "12h 31m 22s"
});

// Validation
if (test1) {
  const startDate = new Date(test1.startDateTime);
  const endDate = new Date(test1.endDateTime);
  
  console.log('\n=== VALIDATION ===');
  console.log('End Date (from screenshot):', test1.UI_EndDate);
  console.log('Start Date (calculated):', test1.UI_StartDate);
  console.log('Runtime:', test1.runtimeHours.toFixed(4), 'hours');
  
  // Check if Start Date < End Date
  const isCorrectOrder = startDate < endDate;
  console.log('Start Date < End Date?', isCorrectOrder ? 'YES (CORRECT!)' : 'NO (WRONG!)');
  
  // Check time difference matches runtime
  const timeDiffHours = (endDate - startDate) / (1000 * 60 * 60);
  console.log('Time difference:', timeDiffHours.toFixed(4), 'hours');
  console.log('Expected runtime:', test1.runtimeHours.toFixed(4), 'hours');
  
  const runtimeMatch = Math.abs(timeDiffHours - test1.runtimeHours) < 0.0001;
  console.log('Runtime matches?', runtimeMatch ? 'YES (CORRECT!)' : 'NO (WRONG!)');
}

// Test 2: Different runtime format
const test2 = testClosedBotsDateLogic({
  date: "12/01/2025",
  time: "10:00:00",
  runtime: "5h 30m"
});

// Test 3: Runtime with days
const test3 = testClosedBotsDateLogic({
  date: "12/05/2025",
  time: "18:00:00",
  runtime: "2d 3h 15m"
});

console.log('\n===============================================');
console.log('ALL TESTS COMPLETED');
console.log('===============================================');

// Summary
console.log('\nSUMMARY:');
console.log('The Closed Bots date logic performs SUBTRACTION:');
console.log('Start Date = End Date (screenshot timestamp) - Runtime');
console.log('');
console.log('If UI shows ADDITION (End = Start + Runtime), then:');
console.log('1. The Closed Bots date logic is NOT being executed');
console.log('2. OR the closedExtractedScreenshotData is empty/null');
console.log('3. OR the isClosedBots flag is false');
console.log('4. OR the fallback values (currentDateTimeDisplay, lastUploadDate) are being used');
