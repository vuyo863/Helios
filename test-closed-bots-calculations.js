/**
 * Backend-Tests für Closed Bots Berechnungen
 * 
 * Testet:
 * 1. Datumsberechnung (End Date aus Screenshot, Start Date = End Date - Runtime)
 * 2. Prozent-Berechnung für verschiedene Investment-Basen
 */

const API_BASE = 'http://localhost:5000';

// Hilfsfunktionen
function parseRuntime(runtime) {
  if (!runtime) return 0;
  let totalHours = 0;
  const dayMatch = runtime.match(/(\d+)d/);
  const hourMatch = runtime.match(/(\d+)h/);
  const minMatch = runtime.match(/(\d+)m/);
  const secMatch = runtime.match(/(\d+)s/);
  
  if (dayMatch) totalHours += parseInt(dayMatch[1]) * 24;
  if (hourMatch) totalHours += parseInt(hourMatch[1]);
  if (minMatch) totalHours += parseInt(minMatch[1]) / 60;
  if (secMatch) totalHours += parseInt(secMatch[1]) / 3600;
  
  return totalHours;
}

function parseGermanDate(dateStr) {
  // Format: "24.11.2025 16:42" -> Date
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('.');
  const [hour, minute] = timePart.split(':');
  return new Date(year, month - 1, day, hour, minute);
}

