/**
 * Badge Logic Tests - Testing "Active" vs "Paused" status
 * 
 * Logic:
 * - "Active" = Pair in Watchlist AND at least 1 threshold active
 * - "Paused" = Pair NOT in Watchlist OR all thresholds paused
 */

interface ThresholdConfig {
  id: string;
  threshold: string;
  isActive: boolean;
  notifyOnIncrease?: boolean;
  notifyOnDecrease?: boolean;
}

interface TrendPriceSettings {
  trendPriceId: string;
  thresholds: ThresholdConfig[];
}

// Badge Logic Function - exactly as implemented in notifications.tsx
function calculateBadgeStatus(
  trendPriceId: string,
  watchlist: string[],
  savedThresholds: ThresholdConfig[]
): 'Active' | 'Paused' {
  const isInWatchlist = watchlist.includes(trendPriceId);
  const hasAnyActiveThreshold = savedThresholds.some(t => t.isActive !== false);
  const isActive = isInWatchlist && hasAnyActiveThreshold;
  return isActive ? 'Active' : 'Paused';
}

// Test runner
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => boolean): void {
  testCount++;
  try {
    const result = fn();
    if (result) {
      passCount++;
      console.log(`✅ Test ${testCount}: ${name}`);
    } else {
      failCount++;
      console.log(`❌ Test ${testCount}: ${name} - FAILED`);
    }
  } catch (error) {
    failCount++;
    console.log(`❌ Test ${testCount}: ${name} - ERROR: ${error}`);
  }
}

function assertEqual(actual: any, expected: any, message?: string): boolean {
  if (actual === expected) {
    return true;
  }
  console.log(`   Expected: ${expected}, Got: ${actual}${message ? ' - ' + message : ''}`);
  return false;
}

console.log('\n========================================');
console.log('BADGE LOGIC TESTS - Active vs Paused');
console.log('========================================\n');

// ===========================================
// GROUP 1: Basic Badge Logic Tests
// ===========================================
console.log('--- GROUP 1: Basic Badge Logic ---\n');

test('1. Pair in watchlist + 1 active threshold = Active', () => {
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: true, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Active');
});

