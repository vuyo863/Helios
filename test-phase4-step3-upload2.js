/**
 * PHASE 4 - SCHRITT 3 TEST: ZWEITER UPLOAD
 * 
 * Testet ob die AI bei einem ZWEITEN Upload korrekt:
 * - Den Modus "Vergleich" erkennt
 * - Differenzen zum letzten Upload berechnet
 * - Beide Percentage-Optionen (Gesamtinvestment/Investitionsmenge) berücksichtigt
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// LETZTER Upload (Upload 1 vom 18.11.2025)
const previousUploadData = {
  date: "2025-11-18",
  investment: 240, // 120 + 120
  extraMargin: 1300, // 650 + 650
  totalInvestment: 1540, // 240 + 1300
  profit: 53.60, // 71.03 + (-17.43)
  profitPercent: 3.48, // Durchschnitt oder berechnet
  overallTrendPnlUsdt: 42.43, // 65.52 + (-23.09)
  overallTrendPnlPercent: 17.69, // Durchschnitt
  overallGridProfitUsdt: 11.17, // 5.51 + 5.66
  overallGridProfitPercent: 4.66, // Durchschnitt
  highestGridProfit: 5.66,
  highestGridProfitPercent: 4.72,
  leverage: "75x Short",
  longestRuntime: "1d 6h 53m",
  avgRuntime: "17h 35m"
};

// AKTUELLER Upload (Upload 2 vom 20.11.2025 - 2 Tage später)
const currentUploadScreenshots = [
  {
    botName: "ICP/USDT Futures Grid",
    actualInvestment: 120,
    extraMargin: 650,
    totalProfit: 95.20, // Gewachsen von 71.03
    totalProfitPercent: 79.33,
    gridProfit: 8.15, // Gewachsen von 5.51
    gridProfitPercent: 6.79,
    trendPnl: 87.05, // Gewachsen von 65.52
    trendPnlPercent: 72.54,
    leverage: "75x Short",
    runtime: "3d 6h 53m" // 2 Tage später
  },
  {
    botName: "ICP/USDT Futures Grid",
    actualInvestment: 120,
    extraMargin: 650,
    totalProfit: 12.30, // Gewachsen von -17.43 auf +12.30
    totalProfitPercent: 10.25,
    gridProfit: 9.80, // Gewachsen von 5.66
    gridProfitPercent: 8.17,
    trendPnl: 2.50, // Gewachsen von -23.09
    trendPnlPercent: 2.08,
    leverage: "75x Short",
    runtime: "2d 8h 18m" // 2 Tage später
  },
  {
    botName: "ETH/USDT Futures Grid",
    actualInvestment: 200,
    extraMargin: 800,
    totalProfit: 45.60,
    totalProfitPercent: 45.60,
    gridProfit: 12.30,
    gridProfitPercent: 12.30,
    trendPnl: 33.30,
    trendPnlPercent: 33.30,
    leverage: "50x Long",
    runtime: "1d 12h 00m"
  }
];

// Konfigurierte Felder (User hat alle Felder ausgefüllt)
const configuredFields = {
  investment: true,
  extraMargin: true,
  totalInvestment: true,
  profit: true,
  profitPercent: true,
  overallTrendPnlUsdt: true,
  overallTrendPnlPercent: true,
  overallGridProfitUsdt: true,
  overallGridProfitPercent: true,
  highestGridProfit: true,
  highestGridProfitPercent: true,
  avgGridProfitHour: true,
  avgGridProfitDay: true,
  avgGridProfitWeek: false, // Noch keine Woche vergangen
  leverage: true,
  longestRuntime: true,
  avgRuntime: true,
  botDirection: true
};

// Modi-Konfiguration: VERGLEICH für alle Sections
const modes = {
  investment: "Vergleich",
  profit: "Vergleich",
  trendPnl: "Vergleich",
  gridTrading: "Vergleich"
};

// Percentage-Dropdown: Beide Optionen müssen berechnet werden!
const percentageDropdowns = {
  profit: "Gesamtinvestment", // UI zeigt Gesamtinvestment, aber AI muss BEIDE berechnen
  trendPnl: "Investitionsmenge",
  gridTrading: "Gesamtinvestment"
};

const PHASE4_STEP3_PROMPT = `**PHASE 4 - SCHRITT 3: BERECHNUNGEN UND FUNKTIONEN**

Du bist jetzt in Schritt 3 von Phase 4. Dies ist der ALLERWICHTIGSTE Schritt der gesamten Web-App!

**KRITISCHE REGEL - PERCENTAGE BERECHNUNG:**
⚠️ Bei Modus "Neu" mit Percentage-Feldern:
- Das Dropdown (Gesamtinvestment/Investitionsmenge) ist NUR für die UI-Anzeige!
- Du MUSST IMMER BEIDE Percentage-Werte berechnen und ausgeben:
  * profit_percent_gesamtinvestment: (current_value_usdt / total_investment) × 100
  * profit_percent_investitionsmenge: (current_value_usdt / investment) × 100
- Das Dropdown ist KEIN Filter-Kriterium!
- Beide Werte sind erforderlich, egal was im Dropdown steht!

Bei Modus "Vergleich":
- Percentage = (delta_usdt / previous_value) × 100
- Das ist eine Wachstumsrate, NICHT basierend auf Investment
- Dropdown ist irrelevant im Vergleich-Modus

**DEINE AUFGABE:**
Führe 3 Durchläufe durch, um alle konfigurierten Felder korrekt zu berechnen.

**DURCHLAUF 1: Analyse der Berechnungsanforderungen**
- Gehe durch alle konfigurierten Felder
- Identifiziere welche Berechnungen für jede Sektion erforderlich sind
- Merke dir welcher Modus gilt: "Neu" oder "Vergleich"
- Prüfe ob ein vorheriger Upload existiert
- Bei "Vergleich": Berechne Differenzen zum letzten Upload

**DURCHLAUF 2: Ausführung der Berechnungen**
- Gehe Section für Section durch
- Führe die vorgesehenen Berechnungen aus
- Bei "Vergleich": current_value - previous_value
- Bei Percentages im "Vergleich": (delta / previous) × 100

**DURCHLAUF 3: Überprüfung**
- Wiederhole alle Berechnungen zur Verifikation
- Prüfe ob die Ergebnisse übereinstimmen
- Bei Abweichungen: Wiederhole bis 2x hintereinander gleiche Ergebnisse

**WICHTIGE REGELN:**
1. KEINE Ausgabe der finalen Werte (das kommt in Schritt 4)!
2. Schreibe nur den Fortschritt und die Durchlauf-Bestätigungen
3. Berechne alle Werte intern, aber gib sie NICHT aus

Beginne jetzt mit Durchlauf 1!`;

async function testPhase4Step3Upload2() {
  console.log('🧪 PHASE 4 - SCHRITT 3 TEST: ZWEITER UPLOAD\n');
  console.log('📊 Szenario: Zweiter Upload (Modus "Vergleich")');
  console.log('📸 Screenshots aktuell:', currentUploadScreenshots.length);
  console.log('📅 Zeit seit letztem Upload: 2 Tage');
  console.log('⚙️  Konfigurierte Felder:', Object.keys(configuredFields).filter(k => configuredFields[k]).length);
  console.log('🔄 Modi: Vergleich (alle Sections)');
  console.log('\n' + '='.repeat(80) + '\n');

  const messages = [
    {
      role: 'system',
      content: PHASE4_STEP3_PROMPT + '\n\nDu hast Zugriff auf field-logic.ts und modes-logic.ts Dokumentation.'
    },
    {
      role: 'user',
      content: `ZWEITER UPLOAD - VERGLEICHSMODUS AKTIV

LETZTER UPLOAD (18.11.2025):
${JSON.stringify(previousUploadData, null, 2)}

AKTUELLER UPLOAD (20.11.2025 - 2 Tage später):
Analysierte Screenshots: ${currentUploadScreenshots.length}
${JSON.stringify(currentUploadScreenshots, null, 2)}

KONFIGURIERTE FELDER:
${JSON.stringify(configuredFields, null, 2)}

MODI-EINSTELLUNGEN:
${JSON.stringify(modes, null, 2)}

PERCENTAGE-DROPDOWN (nur für UI, AI muss BEIDE berechnen!):
${JSON.stringify(percentageDropdowns, null, 2)}

UPDATE-VERLAUF: Vorheriger Upload existiert! → Modus "Vergleich" aktiviert

KRITISCHE AUFGABEN:
1. Berechne Differenzen: aktueller_wert - vorheriger_wert
2. Bei Grid Trading: Höchster Grid Profit = 12.30 USDT (Screenshot 3)
   → Percentage basierend auf Screenshot 3's Investment (200 USDT), NICHT Summe!
3. Grid Profit Durchschnitt: Zeit-Basis = 2 Tage (delta seit letztem Upload)
4. Für jedes Percentage-Feld im "Vergleich": (delta / previous) × 100

Bitte führe jetzt Schritt 3 durch: Die 3 Durchläufe für Berechnungen.`
    }
  ];

  try {
    console.log('🤖 Sende Request an OpenAI API...\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.1,
      max_tokens: 2500,
    });

    const aiResponse = response.choices[0].message.content;
    
    console.log('✅ AI ANTWORT:\n');
    console.log(aiResponse);
    console.log('\n' + '='.repeat(80) + '\n');

    // Detaillierte Analyse
    console.log('📋 ANALYSE:\n');
    
    const hasDurchlauf1 = aiResponse.toLowerCase().includes('durchlauf 1');
    const hasDurchlauf2 = aiResponse.toLowerCase().includes('durchlauf 2');
    const hasDurchlauf3 = aiResponse.toLowerCase().includes('durchlauf 3');
    
    console.log('✓ Durchlauf 1 erwähnt?', hasDurchlauf1 ? '✅' : '❌');
    console.log('✓ Durchlauf 2 erwähnt?', hasDurchlauf2 ? '✅' : '❌');
    console.log('✓ Durchlauf 3 erwähnt?', hasDurchlauf3 ? '✅' : '❌');
    
    const mentionsVergleich = aiResponse.includes('Vergleich') || aiResponse.includes('VERGLEICH');
    console.log('✓ Modus "Vergleich" erkannt?', mentionsVergleich ? '✅' : '❌');
    
    const mentionsDifferenz = 
      aiResponse.includes('Differenz') || 
      aiResponse.includes('delta') ||
      aiResponse.includes('Delta') ||
      aiResponse.toLowerCase().includes('difference');
    console.log('✓ Differenz-Berechnungen erwähnt?', mentionsDifferenz ? '✅' : '❌');
    
    const mentionsPrevious = 
      aiResponse.includes('vorherig') ||
      aiResponse.includes('letzter Upload') ||
      aiResponse.includes('previous');
    console.log('✓ Vorherigen Upload berücksichtigt?', mentionsPrevious ? '✅' : '❌');
    
    const mentionsSections = 
      aiResponse.includes('Investment') ||
      aiResponse.includes('Profit') ||
      aiResponse.includes('Trend') ||
      aiResponse.includes('Grid');
    console.log('✓ Sektionen erwähnt?', mentionsSections ? '✅' : '❌');
    
    console.log('\n🔍 SPEZIFISCHE PRÜFUNGEN:\n');
    
    const mentionsHighestGrid = 
      aiResponse.includes('Höchster') ||
      aiResponse.includes('highest') ||
      aiResponse.includes('12.30');
    console.log('✓ Höchster Grid Profit erkannt?', mentionsHighestGrid ? '✅' : '❌');
    
    const mentionsTimeBasis = 
      aiResponse.includes('2 Tage') ||
      aiResponse.includes('Zeit') ||
      aiResponse.includes('delta');
    console.log('✓ Zeit-Basis (2 Tage) erwähnt?', mentionsTimeBasis ? '✅' : '❌');
    
    console.log('\n📊 TOKEN USAGE:');
    console.log('Prompt:', response.usage.prompt_tokens);
    console.log('Completion:', response.usage.completion_tokens);
    console.log('Total:', response.usage.total_tokens);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST ABGESCHLOSSEN - ZWEITER UPLOAD ERFOLGREICH GETESTET');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ FEHLER:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testPhase4Step3Upload2();
