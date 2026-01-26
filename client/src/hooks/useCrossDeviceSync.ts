/**
 * CROSS-DEVICE SYNC HOOK
 * =======================
 * Erstellt: 25.01.2026
 * 
 * ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
 * ⚠️ DIAMOND STATE - TRENDPREISE & WATCHLIST SYNC ⚠️
 * ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
 * 
 * NIEMALS ANFASSEN! FERTIG UND FUNKTIONIERT!
 * 
 * Der Watchlist-Sync Code ist DIAMOND STATE:
 * - pushWatchlistToBackend Aufrufe
 * - pullWatchlistFromBackend Aufrufe
 * - mergeWatchlist Aufrufe
 * - setWatchlist / setPairMarketTypes Callbacks
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
 * Separater Hook für Cross-Device Sync Integration.
 * Wird in notifications.tsx eingebunden ohne Golden State zu ändern.
 * 
 * FUNKTIONSWEISE:
 * 1. Beim Mount: Daten vom Backend holen und mit localStorage mergen
 * 2. Polling alle 3.5s: Remote-Daten mit lokalen mergen
 * 3. Bei lokalen Änderungen: Daten ans Backend pushen
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  getDeviceId,
  getCurrentTimestamp,
  pushWatchlistToBackend,
  pullWatchlistFromBackend,
  pushThresholdsToBackend,
  pullThresholdsFromBackend,
  pushAlarmLevelsToBackend,
  pullAlarmLevelsFromBackend,
  pushActiveAlarmsToBackend,
  pullActiveAlarmsFromBackend,
  mergeWatchlist,
  mergeAllThresholds,
  mergeAlarmLevelConfigs,
  createWatchlistSyncData,
  createThresholdsSyncData,
  createAlarmLevelsSyncData,
  type WatchlistSyncData,
  type AllThresholdsSyncData,
  type AlarmLevelSyncData,
  type ActiveAlarmSyncData,
  type ThresholdConfig,
  type AlarmLevelConfig
} from '@/lib/sync';

interface ActiveAlarm {
  id: string;
  trendPriceName: string;
  threshold: string;
  alarmLevel: string;
  triggeredAt: Date;
  message: string;
  note: string;
  thresholdId?: string;
  pairId?: string;
  requiresApproval: boolean;
  repetitionsCompleted?: number;
  repetitionsTotal?: number;
  restwartezeitEndsAt?: Date;
}

interface UseCrossDeviceSyncProps {
  watchlist: string[];
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures'; symbol: string }>;
  trendPriceSettings: Record<string, { trendPriceId: string; thresholds: any[] }>;
  alarmLevelConfigs: Record<string, AlarmLevelConfig>;
  activeAlarms: ActiveAlarm[];
  setWatchlist: (fn: (prev: string[]) => string[]) => void;
  setPairMarketTypes: (fn: (prev: Record<string, { marketType: 'spot' | 'futures'; symbol: string }>) => Record<string, { marketType: 'spot' | 'futures'; symbol: string }>) => void;
  setTrendPriceSettings: (fn: (prev: Record<string, { trendPriceId: string; thresholds: any[] }>) => Record<string, { trendPriceId: string; thresholds: any[] }>) => void;
  setAlarmLevelConfigs: (configs: Record<string, AlarmLevelConfig>) => void;
  setActiveAlarms: (fn: (prev: ActiveAlarm[]) => ActiveAlarm[]) => void;
  editingThresholdId?: string | null;
}

export function useCrossDeviceSync({
  watchlist,
  pairMarketTypes,
  trendPriceSettings,
  alarmLevelConfigs,
  activeAlarms,
  setWatchlist,
  setPairMarketTypes,
  setTrendPriceSettings,
  setAlarmLevelConfigs,
  setActiveAlarms,
  editingThresholdId = null
}: UseCrossDeviceSyncProps) {
  const isInitialMount = useRef(true);
  const lastPushTimestamp = useRef<number>(0);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSyncComplete = useRef(false);
  
  // CRITICAL: Flag to prevent push when we just received data from server
  // This prevents the "ping-pong" effect where pulling data triggers a push
  const isProcessingRemoteUpdate = useRef(false);
  
  // ROBUST FIX: Track what we last pushed to prevent pushing the same data multiple times
  // This is KEY for 3+ tab sync - prevents tabs from pushing back data they just received
  const lastPushedWatchlistHash = useRef<string>('');
  const lastPushedThresholdsHash = useRef<string>('');
  const lastPushedAlarmLevelsHash = useRef<string>('');
  const lastPushedActiveAlarmsHash = useRef<string>('');
  
  // Also track what we last received to detect if current state is from remote
  const lastReceivedWatchlistHash = useRef<string>('');
  const lastReceivedThresholdsHash = useRef<string>('');
  const lastReceivedAlarmLevelsHash = useRef<string>('');
  const lastReceivedActiveAlarmsHash = useRef<string>('');
  
  // FIX: Track last KNOWN remote timestamp - use this for comparison instead of creating new timestamps!
  const lastKnownRemoteWatchlistTimestamp = useRef<number>(0);
  const lastKnownRemoteThresholdsTimestamp = useRef<number>(0);
  const lastKnownRemoteAlarmLevelsTimestamp = useRef<number>(0);
  const lastKnownRemoteActiveAlarmsTimestamp = useRef<number>(0);
  
  // Helper to create a hash of content for comparison
  const hashContent = (obj: unknown): string => JSON.stringify(obj);
  
  // REFS for stable polling - prevents interval recreation on every state change
  const watchlistRef = useRef(watchlist);
  const pairMarketTypesRef = useRef(pairMarketTypes);
  const trendPriceSettingsRef = useRef(trendPriceSettings);
  const alarmLevelConfigsRef = useRef(alarmLevelConfigs);
  const activeAlarmsRef = useRef(activeAlarms);
  const editingThresholdIdRef = useRef(editingThresholdId);
  
  // REFS for setters - prevents interval recreation when functions change
  const setWatchlistRef = useRef(setWatchlist);
  const setPairMarketTypesRef = useRef(setPairMarketTypes);
  const setTrendPriceSettingsRef = useRef(setTrendPriceSettings);
  const setAlarmLevelConfigsRef = useRef(setAlarmLevelConfigs);
  const setActiveAlarmsRef = useRef(setActiveAlarms);
  
  // Keep refs in sync with state
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);
  useEffect(() => { pairMarketTypesRef.current = pairMarketTypes; }, [pairMarketTypes]);
  useEffect(() => { trendPriceSettingsRef.current = trendPriceSettings; }, [trendPriceSettings]);
  useEffect(() => { alarmLevelConfigsRef.current = alarmLevelConfigs; }, [alarmLevelConfigs]);
  useEffect(() => { activeAlarmsRef.current = activeAlarms; }, [activeAlarms]);
  useEffect(() => { editingThresholdIdRef.current = editingThresholdId; }, [editingThresholdId]);
  
  // Keep setter refs in sync
  useEffect(() => { setWatchlistRef.current = setWatchlist; }, [setWatchlist]);
  useEffect(() => { setPairMarketTypesRef.current = setPairMarketTypes; }, [setPairMarketTypes]);
  useEffect(() => { setTrendPriceSettingsRef.current = setTrendPriceSettings; }, [setTrendPriceSettings]);
  useEffect(() => { setAlarmLevelConfigsRef.current = setAlarmLevelConfigs; }, [setAlarmLevelConfigs]);
  useEffect(() => { setActiveAlarmsRef.current = setActiveAlarms; }, [setActiveAlarms]);
  
  // Prevent rapid consecutive pushes
  const PUSH_DEBOUNCE_MS = 1000;
  
  // FIX: Track if a push was blocked and needs retry
  const pendingPushRetry = useRef<NodeJS.Timeout | null>(null);
  
  // FIX: Ref for pushAllToBackend to avoid stale closures in retry callback
  const pushAllToBackendRef = useRef<() => void>(() => {});

  // ===========================================
  // ⚠️⚠️⚠️ DIAMOND STATE - WATCHLIST SYNC V2.0 ⚠️⚠️⚠️
  // INITIAL SYNC - Fetch Remote on Mount
  // NIEMALS ÄNDERN! Funktioniert perfekt!
  // ===========================================
  useEffect(() => {
    const performInitialSync = async () => {
      console.log('[CROSS-DEVICE-SYNC] Initial sync starting...');
      
      try {
        // 1. Pull Watchlist from Backend
        // FIX: AUCH leere Watchlists verarbeiten um Löschungen zu syncen!
        const remoteWatchlist = await pullWatchlistFromBackend();
        if (remoteWatchlist && remoteWatchlist.watchlist !== undefined) {
          const localData = createWatchlistSyncData(watchlist, pairMarketTypes);
          const merged = mergeWatchlist(localData, remoteWatchlist);
          
          // FIX: Auch leere Watchlists anwenden (wenn neuer als lokal)
          if (merged) {
            console.log('[CROSS-DEVICE-SYNC] Merged watchlist:', merged.watchlist.length, 'items');
            // Store remote timestamp so we don't push it back
            lastKnownRemoteWatchlistTimestamp.current = remoteWatchlist.timestamp;
            setWatchlist(() => merged.watchlist);
            setPairMarketTypes(() => merged.pairMarketTypes);
          }
        }
        
        // 2. Pull Thresholds from Backend
        // FIX: AUCH leere Thresholds verarbeiten um Löschungen zu syncen!
        const remoteThresholds = await pullThresholdsFromBackend();
        if (remoteThresholds && remoteThresholds.settings !== undefined) {
          const localData = createThresholdsSyncData(trendPriceSettings);
          const merged = mergeAllThresholds(localData, remoteThresholds);
          
          // FIX: Auch leere Settings anwenden (wenn neuer als lokal)
          if (merged) {
            console.log('[CROSS-DEVICE-SYNC] Merged thresholds:', Object.keys(merged.settings).length, 'items');
            lastKnownRemoteThresholdsTimestamp.current = remoteThresholds.timestamp;
            setTrendPriceSettings(() => merged.settings);
          }
        }
        
        // 3. Pull Alarm Levels from Backend
        // FIX: AUCH leere Alarm Levels verarbeiten um Löschungen zu syncen!
        const remoteAlarmLevels = await pullAlarmLevelsFromBackend();
        if (remoteAlarmLevels && remoteAlarmLevels.configs !== undefined) {
          const localData = createAlarmLevelsSyncData(alarmLevelConfigs);
          const merged = mergeAlarmLevelConfigs(localData, remoteAlarmLevels);
          
          // FIX: Auch leere Configs anwenden (wenn neuer als lokal)
          if (merged) {
            console.log('[CROSS-DEVICE-SYNC] Merged alarm levels:', Object.keys(merged.configs).length, 'items');
            lastKnownRemoteAlarmLevelsTimestamp.current = remoteAlarmLevels.timestamp;
            setAlarmLevelConfigs(merged.configs);
          }
        }
        
        // 4. Pull Active Alarms from Backend - MOST IMPORTANT for cross-device sync!
        // ===========================================
        // ACTIVE ALARMS INITIAL SYNC - Kann bearbeitet werden
        // ===========================================
        const remoteActiveAlarms = await pullActiveAlarmsFromBackend();
        console.log('[ACTIVE-ALARMS-SYNC] Initial sync - Remote alarms:', remoteActiveAlarms?.alarms?.length ?? 'null', 'Timestamp:', remoteActiveAlarms?.timestamp ?? 'null');
        
        if (remoteActiveAlarms && remoteActiveAlarms.alarms !== undefined) {
          // For active alarms: Remote always wins (newer timestamp = more accurate state)
          // Parse dates back from ISO strings
          const parsedAlarms = remoteActiveAlarms.alarms.map(a => ({
            ...a,
            triggeredAt: new Date(a.triggeredAt),
            restwartezeitEndsAt: a.restwartezeitEndsAt ? new Date(a.restwartezeitEndsAt) : undefined
          }));
          
          console.log('[ACTIVE-ALARMS-SYNC] Initial sync - Setting', parsedAlarms.length, 'alarms, LastKnownTS:', remoteActiveAlarms.timestamp);
          lastKnownRemoteActiveAlarmsTimestamp.current = remoteActiveAlarms.timestamp;
          setActiveAlarms(() => parsedAlarms);
        } else {
          console.log('[ACTIVE-ALARMS-SYNC] Initial sync - No remote data');
        }
        
        console.log('[CROSS-DEVICE-SYNC] Initial sync complete');
        
        // Mark initial sync as complete - NOW pushes are allowed
        initialSyncComplete.current = true;
        
      } catch (error) {
        console.error('[CROSS-DEVICE-SYNC] Initial sync error:', error);
        // Even on error, mark as complete to not block forever
        initialSyncComplete.current = true;
      }
    };
    
    performInitialSync();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===========================================
  // ⚠️⚠️⚠️ DIAMOND STATE - PUSH LOGIC V2.0 ⚠️⚠️⚠️
  // PUSH TO BACKEND when Local Data Changes
  // NIEMALS ÄNDERN! Debounce-Retry funktioniert!
  // ===========================================
  const pushAllToBackend = useCallback(async () => {
    // CRITICAL: Don't push until initial sync is complete!
    // This prevents empty local data from overwriting remote data
    if (!initialSyncComplete.current) {
      console.log('[CROSS-DEVICE-SYNC] Skipping push - initial sync not complete');
      return;
    }
    
    // CRITICAL: Don't push when we just received data from server!
    // This prevents the "ping-pong" effect
    if (isProcessingRemoteUpdate.current) {
      console.log('[CROSS-DEVICE-SYNC] Skipping push - processing remote update');
      return;
    }
    
    // GOLDEN STATE FIX: Don't push thresholds when user is currently editing one!
    // User must click "Speichern" explicitly - no auto-save on value input
    const currentlyEditing = editingThresholdIdRef.current;
    
    const now = getCurrentTimestamp();
    
    // Debounce rapid pushes - but schedule a retry if blocked!
    const timeSinceLastPush = now - lastPushTimestamp.current;
    if (timeSinceLastPush < PUSH_DEBOUNCE_MS) {
      // FIX: Schedule a retry after debounce period ends
      const retryDelay = PUSH_DEBOUNCE_MS - timeSinceLastPush + 100; // +100ms buffer
      
      // Clear any existing retry timer
      if (pendingPushRetry.current) {
        clearTimeout(pendingPushRetry.current);
      }
      
      // Schedule retry - this ensures the latest data eventually gets pushed
      // FIX: Use ref to avoid stale closure - always calls latest version
      pendingPushRetry.current = setTimeout(() => {
        console.log('[CROSS-DEVICE-SYNC] Debounce retry triggered');
        pushAllToBackendRef.current();
      }, retryDelay);
      
      console.log('[CROSS-DEVICE-SYNC] Push debounced, retry scheduled in', retryDelay, 'ms');
      return;
    }
    
    // Clear pending retry since we're pushing now
    if (pendingPushRetry.current) {
      clearTimeout(pendingPushRetry.current);
      pendingPushRetry.current = null;
    }
    
    lastPushTimestamp.current = now;
    
    console.log('[CROSS-DEVICE-SYNC] Pushing data to backend...');
    
    try {
      // ROBUST FIX: Only push if content has ACTUALLY changed (not just received from remote)
      const currentWatchlistHash = hashContent({ watchlist, pairMarketTypes });
      const currentAlarmLevelsHash = hashContent(alarmLevelConfigs);
      
      // Check if this is the same data we just received from remote - don't push it back!
      const isWatchlistFromRemote = currentWatchlistHash === lastReceivedWatchlistHash.current;
      const isAlarmLevelsFromRemote = currentAlarmLevelsHash === lastReceivedAlarmLevelsHash.current;
      
      // Also check if we already pushed this exact content
      const watchlistAlreadyPushed = currentWatchlistHash === lastPushedWatchlistHash.current;
      const alarmLevelsAlreadyPushed = currentAlarmLevelsHash === lastPushedAlarmLevelsHash.current;
      
      // Push watchlist only if it's NEW local data (not from remote and not already pushed)
      if (!isWatchlistFromRemote && !watchlistAlreadyPushed) {
        await pushWatchlistToBackend(watchlist, pairMarketTypes);
        lastPushedWatchlistHash.current = currentWatchlistHash;
        console.log('[CROSS-DEVICE-SYNC] Watchlist pushed (items:', watchlist.length, ')');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Watchlist skip - already synced');
      }
      
      // GOLDEN STATE: Only push thresholds when NOT editing (user must click "Speichern")
      if (currentlyEditing) {
        console.log('[CROSS-DEVICE-SYNC] Thresholds skip - user is editing (editingThresholdId:', currentlyEditing, ')');
      } else {
        const currentThresholdsHash = hashContent(trendPriceSettings);
        const isThresholdsFromRemote = currentThresholdsHash === lastReceivedThresholdsHash.current;
        const thresholdsAlreadyPushed = currentThresholdsHash === lastPushedThresholdsHash.current;
        
        // Push thresholds only if NEW local data
        if (!isThresholdsFromRemote && !thresholdsAlreadyPushed) {
          await pushThresholdsToBackend(trendPriceSettings);
          lastPushedThresholdsHash.current = currentThresholdsHash;
          console.log('[CROSS-DEVICE-SYNC] Thresholds pushed');
        } else {
          console.log('[CROSS-DEVICE-SYNC] Thresholds skip - already synced');
        }
      }
      
      // Push alarm levels only if NEW local data
      if (!isAlarmLevelsFromRemote && !alarmLevelsAlreadyPushed) {
        await pushAlarmLevelsToBackend(alarmLevelConfigs);
        lastPushedAlarmLevelsHash.current = currentAlarmLevelsHash;
        console.log('[CROSS-DEVICE-SYNC] Alarm levels pushed');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Alarm levels skip - already synced');
      }
      
      // Push active alarms - CRITICAL for cross-device approve/stop sync!
      // ===========================================
      // ACTIVE ALARMS PUSH - Kann bearbeitet werden
      // ===========================================
      const currentActiveAlarmsHash = hashContent(activeAlarms.map(a => a.id).sort());
      const isActiveAlarmsFromRemote = currentActiveAlarmsHash === lastReceivedActiveAlarmsHash.current;
      const activeAlarmsAlreadyPushed = currentActiveAlarmsHash === lastPushedActiveAlarmsHash.current;
      
      console.log('[ACTIVE-ALARMS-SYNC] Push check - Count:', activeAlarms.length, 'Hash:', currentActiveAlarmsHash, 'FromRemote:', isActiveAlarmsFromRemote, 'AlreadyPushed:', activeAlarmsAlreadyPushed);
      
      if (!isActiveAlarmsFromRemote && !activeAlarmsAlreadyPushed) {
        console.log('[ACTIVE-ALARMS-SYNC] PUSHING to backend!', activeAlarms.length, 'alarms');
        await pushActiveAlarmsToBackend(activeAlarms);
        lastPushedActiveAlarmsHash.current = currentActiveAlarmsHash;
        console.log('[ACTIVE-ALARMS-SYNC] Push SUCCESS');
      } else {
        console.log('[ACTIVE-ALARMS-SYNC] Push SKIPPED - already synced');
      }
      
      console.log('[CROSS-DEVICE-SYNC] Push complete');
      
    } catch (error) {
      console.error('[CROSS-DEVICE-SYNC] Push error:', error);
    }
  }, [watchlist, pairMarketTypes, trendPriceSettings, alarmLevelConfigs, activeAlarms]);

  // FIX: Keep ref updated with latest version to avoid stale closures
  useEffect(() => {
    pushAllToBackendRef.current = pushAllToBackend;
  }, [pushAllToBackend]);

  // FIX: Cleanup pendingPushRetry on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pendingPushRetry.current) {
        clearTimeout(pendingPushRetry.current);
        pendingPushRetry.current = null;
      }
    };
  }, []);

  // Push to backend when data changes (after initial mount)
  // CRITICAL FIX: Also trigger when editingThresholdId changes to null (user clicked "Speichern")
  // This ensures the push happens AFTER the editing state is cleared
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Delay push slightly to batch rapid changes
    const timeout = setTimeout(() => {
      pushAllToBackend();
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [watchlist, pairMarketTypes, trendPriceSettings, alarmLevelConfigs, activeAlarms, editingThresholdId, pushAllToBackend]);

  // ===========================================
  // ⚠️⚠️⚠️ DIAMOND STATE - POLLING V2.0 ⚠️⚠️⚠️
  // POLLING - Sync every 3.5 seconds (FULLY STABLE)
  // NIEMALS ÄNDERN! Anti-Ping-Pong funktioniert!
  // ===========================================
  useEffect(() => {
    console.log('[CROSS-DEVICE-SYNC] Setting up polling interval...');
    
    const performSync = async () => {
      try {
        console.log('[CROSS-DEVICE-SYNC] Polling for updates...');
        
        // Use refs to get current state (prevents stale closures)
        const currentWatchlist = watchlistRef.current;
        const currentPairMarketTypes = pairMarketTypesRef.current;
        const currentTrendPriceSettings = trendPriceSettingsRef.current;
        const currentAlarmLevelConfigs = alarmLevelConfigsRef.current;
        
        // 1. Sync Watchlist - NEUERER TIMESTAMP GEWINNT KOMPLETT
        const remoteWatchlist = await pullWatchlistFromBackend();
        if (remoteWatchlist && remoteWatchlist.watchlist !== undefined) {
          // FIX: Compare against LAST KNOWN remote timestamp, not a freshly created one!
          // This ensures we detect when another device has pushed newer data
          const isNewerThanLastKnown = remoteWatchlist.timestamp > lastKnownRemoteWatchlistTimestamp.current;
          
          if (isNewerThanLastKnown) {
            // Update our knowledge of the remote timestamp
            lastKnownRemoteWatchlistTimestamp.current = remoteWatchlist.timestamp;
            
            // Check if content is actually different from what we have
            const isDifferent = JSON.stringify(remoteWatchlist.watchlist.sort()) !== JSON.stringify(currentWatchlist.sort());
            
            if (isDifferent) {
              console.log('[CROSS-DEVICE-SYNC] Watchlist updated from remote:', remoteWatchlist.watchlist);
              
              // ROBUST FIX: Store the hash of what we're receiving so we don't push it back
              const receivedHash = hashContent({ watchlist: remoteWatchlist.watchlist, pairMarketTypes: remoteWatchlist.pairMarketTypes });
              lastReceivedWatchlistHash.current = receivedHash;
              
              // SET FLAG before updating state to prevent push-back!
              isProcessingRemoteUpdate.current = true;
              
              setWatchlistRef.current(() => remoteWatchlist.watchlist);
              setPairMarketTypesRef.current(() => remoteWatchlist.pairMarketTypes);
              
              // Reset flag after a short delay (after state update effects have run)
              setTimeout(() => {
                isProcessingRemoteUpdate.current = false;
              }, 1000);
            }
          }
        }
        
        // 2. Sync Thresholds - newer timestamp wins
        const remoteThresholds = await pullThresholdsFromBackend();
        if (remoteThresholds && remoteThresholds.settings !== undefined) {
          // FIX: Compare against LAST KNOWN remote timestamp
          const isNewerThanLastKnown = remoteThresholds.timestamp > lastKnownRemoteThresholdsTimestamp.current;
          
          if (isNewerThanLastKnown) {
            // Update our knowledge of the remote timestamp
            lastKnownRemoteThresholdsTimestamp.current = remoteThresholds.timestamp;
            
            const isDifferent = JSON.stringify(remoteThresholds.settings) !== JSON.stringify(currentTrendPriceSettings);
            if (isDifferent) {
              console.log('[CROSS-DEVICE-SYNC] Thresholds updated:', Object.keys(remoteThresholds.settings));
              
              // ROBUST FIX: Store hash of what we're receiving
              const receivedHash = hashContent(remoteThresholds.settings);
              lastReceivedThresholdsHash.current = receivedHash;
              
              // SET FLAG before updating state to prevent push-back!
              isProcessingRemoteUpdate.current = true;
              
              setTrendPriceSettingsRef.current(() => remoteThresholds.settings);
              
              setTimeout(() => {
                isProcessingRemoteUpdate.current = false;
              }, 1000);
            }
          }
        }
        
        // 3. Sync Alarm Levels - newer timestamp wins
        const remoteAlarmLevels = await pullAlarmLevelsFromBackend();
        if (remoteAlarmLevels && remoteAlarmLevels.configs !== undefined) {
          // FIX: Compare against LAST KNOWN remote timestamp
          const isNewerThanLastKnown = remoteAlarmLevels.timestamp > lastKnownRemoteAlarmLevelsTimestamp.current;
          
          if (isNewerThanLastKnown) {
            // Update our knowledge of the remote timestamp
            lastKnownRemoteAlarmLevelsTimestamp.current = remoteAlarmLevels.timestamp;
            
            const isDifferent = JSON.stringify(remoteAlarmLevels.configs) !== JSON.stringify(currentAlarmLevelConfigs);
            if (isDifferent) {
              console.log('[CROSS-DEVICE-SYNC] Alarm levels updated');
              
              // ROBUST FIX: Store hash of what we're receiving
              const receivedHash = hashContent(remoteAlarmLevels.configs);
              lastReceivedAlarmLevelsHash.current = receivedHash;
              
              // SET FLAG before updating state to prevent push-back!
              isProcessingRemoteUpdate.current = true;
              
              setAlarmLevelConfigsRef.current(remoteAlarmLevels.configs);
              
              setTimeout(() => {
                isProcessingRemoteUpdate.current = false;
              }, 1000);
            }
          }
        }
        
        // 4. Sync Active Alarms - CRITICAL for cross-device approve/stop sync!
        // ===========================================
        // ACTIVE ALARMS SYNC - Kann bearbeitet werden
        // ===========================================
        const currentActiveAlarms = activeAlarmsRef.current;
        const remoteActiveAlarms = await pullActiveAlarmsFromBackend();
        
        console.log('[ACTIVE-ALARMS-SYNC] Polling - Remote:', remoteActiveAlarms?.alarms?.length ?? 'null', 'Local:', currentActiveAlarms.length, 'LastKnownTS:', lastKnownRemoteActiveAlarmsTimestamp.current);
        
        if (remoteActiveAlarms && remoteActiveAlarms.alarms !== undefined) {
          const isNewerThanLastKnown = remoteActiveAlarms.timestamp > lastKnownRemoteActiveAlarmsTimestamp.current;
          
          console.log('[ACTIVE-ALARMS-SYNC] Timestamp check - Remote:', remoteActiveAlarms.timestamp, 'LastKnown:', lastKnownRemoteActiveAlarmsTimestamp.current, 'IsNewer:', isNewerThanLastKnown);
          
          if (isNewerThanLastKnown) {
            lastKnownRemoteActiveAlarmsTimestamp.current = remoteActiveAlarms.timestamp;
            
            // Compare by alarm IDs (not full content, as dates may differ slightly)
            const currentIds = currentActiveAlarms.map(a => a.id).sort().join(',');
            const remoteIds = remoteActiveAlarms.alarms.map(a => a.id).sort().join(',');
            const isDifferent = currentIds !== remoteIds;
            
            console.log('[ACTIVE-ALARMS-SYNC] Content check - LocalIDs:', currentIds, 'RemoteIDs:', remoteIds, 'IsDifferent:', isDifferent);
            
            if (isDifferent) {
              console.log('[ACTIVE-ALARMS-SYNC] UPDATING from remote! Local:', currentActiveAlarms.length, '→ Remote:', remoteActiveAlarms.alarms.length);
              
              // Parse dates back from ISO strings
              const parsedAlarms = remoteActiveAlarms.alarms.map(a => ({
                ...a,
                triggeredAt: new Date(a.triggeredAt),
                restwartezeitEndsAt: a.restwartezeitEndsAt ? new Date(a.restwartezeitEndsAt) : undefined
              }));
              
              // Store hash of what we're receiving
              const receivedHash = hashContent(remoteActiveAlarms.alarms.map(a => a.id).sort());
              lastReceivedActiveAlarmsHash.current = receivedHash;
              
              isProcessingRemoteUpdate.current = true;
              
              setActiveAlarmsRef.current(() => parsedAlarms);
              
              // Also update localStorage immediately for consistency
              localStorage.setItem('active-alarms', JSON.stringify(parsedAlarms));
              
              setTimeout(() => {
                isProcessingRemoteUpdate.current = false;
              }, 1000);
            }
          }
        }
        
      } catch (error) {
        console.error('[CROSS-DEVICE-SYNC] Polling error:', error);
      }
    };
    
    // Start polling after 3 seconds (give time for initial sync)
    // COMPLETELY STABLE - no dependencies, uses refs for everything
    const startPolling = setTimeout(() => {
      console.log('[CROSS-DEVICE-SYNC] Starting polling interval (3.5s)');
      syncIntervalRef.current = setInterval(performSync, 3500);
    }, 3000);
    
    return () => {
      console.log('[CROSS-DEVICE-SYNC] Cleaning up polling interval');
      clearTimeout(startPolling);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // EMPTY dependency array - interval is FULLY stable, uses refs for ALL state and functions
  }, []);

  return {
    pushAllToBackend
  };
}
