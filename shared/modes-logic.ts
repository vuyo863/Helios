/**
 * MODES LOGIC DOCUMENTATION
 * 
 * This file documents the two modes that exist for MOST sections (EXCEPT Info-Section).
 * The AI must understand these modes to correctly calculate and compare values.
 * 
 * IMPORTANT: Info-Section has NO modes! Only the other sections use these modes.
 */

/**
 * WHICH SECTIONS HAVE MODES?
 * 
 * ✅ Sections WITH modes (dropdown with 2 options):
 * - Investment Section
 * - Gesamter Profit / P&L Section
 * - Trend P&L Section
 * - Grid Trading Section
 * 
 * ❌ Sections WITHOUT modes (no dropdown):
 * - Info Section (fixed logic, no comparison)
 * - Bot Type Section (just selection, no calculations)
 */

export const MODES_LOGIC = {
  /**
   * MODE 1: "Vergleich" (Comparison/Difference)
   * 
   * Function: Shows the CHANGE/DIFFERENCE compared to the last update
   * 
   * Logic:
   * - Compare current upload value WITH last update value
   * - Calculate: Current - Last Update = Change
   * - Can be positive (growth) or negative (loss)
   * 
   * Example for Profit (USDT field):
   * - Last Update (Tag 1): Profit = 100 USDT
   * - Current Upload (Tag 5): Profit = 250 USDT
   * - Vergleich = 250 - 100 = +150 USDT
   * 
   * Example for Profit (% field):
   * - USDT Delta = +150 USDT
   * - Percentage = (150 / 100) × 100 = +150% ← Growth Rate!
   * - This means: "Profit increased BY 150%"
   * 
   * CRITICAL: Percentage Calculation Formula
   * ==========================================
   * percentage = (delta_usdt / previous_value) × 100
   * 
   * NOT: (delta_usdt / total_investment) × 100 ← WRONG!
   * 
   * Examples:
   * 1) 50 USDT → 75 USDT = +25 USDT = +50% (25/50×100)
   * 2) 100 USDT → 120 USDT = +20 USDT = +20% (20/100×100)
   * 3) 200 USDT → 180 USDT = -20 USDT = -10% (-20/200×100)
   * 
   * Special case - FIRST upload (no previous update):
   * - There is no "last update" to compare with
   * - "Vergleich" = same as "Neu" (current value)
   * - OR show "N/A" or "Keine Vergleichsdaten"
   * 
   * For multiple screenshots in one upload:
   * - Aggregate current upload first: Bot A + Bot B + Bot C = Current Total
   * - Then compare: Current Total - Last Update Total = Difference
   */
  VERGLEICH: {
    mode: 'comparison',
    calculation: 'difference_since_last_update',
    comparison: true,
    requires_history: true,
    description: 'Shows the change/difference since the last update',
    percentage_formula: '(delta_usdt / previous_value) × 100',
  },

  /**
   * MODE 2: "Neu" (New/Current Values)
   * 
   * Function: Shows the current/new values from the upload
   * 
   * Logic:
   * - Take the current upload value
   * - This IS the "Neu" value because each upload already shows cumulative data
   * 
   * Example for Profit (USDT field):
   * - Upload 1 (Tag 1): Profit = 50 USDT → Neu = 50 USDT
   * - Upload 2 (Tag 5): Profit = 75 USDT → Neu = 75 USDT (total as shown in screenshots)
   * - Upload 3 (Tag 10): Profit = 120 USDT → Neu = 120 USDT
   * 
   * CRITICAL: TWO PERCENTAGE CALCULATION OPTIONS for "Neu" Mode
   * ===========================================================
   * 
   * Each percentage field has a dropdown with 2 options:
   * 
   * Option 1: "Gesamtinvestment" (Total Investment)
   * ------------------------------------------------
   * percentage = (current_value_usdt / total_investment) × 100
   * 
   * Example:
   * - Profit = 75 USDT
   * - Investitionsmenge = 500 USDT
   * - Extra Margin = 200 USDT
   * - Total Investment = 700 USDT
   * - Percentage = (75 / 700) × 100 = 10.71%
   * - Meaning: "Profit is 10.71% of total capital deployed"
   * 
   * Option 2: "Investitionsmenge" (Investment Amount)
   * --------------------------------------------------
   * percentage = (current_value_usdt / investment) × 100
   * 
   * Example (same values):
   * - Profit = 75 USDT
   * - Investitionsmenge = 500 USDT
   * - Percentage = (75 / 500) × 100 = 15%
   * - Meaning: "Profit is 15% of base investment (excluding extra margin)"
   * 
   * CRITICAL FOR AI IMPLEMENTATION:
   * ================================
   * - The AI MUST ALWAYS calculate and OUTPUT BOTH percentage values
   * - This is NOT optional - both values are required in the output
   * - The dropdown is ONLY a UI feature for user display preference
   * - The dropdown does NOT control what the AI calculates
   * 
   * AI OUTPUT REQUIREMENT:
   * - For every percentage field, provide BOTH values:
   *   1. Percentage based on Gesamtinvestment (total_investment)
   *   2. Percentage based on Investitionsmenge (investment only)
   * - Example AI output format:
   *   {
   *     profit_percent_gesamtinvestment: 10.71,
   *     profit_percent_investitionsmenge: 15.00
   *   }
   * - The UI will then show whichever the user selected via dropdown
   * 
   * This applies to: Profit %, Trend P&L %, Grid Profit %, Highest Grid Profit %
   * 
   * This is DIFFERENT from "Vergleich" mode!
   * - "Neu" → Percentage relative to investment (user chooses which investment base)
   * - "Vergleich" → Percentage as growth rate (dropdown irrelevant)
   * 
   * Reasoning:
   * - The screenshots from Pionex already show CUMULATIVE values
   * - No addition of uploads is needed
   * - The current total is shown directly
   * 
   * For multiple screenshots in one upload:
   * - If upload contains 3 bot screenshots
   * - Bot A: 1000 USDT, Bot B: 500 USDT, Bot C: 800 USDT
   * - Neu = 1000 + 500 + 800 = 2300 USDT
   */
  NEU: {
    mode: 'new_values',
    calculation: 'current_upload_value',
    comparison: false,
    aggregation: 'sum_if_multiple_bots',
    description: 'Shows the current/new value from the upload (which already contains cumulative data from Pionex)',
    percentage_formula_option1: '(current_value_usdt / total_investment) × 100 - Gesamtinvestment',
    percentage_formula_option2: '(current_value_usdt / investment) × 100 - Investitionsmenge',
    percentage_note: 'User selects which base via dropdown. AI must provide both values.',
  },

};