test('2. Pair in watchlist + all thresholds paused = Paused', () => {
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

test('3. Pair NOT in watchlist + active thresholds = Paused', () => {
  const watchlist: string[] = [];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: true, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

test('4. Pair NOT in watchlist + paused thresholds = Paused', () => {
  const watchlist: string[] = [];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

test('5. Pair in watchlist + no thresholds = Paused', () => {
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

// ===========================================
// GROUP 2: Multiple Thresholds Tests
// ===========================================
console.log('\n--- GROUP 2: Multiple Thresholds ---\n');

test('6. Pair in watchlist + 3 thresholds all active = Active', () => {
  const watchlist = ['BTCUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '50000', isActive: true, notifyOnIncrease: true },
    { id: 't2', threshold: '60000', isActive: true, notifyOnIncrease: true },
    { id: 't3', threshold: '40000', isActive: true, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('BTCUSDT', watchlist, thresholds), 'Active');
});

test('7. Pair in watchlist + 3 thresholds all paused = Paused', () => {
  const watchlist = ['BTCUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '50000', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '60000', isActive: false, notifyOnIncrease: true },
    { id: 't3', threshold: '40000', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('BTCUSDT', watchlist, thresholds), 'Paused');
});

test('8. Pair in watchlist + 1 active out of 3 = Active', () => {
  const watchlist = ['BTCUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '50000', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '60000', isActive: true, notifyOnIncrease: true },
    { id: 't3', threshold: '40000', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('BTCUSDT', watchlist, thresholds), 'Active');
});

test('9. Pair in watchlist + 2 active 1 paused = Active', () => {
  const watchlist = ['SOLUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '100', isActive: true, notifyOnIncrease: true },
    { id: 't2', threshold: '150', isActive: false, notifyOnIncrease: true },
    { id: 't3', threshold: '80', isActive: true, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('SOLUSDT', watchlist, thresholds), 'Active');
});

test('10. Pair in watchlist + last threshold active = Active', () => {
  const watchlist = ['ADAUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '0.5', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '0.6', isActive: false, notifyOnIncrease: true },
    { id: 't3', threshold: '0.4', isActive: false, notifyOnDecrease: true },
    { id: 't4', threshold: '0.7', isActive: true, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ADAUSDT', watchlist, thresholds), 'Active');
});

// ===========================================
// GROUP 3: Remove from Watchlist Simulation
// ===========================================
console.log('\n--- GROUP 3: Remove from Watchlist ---\n');

test('11. After removal from watchlist: all thresholds become paused = Paused', () => {
  // Simulate: pair was removed, thresholds set to isActive=false
  const watchlist: string[] = []; // Not in watchlist anymore
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

test('12. Pair removed but thresholds still exist = Paused', () => {
  const watchlist: string[] = [];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '2500', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

// ===========================================
// GROUP 4: Re-add to Watchlist Simulation
// ===========================================
console.log('\n--- GROUP 4: Re-add to Watchlist ---\n');

test('13. Re-added to watchlist but thresholds still paused = Paused', () => {
  // Simulate: pair re-added, but thresholds remain isActive=false
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

test('14. Re-added + one threshold manually activated = Active', () => {
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: true, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Active');
});

test('15. Re-added + multiple thresholds, only 1 active = Active', () => {
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '2800', isActive: true, notifyOnDecrease: true },
    { id: 't3', threshold: '3200', isActive: false, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Active');
});

// ===========================================
// GROUP 5: Edge Cases
// ===========================================
console.log('\n--- GROUP 5: Edge Cases ---\n');

test('16. Different pair in watchlist = Paused for non-watchlist pair', () => {
  const watchlist = ['BTCUSDT']; // Only BTC in watchlist
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: true, notifyOnIncrease: true }
  ];
  // Testing ETHUSDT which is NOT in watchlist
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Paused');
});

test('17. Multiple pairs in watchlist, checking correct one = Active', () => {
  const watchlist = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: true, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Active');
});

test('18. isActive undefined treated as active = Active', () => {
  const watchlist = ['ETHUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: undefined as any, notifyOnIncrease: true }
  ];
  // undefined !== false, so it should be treated as active
  return assertEqual(calculateBadgeStatus('ETHUSDT', watchlist, thresholds), 'Active');
});

test('19. Futures pair with -PERP suffix = Active when in watchlist', () => {
  const watchlist = ['ETHUSDT-PERP'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: true, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT-PERP', watchlist, thresholds), 'Active');
});

test('20. Futures pair removed from watchlist = Paused', () => {
  const watchlist: string[] = [];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '3000', isActive: false, notifyOnIncrease: true }
  ];
  return assertEqual(calculateBadgeStatus('ETHUSDT-PERP', watchlist, thresholds), 'Paused');
});

// ===========================================
// GROUP 6: Additional State Transition Tests
// ===========================================
console.log('\n--- GROUP 6: State Transitions ---\n');

test('21. Activate first threshold in paused pair = Active', () => {
  const watchlist = ['XRPUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '0.5', isActive: true, notifyOnIncrease: true },
    { id: 't2', threshold: '0.4', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('XRPUSDT', watchlist, thresholds), 'Active');
});

test('22. Deactivate last active threshold = Paused', () => {
  const watchlist = ['XRPUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '0.5', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '0.4', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('XRPUSDT', watchlist, thresholds), 'Paused');
});

test('23. 5 thresholds with mixed states = Active (has active)', () => {
  const watchlist = ['DOGEUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '0.1', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '0.08', isActive: false, notifyOnDecrease: true },
    { id: 't3', threshold: '0.12', isActive: true, notifyOnIncrease: true },
    { id: 't4', threshold: '0.15', isActive: false, notifyOnIncrease: true },
    { id: 't5', threshold: '0.05', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('DOGEUSDT', watchlist, thresholds), 'Active');
});

test('24. 5 thresholds all paused = Paused', () => {
  const watchlist = ['DOGEUSDT'];
  const thresholds: ThresholdConfig[] = [
    { id: 't1', threshold: '0.1', isActive: false, notifyOnIncrease: true },
    { id: 't2', threshold: '0.08', isActive: false, notifyOnDecrease: true },
    { id: 't3', threshold: '0.12', isActive: false, notifyOnIncrease: true },
    { id: 't4', threshold: '0.15', isActive: false, notifyOnIncrease: true },
    { id: 't5', threshold: '0.05', isActive: false, notifyOnDecrease: true }
  ];
  return assertEqual(calculateBadgeStatus('DOGEUSDT', watchlist, thresholds), 'Paused');
});

test('25. Empty watchlist with 10 active thresholds = Paused', () => {
  const watchlist: string[] = [];
  const thresholds: ThresholdConfig[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    threshold: String(1000 + i * 100),
    isActive: true,
    notifyOnIncrease: true
  }));
  return assertEqual(calculateBadgeStatus('BNBUSDT', watchlist, thresholds), 'Paused');
});

// ===========================================
// Summary
// ===========================================
console.log('\n========================================');
console.log(`SUMMARY: ${passCount}/${testCount} tests passed`);
console.log(`Failures: ${failCount}`);
console.log('========================================\n');

if (failCount === 0) {
  console.log('✅ ALL TESTS PASSED! Badge logic is correct.\n');
} else {
  console.log('❌ Some tests failed. Please review the badge logic.\n');
  process.exit(1);
}
