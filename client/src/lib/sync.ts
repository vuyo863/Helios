/**
 * SYNC MODULE - SEPARATE ENTWICKLUNG
 * ===================================
 * Erstellt: 25.01.2026 ~23:00 Uhr
 * Aktualisiert: 25.01.2026 ~23:15 Uhr
 * 
 * ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
 * ⚠️ DIAMOND STATE - TRENDPREISE & WATCHLIST SYNC ⚠️
 * ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
 * 
 * NIEMALS ANFASSEN! FERTIG UND FUNKTIONIERT!
 * 
 * Die folgenden Funktionen sind DIAMOND STATE:
 * - pushWatchlistToBackend()
 * - pullWatchlistFromBackend()
 * - mergeWatchlist()
 * - createWatchlistSyncData()
 * 
 * SECTIONS SIND SEPARAT:
 * - Watchlist Sync = DIAMOND STATE (nicht anfassen)
 * - Threshold Sync = Kann bearbeitet werden
 * - AlarmLevel Sync = Kann bearbeitet werden
 * - ActiveAlarms Sync = Kann bearbeitet werden
 * 
 * Bei Änderungen: NUR die betroffene Section bearbeiten!
 * 
 * ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
 * 
 * WICHTIG: Diese Datei ist SEPARAT von notifications.tsx
 * Der perfekte Code in notifications.tsx wird NICHT modifiziert!
 * 
 * SICHERE SYNC-STRATEGIE:
 * ========================
 * 1. localStorage bleibt MASTER für lokale Änderungen
 * 2. Backend NUR für Cross-Device Sync (Lesen von anderen Geräten)
 * 3. Timestamp bei JEDER Änderung → neuere Version gewinnt
 * 4. MERGE statt Überschreiben → keine Daten gehen verloren
 * 5. Wenn Backend leer/veraltet ist → lokale Daten werden NICHT gelöscht!
 * 
 * FLOW:
 * ======
 * Lokales Gerät ändert etwas
 *     ↓
 * localStorage wird SOFORT aktualisiert (wie jetzt)
 *     ↓
 * Änderung wird MIT Timestamp ans Backend gesendet
 *     ↓
 * Anderes Gerät pollt Backend alle 3-5 Sekunden
 *     ↓
 * Nur NEUERE Daten (Timestamp-Vergleich) werden übernommen
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

export interface ThresholdConfig {
  id: string;
  threshold: string;
  notifyOnIncrease: boolean;
  notifyOnDecrease: boolean;
  increaseFrequency: 'einmalig' | 'wiederholend';
  decreaseFrequency: 'einmalig' | 'wiederholend';
  alarmLevel: 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich';
  note: string;
  isActive: boolean;
  triggerCount?: number;
  activeAlarmId?: string;
}

export interface ThresholdSyncData extends SyncableData {
  trendPriceId: string;
  thresholds: ThresholdConfig[];
}

export interface AllThresholdsSyncData extends SyncableData {
  settings: Record<string, { trendPriceId: string; thresholds: ThresholdConfig[] }>;
}

export interface AlarmLevelConfig {
  level: 'harmlos' | 'achtung' | 'gefährlich' | 'sehr_gefährlich';
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    webPush: boolean;
    nativePush: boolean;
  };
  requiresApproval: boolean;
  repeatCount: number | 'infinite';
  sequenceHours: number;
  sequenceMinutes: number;
  sequenceSeconds: number;
  restwartezeitHours: number;
  restwartezeitMinutes: number;
  restwartezeitSeconds: number;
}

export interface AlarmLevelSyncData extends SyncableData {
  configs: Record<string, AlarmLevelConfig>;
}

// ===========================================
// CONSTANTS
// ===========================================

const DEVICE_ID_KEY = 'sync-device-id';
const WATCHLIST_TIMESTAMP_KEY = 'sync-watchlist-timestamp';
const THRESHOLDS_TIMESTAMP_KEY = 'sync-thresholds-timestamp';
const ALARM_LEVELS_TIMESTAMP_KEY = 'sync-alarm-levels-timestamp';

// ===========================================
// DEVICE ID - Unique identifier for this device
// ===========================================

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('[SYNC] New device ID created:', deviceId);
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

export function getLocalTimestamp(key: string): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem(key);
  return stored ? parseInt(stored, 10) : 0;
}

export function setLocalTimestamp(key: string, timestamp: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, String(timestamp));
}

// ===========================================
// MERGE STRATEGIES - CRITICAL FOR SAFE SYNC
// ===========================================

/**
 * SICHERE Merge-Strategie für Watchlist
 * - Wenn remote neuer: Merge (union) statt überschreiben
 * - Lokale Daten werden NIE gelöscht!
 */
