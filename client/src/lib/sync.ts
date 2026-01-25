/**
 * SYNC MODULE - SEPARATE ENTWICKLUNG
 * ===================================
 * Erstellt: 25.01.2026 ~23:00 Uhr
 * 
 * WICHTIG: Diese Datei ist SEPARAT von notifications.tsx
 * Der perfekte Code in notifications.tsx wird NICHT modifiziert!
 * 
 * Sync-Strategie:
 * - localStorage bleibt Master für lokale Änderungen
 * - Backend nur für Cross-Device Sync (Lesen von anderen Geräten)
 * - Timestamp bei jeder Änderung → neuere Version gewinnt
 * - Merge statt Überschreiben → keine Daten gehen verloren
 * - Polling alle 3-5 Sekunden
 */

// ===========================================
// TYPES
// ===========================================

export interface SyncableData {
  timestamp: number;
  deviceId: string;
}

export interface WatchlistSyncData extends SyncableData {
  watchlist: string[];
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures', symbol: string }>;
}

export interface ThresholdSyncData extends SyncableData {
  trendPriceId: string;
  thresholds: any[]; // ThresholdConfig[]
}

export interface AlarmLevelSyncData extends SyncableData {
  configs: Record<string, any>; // Record<AlarmLevel, AlarmLevelConfig>
}

// ===========================================
// DEVICE ID - Unique identifier for this device
// ===========================================

const DEVICE_ID_KEY = 'sync-device-id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ===========================================
// TIMESTAMP UTILITIES
// ===========================================

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function isNewerThan(timestampA: number, timestampB: number): boolean {
  return timestampA > timestampB;
}

// ===========================================
// MERGE STRATEGIES
// ===========================================

/**
 * Merge watchlist data - newer wins, but preserve local additions
 */
export function mergeWatchlist(
  local: WatchlistSyncData | null,
  remote: WatchlistSyncData | null
): WatchlistSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  // If same device, always use local
  if (remote.deviceId === getDeviceId()) {
    return local;
  }
  
  // Remote is newer - use remote but merge additions
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    // Merge: keep local additions that remote doesn't have
    const mergedWatchlist = [...new Set([...remote.watchlist, ...local.watchlist])];
    const mergedPairMarketTypes = { ...remote.pairMarketTypes, ...local.pairMarketTypes };
    
    return {
      timestamp: remote.timestamp,
      deviceId: getDeviceId(),
      watchlist: mergedWatchlist,
      pairMarketTypes: mergedPairMarketTypes
    };
  }
  
  // Local is newer - keep local
  return local;
}

/**
 * Merge threshold data - newer wins per threshold
 */
export function mergeThresholds(
  local: ThresholdSyncData | null,
  remote: ThresholdSyncData | null
): ThresholdSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  // If same device, always use local
  if (remote.deviceId === getDeviceId()) {
    return local;
  }
  
  // Remote is newer - use remote data
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    return {
      ...remote,
      deviceId: getDeviceId()
    };
  }
  
  // Local is newer - keep local
  return local;
}

/**
 * Merge alarm level configs - newer wins
 */
export function mergeAlarmLevelConfigs(
  local: AlarmLevelSyncData | null,
  remote: AlarmLevelSyncData | null
): AlarmLevelSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  // If same device, always use local
  if (remote.deviceId === getDeviceId()) {
    return local;
  }
  
  // Remote is newer - use remote
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    return {
      ...remote,
      deviceId: getDeviceId()
    };
  }
  
  // Local is newer - keep local
  return local;
}

// ===========================================
// SYNC STATUS
// ===========================================

export interface SyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
}

let syncStatus: SyncStatus = {
  lastSyncTime: null,
  isSyncing: false,
  error: null
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

// ===========================================
// PLACEHOLDER - Backend Sync Functions
// (Wird später implementiert)
// ===========================================

export async function syncWatchlistToBackend(data: WatchlistSyncData): Promise<boolean> {
  // TODO: POST to /api/sync/watchlist
  console.log('[SYNC] syncWatchlistToBackend - Not implemented yet', data);
  return true;
}

export async function syncWatchlistFromBackend(): Promise<WatchlistSyncData | null> {
  // TODO: GET from /api/sync/watchlist
  console.log('[SYNC] syncWatchlistFromBackend - Not implemented yet');
  return null;
}

export async function syncThresholdsToBackend(data: ThresholdSyncData): Promise<boolean> {
  // TODO: POST to /api/sync/thresholds
  console.log('[SYNC] syncThresholdsToBackend - Not implemented yet', data);
  return true;
}

export async function syncThresholdsFromBackend(trendPriceId: string): Promise<ThresholdSyncData | null> {
  // TODO: GET from /api/sync/thresholds/:trendPriceId
  console.log('[SYNC] syncThresholdsFromBackend - Not implemented yet', trendPriceId);
  return null;
}

export async function syncAlarmLevelsToBackend(data: AlarmLevelSyncData): Promise<boolean> {
  // TODO: POST to /api/sync/alarm-levels
  console.log('[SYNC] syncAlarmLevelsToBackend - Not implemented yet', data);
  return true;
}

export async function syncAlarmLevelsFromBackend(): Promise<AlarmLevelSyncData | null> {
  // TODO: GET from /api/sync/alarm-levels
  console.log('[SYNC] syncAlarmLevelsFromBackend - Not implemented yet');
  return null;
}

// ===========================================
// SYNC MANAGER (Polling)
// ===========================================

let syncInterval: NodeJS.Timeout | null = null;

export function startSyncPolling(intervalMs: number = 3500): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  console.log(`[SYNC] Starting sync polling every ${intervalMs}ms`);
  
  syncInterval = setInterval(async () => {
    try {
      syncStatus.isSyncing = true;
      
      // TODO: Implement actual sync logic here
      // 1. Fetch remote data
      // 2. Merge with local data
      // 3. Update localStorage if needed
      // 4. Push local changes if newer
      
      syncStatus.lastSyncTime = Date.now();
      syncStatus.error = null;
    } catch (error) {
      syncStatus.error = String(error);
      console.error('[SYNC] Error:', error);
    } finally {
      syncStatus.isSyncing = false;
    }
  }, intervalMs);
}

export function stopSyncPolling(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[SYNC] Stopped sync polling');
  }
}

// ===========================================
// EXPORTS SUMMARY
// ===========================================
// 
// Diese Datei enthält:
// - getDeviceId() - Eindeutige Geräte-ID
// - mergeWatchlist() - Merge-Strategie für Watchlist
// - mergeThresholds() - Merge-Strategie für Schwellenwerte
// - mergeAlarmLevelConfigs() - Merge-Strategie für Alarm-Level
// - syncXxxToBackend() - Placeholder für Backend-Sync (Push)
// - syncXxxFromBackend() - Placeholder für Backend-Sync (Pull)
// - startSyncPolling() / stopSyncPolling() - Polling-Manager
//
// NÄCHSTE SCHRITTE:
// 1. Backend-API-Routen erstellen
// 2. Sync-Funktionen implementieren
// 3. Tests erstellen
// 4. In notifications.tsx integrieren (NUR nach Tests!)
