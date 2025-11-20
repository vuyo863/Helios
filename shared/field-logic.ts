/**
 * FIELD LOGIC DOCUMENTATION
 * 
 * This file contains the business logic for all fields in the upload form.
 * The AI must understand and follow these rules when analyzing screenshots.
 */

/**
 * INFO SECTION - Fixed Logic (No Modes)
 * 
 * Important: The Info section has NO dropdown modes.
 * Each field has a fixed, unchangeable function.
 */

export const INFO_SECTION_LOGIC = {
  /**
   * DATUM (Date)
   * 
   * Function: Shows the START DATE of the very first upload for this Bot Type category
   * 
   * Logic:
   * - First upload: Bot started on 01.01.2025 → Info section always shows 01.01.2025
   * - Subsequent uploads: Date remains 01.01.2025 (never changes)
   * 
   * Rules:
   * - Date is NOT recalculated
   * - Date is NOT updated
   * - No modes exist
   * - Simply store the start date and always output it
   * 
   * Example:
   * - Upload 1 (01.01.2025): Date = 01.01.2025
   * - Upload 2 (15.02.2025): Date = 01.01.2025 (unchanged)
   * - Upload 3 (18.03.2025): Date = 01.01.2025 (unchanged)
   */
  DATUM: {
    type: 'start_date',
    calculation: 'first_upload_only',
    updates: false,
    modes: false,
  },

  /**
   * BOT-RICHTUNG (Bot Direction)
   * 
   * Function: Shows which type of bots are in the current upload
   * 
   * Options:
   * - "Long": Only Long bots
   * - "Short": Only Short bots
   * - "Beides": Mixed (both Long and Short)
   * 
   * Logic:
   * - Count directions in current upload screenshots
   * - If all are Long → "Long"
   * - If all are Short → "Short"
   * - If mixed → "Beides"
   * 
   * Rules:
   * - No modes
   * - No comparison with previous updates
   * - Simply determine direction based on current upload
   * 
   * Example:
   * - Upload contains 3 Long bots → "Long"
   * - Upload contains 6 Short bots → "Short"
   * - Upload contains 2 Long + 1 Short → "Beides"
   */
  BOT_RICHTUNG: {
    type: 'direction',
    calculation: 'current_upload_only',
    options: ['Long', 'Short', 'Beides'],
    modes: false,
  },

  /**
   * HEBEL (Leverage)
   * 
   * Function: Shows the leverage values used in the upload
   * 
   * Logic:
   * - Extract leverage from each screenshot in current upload
   * - If all bots use same leverage → single value (e.g., "5x")
   * - If mixed leverages → list all unique values (e.g., "5x, 10x")
   * 
   * Rules:
   * - No modes
   * - No comparison with previous uploads
   * - Aggregate leverages only from current upload
   * 
   * Example:
   * - All bots use 5x → "5x"
   * - 8 bots use 5x, 2 use 10x → "5x, 10x"
   */
  HEBEL: {
    type: 'leverage',
    calculation: 'aggregate_current_upload',
    modes: false,
  },

  /**
   * LÄNGSTE LAUFZEIT (Longest Runtime)
   * 
   * Function: Find the longest runtime ONLY from the current upload
   * 
   * Logic:
   * - Read runtime value from each screenshot
   * - Take the MAXIMUM value
   * - Each upload is an independent evaluation
   * 
   * Rules:
   * - No modes
   * - No cross-update comparison
   * - Runtime = MAX(all runtimes in current upload)
   * 
   * Example:
   * - Upload A: Bots run 1d, 4d, 9d → Longest = 9d
   * - Upload B: Bots run 3h, 7h, 15h → Longest = 15h (≈0.6d)
   * - We do NOT compare with 9d from Upload A
   * - Each upload is independent
   * 
   * Reasoning:
   * - User wants to see: "How long has the longest-running bot in THIS batch been active?"
   * - Old runtimes would distort the current state
   */
  LAENGSTE_LAUFZEIT: {
    type: 'runtime_max',
    calculation: 'max_from_current_upload',
    comparison: false,
    modes: false,
  },

  /**
   * DURCHSCHNITTLICHE LAUFZEIT (Average Runtime)
   * 
   * Function: Calculate the average of all runtimes from the current upload
   * 
   * Logic:
   * - Read runtime from each screenshot
   * - Calculate: SUM(all runtimes) / COUNT(bots)
   * - Each upload is isolated
   * 
   * Rules:
   * - No modes
   * - No comparison logic
   * - Average = Sum of all runtimes / Number of bots
   * - Each upload evaluation is calculated independently
   * 
   * Example:
   * - Upload contains bots with: 1d, 3d, 5d
   * - Average = (1 + 3 + 5) / 3 = 3d
   * - New upload: 4h, 6h
   * - Average = (4 + 6) / 2 = 5h
   * - No relation to previous uploads
   * 
   * Reasoning:
   * - This average will be used later (in other sections) as basis for hourly/daily/weekly calculations
   * - Therefore it must always match the current upload group
   */
  DURCHSCHNITTLICHE_LAUFZEIT: {
    type: 'runtime_avg',
    calculation: 'average_from_current_upload',
    comparison: false,
    modes: false,
  },
};