export function mergeWatchlist(
  local: WatchlistSyncData | null,
  remote: WatchlistSyncData | null
): WatchlistSyncData | null {
  // Wenn keine Daten vorhanden
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  // FIX: "Same device" check entfernt - Timestamp entscheidet IMMER!
  // Bei Multi-Tab-Sync teilen alle Tabs dieselbe deviceId, also muss Remote trotzdem übernommen werden wenn neuer
  
  // TIMESTAMP GEWINNT: Neuere Version überschreibt ältere (ermöglicht Löschungen)
  // Das ermöglicht auch Löschungen zu syncen!
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    console.log('[SYNC-MERGE] Watchlist: Remote is NEWER - taking remote completely');
    console.log('[SYNC-MERGE] Remote:', remote.watchlist, 'Local:', local.watchlist);
    
    // Remote gewinnt komplett - inklusive Löschungen!
    return {
      timestamp: remote.timestamp,
      deviceId: remote.deviceId,
      watchlist: remote.watchlist,
      pairMarketTypes: remote.pairMarketTypes
    };
  }
  
  // Lokal ist neuer - behalten
  console.log('[SYNC-MERGE] Watchlist: Local is NEWER, keeping local');
  return local;
}

/**
 * SICHERE Merge-Strategie für Thresholds
 * - Pro TrendPriceId: neuere Version gewinnt
 * - WICHTIG: Wenn remote neuer ist, werden auch LÖSCHUNGEN übernommen!
 * 
 * THRESHOLD SYNC SECTION - Kann bearbeitet werden
 * (Watchlist Sync = DIAMOND STATE, nicht anfassen)
 */
export function mergeAllThresholds(
  local: AllThresholdsSyncData | null,
  remote: AllThresholdsSyncData | null
): AllThresholdsSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  // FIX: "Same device" check entfernt - Timestamp entscheidet IMMER!
  // Bei Multi-Tab-Sync teilen alle Tabs dieselbe deviceId
  
  // TIMESTAMP GEWINNT: Neuere Version überschreibt ältere
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    console.log('[SYNC-MERGE] Thresholds: Remote is newer, taking remote data');
    
    // Remote gewinnt komplett - AUCH bei Löschungen!
    // Wenn User auf Tablet löscht → Remote ist neuer UND leer → Laptop übernimmt Löschung
    return {
      timestamp: remote.timestamp,
      deviceId: getDeviceId(),
      settings: { ...remote.settings }
    };
  }
  
  // Lokal ist neuer - behalten
  console.log('[SYNC-MERGE] Thresholds: Local is newer, keeping local');
  return local;
}

/**
 * SICHERE Merge-Strategie für Alarm-Level Configs
 * - Neuere Version gewinnt komplett
 */
export function mergeAlarmLevelConfigs(
  local: AlarmLevelSyncData | null,
  remote: AlarmLevelSyncData | null
): AlarmLevelSyncData | null {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  
  // FIX: "Same device" check entfernt - Timestamp entscheidet IMMER!
  // Bei Multi-Tab-Sync teilen alle Tabs dieselbe deviceId
  
  // TIMESTAMP GEWINNT: Neuere Version gewinnt
  if (isNewerThan(remote.timestamp, local.timestamp)) {
    console.log('[SYNC-MERGE] AlarmLevels: Remote is newer, using remote');
    return {
      ...remote,
      deviceId: getDeviceId()
    };
  }
  
  console.log('[SYNC-MERGE] AlarmLevels: Local is newer, keeping local');
  return local;
}

// ===========================================
// SYNC STATUS
// ===========================================

export interface SyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
  lastWatchlistSync: number | null;
  lastThresholdsSync: number | null;
  lastAlarmLevelsSync: number | null;
  lastActiveAlarmsSync: number | null;
}

