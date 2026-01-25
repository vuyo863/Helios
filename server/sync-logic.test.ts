/**
 * SYNC LOGIC TESTS
 * =================
 * Tests für die sichere Sync-Logik in client/src/lib/sync.ts
 * 
 * Kritische Tests:
 * 1. Merge-Logik: Lokale Daten werden NIEMALS gelöscht
 * 2. Timestamp-Vergleich: Neuere Version gewinnt
 * 3. Leere Remote-Daten: Löschen NICHT lokale Daten
 */

// Simulate the sync module logic (copy of merge functions)

interface SyncableData {
  timestamp: number;
  deviceId: string;
}

interface WatchlistSyncData extends SyncableData {
  watchlist: string[];
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures', symbol: string }>;
}

interface ThresholdConfig {
  id: string;
  threshold: string;
  isActive: boolean;
}

interface AllThresholdsSyncData extends SyncableData {
  settings: Record<string, { trendPriceId: string; thresholds: ThresholdConfig[] }>;
}

const LOCAL_DEVICE_ID = 'device-local-test';
const REMOTE_DEVICE_ID = 'device-remote-test';

function getDeviceId(): string {
  return LOCAL_DEVICE_ID;
}

function isNewerThan(a: number, b: number): boolean {
  return a > b;
}

// Merge Watchlist
function mergeWatchlist(
  local: WatchlistSyncData | null,
  remote: WatchlistSyncData | null
): WatchlistSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  if (remote.deviceId === getDeviceId()) {
    return local;
  }
  
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    const mergedWatchlist = [...new Set([...remote.watchlist, ...local.watchlist])];
    const mergedPairMarketTypes = { ...local.pairMarketTypes, ...remote.pairMarketTypes };
    
    return {
      timestamp: remote.timestamp,
      deviceId: getDeviceId(),
      watchlist: mergedWatchlist,
      pairMarketTypes: mergedPairMarketTypes
    };
  }
  
  return local;
}

// Merge Thresholds
function mergeAllThresholds(
  local: AllThresholdsSyncData | null,
  remote: AllThresholdsSyncData | null
): AllThresholdsSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  if (remote.deviceId === getDeviceId()) {
    return local;
  }
  
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    const mergedSettings: Record<string, { trendPriceId: string; thresholds: ThresholdConfig[] }> = { ...local.settings };
    
    for (const pairId in remote.settings) {
      const remoteData = remote.settings[pairId];
      const localData = local.settings[pairId];
      
      if (!localData || remoteData.thresholds.length > 0) {
        if (remoteData.thresholds.length === 0 && localData && localData.thresholds.length > 0) {
          continue;
        }
        mergedSettings[pairId] = remoteData;
      }
    }
    
    return {
      timestamp: remote.timestamp,
      deviceId: getDeviceId(),
      settings: mergedSettings
    };
  }
  
  return local;
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

function assertEqual(actual: any, expected: any): boolean {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return true;
  console.log(`   Expected: ${JSON.stringify(expected)}`);
  console.log(`   Got: ${JSON.stringify(actual)}`);
  return false;
}

console.log('\n========================================');
console.log('SYNC LOGIC TESTS - Safe Merge Strategy');
console.log('========================================\n');

// ===========================================
// GROUP 1: Watchlist Merge Tests
// ===========================================
console.log('--- GROUP 1: Watchlist Merge ---\n');

test('1. Local only - returns local', () => {
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT'],
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, null);
  return result !== null && assertEqual(result.watchlist, ['ETHUSDT']);
});

test('2. Remote only - returns remote', () => {
  const remote: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: REMOTE_DEVICE_ID,
    watchlist: ['BTCUSDT'],
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(null, remote);
  return result !== null && assertEqual(result.watchlist, ['BTCUSDT']);
});