/**
 * GRID TRADING SECTION LOGIC
 * 
 * This section has TWO types of fields with DIFFERENT aggregation logic.
 */

export const GRID_TRADING_LOGIC = {
  /**
   * GESAMTER GRID PROFIT (Total Grid Profit)
   * 
   * Function: Sum of ALL Grid Profit values from all screenshots
   * 
   * Mode "Neu":
   * - Sum all Grid Profit values from ALL screenshots in current upload
   * - Example: Screenshot 1 = 50 USDT, Screenshot 2 = 75 USDT, Screenshot 3 = 30 USDT
   * - Gesamter Grid Profit = 50 + 75 + 30 = 155 USDT
   * 
   * Mode "Vergleich":
   * - Compare current total with previous upload total
   * - Example: Previous = 120 USDT, Current = 155 USDT
   * - Vergleich = +35 USDT
   * 
   * Percentage Calculation (Mode "Neu"):
   * - Option 1 (Gesamtinvestment): (155 / sum_of_all_gesamtinvestments) × 100
   * - Option 2 (Investitionsmenge): (155 / sum_of_all_investitionsmengen) × 100
   * 
   * Percentage Calculation (Mode "Vergleich"):
   * - (35 / 120) × 100 = 29.17% ← Growth rate
   */
  GESAMTER_GRID_PROFIT: {
    type: 'aggregated_sum',
    calculation: 'sum_all_screenshots',
    modes: ['neu', 'vergleich'],
  },

  /**
   * HÖCHSTER GRID PROFIT (Highest Grid Profit)
   * 
   * ⚠️ CRITICAL: This field works DIFFERENTLY from "Gesamter Grid Profit"!
   * 
   * Function: Find the SINGLE screenshot with the HIGHEST Grid Profit value
   * 
   * Mode "Neu":
   * - AI performs INTERNAL comparison across all screenshots
   * - Find which screenshot has the highest Grid Profit
   * - Return ONLY that single value
   * - Example: Screenshot 1 = 50 USDT, Screenshot 2 = 75 USDT, Screenshot 3 = 30 USDT
   * - Höchster Grid Profit = 75 USDT (from Screenshot 2)
   * 
   * Mode "Vergleich":
   * - Find highest Grid Profit in current upload (same as "Neu")
   * - Compare with highest Grid Profit from previous upload
   * - Example: Previous highest = 60 USDT, Current highest = 75 USDT
   * - Vergleich = +15 USDT
   * 
   * ⚠️ PERCENTAGE CALCULATION - CRITICAL DIFFERENCE:
   * ===================================================
   * Percentage is calculated based on the INDIVIDUAL screenshot that had the highest value!
   * NOT based on the sum of all screenshots!
   * 
   * Mode "Neu" - Percentage Options:
   * - Option 1 (Gesamtinvestment): (75 / gesamtinvestment_of_screenshot_2_only) × 100
   * - Option 2 (Investitionsmenge): (75 / investitionsmenge_of_screenshot_2_only) × 100
   * 
   * Example with real numbers:
   * - Screenshot 1: Grid Profit 50 USDT, Investment 500, Gesamt 700
   * - Screenshot 2: Grid Profit 75 USDT, Investment 300, Gesamt 400 ← HIGHEST!
   * - Screenshot 3: Grid Profit 30 USDT, Investment 200, Gesamt 300
   * 
   * Höchster Grid Profit (USDT) = 75 USDT
   * Höchster Grid Profit (%) Gesamtinvestment = (75 / 400) × 100 = 18.75%
   * Höchster Grid Profit (%) Investitionsmenge = (75 / 300) × 100 = 25%
   * 
   * ❌ WRONG: (75 / 1400) × 100 = 5.36% ← Don't use sum of all investments!
   * ❌ WRONG: (75 / 1000) × 100 = 7.5% ← Don't use sum of all Investitionsmengen!
   * 
   * Mode "Vergleich" - Percentage:
   * - Compare current highest with previous highest
   * - (15 / 60) × 100 = 25% ← Growth rate
   * 
   * WHY THIS MATTERS:
   * - Using summed investments would show artificially low percentages
   * - The highest Grid Profit is a single bot's achievement
   * - It should be compared to that single bot's investment
   */
  HOECHSTER_GRID_PROFIT: {
    type: 'single_maximum',
    calculation: 'max_single_screenshot',
    percentage_basis: 'individual_screenshot_investment',
    modes: ['neu', 'vergleich'],
    warning: 'Do NOT use aggregated investment values for percentage calculation!',
  },

  /**
   * GRID PROFIT DURCHSCHNITT (Average Grid Profit per Hour/Day/Week)
   * 
   * This field has THREE sub-fields:
   * - avgGridProfitHour (per hour)
   * - avgGridProfitDay (per day)
   * - avgGridProfitWeek (per week)
   * 
   * ⚠️ CRITICAL: Always use total_grid_profit_usdt from CURRENT upload only!
   * 
   * The ONLY difference between "Neu" and "Vergleich" is the TIME BASIS!
   * 
   * =================================================================
   * MODE "NEU" - Average since bot START
   * =================================================================
   * 
   * Time Basis: Total runtime since bots started
   * 
   * Calculation:
   * - hours_total = runtime_since_start_hours
   * - days_total = runtime_since_start_days
   * - weeks_total = runtime_since_start_weeks
   * 
   * - IF hours_total >= 1:  avg_per_hour = total_grid_profit_usdt / hours_total
   * - IF days_total >= 1:   avg_per_day = total_grid_profit_usdt / days_total
   * - IF weeks_total >= 1:  avg_per_week = total_grid_profit_usdt / weeks_total
   * 
   * ⚠️ IMPORTANT: Only output fields where time basis >= 1!
   * - Bot runs 2 days, 10 hours:
   *   ✅ avg_per_hour = total / 58 hours
   *   ✅ avg_per_day = total / 2.4 days
   *   ❌ avg_per_week = EMPTY (not yet 1 week)
   * 
   * Example:
   * - total_grid_profit_usdt = 120 USDT (sum of all screenshots)
   * - runtime_since_start = 3 days, 12 hours = 84 hours = 3.5 days = 0.5 weeks
   * 
   * - avg_per_hour = 120 / 84 = 1.43 USDT/hour ✅
   * - avg_per_day = 120 / 3.5 = 34.29 USDT/day ✅
   * - avg_per_week = EMPTY (0.5 weeks < 1 week) ❌
   * 
   * =================================================================
   * MODE "VERGLEICH" - Average since LAST upload
   * =================================================================
   * 
   * Time Basis: Time difference between last upload and current upload
   * 
   * Calculation:
   * - delta_runtime = current_upload_timestamp - last_upload_timestamp
   * - delta_hours = delta_runtime_in_hours
   * - delta_days = delta_runtime_in_days
   * - delta_weeks = delta_runtime_in_weeks
   * 
   * - IF delta_hours >= 1:  avg_per_hour = total_grid_profit_usdt / delta_hours
   * - IF delta_days >= 1:   avg_per_day = total_grid_profit_usdt / delta_days
   * - IF delta_weeks >= 1:  avg_per_week = total_grid_profit_usdt / delta_weeks
   * 
   * ⚠️ total_grid_profit_usdt is STILL from current upload only!
   * 
   * Example:
   * - Last upload: 2025-01-10 10:00
   * - Current upload: 2025-01-12 14:00
   * - Delta = 2 days, 4 hours = 52 hours = 2.17 days = 0.31 weeks
   * - total_grid_profit_usdt = 120 USDT (from current upload)
   * 
   * - avg_per_hour = 120 / 52 = 2.31 USDT/hour ✅
   * - avg_per_day = 120 / 2.17 = 55.30 USDT/day ✅
   * - avg_per_week = EMPTY (0.31 weeks < 1 week) ❌
   * 
   * WHY THIS MAKES SENSE:
   * - "Neu" shows: "What's the average Grid Profit rate since we started?"
   * - "Vergleich" shows: "What's the average Grid Profit rate since last check?"
   * 
   * Both use the CURRENT upload's total Grid Profit, but divide by different time periods.
   */
  GRID_PROFIT_DURCHSCHNITT: {
    type: 'time_based_average',
    calculation: 'total_grid_profit / time_basis',
    time_basis_neu: 'runtime_since_start',
    time_basis_vergleich: 'delta_since_last_upload',
    profit_source: 'current_upload_only',
    modes: ['neu', 'vergleich'],
    fields: ['avgGridProfitHour', 'avgGridProfitDay', 'avgGridProfitWeek'],
    minimum_time_requirement: 'time_basis >= 1 for each field',
  },
};

/**
 * SUMMARY TABLE
 * 
 * Field                      | Function                                    | Comparison? | Modes?
 * ---------------------------|---------------------------------------------|-------------|--------
 * Datum                      | Start date of first upload                  | No          | No
 * Bot-Richtung               | Long/Short/Beides from current upload       | No          | No
 * Hebel                      | Leverage values from current upload         | No          | No
 * Längste Laufzeit           | Highest runtime value of current upload     | No          | No
 * Durchschnittliche Laufzeit | Average of all runtimes from current upload | No          | No
 * 
 * KEY PRINCIPLES:
 * - Each upload forms an independent Info evaluation
 * - No history inheritance except the date
 * - Info section describes the bots, does NOT calculate profits
 */