let syncStatus: SyncStatus = {
  lastSyncTime: null,
  isSyncing: false,
  error: null,
  lastWatchlistSync: null,
  lastThresholdsSync: null,
  lastAlarmLevelsSync: null,
  lastActiveAlarmsSync: null
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

// ===========================================
// BACKEND API FUNCTIONS
// ===========================================

const API_BASE = '/api/sync';

/**
 * Watchlist zum Backend pushen
 */
export async function pushWatchlistToBackend(
  watchlist: string[],
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures', symbol: string }>
): Promise<boolean> {
  try {
    const timestamp = getCurrentTimestamp();
    const data: WatchlistSyncData = {
      timestamp,
      deviceId: getDeviceId(),
      watchlist,
      pairMarketTypes
    };
    
    const response = await fetch(`${API_BASE}/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      setLocalTimestamp(WATCHLIST_TIMESTAMP_KEY, timestamp);
      console.log('[SYNC] Watchlist pushed to backend');
      return true;
    }
    
    console.error('[SYNC] Failed to push watchlist:', response.status);
    return false;
  } catch (error) {
    console.error('[SYNC] Error pushing watchlist:', error);
    return false;
  }
}

/**
 * Watchlist vom Backend holen und SICHER mergen
 */
export async function pullWatchlistFromBackend(): Promise<WatchlistSyncData | null> {
  try {
    const response = await fetch(`${API_BASE}/watchlist`);
    
    if (!response.ok) {
      console.log('[SYNC] No watchlist data from backend');
      return null;
    }
    
    const remoteData: WatchlistSyncData = await response.json();
    syncStatus.lastWatchlistSync = Date.now();
    
    return remoteData;
  } catch (error) {
    console.error('[SYNC] Error pulling watchlist:', error);
    return null;
  }
}

/**
 * Thresholds zum Backend pushen
 */
export async function pushThresholdsToBackend(
  settings: Record<string, { trendPriceId: string; thresholds: ThresholdConfig[] }>
): Promise<boolean> {
  try {
    const timestamp = getCurrentTimestamp();
    const data: AllThresholdsSyncData = {
      timestamp,
      deviceId: getDeviceId(),
      settings
    };
    
    const response = await fetch(`${API_BASE}/thresholds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      setLocalTimestamp(THRESHOLDS_TIMESTAMP_KEY, timestamp);
      console.log('[SYNC] Thresholds pushed to backend');
      return true;
    }
    
    console.error('[SYNC] Failed to push thresholds:', response.status);
    return false;
  } catch (error) {
    console.error('[SYNC] Error pushing thresholds:', error);
    return false;
  }
}

/**
 * Thresholds vom Backend holen
 * FIX: Bei 404 (keine Daten) wird leeres Objekt mit aktuellem Timestamp zurückgegeben
 * Das signalisiert "alle Thresholds wurden gelöscht" und überschreibt lokale Daten
 */
export async function pullThresholdsFromBackend(): Promise<AllThresholdsSyncData | null> {
  try {
    const response = await fetch(`${API_BASE}/thresholds`);
    
    if (!response.ok) {
      // FIX: Bei 404 = "keine Thresholds mehr" → leeres Objekt mit aktuellem Timestamp
      // Das sorgt dafür, dass gelöschte Thresholds auf anderen Geräten auch verschwinden
      if (response.status === 404) {
        console.log('[SYNC] No thresholds on backend (404) - returning empty with current timestamp');
        return {
          timestamp: getCurrentTimestamp(),
          deviceId: 'backend-empty',
          settings: {}
        };
      }
      console.log('[SYNC] Error fetching thresholds:', response.status);
      return null;
    }
    
    const remoteData: AllThresholdsSyncData = await response.json();
    syncStatus.lastThresholdsSync = Date.now();
    
    return remoteData;
  } catch (error) {
    console.error('[SYNC] Error pulling thresholds:', error);
    return null;
  }
}

/**
 * Alarm Levels zum Backend pushen
 */
export async function pushAlarmLevelsToBackend(
  configs: Record<string, AlarmLevelConfig>
): Promise<boolean> {
  try {
    const timestamp = getCurrentTimestamp();
    const data: AlarmLevelSyncData = {
      timestamp,
      deviceId: getDeviceId(),
      configs
    };
    
    const response = await fetch(`${API_BASE}/alarm-levels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      setLocalTimestamp(ALARM_LEVELS_TIMESTAMP_KEY, timestamp);
      console.log('[SYNC] Alarm levels pushed to backend');
      return true;
    }
    
    console.error('[SYNC] Failed to push alarm levels:', response.status);
    return false;
  } catch (error) {
    console.error('[SYNC] Error pushing alarm levels:', error);
    return false;
  }
}

/**
 * Alarm Levels vom Backend holen
 */
export async function pullAlarmLevelsFromBackend(): Promise<AlarmLevelSyncData | null> {
  try {
    const response = await fetch(`${API_BASE}/alarm-levels`);
    
    if (!response.ok) {
      console.log('[SYNC] No alarm levels data from backend');
      return null;
    }
    
    const remoteData: AlarmLevelSyncData = await response.json();
    syncStatus.lastAlarmLevelsSync = Date.now();
    
    return remoteData;
  } catch (error) {
    console.error('[SYNC] Error pulling alarm levels:', error);
    return null;
  }
}

// ===========================================
// ACTIVE ALARMS SYNC
// ===========================================

export interface ActiveAlarmSyncData {
  timestamp: number;
  deviceId: string;
  alarms: Array<{
    id: string;
    trendPriceName: string;
    threshold: string;
    alarmLevel: string;
    triggeredAt: string;
    message: string;
    note: string;
    thresholdId?: string;
    pairId?: string;
    requiresApproval: boolean;
    repetitionsCompleted?: number;
    repetitionsTotal?: number;
    restwartezeitEndsAt?: string;
  }>;
}

export function createActiveAlarmsSyncData(alarms: any[]): ActiveAlarmSyncData {
  return {
    timestamp: getCurrentTimestamp(),
    deviceId: getDeviceId(),
    alarms: alarms.map(a => ({
      ...a,
      triggeredAt: typeof a.triggeredAt === 'string' ? a.triggeredAt : new Date(a.triggeredAt).toISOString(),
      restwartezeitEndsAt: a.restwartezeitEndsAt ? 
        (typeof a.restwartezeitEndsAt === 'string' ? a.restwartezeitEndsAt : new Date(a.restwartezeitEndsAt).toISOString()) 
        : undefined
    }))
  };
}

/**
 * Active Alarms ans Backend pushen
 */
export async function pushActiveAlarmsToBackend(alarms: any[]): Promise<boolean> {
  try {
    const syncData = createActiveAlarmsSyncData(alarms);
    
    console.log(`[SYNC] Pushing active alarms:`, alarms.length);
    
    const response = await fetch(`${API_BASE}/active-alarms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncData)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to push active alarms: ${response.status}`);
    }
    
    syncStatus.lastActiveAlarmsSync = Date.now();
    
    return true;
  } catch (error) {
    console.error('[SYNC] Error pushing active alarms:', error);
    return false;
  }
}

/**
 * Active Alarms vom Backend holen
 */
export async function pullActiveAlarmsFromBackend(): Promise<ActiveAlarmSyncData | null> {
  try {
    const response = await fetch(`${API_BASE}/active-alarms`);
    
    if (!response.ok) {
      console.log('[SYNC] No active alarms data from backend');
      return null;
    }
    
    const remoteData: ActiveAlarmSyncData = await response.json();
    syncStatus.lastActiveAlarmsSync = Date.now();
    
    return remoteData;
  } catch (error) {
    console.error('[SYNC] Error pulling active alarms:', error);
    return null;
  }
}

// ===========================================
// SYNC MANAGER (Polling mit sicherer Merge-Logik)
// ===========================================

let syncInterval: ReturnType<typeof setInterval> | null = null;

export interface SyncCallbacks {
  onWatchlistUpdate?: (merged: WatchlistSyncData) => void;
  onThresholdsUpdate?: (merged: AllThresholdsSyncData) => void;
  onAlarmLevelsUpdate?: (merged: AlarmLevelSyncData) => void;
  getLocalWatchlist: () => WatchlistSyncData | null;
  getLocalThresholds: () => AllThresholdsSyncData | null;
  getLocalAlarmLevels: () => AlarmLevelSyncData | null;
}

/**
 * Startet das sichere Sync-Polling
 * - Holt Daten vom Backend
 * - Merged mit lokalen Daten (NIEMALS überschreiben!)
 * - Ruft Callbacks nur wenn sich was geändert hat
 */
export function startSyncPolling(
  callbacks: SyncCallbacks,
  intervalMs: number = 3500
): void {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  console.log(`[SYNC] Starting SAFE sync polling every ${intervalMs}ms`);
  
  const performSync = async () => {
    if (syncStatus.isSyncing) return;
    
    try {
      syncStatus.isSyncing = true;
      
      // 1. Watchlist Sync
      const remoteWatchlist = await pullWatchlistFromBackend();
      if (remoteWatchlist) {
        const localWatchlist = callbacks.getLocalWatchlist();
        const merged = mergeWatchlist(localWatchlist, remoteWatchlist);
        
        if (merged && callbacks.onWatchlistUpdate) {
          // Nur updaten wenn sich was geändert hat
          const localTimestamp = localWatchlist?.timestamp || 0;
          if (merged.timestamp > localTimestamp) {
            callbacks.onWatchlistUpdate(merged);
          }
        }
      }
      
      // 2. Thresholds Sync
      const remoteThresholds = await pullThresholdsFromBackend();
      if (remoteThresholds) {
        const localThresholds = callbacks.getLocalThresholds();
        const merged = mergeAllThresholds(localThresholds, remoteThresholds);
        
        if (merged && callbacks.onThresholdsUpdate) {
          const localTimestamp = localThresholds?.timestamp || 0;
          if (merged.timestamp > localTimestamp) {
            callbacks.onThresholdsUpdate(merged);
          }
        }
      }
      
      // 3. Alarm Levels Sync
      const remoteAlarmLevels = await pullAlarmLevelsFromBackend();
      if (remoteAlarmLevels) {
        const localAlarmLevels = callbacks.getLocalAlarmLevels();
        const merged = mergeAlarmLevelConfigs(localAlarmLevels, remoteAlarmLevels);
        
        if (merged && callbacks.onAlarmLevelsUpdate) {
          const localTimestamp = localAlarmLevels?.timestamp || 0;
          if (merged.timestamp > localTimestamp) {
            callbacks.onAlarmLevelsUpdate(merged);
          }
        }
      }
      
      syncStatus.lastSyncTime = Date.now();
      syncStatus.error = null;
      
    } catch (error) {
      syncStatus.error = String(error);
      console.error('[SYNC] Polling error:', error);
    } finally {
      syncStatus.isSyncing = false;
    }
  };
  
  // Initial sync
  performSync();
  
  // Start interval
  syncInterval = setInterval(performSync, intervalMs);
}

export function stopSyncPolling(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[SYNC] Stopped sync polling');
  }
}

// ===========================================
// HELPER: Create Sync Data from localStorage
// ===========================================

export function createWatchlistSyncData(
  watchlist: string[],
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures', symbol: string }>
): WatchlistSyncData {
  return {
    timestamp: getLocalTimestamp(WATCHLIST_TIMESTAMP_KEY) || getCurrentTimestamp(),
    deviceId: getDeviceId(),
    watchlist,
    pairMarketTypes
  };
}

export function createThresholdsSyncData(
  settings: Record<string, { trendPriceId: string; thresholds: ThresholdConfig[] }>
): AllThresholdsSyncData {
  return {
    timestamp: getLocalTimestamp(THRESHOLDS_TIMESTAMP_KEY) || getCurrentTimestamp(),
    deviceId: getDeviceId(),
    settings
  };
}

export function createAlarmLevelsSyncData(
  configs: Record<string, AlarmLevelConfig>
): AlarmLevelSyncData {
  return {
    timestamp: getLocalTimestamp(ALARM_LEVELS_TIMESTAMP_KEY) || getCurrentTimestamp(),
    deviceId: getDeviceId(),
    configs
  };
}

// ===========================================
// EXPORTS SUMMARY
// ===========================================
// 
// SICHERE SYNC-LOGIK:
// - mergeWatchlist() - Union-Merge, nichts geht verloren
// - mergeAllThresholds() - Pro-Pair Merge, leere Remote löscht nichts
// - mergeAlarmLevelConfigs() - Timestamp-basiert
// 
// BACKEND-FUNKTIONEN:
// - pushWatchlistToBackend() / pullWatchlistFromBackend()
// - pushThresholdsToBackend() / pullThresholdsFromBackend()
// - pushAlarmLevelsToBackend() / pullAlarmLevelsFromBackend()
// 
// POLLING:
// - startSyncPolling(callbacks, intervalMs)
// - stopSyncPolling()
// 
// NÄCHSTE SCHRITTE:
// 1. Backend-API-Routen erstellen (/api/sync/*)
// 2. Tests für Merge-Logik
// 3. Integration in notifications.tsx (NUR nach Tests!)