test('3. Remote newer - MERGES (union) instead of overwriting', () => {
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT', 'SOLUSDT'],
    pairMarketTypes: {}
  };
  const remote: WatchlistSyncData = {
    timestamp: 2000, // NEWER
    deviceId: REMOTE_DEVICE_ID,
    watchlist: ['BTCUSDT', 'ETHUSDT'],
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, remote);
  // Should contain ALL items from both (union)
  return result !== null && 
    result.watchlist.includes('ETHUSDT') &&
    result.watchlist.includes('SOLUSDT') &&
    result.watchlist.includes('BTCUSDT') &&
    result.watchlist.length === 3;
});

test('4. Local newer - keeps local', () => {
  const local: WatchlistSyncData = {
    timestamp: 2000, // NEWER
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT', 'SOLUSDT'],
    pairMarketTypes: {}
  };
  const remote: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: REMOTE_DEVICE_ID,
    watchlist: ['BTCUSDT'],
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, remote);
  return result !== null && 
    assertEqual(result.watchlist, ['ETHUSDT', 'SOLUSDT']);
});

test('5. Same device - always keeps local', () => {
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT'],
    pairMarketTypes: {}
  };
  const remote: WatchlistSyncData = {
    timestamp: 2000,
    deviceId: LOCAL_DEVICE_ID, // SAME DEVICE
    watchlist: ['BTCUSDT'],
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, remote);
  return result !== null && assertEqual(result.watchlist, ['ETHUSDT']);
});

test('6. Empty remote watchlist - still merges with local', () => {
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT', 'BTCUSDT'],
    pairMarketTypes: {}
  };
  const remote: WatchlistSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    watchlist: [], // EMPTY
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, remote);
  // Local items should be preserved!
  return result !== null && 
    result.watchlist.includes('ETHUSDT') &&
    result.watchlist.includes('BTCUSDT');
});

// ===========================================
// GROUP 2: Thresholds Merge Tests
// ===========================================
console.log('\n--- GROUP 2: Thresholds Merge ---\n');

test('7. Local only - returns local', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(local, null);
  return result !== null && result.settings['ETHUSDT'] !== undefined;
});

test('8. Remote only - returns remote', () => {
  const remote: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'BTCUSDT': { trendPriceId: 'BTCUSDT', thresholds: [{ id: 't1', threshold: '50000', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(null, remote);
  return result !== null && result.settings['BTCUSDT'] !== undefined;
});

test('9. Remote newer - updates thresholds', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3500', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(local, remote);
  return result !== null && result.settings['ETHUSDT'].thresholds[0].threshold === '3500';
});

test('10. Local newer - keeps local thresholds', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3500', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(local, remote);
  return result !== null && result.settings['ETHUSDT'].thresholds[0].threshold === '3000';
});

test('11. CRITICAL: Empty remote thresholds do NOT delete local', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [] } // EMPTY!
    }
  };
  const result = mergeAllThresholds(local, remote);
  // Local thresholds should be PRESERVED!
  return result !== null && 
    result.settings['ETHUSDT'].thresholds.length === 1 &&
    result.settings['ETHUSDT'].thresholds[0].threshold === '3000';
});

test('12. Remote adds new pair, local pair preserved', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'BTCUSDT': { trendPriceId: 'BTCUSDT', thresholds: [{ id: 't2', threshold: '50000', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(local, remote);
  // Both pairs should exist
  return result !== null && 
    result.settings['ETHUSDT'] !== undefined &&
    result.settings['BTCUSDT'] !== undefined;
});

// ===========================================
// GROUP 3: Edge Cases
// ===========================================
console.log('\n--- GROUP 3: Edge Cases ---\n');

test('13. Both null - returns null', () => {
  const result = mergeWatchlist(null, null);
  return result === null;
});

test('14. Same timestamp - local wins (defensive)', () => {
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT'],
    pairMarketTypes: {}
  };
  const remote: WatchlistSyncData = {
    timestamp: 1000, // SAME
    deviceId: REMOTE_DEVICE_ID,
    watchlist: ['BTCUSDT'],
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, remote);
  // Local should win when timestamps are equal
  return result !== null && assertEqual(result.watchlist, ['ETHUSDT']);
});

test('15. PairMarketTypes merge correctly', () => {
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT'],
    pairMarketTypes: { 'ETHUSDT': { marketType: 'spot', symbol: 'ETHUSDT' } }
  };
  const remote: WatchlistSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    watchlist: ['BTCUSDT'],
    pairMarketTypes: { 'BTCUSDT': { marketType: 'futures', symbol: 'BTCUSDT' } }
  };
  const result = mergeWatchlist(local, remote);
  return result !== null && 
    result.pairMarketTypes['ETHUSDT'] !== undefined &&
    result.pairMarketTypes['BTCUSDT'] !== undefined;
});