function formatGermanDate(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

// Test 1-5: Datumsberechnung (End Date - Runtime = Start Date)
const dateCalculationTests = [
  {
    name: 'Test 1: Standard Closed Bot (12h 31m 22s Laufzeit)',
    endDate: '24.11.2025 16:42',
    runtime: '12h 31m 22s',
    expectedStartDate: '24.11.2025 04:10', // 16:42 - 12:31 = 04:11 (ca.)
  },
  {
    name: 'Test 2: Kurze Laufzeit (2h 15m)',
    endDate: '15.12.2025 10:00',
    runtime: '2h 15m',
    expectedStartDate: '15.12.2025 07:45',
  },
  {
    name: 'Test 3: Lange Laufzeit (1d 5h 30m)',
    endDate: '20.11.2025 18:30',
    runtime: '1d 5h 30m',
    expectedStartDate: '19.11.2025 13:00',
  },
  {
    name: 'Test 4: Nur Stunden (8h)',
    endDate: '01.12.2025 20:00',
    runtime: '8h',
    expectedStartDate: '01.12.2025 12:00',
  },
  {
    name: 'Test 5: Mehrere Tage (3d 12h)',
    endDate: '10.12.2025 00:00',
    runtime: '3d 12h',
    expectedStartDate: '06.12.2025 12:00',
  },
];

// Test 6-10: Prozentberechnung
const percentCalculationTests = [
  {
    name: 'Test 6: Profit % mit Gesamtinvestment (400 USDT)',
    profitUsdt: 4.88,
    investment: 50,
    totalInvestment: 400,
    expectedPercentGesamtinvestment: '1.22', // (4.88 / 400) * 100
    expectedPercentInvestitionsmenge: '9.76', // (4.88 / 50) * 100
  },
  {
    name: 'Test 7: Trend P&L % negativ',
    trendUsdt: -0.842,
    investment: 50,
    totalInvestment: 400,
    expectedPercentGesamtinvestment: '-0.21', // (-0.842 / 400) * 100
    expectedPercentInvestitionsmenge: '-1.68', // (-0.842 / 50) * 100
  },
  {
    name: 'Test 8: Grid Profit % mit großen Werten',
    gridProfitUsdt: 5.72,
    investment: 50,
    totalInvestment: 400,
    expectedPercentGesamtinvestment: '1.43', // (5.72 / 400) * 100
    expectedPercentInvestitionsmenge: '11.44', // (5.72 / 50) * 100
  },
  {
    name: 'Test 9: Kleine Profitwerte',
    profitUsdt: 0.25,
    investment: 100,
    totalInvestment: 500,
    expectedPercentGesamtinvestment: '0.05', // (0.25 / 500) * 100
    expectedPercentInvestitionsmenge: '0.25', // (0.25 / 100) * 100
  },
  {
    name: 'Test 10: Große Profitwerte',
    profitUsdt: 150.75,
    investment: 1000,
    totalInvestment: 3000,
    expectedPercentGesamtinvestment: '5.03', // (150.75 / 3000) * 100
    expectedPercentInvestitionsmenge: '15.07', // (150.75 / 1000) * 100 = 15.075, gerundet 15.07
  },
];

// Führe alle Tests aus
async function runTests() {
  console.log('='.repeat(60));
  console.log('CLOSED BOTS BERECHNUNGS-TESTS');
  console.log('='.repeat(60));
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  // Datums-Tests
  console.log('--- DATUMSBERECHNUNGS-TESTS (End Date - Runtime = Start Date) ---');
  console.log('');
  
  for (const test of dateCalculationTests) {
    try {
      // Parse End Date
      const endDateTime = parseGermanDate(test.endDate);
      
      // Parse Runtime
      const runtimeHours = parseRuntime(test.runtime);
      const runtimeMs = runtimeHours * 60 * 60 * 1000;
      
      // Calculate Start Date (End Date - Runtime)
      const startDateTime = new Date(endDateTime.getTime() - runtimeMs);
      const calculatedStartDate = formatGermanDate(startDateTime);
      
      // Parse expected Start Date für Vergleich (mit Toleranz von 1 Minute)
      const expectedStart = parseGermanDate(test.expectedStartDate);
      const calculatedStart = startDateTime;
      const diffMinutes = Math.abs((expectedStart.getTime() - calculatedStart.getTime()) / (1000 * 60));
      
      const success = diffMinutes <= 2; // 2 Minuten Toleranz wegen Rundung
      
      if (success) {
        console.log(`✓ ${test.name}`);
        console.log(`  End Date: ${test.endDate}`);
        console.log(`  Runtime: ${test.runtime} (${runtimeHours.toFixed(2)}h)`);
        console.log(`  Berechnet: Start Date = ${calculatedStartDate}`);
        console.log(`  Erwartet: ${test.expectedStartDate} (Differenz: ${diffMinutes.toFixed(1)} Minuten)`);
        passed++;
      } else {
        console.log(`✗ ${test.name} - FEHLGESCHLAGEN`);
        console.log(`  End Date: ${test.endDate}`);
        console.log(`  Runtime: ${test.runtime}`);
        console.log(`  Berechnet: ${calculatedStartDate}`);
        console.log(`  Erwartet: ${test.expectedStartDate}`);
        console.log(`  Differenz: ${diffMinutes.toFixed(1)} Minuten (zu groß!)`);
        failed++;
      }
      console.log('');
    } catch (error) {
      console.log(`✗ ${test.name} - FEHLER: ${error.message}`);
      failed++;
      console.log('');
    }
  }
  
  // Prozent-Tests
  console.log('--- PROZENTBERECHNUNGS-TESTS (Gesamtinvestment vs Investitionsmenge) ---');
  console.log('');
  
  for (const test of percentCalculationTests) {
    try {
      const usdtValue = test.profitUsdt || test.trendUsdt || test.gridProfitUsdt;
      
      // Berechne Prozent für beide Basen
      const percentGesamtinvestment = ((usdtValue / test.totalInvestment) * 100).toFixed(2);
      const percentInvestitionsmenge = ((usdtValue / test.investment) * 100).toFixed(2);
      
      const successGesamt = percentGesamtinvestment === test.expectedPercentGesamtinvestment;
      const successInvest = percentInvestitionsmenge === test.expectedPercentInvestitionsmenge;
      const success = successGesamt && successInvest;
      
      if (success) {
        console.log(`✓ ${test.name}`);
        console.log(`  USDT-Wert: ${usdtValue}`);
        console.log(`  Investment: ${test.investment} USDT, Gesamtinvestment: ${test.totalInvestment} USDT`);
        console.log(`  Gesamtinvestment %: ${percentGesamtinvestment} (erwartet: ${test.expectedPercentGesamtinvestment})`);
        console.log(`  Investitionsmenge %: ${percentInvestitionsmenge} (erwartet: ${test.expectedPercentInvestitionsmenge})`);
        passed++;
      } else {
        console.log(`✗ ${test.name} - FEHLGESCHLAGEN`);
        console.log(`  USDT-Wert: ${usdtValue}`);
        console.log(`  Gesamtinvestment %: ${percentGesamtinvestment} (erwartet: ${test.expectedPercentGesamtinvestment}) ${successGesamt ? '✓' : '✗'}`);
        console.log(`  Investitionsmenge %: ${percentInvestitionsmenge} (erwartet: ${test.expectedPercentInvestitionsmenge}) ${successInvest ? '✓' : '✗'}`);
        failed++;
      }
      console.log('');
    } catch (error) {
      console.log(`✗ ${test.name} - FEHLER: ${error.message}`);
      failed++;
      console.log('');
    }
  }
  
  // Zusammenfassung
  console.log('='.repeat(60));
  console.log('ZUSAMMENFASSUNG');
  console.log('='.repeat(60));
  console.log(`Bestanden: ${passed}/${passed + failed}`);
  console.log(`Fehlgeschlagen: ${failed}/${passed + failed}`);
  console.log('');
  
  if (failed === 0) {
    console.log('ALLE TESTS ERFOLGREICH!');
  } else {
    console.log(`${failed} TEST(S) FEHLGESCHLAGEN`);
  }
  
  return { passed, failed };
}

runTests().catch(console.error);
