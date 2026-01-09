/**
 * REPETITION TEST SCRIPT
 * =======================
 * 
 * Dieses Script erstellt echte Schwellenwerte im localStorage,
 * die in der UI sichtbar sind und Wiederholungen auslösen.
 * 
 * ANLEITUNG:
 * 1. Öffne die Notifications-Seite in der App
 * 2. Öffne die Browser-Konsole (F12 → Console)
 * 3. Kopiere dieses Script und füge es in die Konsole ein
 * 4. Beobachte die Logs für [REPETITION] und [AUTO-DISMISS] Meldungen
 * 5. Prüfe die Backend-Logs für POST /api/notifications/send Aufrufe
 * 
 * Das Script erstellt Schwellenwerte für BTCUSDT, die sofort triggern.
 */

// Test-Konfiguration
const TEST_CONFIG = {
  pairId: 'BTCUSDT',      // Welches Paar testen
  pairName: 'BTC/USDT',
  repetitions: 10,         // Anzahl Wiederholungen (muss >= 10 sein)
  sequenceSeconds: 2,      // Sekunden zwischen Wiederholungen
  restwartezeitSeconds: 5, // Restwartezeit nach letzter Wiederholung
  alarmLevel: 'harmlos',   // harmlos | achtsam | gefährlich | sehrgefährlich
  testCount: 15            // Anzahl Tests
};

// Hilfsfunktion: Generiere eindeutige ID
function generateId() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Hilfsfunktion: Aktuellen Preis aus der UI lesen
function getCurrentPriceFromUI() {
  // Suche nach dem Preis-Element für das Test-Paar
  const priceElements = document.querySelectorAll('[data-testid*="price"]');
  for (const el of priceElements) {
    const text = el.textContent;
    if (text && text.includes('$')) {
      // Parse deutschen Zahlenformat: "95.432,45" -> 95432.45
      const match = text.match(/[\d.,]+/);
      if (match) {
        const numStr = match[0].replace(/\./g, '').replace(',', '.');
        const price = parseFloat(numStr);
        if (!isNaN(price) && price > 1000) { // BTC sollte > 1000 sein
          return price;
        }
      }
    }
  }
  // Fallback: Hole den Preis von der API
  return null;
}