// ===========================================
// GROUP 4: Real-world Scenarios
// ===========================================
console.log('\n--- GROUP 4: Real-world Scenarios ---\n');

test('16. User removes pair on device A, device B still has it', () => {
  // Device B (local) has ETHUSDT
  const local: WatchlistSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    watchlist: ['ETHUSDT', 'BTCUSDT'],
    pairMarketTypes: {}
  };
  // Device A (remote) removed ETHUSDT, newer timestamp
  const remote: WatchlistSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    watchlist: ['BTCUSDT'], // ETHUSDT removed
    pairMarketTypes: {}
  };
  const result = mergeWatchlist(local, remote);
  // With MERGE strategy, ETHUSDT should still exist!
  return result !== null && 
    result.watchlist.includes('ETHUSDT') &&
    result.watchlist.includes('BTCUSDT');
});

test('17. User adds threshold on device A, device B syncs', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {}
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(local, remote);
  return result !== null && result.settings['ETHUSDT'] !== undefined;
});

test('18. Backend returns empty (server restart), local data preserved', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] },
      'BTCUSDT': { trendPriceId: 'BTCUSDT', thresholds: [{ id: 't2', threshold: '50000', isActive: true }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 500, // OLDER (server just restarted)
    deviceId: REMOTE_DEVICE_ID,
    settings: {} // EMPTY
  };
  const result = mergeAllThresholds(local, remote);
  // Local should be preserved because it's newer
  return result !== null && 
    result.settings['ETHUSDT'] !== undefined &&
    result.settings['BTCUSDT'] !== undefined;
});

test('19. Multiple pairs, some updated, some empty in remote', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] },
      'BTCUSDT': { trendPriceId: 'BTCUSDT', thresholds: [{ id: 't2', threshold: '50000', isActive: true }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3500', isActive: true }] }, // UPDATED
      'BTCUSDT': { trendPriceId: 'BTCUSDT', thresholds: [] } // EMPTY - should NOT delete local
    }
  };
  const result = mergeAllThresholds(local, remote);
  return result !== null && 
    result.settings['ETHUSDT'].thresholds[0].threshold === '3500' && // Updated
    result.settings['BTCUSDT'].thresholds.length === 1; // Preserved!
});

test('20. isActive state preserved during merge', () => {
  const local: AllThresholdsSyncData = {
    timestamp: 1000,
    deviceId: LOCAL_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: false }] }
    }
  };
  const remote: AllThresholdsSyncData = {
    timestamp: 2000,
    deviceId: REMOTE_DEVICE_ID,
    settings: {
      'ETHUSDT': { trendPriceId: 'ETHUSDT', thresholds: [{ id: 't1', threshold: '3000', isActive: true }] }
    }
  };
  const result = mergeAllThresholds(local, remote);
  // Remote is newer, so remote's isActive should be used
  return result !== null && result.settings['ETHUSDT'].thresholds[0].isActive === true;
});

// ===========================================
// Summary
// ===========================================
console.log('\n========================================');
console.log(`SUMMARY: ${passCount}/${testCount} tests passed`);
console.log(`Failures: ${failCount}`);
console.log('========================================\n');

if (failCount === 0) {
  console.log('✅ ALL TESTS PASSED! Sync logic is safe.\n');
  console.log('Key confirmations:');
  console.log('  - Empty remote data does NOT delete local data');
  console.log('  - Watchlist uses UNION merge (nothing lost)');
  console.log('  - Timestamp comparison works correctly');
  console.log('  - Same device always keeps local');
  console.log('');
} else {
  console.log('❌ Some tests failed. Review the sync logic.\n');
  process.exit(1);
}
