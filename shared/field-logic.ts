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
