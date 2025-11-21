/**
 * PHASE 4 - SCHRITT 3 TEST
 * 
 * Dieser Test prüft ob die AI die 3 Durchläufe korrekt durchführt:
 * - Durchlauf 1: Identifiziere benötigte Berechnungen
 * - Durchlauf 2: Führe Berechnungen aus
 * - Durchlauf 3: Verifikation (wiederholen bis 2x gleiche Ergebnisse)
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Szenario 1: ERSTER Upload (Modus "Neu")
const scenario1Screenshots = [
  {
    botName: "ICP/USDT Futures Grid",
    actualInvestment: 120,
    extraMargin: 650,
    totalProfit: 71.03,
    totalProfitPercent: 59.19,
    gridProfit: 5.51,
    gridProfitPercent: 4.59,
    trendPnl: 65.52,
    trendPnlPercent: 54.60,
    leverage: "75x Short",
    runtime: "1d 6h 53m"
  },
  {
    botName: "ICP/USDT Futures Grid",
    actualInvestment: 120,
    extraMargin: 650,
    totalProfit: -17.43,
    totalProfitPercent: -14.52,
    gridProfit: 5.66,
    gridProfitPercent: 4.72,
    trendPnl: -23.09,
    trendPnlPercent: -19.23,
    leverage: "75x Short",
    runtime: "8h 18m"
  }
];

// Konfigurierte Felder (aus Phase 3)
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
  avgGridProfitWeek: true,
  leverage: true,
  longestRuntime: true,
  avgRuntime: true,
  botDirection: true
};

// Modi-Konfiguration
const modes = {
  investment: "Neu",
  profit: "Neu",
  trendPnl: "Neu",
  gridTrading: "Neu"
};

const PHASE4_STEP3_PROMPT = `**PHASE 4 - SCHRITT 3: BERECHNUNGEN UND FUNKTIONEN**

Du bist jetzt in Schritt 3 von Phase 4. Dies ist der ALLERWICHTIGSTE Schritt der gesamten Web-App!

**DEINE AUFGABE:**
Führe 3 Durchläufe durch, um alle konfigurierten Felder korrekt zu berechnen.

**DURCHLAUF 1: Analyse der Berechnungsanforderungen**
- Gehe durch alle konfigurierten Felder
- Identifiziere welche Berechnungen für jede Sektion erforderlich sind
- Merke dir welcher Modus gilt: "Neu" oder "Vergleich"
- Prüfe ob ein vorheriger Upload existiert
- Schreibe genau auf: Welche Sektion braucht welche Rechnungen

**DURCHLAUF 2: Ausführung der Berechnungen**
- Gehe Section für Section durch
- Führe die vorgesehenen Berechnungen aus
- Verwende die extrahierten Screenshot-Daten
- Berechne jedes Feld nach der dokumentierten Logik

**DURCHLAUF 3: Überprüfung**
- Wiederhole alle Berechnungen zur Verifikation
- Prüfe ob die Ergebnisse übereinstimmen
- Bei Abweichungen: Wiederhole bis 2x hintereinander gleiche Ergebnisse

**WICHTIGE REGELN:**
1. KEINE Ausgabe der finalen Werte (das kommt in Schritt 4)!
2. Schreibe nur den Fortschritt und die Durchlauf-Bestätigungen
3. Berechne alle Werte intern, aber gib sie NICHT aus
4. Verwende die dokumentierte Logik aus field-logic.ts und modes-logic.ts

**AUSGABE-FORMAT:**
Gib NICHT die berechneten Werte aus! Schreibe nur:
- "Durchlauf 1: Sektion X - Berechnungslogik vorbereitet"
- "Durchlauf 2: Sektion X - Berechnungen durchgeführt"
- "Durchlauf 3: Sektion X - Ergebnisse verifiziert ✓"

Beginne jetzt mit Durchlauf 1!`;

async function testPhase4Step3() {
  console.log('🧪 PHASE 4 - SCHRITT 3 TEST STARTET\n');
  console.log('📊 Szenario: Erster Upload (Modus "Neu")');
  console.log('📸 Screenshots:', scenario1Screenshots.length);
  console.log('⚙️  Konfigurierte Felder:', Object.keys(configuredFields).filter(k => configuredFields[k]).length);
  console.log('\n' + '='.repeat(80) + '\n');

  const messages = [
    {
      role: 'system',
      content: PHASE4_STEP3_PROMPT + '\n\nDu hast Zugriff auf field-logic.ts und modes-logic.ts Dokumentation.'
    },
    {
      role: 'user',
      content: `Ich habe ${scenario1Screenshots.length} Screenshots analysiert.

EXTRAHIERTE DATEN:
${JSON.stringify(scenario1Screenshots, null, 2)}

KONFIGURIERTE FELDER:
${JSON.stringify(configuredFields, null, 2)}

MODI-EINSTELLUNGEN:
${JSON.stringify(modes, null, 2)}

UPDATE-VERLAUF: Kein vorheriger Upload vorhanden (Startmetrik)

Bitte führe jetzt Schritt 3 durch: Die 3 Durchläufe für Berechnungen.`
    }
  ];

  try {
    console.log('🤖 Sende Request an OpenAI API...\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.1,
      max_tokens: 2000,
    });

    const aiResponse = response.choices[0].message.content;
    
    console.log('✅ AI ANTWORT:\n');
    console.log(aiResponse);
    console.log('\n' + '='.repeat(80) + '\n');

    // Analyse der Antwort
    console.log('📋 ANALYSE:\n');
    
    const hasDurchlauf1 = aiResponse.toLowerCase().includes('durchlauf 1');
    const hasDurchlauf2 = aiResponse.toLowerCase().includes('durchlauf 2');
    const hasDurchlauf3 = aiResponse.toLowerCase().includes('durchlauf 3');
    
    console.log('✓ Durchlauf 1 erwähnt?', hasDurchlauf1 ? '✅' : '❌');
    console.log('✓ Durchlauf 2 erwähnt?', hasDurchlauf2 ? '✅' : '❌');
    console.log('✓ Durchlauf 3 erwähnt?', hasDurchlauf3 ? '✅' : '❌');
    
    const mentionsNeu = aiResponse.includes('Neu') || aiResponse.includes('NEU');
    console.log('✓ Modus "Neu" erkannt?', mentionsNeu ? '✅' : '❌');
    
    const mentionsSections = 
      aiResponse.includes('Investment') ||
      aiResponse.includes('Profit') ||
      aiResponse.includes('Trend') ||
      aiResponse.includes('Grid');
    console.log('✓ Sektionen erwähnt?', mentionsSections ? '✅' : '❌');
    
    console.log('\n📊 TOKEN USAGE:');
    console.log('Prompt:', response.usage.prompt_tokens);
    console.log('Completion:', response.usage.completion_tokens);
    console.log('Total:', response.usage.total_tokens);

  } catch (error) {
    console.error('❌ FEHLER:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testPhase4Step3();