// Hauptfunktion: Erstelle Test-Schwellenwert
async function createTestThreshold(testNumber) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[TEST ${testNumber}/${TEST_CONFIG.testCount}] Starte Test...`);
  console.log(`${'='.repeat(60)}`);
  
  // 1. Aktuellen Preis ermitteln (aus UI oder API)
  let currentPrice = getCurrentPriceFromUI();
  
  if (!currentPrice) {
    // Versuche Preis vom Backend zu holen
    try {
      const resp = await fetch('/api/binance-price/BTCUSDT');
      if (resp.ok) {
        const data = await resp.json();
        currentPrice = parseFloat(data.price);
      }
    } catch (e) {
      console.error('[TEST] Konnte Preis nicht ermitteln:', e);
    }
  }
  
  if (!currentPrice) {
    // Letzter Fallback: Schätze BTC-Preis
    currentPrice = 95000;
    console.log('[TEST] Verwende geschätzten Preis:', currentPrice);
  } else {
    console.log('[TEST] Aktueller Preis:', currentPrice);
  }
  
  // 2. Schwellenwert erstellen der SOFORT triggert
  // Setze Schwellenwert leicht UNTER dem aktuellen Preis für "notifyOnIncrease"
  const thresholdValue = Math.floor(currentPrice * 0.999); // 0.1% unter aktuellem Preis
  
  const thresholdId = generateId();
  const newThreshold = {
    id: thresholdId,
    threshold: thresholdValue.toString(),
    notifyOnIncrease: true,
    notifyOnDecrease: false,
    increaseFrequency: 'wiederholend',
    decreaseFrequency: 'einmalig',
    alarmLevel: TEST_CONFIG.alarmLevel,
    note: `Test ${testNumber} - ${new Date().toLocaleTimeString('de-DE')}`,
    isActive: true
  };
  
  // 3. Watchlist aktualisieren (falls nötig)
  let watchlist = JSON.parse(localStorage.getItem('notifications-watchlist') || '[]');
  if (!watchlist.includes(TEST_CONFIG.pairId)) {
    watchlist.push(TEST_CONFIG.pairId);
    localStorage.setItem('notifications-watchlist', JSON.stringify(watchlist));
    console.log('[TEST] Watchlist aktualisiert:', watchlist);
  }
  
  // 4. Pair-Market-Types setzen
  let pairMarketTypes = JSON.parse(localStorage.getItem('notifications-pair-market-types') || '{}');
  if (!pairMarketTypes[TEST_CONFIG.pairId]) {
    pairMarketTypes[TEST_CONFIG.pairId] = 'spot';
    localStorage.setItem('notifications-pair-market-types', JSON.stringify(pairMarketTypes));
  }
  
  // 5. Schwellenwert-Settings aktualisieren
  let settings = JSON.parse(localStorage.getItem('notifications-threshold-settings') || '{}');
  if (!settings[TEST_CONFIG.pairId]) {
    settings[TEST_CONFIG.pairId] = {
      trendPriceId: TEST_CONFIG.pairId,
      thresholds: []
    };
  }
  settings[TEST_CONFIG.pairId].thresholds.push(newThreshold);
  localStorage.setItem('notifications-threshold-settings', JSON.stringify(settings));
  
  // 6. Alarm-Level-Config setzen für Wiederholungen
  let alarmConfigs = JSON.parse(localStorage.getItem('alarm-level-configs') || '{}');
  alarmConfigs[TEST_CONFIG.alarmLevel] = {
    level: TEST_CONFIG.alarmLevel,
    channels: {
      push: false,        // Deaktiviert für Tests (würde OneSignal-Fehler geben)
      email: true,        // Email funktioniert
      sms: false,         // SMS deaktiviert (spart Kosten)
      webPush: false,
      nativePush: false
    },
    repeatCount: TEST_CONFIG.repetitions,
    repeatSequence: TEST_CONFIG.sequenceSeconds,
    restwartezeit: TEST_CONFIG.restwartezeitSeconds,
    requiresApproval: false // Auto-dismiss nach Wiederholungen
  };
  localStorage.setItem('alarm-level-configs', JSON.stringify(alarmConfigs));
  
  console.log('[TEST] Schwellenwert erstellt:', {
    id: thresholdId,
    threshold: thresholdValue,
    currentPrice: currentPrice,
    willTriggerBecause: `${currentPrice} > ${thresholdValue}`,
    repetitions: TEST_CONFIG.repetitions,
    sequence: `${TEST_CONFIG.sequenceSeconds}s`,
    restwartezeit: `${TEST_CONFIG.restwartezeitSeconds}s`
  });
  
  // Berechne erwartete Zeiten
  const expectedTotalTime = (TEST_CONFIG.repetitions - 1) * TEST_CONFIG.sequenceSeconds + TEST_CONFIG.restwartezeitSeconds;
  console.log(`[TEST] Erwartete Laufzeit: ${expectedTotalTime}s (${TEST_CONFIG.repetitions-1} x ${TEST_CONFIG.sequenceSeconds}s + ${TEST_CONFIG.restwartezeitSeconds}s Restwartezeit)`);
  console.log(`[TEST] Erwarte ${TEST_CONFIG.repetitions} Benachrichtigungen in den nächsten ${expectedTotalTime}s`);
  console.log('[TEST] Beobachte die Logs für [REPETITION] Einträge...');
  
  return {
    testNumber,
    thresholdId,
    thresholdValue,
    currentPrice,
    startTime: Date.now(),
    expectedEndTime: Date.now() + (expectedTotalTime * 1000)
  };
}

// Info ausgeben
console.log(`
╔════════════════════════════════════════════════════════════╗
║         REPETITION TEST SCRIPT                              ║
╠════════════════════════════════════════════════════════════╣
║  Konfiguration:                                            ║
║  - Trading Pair: ${TEST_CONFIG.pairId.padEnd(20)}                   ║
║  - Wiederholungen: ${String(TEST_CONFIG.repetitions).padEnd(18)}                   ║
║  - Sequenz: ${TEST_CONFIG.sequenceSeconds}s                                       ║
║  - Restwartezeit: ${TEST_CONFIG.restwartezeitSeconds}s                                    ║
║  - Alarm-Level: ${TEST_CONFIG.alarmLevel.padEnd(19)}                   ║
╠════════════════════════════════════════════════════════════╣
║  Befehle:                                                  ║
║  - runTest(1)     → Startet Test #1                        ║
║  - runAllTests()  → Startet alle 15 Tests nacheinander     ║
║  - clearTests()   → Löscht alle Test-Schwellenwerte        ║
╚════════════════════════════════════════════════════════════╝
`);

// Globale Funktionen verfügbar machen
window.runTest = async function(testNumber = 1) {
  const result = await createTestThreshold(testNumber);
  console.log('\n[TEST] ⚠️ WICHTIG: Lade die Seite neu (F5) um den Schwellenwert zu aktivieren!');
  console.log('[TEST] Nach dem Reload, beobachte die Console für [REPETITION] Logs.');
  return result;
};

window.runAllTests = async function() {
  console.log(`[TEST] Starte ${TEST_CONFIG.testCount} Tests...`);
  console.log('[TEST] Jeder Test wird nacheinander ausgeführt.');
  console.log('[TEST] Beobachte die Backend-Logs für /api/notifications/send Aufrufe.\n');
  
  for (let i = 1; i <= TEST_CONFIG.testCount; i++) {
    await createTestThreshold(i);
    if (i < TEST_CONFIG.testCount) {
      console.log(`\n[TEST] Warte 5s vor dem nächsten Test...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log('\n[TEST] ⚠️ WICHTIG: Lade die Seite neu (F5) um alle Schwellenwerte zu aktivieren!');
};

window.clearTests = function() {
  let settings = JSON.parse(localStorage.getItem('notifications-threshold-settings') || '{}');
  let removed = 0;
  
  for (const pairId of Object.keys(settings)) {
    const before = settings[pairId].thresholds.length;
    settings[pairId].thresholds = settings[pairId].thresholds.filter(t => !t.id.startsWith('test-'));
    removed += before - settings[pairId].thresholds.length;
  }
  
  localStorage.setItem('notifications-threshold-settings', JSON.stringify(settings));
  console.log(`[TEST] ${removed} Test-Schwellenwerte entfernt.`);
  console.log('[TEST] Lade die Seite neu (F5) um die Änderungen zu sehen.');
};

console.log('\n[READY] Script geladen. Verwende runTest(1) um einen Test zu starten.');
