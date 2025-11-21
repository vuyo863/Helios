/**
 * PHASE 4 - SCHRITT 4 TEST: AUSGABE IM MODUS "NEU"
 * 
 * Testet ob die AI im Modus "Neu" BEIDE Percentage-Werte ausgibt
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const PHASE4_STEP4_CORRECTED_PROMPT = `**PHASE 4 - SCHRITT 4: AUSGABE IN FORMULARFELDER**

Schritt 3 ist abgeschlossen und alle Berechnungen wurden verifiziert.

**KRITISCHE REGEL - PERCENTAGE-FELD-NAMEN:**

**MODUS "NEU":**
- Du MUSST BEIDE Percentage-Werte ausgeben!
- Feldnamen MIT Suffix: "_gesamtinvestment" und "_investitionsmenge"
- Beispiel:
  {
    "profit": 153.10,
    "profitPercent_gesamtinvestment": 6.03,    ← (153.10 / 2540) × 100
    "profitPercent_investitionsmenge": 34.91   ← (153.10 / 440) × 100
  }

**MODUS "VERGLEICH":**
- Nur EINE Percentage (Wachstumsrate)!
- Feldname OHNE Suffix: einfach "profitPercent"
- Beispiel:
  {
    "profit": 99.50,
    "profitPercent": 185.63    ← (99.50 / 53.60) × 100 = Wachstumsrate
  }

**AUSGABE-FORMAT FÜR MODUS "NEU":**
{
  "date": "TT.MM.JJJJ",
  "botDirection": "Long|Short|Beides",
  "leverage": "z.B. 5x, 10x",
  "longestRuntime": "z.B. 1d 6h 53m",
  "avgRuntime": "z.B. 17h 35m",
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

Sage vorher: "Schritt 3 abgeschlossen. Gehe zu Schritt 4 über: Ausgabe der Werte"
Dann gib das JSON aus.
Dann sage: "Schritt 4 abgeschlossen. Alle Werte wurden in die Felder eingetragen."`;

const currentUploadScreenshots = [
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
];

async function testPhase4Step4NeuMode() {
  console.log('🧪 PHASE 4 - SCHRITT 4 TEST: MODUS "NEU"\n');
  console.log('📊 Szenario: Erster Upload (Modus "Neu")');
  console.log('🎯 Aufgabe: BEIDE Percentage-Werte (_gesamtinvestment UND _investitionsmenge) ausgeben');
  console.log('\n' + '='.repeat(80) + '\n');

  const messages = [
    {
      role: 'system',
      content: PHASE4_STEP4_CORRECTED_PROMPT
    },
    {
      role: 'user',
      content: `Schritt 3 ist abgeschlossen. Alle Berechnungen wurden verifiziert.

MODUS: "NEU" (Erster Upload, keine Vergleichsdaten)

AKTUELLER UPLOAD (3 Screenshots):
${JSON.stringify(currentUploadScreenshots, null, 2)}

BERECHNETE WERTE:
- Investment Gesamt: 120 + 120 + 200 = 440 USDT
- Extra Margin Gesamt: 650 + 650 + 800 = 2100 USDT
- Total Investment: 440 + 2100 = 2540 USDT
- Profit Gesamt: 95.20 + 12.30 + 45.60 = 153.10 USDT
- Trend PnL Gesamt: 87.05 + 2.50 + 33.30 = 122.85 USDT
- Grid Profit Gesamt: 8.15 + 9.80 + 12.30 = 30.25 USDT
- Höchster Grid Profit: 12.30 USDT (Screenshot 3, dessen Investment: 200 USDT, dessen Total: 1000 USDT)
- Bot-Richtung: "Beides" (2x Short, 1x Long)
- Leverage: "50x Long, 75x Short"
- Längste Runtime: "3d 6h 53m"
- Durchschnittliche Runtime: "2d 9h 44m"
- Grid Profit Durchschnitt/Tag: 30.25 / ~2.5 Tage = ~12.10 USDT/Tag

⚠️ KRITISCH - PERCENTAGE-BERECHNUNGEN:
Bei ALLEN Percentage-Feldern BEIDE Werte berechnen:

Profit:
- profitPercent_gesamtinvestment = (153.10 / 2540) × 100 = 6.03%
- profitPercent_investitionsmenge = (153.10 / 440) × 100 = 34.80%

Trend PnL:
- overallTrendPnlPercent_gesamtinvestment = (122.85 / 2540) × 100 = 4.84%
- overallTrendPnlPercent_investitionsmenge = (122.85 / 440) × 100 = 27.92%

Gesamter Grid Profit:
- overallGridProfitPercent_gesamtinvestment = (30.25 / 2540) × 100 = 1.19%
- overallGridProfitPercent_investitionsmenge = (30.25 / 440) × 100 = 6.88%

Höchster Grid Profit (SPEZIAL: Screenshot 3's Werte!):
- highestGridProfitPercent_gesamtinvestment = (12.30 / 1000) × 100 = 1.23%
- highestGridProfitPercent_investitionsmenge = (12.30 / 200) × 100 = 6.15%

Bitte gib jetzt in Schritt 4 alle berechneten Werte im JSON-Format aus.
WICHTIG: BEIDE Percentage-Werte für JEDES Percentage-Feld!`
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

    // JSON extrahieren
    console.log('📋 JSON EXTRAKTION:\n');
    
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedJSON = JSON.parse(jsonMatch[0]);
        console.log('✅ Valides JSON gefunden!\n');
        console.log(JSON.stringify(parsedJSON, null, 2));
        
        console.log('\n🔍 KRITISCHE PRÜFUNG - BEIDE PERCENTAGE-WERTE:\n');
        
        const percentageFields = [
          ['profitPercent_gesamtinvestment', 'profitPercent_investitionsmenge'],
          ['overallTrendPnlPercent_gesamtinvestment', 'overallTrendPnlPercent_investitionsmenge'],
          ['overallGridProfitPercent_gesamtinvestment', 'overallGridProfitPercent_investitionsmenge'],
          ['highestGridProfitPercent_gesamtinvestment', 'highestGridProfitPercent_investitionsmenge']
        ];
        
        percentageFields.forEach(([field1, field2]) => {
          const has1 = parsedJSON.hasOwnProperty(field1);
          const has2 = parsedJSON.hasOwnProperty(field2);
          const baseName = field1.split('_')[0];
          
          console.log(`${baseName}:`);
          console.log(`  ✓ ${field1}:`, has1 ? `✅ (${parsedJSON[field1]}%)` : '❌ FEHLT');
          console.log(`  ✓ ${field2}:`, has2 ? `✅ (${parsedJSON[field2]}%)` : '❌ FEHLT');
          
          if (has1 && has2) {
            console.log(`  → BEIDE Werte vorhanden ✅\n`);
          } else {
            console.log(`  → ⚠️  FEHLER: BEIDE Werte müssen im Modus "Neu" vorhanden sein!\n`);
          }
        });
        
      } catch (parseError) {
        console.error('❌ JSON Parse Fehler:', parseError.message);
      }
    }

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

testPhase4Step4NeuMode();
