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
   * MODE 1: "Insgesamt" (Total/Cumulative)
   * 
   * Function: Shows the SUM of ALL uploads up to now
   * 
   * Logic:
   * - Take the current upload value
   * - This IS the "Insgesamt" value because each upload already shows cumulative data
   * 
   * Example for Investment:
   * - Upload 1 (Tag 1): Investment = 1000 USDT → Insgesamt = 1000 USDT
   * - Upload 2 (Tag 2): Investment = 1500 USDT → Insgesamt = 1500 USDT (cumulative shown in screenshot)
   * - Upload 3 (Tag 5): Investment = 2000 USDT → Insgesamt = 2000 USDT
   * 
   * Reasoning:
   * - The screenshots from Pionex already show CUMULATIVE values
   * - No addition of uploads is needed
   * - The current total is shown directly
   * 
   * For multiple screenshots in one upload:
   * - If upload contains 3 bot screenshots
   * - Bot A: 1000 USDT, Bot B: 500 USDT, Bot C: 800 USDT
   * - Insgesamt = 1000 + 500 + 800 = 2300 USDT
   */
  INSGESAMT: {
    mode: 'total',
    calculation: 'current_upload_value',
    comparison: false,
    aggregation: 'sum_if_multiple_bots',
    description: 'Shows the cumulative value from the current upload (which already contains cumulative data from Pionex)',
  },

  /**
   * MODE 2: "Seit letztem Update" (Since Last Update)
   * 
   * Function: Shows the CHANGE/DIFFERENCE compared to the last update
   * 
   * Logic:
   * - Compare current upload value WITH last update value
   * - Calculate: Current - Last Update = Change
   * - Can be positive (growth) or negative (loss)
   * 
   * Example for Profit:
   * - Last Update (Tag 1): Profit = 100 USDT
   * - Current Upload (Tag 5): Profit = 250 USDT
   * - Seit letztem Update = 250 - 100 = +150 USDT
   * 
   * Example for Investment:
   * - Last Update: Investment = 1000 USDT
   * - Current Upload: Investment = 1500 USDT
   * - Seit letztem Update = 1500 - 1000 = +500 USDT
   * 
   * Special case - FIRST upload (no previous update):
   * - There is no "last update" to compare with
   * - "Seit letztem Update" = same as "Insgesamt" (current value)
   * - OR show "N/A" or "Keine Vergleichsdaten"
   * 
   * For multiple screenshots in one upload:
   * - Aggregate current upload first: Bot A + Bot B + Bot C = Current Total
   * - Then compare: Current Total - Last Update Total = Difference
   */
  SEIT_LETZTEM_UPDATE: {
    mode: 'since_last_update',
    calculation: 'current_minus_last_update',
    comparison: true,
    requires_history: true,
    description: 'Shows the change/difference since the last update',
  },

};

/**
 * COMPARISON TABLE
 * 
 * Scenario: 3 uploads for "Grid Trading Bots"
 * 
 * Upload 1 (05.11.2025): Investment = 500 USDT, Profit = 25 USDT
 * Upload 2 (10.11.2025): Investment = 800 USDT, Profit = 80 USDT
 * Upload 3 (15.11.2025 - CURRENT): Investment = 1200 USDT, Profit = 150 USDT
 * 
 * Mode                | Investment Display | Profit Display | Calculation
 * --------------------|-------------------|----------------|-------------------
 * Insgesamt           | 1200 USDT         | 150 USDT       | Current value
 * Seit letztem Update | +400 USDT         | +70 USDT       | Current - Upload 2
 * 
 * 
 * ANOTHER SCENARIO: Multiple bots in single upload
 * 
 * Current Upload contains 3 bot screenshots:
 * - Bot A: Investment = 400 USDT, Profit = 50 USDT
 * - Bot B: Investment = 300 USDT, Profit = 35 USDT
 * - Bot C: Investment = 500 USDT, Profit = 65 USDT
 * 
 * Last Update (single total): Investment = 800 USDT, Profit = 100 USDT
 * 
 * Mode                | Investment Display | Profit Display | Calculation
 * --------------------|-------------------|----------------|----------------------------
 * Insgesamt           | 1200 USDT         | 150 USDT       | 400+300+500, 50+35+65
 * Seit letztem Update | +400 USDT         | +50 USDT       | 1200-800, 150-100
 */

/**
 * KEY PRINCIPLES
 * 
 * 1. **"Insgesamt" default behavior**:
 *    - Shows the CURRENT values from the upload
 *    - These represent the "Insgesamt" values automatically
 * 
 * 2. **"Seit letztem Update" history requirement**:
 *    - Requires updateHistory for the Bot Type
 *    - If history exists: Shows comparison with last update
 *    - If no history: Shows same as "Insgesamt" or "N/A"
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

export type ModeType = 'insgesamt' | 'seit_letztem_update';

export interface ModeCalculation {
  mode: ModeType;
  currentValue: number;
  lastUpdateValue?: number;
  displayValue: number;
  change?: number;
}