/**
 * COMPARISON TABLE - WITH TWO PERCENTAGE OPTIONS FOR "NEU" MODE
 * 
 * Scenario: Current upload for "Grid Trading Bots"
 * 
 * Investment Section values:
 * - Investitionsmenge: 500 USDT (sum of all bot investments)
 * - Extra Margin: 200 USDT (sum of all extra margins)
 * - Gesamtinvestment: 700 USDT (500 + 200)
 * 
 * Profit Section values:
 * - Gesamtprofit: 75 USDT
 * 
 * Previous Upload:
 * - Profit was: 50 USDT
 * 
 * MODE "NEU" - TWO PERCENTAGE CALCULATION OPTIONS:
 * ================================================
 * 
 * Dropdown Option 1: "Gesamtinvestment"
 * Mode | Profit (USDT) | Dropdown Selection  | Profit (%) | Calculation
 * -----|---------------|---------------------|------------|---------------------------
 * Neu  | 75 USDT       | Gesamtinvestment    | 10.71%     | (75/700)×100 = 10.71%
 * 
 * Dropdown Option 2: "Investitionsmenge"
 * Mode | Profit (USDT) | Dropdown Selection  | Profit (%) | Calculation
 * -----|---------------|---------------------|------------|---------------------------
 * Neu  | 75 USDT       | Investitionsmenge   | 15%        | (75/500)×100 = 15%
 * 
 * MODE "VERGLEICH" - DROPDOWN IRRELEVANT:
 * =======================================
 * Mode       | Profit (USDT) | Profit (%)  | Calculation (Growth Rate)
 * -----------|---------------|-------------|----------------------------------
 * Vergleich  | +25 USDT      | +50%        | (25/50)×100 = +50% ← Growth Rate!
 * 
 * KEY DIFFERENCES:
 * - "Neu" with "Gesamtinvestment": Profit as % of total capital (10.71%)
 * - "Neu" with "Investitionsmenge": Profit as % of base investment only (15%)
 * - "Vergleich": Growth rate from previous value (50% increase!)
 * 
 * CRITICAL: AI MUST ALWAYS OUTPUT BOTH PERCENTAGE VALUES FOR "NEU" MODE:
 * ========================================================================
 * - Option 1: (75 / 700) × 100 = 10.71% ← ALWAYS calculate this
 * - Option 2: (75 / 500) × 100 = 15% ← ALWAYS calculate this
 * - The dropdown is ONLY for UI display, NOT for filtering AI output
 * - Do NOT skip calculating one based on dropdown selection
 * - Both values must be provided in every AI response
 * 
 * THE REAL EVALUATION CRITERIA ARE:
 * - "Neu" vs "Vergleich" modes (different calculation methods)
 * - Everything else is always evaluated - no optional fields
 */

/**
 * EVALUATION CRITERIA - WHAT CONTROLS AI ANALYSIS
 * =================================================
 * 
 * THE ONLY REAL SELECTION CRITERIA:
 * - "Neu" vs "Vergleich" mode (Section-level dropdown at top right)
 *   → This determines the calculation method
 *   → This is what the AI evaluates
 * 
 * NOT SELECTION CRITERIA (UI-only features):
 * - Percentage basis dropdown ("Gesamtinvestment" vs "Investitionsmenge")
 *   → This is ONLY for user display preference
 *   → AI must calculate BOTH values regardless
 *   → Does NOT filter or change what AI outputs
 * 
 * EVERYTHING IS ALWAYS EVALUATED:
 * - All fields are always analyzed
 * - No optional calculations
 * - Complete data output required
 */

/**
 * KEY PRINCIPLES
 * 
 * 1. **"Neu" default behavior**:
 *    - Shows the CURRENT values from the upload
 *    - These represent the new/current values automatically
 * 
 * 2. **"Vergleich" history requirement**:
 *    - Requires updateHistory for the Bot Type
 *    - If history exists: Shows comparison with last update
 *    - If no history: Shows same as "Neu" or "N/A"
 * 
 * 3. **Multiple screenshots in one upload**:
 *    - Values are aggregated across all bots in the upload
 *    - Mode logic is applied to the aggregated values
 * 
 * 4. **Info-Section EXCEPTION**:
 *    - Info-Section has NO modes
 *    - Uses different logic (see field-logic.ts)
 *    - Mode logic does not apply to Info-Section
 */

export type ModeType = 'vergleich' | 'neu';

export interface ModeCalculation {
  mode: ModeType;
  currentValue: number;
  lastUpdateValue?: number;
  displayValue: number;
  change?: number;
}
