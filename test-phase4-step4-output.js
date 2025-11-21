/**
 * PHASE 4 - SCHRITT 4 TEST: AUSGABE IN FELDER
 * 
 * Testet ob die AI die berechneten Werte korrekt in die Formularfelder ausgibt
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const PHASE4_STEP4_PROMPT = `**PHASE 4 - SCHRITT 4: AUSGABE IN FORMULARFELDER**

Schritt 3 ist abgeschlossen und alle Berechnungen wurden verifiziert.

**DEINE AUFGABE:**
Gib jetzt alle berechneten Werte in einem strukturierten JSON-Format aus, damit sie in die Formularfelder eingefügt werden können.

**AUSGABE-FORMAT:**
Gib ein valides JSON-Objekt zurück mit ALLEN berechneten Feldern:

{
  "date": "TT.MM.JJJJ",
  "botDirection": "Long|Short|Beides",
  "leverage": "z.B. 5x, 10x",
  "longestRuntime": "z.B. 1d 6h 53m",
  "avgRuntime": "z.B. 2d 9h 44m",
  "investment": 240.00,
  "extraMargin": 1300.00,
  "totalInvestment": 1540.00,
  "profit": 53.60,
  "profitPercent_gesamtinvestment": 3.48,
  "profitPercent_investitionsmenge": 22.33,
  "overallTrendPnlUsdt": 42.43,
  "overallTrendPnlPercent_gesamtinvestment": 2.75,
  "overallTrendPnlPercent_investitionsmenge": 17.68,
  "overallGridProfitUsdt": 11.17,
  "overallGridProfitPercent_gesamtinvestment": 0.73,
  "overallGridProfitPercent_investitionsmenge": 4.65,
  "highestGridProfit": 5.66,
  "highestGridProfitPercent_gesamtinvestment": 0.73,
  "highestGridProfitPercent_investitionsmenge": 9.43,
  "avgGridProfitHour": 0.15,
  "avgGridProfitDay": 3.60,
  "avgGridProfitWeek": null
}

**WICHTIGE REGELN:**
1. Bei Modus "Neu": BEIDE Percentage-Werte ausgeben (_gesamtinvestment und _investitionsmenge)!
2. Bei Modus "Vergleich": Nur ein Percentage-Wert (Wachstumsrate)
3. Alle Zahlen auf 2 Dezimalstellen runden
4. Felder die nicht berechnet wurden: null
5. Bei Grid Profit Durchschnitt: Nur Felder wo time_basis >= 1

Sage vorher: "Schritt 3 abgeschlossen. Gehe zu Schritt 4 über: Ausgabe der Werte"
Dann gib das JSON aus.
Dann sage: "Schritt 4 abgeschlossen. Alle Werte wurden in die Felder eingetragen."`;

// Szenario: Zweiter Upload (Vergleich Modus)
const calculatedValues = {
  previousUpload: {
    date: "2025-11-18",
    investment: 240,
    extraMargin: 1300,
    totalInvestment: 1540,
    profit: 53.60,
    overallTrendPnlUsdt: 42.43,
    overallGridProfitUsdt: 11.17,
    highestGridProfit: 5.66,
  },
  currentScreenshots: [
    {
      actualInvestment: 120,
      extraMargin: 650,
      totalProfit: 95.20,
      gridProfit: 8.15,
      trendPnl: 87.05,
      leverage: "75x Short",
      runtime: "3d 6h 53m"
    },
    {
      actualInvestment: 120,
      extraMargin: 650,
      totalProfit: 12.30,
      gridProfit: 9.80,
      trendPnl: 2.50,
      leverage: "75x Short",
      runtime: "2d 8h 18m"
    },
    {
      actualInvestment: 200,
      extraMargin: 800,
      totalProfit: 45.60,
      gridProfit: 12.30,
      trendPnl: 33.30,
      leverage: "50x Long",
      runtime: "1d 12h 00m"
    }
  ],
  mode: "Vergleich",
  timeDelta: "2 Tage"
};

async function testPhase4Step4() {
  console.log('🧪 PHASE 4 - SCHRITT 4 TEST: AUSGABE IN FELDER\n');
  console.log('📊 Szenario: Zweiter Upload (Modus "Vergleich")');
  console.log('🎯 Aufgabe: Berechnete Werte in JSON-Format ausgeben');
  console.log('\n' + '='.repeat(80) + '\n');

  const messages = [
    {
      role: 'system',
      content: PHASE4_STEP4_PROMPT
    },
    {
      role: 'user',
      content: `Schritt 3 ist abgeschlossen. Alle Berechnungen wurden verifiziert.

BERECHNETE WERTE (aus Schritt 3):

VORHERIGER UPLOAD:
${JSON.stringify(calculatedValues.previousUpload, null, 2)}

AKTUELLER UPLOAD (3 Screenshots):
${JSON.stringify(calculatedValues.currentScreenshots, null, 2)}

MODUS: ${calculatedValues.mode}
ZEIT-DELTA: ${calculatedValues.timeDelta}

Bitte gib jetzt in Schritt 4 alle berechneten Werte im JSON-Format aus, damit sie in die Formularfelder eingetragen werden können.

WICHTIG:
- Investment Differenz: 2540 - 1540 = +1000 USDT
- Profit Differenz: 153.1 - 53.6 = +99.5 USDT (+185.63%)
- Trend PnL Differenz: 122.85 - 42.43 = +80.42 USDT (+189.47%)
- Höchster Grid Profit: 12.30 USDT (Screenshot 3, Investment 200 USDT → 6.15%)
- Grid Profit Durchschnitt: 30.25 USDT / 2 Tage = 15.13 USDT/Tag
- Bot-Richtung: "Beides" (2x Short, 1x Long)
- Leverage: "50x Long, 75x Short"
- Längste Runtime: "3d 6h 53m"
- Durchschnittliche Runtime: ~2d 9h 44m`
    }
  ];

  try {
    console.log('🤖 Sende Request an OpenAI API...\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0,
      max_tokens: 1500,
    });

    const aiResponse = response.choices[0].message.content;
    
    console.log('✅ AI ANTWORT:\n');
    console.log(aiResponse);
    console.log('\n' + '='.repeat(80) + '\n');

    // Versuche JSON zu extrahieren
    console.log('📋 JSON EXTRAKTION:\n');
    
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedJSON = JSON.parse(jsonMatch[0]);
        console.log('✅ Valides JSON gefunden!\n');
        console.log(JSON.stringify(parsedJSON, null, 2));
        
        console.log('\n📊 FELD-VALIDIERUNG:\n');
        
        const requiredFields = [
          'botDirection',
          'leverage',
          'longestRuntime',
          'avgRuntime',
          'investment',
          'profit',
          'overallTrendPnlUsdt',
          'overallGridProfitUsdt',
          'highestGridProfit'
        ];
        
        requiredFields.forEach(field => {
          const hasField = parsedJSON.hasOwnProperty(field);
          const value = parsedJSON[field];
          console.log(`✓ ${field}:`, hasField ? `✅ (${value})` : '❌ FEHLT');
        });
        
        console.log('\n🔍 PERCENTAGE FELDER PRÜFUNG:\n');
        
        // Im Vergleich-Modus sollte es nur EINE Percentage geben (Wachstumsrate)
        const hasProfitPercent = parsedJSON.hasOwnProperty('profitPercent');
        console.log('✓ profitPercent (Wachstumsrate):', hasProfitPercent ? '✅' : '❌');
        
        const hasBothPercentages = 
          parsedJSON.hasOwnProperty('profitPercent_gesamtinvestment') &&
          parsedJSON.hasOwnProperty('profitPercent_investitionsmenge');
        
        if (hasBothPercentages) {
          console.log('⚠️  WARNUNG: Im Vergleich-Modus sollten KEINE _gesamtinvestment/_investitionsmenge Felder existieren!');
        }
        
      } catch (parseError) {
        console.error('❌ JSON Parse Fehler:', parseError.message);
      }
    } else {
      console.log('❌ Kein JSON im Response gefunden');
    }

    console.log('\n📊 TOKEN USAGE:');
    console.log('Prompt:', response.usage.prompt_tokens);
    console.log('Completion:', response.usage.completion_tokens);
    console.log('Total:', response.usage.total_tokens);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST ABGESCHLOSSEN - SCHRITT 4 OUTPUT GETESTET');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ FEHLER:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testPhase4Step4();
