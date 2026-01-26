/**
 * CROSS-DEVICE SYNC HOOK
 * =======================
 * Erstellt: 25.01.2026
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
  mergeWatchlist,
  mergeAllThresholds,
  mergeAlarmLevelConfigs,
  createWatchlistSyncData,
  createThresholdsSyncData,
  createAlarmLevelsSyncData,
  type WatchlistSyncData,
  type AllThresholdsSyncData,
  type AlarmLevelSyncData,
  type ThresholdConfig,
  type AlarmLevelConfig
} from '@/lib/sync';

interface UseCrossDeviceSyncProps {
  watchlist: string[];
  pairMarketTypes: Record<string, { marketType: 'spot' | 'futures'; symbol: string }>;
  trendPriceSettings: Record<string, { trendPriceId: string; thresholds: any[] }>;
  alarmLevelConfigs: Record<string, AlarmLevelConfig>;
  setWatchlist: (fn: (prev: string[]) => string[]) => void;
  setPairMarketTypes: (fn: (prev: Record<string, { marketType: 'spot' | 'futures'; symbol: string }>) => Record<string, { marketType: 'spot' | 'futures'; symbol: string }>) => void;
  setTrendPriceSettings: (fn: (prev: Record<string, { trendPriceId: string; thresholds: any[] }>) => Record<string, { trendPriceId: string; thresholds: any[] }>) => void;
  setAlarmLevelConfigs: (configs: Record<string, AlarmLevelConfig>) => void;
}

export function useCrossDeviceSync({
  watchlist,
  pairMarketTypes,
  trendPriceSettings,
  alarmLevelConfigs,
  setWatchlist,
  setPairMarketTypes,
  setTrendPriceSettings,
  setAlarmLevelConfigs
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
  
  // Also track what we last received to detect if current state is from remote
  const lastReceivedWatchlistHash = useRef<string>('');
  const lastReceivedThresholdsHash = useRef<string>('');
  const lastReceivedAlarmLevelsHash = useRef<string>('');
  
  // Helper to create a hash of content for comparison
  const hashContent = (obj: unknown): string => JSON.stringify(obj);
  
  // REFS for stable polling - prevents interval recreation on every state change
  const watchlistRef = useRef(watchlist);
  const pairMarketTypesRef = useRef(pairMarketTypes);
  const trendPriceSettingsRef = useRef(trendPriceSettings);
  const alarmLevelConfigsRef = useRef(alarmLevelConfigs);
  
  // REFS for setters - prevents interval recreation when functions change
  const setWatchlistRef = useRef(setWatchlist);
  const setPairMarketTypesRef = useRef(setPairMarketTypes);
  const setTrendPriceSettingsRef = useRef(setTrendPriceSettings);
  const setAlarmLevelConfigsRef = useRef(setAlarmLevelConfigs);
  
  // Keep refs in sync with state
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);
  useEffect(() => { pairMarketTypesRef.current = pairMarketTypes; }, [pairMarketTypes]);
  useEffect(() => { trendPriceSettingsRef.current = trendPriceSettings; }, [trendPriceSettings]);
  useEffect(() => { alarmLevelConfigsRef.current = alarmLevelConfigs; }, [alarmLevelConfigs]);
  
  // Keep setter refs in sync
  useEffect(() => { setWatchlistRef.current = setWatchlist; }, [setWatchlist]);
  useEffect(() => { setPairMarketTypesRef.current = setPairMarketTypes; }, [setPairMarketTypes]);
  useEffect(() => { setTrendPriceSettingsRef.current = setTrendPriceSettings; }, [setTrendPriceSettings]);
  useEffect(() => { setAlarmLevelConfigsRef.current = setAlarmLevelConfigs; }, [setAlarmLevelConfigs]);
  
  // Prevent rapid consecutive pushes
  const PUSH_DEBOUNCE_MS = 1000;

  // ===========================================
  // INITIAL SYNC - Fetch Remote on Mount
  // ===========================================
  useEffect(() => {
    const performInitialSync = async () => {
      console.log('[CROSS-DEVICE-SYNC] Initial sync starting...');
      
      try {
        // 1. Pull Watchlist from Backend
        const remoteWatchlist = await pullWatchlistFromBackend();
        if (remoteWatchlist && remoteWatchlist.watchlist && remoteWatchlist.watchlist.length > 0) {
          const localData = createWatchlistSyncData(watchlist, pairMarketTypes);
          const merged = mergeWatchlist(localData, remoteWatchlist);
          
          if (merged && merged.watchlist.length > 0) {
            console.log('[CROSS-DEVICE-SYNC] Merged watchlist:', merged.watchlist);
            setWatchlist(() => merged.watchlist);
            setPairMarketTypes(() => merged.pairMarketTypes);
          }
        }
        
        // 2. Pull Thresholds from Backend
        const remoteThresholds = await pullThresholdsFromBackend();
        if (remoteThresholds && Object.keys(remoteThresholds.settings || {}).length > 0) {
          const localData = createThresholdsSyncData(trendPriceSettings);
          const merged = mergeAllThresholds(localData, remoteThresholds);
          
          if (merged && Object.keys(merged.settings).length > 0) {
            console.log('[CROSS-DEVICE-SYNC] Merged thresholds:', Object.keys(merged.settings));
            setTrendPriceSettings(() => merged.settings);
          }
        }
        
        // 3. Pull Alarm Levels from Backend
        const remoteAlarmLevels = await pullAlarmLevelsFromBackend();
        if (remoteAlarmLevels && Object.keys(remoteAlarmLevels.configs || {}).length > 0) {
          const localData = createAlarmLevelsSyncData(alarmLevelConfigs);
          const merged = mergeAlarmLevelConfigs(localData, remoteAlarmLevels);
          
          if (merged) {
            console.log('[CROSS-DEVICE-SYNC] Merged alarm levels');
            setAlarmLevelConfigs(merged.configs);
          }
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
  // PUSH TO BACKEND when Local Data Changes
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
    
    const now = getCurrentTimestamp();
    
    // Debounce rapid pushes
    if (now - lastPushTimestamp.current < PUSH_DEBOUNCE_MS) {
      return;
    }
    lastPushTimestamp.current = now;
    
    console.log('[CROSS-DEVICE-SYNC] Pushing data to backend...');
    
    try {
      // ROBUST FIX: Only push if content has ACTUALLY changed (not just received from remote)
      const currentWatchlistHash = hashContent({ watchlist, pairMarketTypes });
      const currentThresholdsHash = hashContent(trendPriceSettings);
      const currentAlarmLevelsHash = hashContent(alarmLevelConfigs);
      
      // Check if this is the same data we just received from remote - don't push it back!
      const isWatchlistFromRemote = currentWatchlistHash === lastReceivedWatchlistHash.current;
      const isThresholdsFromRemote = currentThresholdsHash === lastReceivedThresholdsHash.current;
      const isAlarmLevelsFromRemote = currentAlarmLevelsHash === lastReceivedAlarmLevelsHash.current;
      
      // Also check if we already pushed this exact content
      const watchlistAlreadyPushed = currentWatchlistHash === lastPushedWatchlistHash.current;
      const thresholdsAlreadyPushed = currentThresholdsHash === lastPushedThresholdsHash.current;
      const alarmLevelsAlreadyPushed = currentAlarmLevelsHash === lastPushedAlarmLevelsHash.current;
      
      // Push watchlist only if it's NEW local data (not from remote and not already pushed)
      if (!isWatchlistFromRemote && !watchlistAlreadyPushed) {
        await pushWatchlistToBackend(watchlist, pairMarketTypes);
        lastPushedWatchlistHash.current = currentWatchlistHash;
        console.log('[CROSS-DEVICE-SYNC] Watchlist pushed (items:', watchlist.length, ')');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Watchlist skip - already synced');
      }
      
      // Push thresholds only if NEW local data
      if (!isThresholdsFromRemote && !thresholdsAlreadyPushed) {
        await pushThresholdsToBackend(trendPriceSettings);
        lastPushedThresholdsHash.current = currentThresholdsHash;
        console.log('[CROSS-DEVICE-SYNC] Thresholds pushed');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Thresholds skip - already synced');
      }
      
      // Push alarm levels only if NEW local data
      if (!isAlarmLevelsFromRemote && !alarmLevelsAlreadyPushed) {
        await pushAlarmLevelsToBackend(alarmLevelConfigs);
        lastPushedAlarmLevelsHash.current = currentAlarmLevelsHash;
        console.log('[CROSS-DEVICE-SYNC] Alarm levels pushed');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Alarm levels skip - already synced');
      }
      
      console.log('[CROSS-DEVICE-SYNC] Push complete');
      
    } catch (error) {
      console.error('[CROSS-DEVICE-SYNC] Push error:', error);
    }
  }, [watchlist, pairMarketTypes, trendPriceSettings, alarmLevelConfigs]);

  // Push to backend when data changes (after initial mount)
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
  }, [watchlist, pairMarketTypes, trendPriceSettings, alarmLevelConfigs, pushAllToBackend]);

  // ===========================================
  // POLLING - Sync every 3.5 seconds (FULLY STABLE - uses refs for EVERYTHING)
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
          const localData = createWatchlistSyncData(currentWatchlist, currentPairMarketTypes);
          
          // Vergleiche Timestamps - nur wenn remote neuer ist, übernehmen
          if (remoteWatchlist.timestamp > (localData?.timestamp || 0)) {
            // Remote ist neuer - übernehme komplett (inklusive Löschungen!)
            const merged = mergeWatchlist(localData, remoteWatchlist);
            
            if (merged) {
              // Nur aktualisieren wenn sich was geändert hat
              const isDifferent = JSON.stringify(merged.watchlist.sort()) !== JSON.stringify(currentWatchlist.sort());
              if (isDifferent) {
                console.log('[CROSS-DEVICE-SYNC] Watchlist updated from remote:', merged.watchlist);
                
                // ROBUST FIX: Store the hash of what we're receiving so we don't push it back
                const receivedHash = hashContent({ watchlist: merged.watchlist, pairMarketTypes: merged.pairMarketTypes });
                lastReceivedWatchlistHash.current = receivedHash;
                
                // SET FLAG before updating state to prevent push-back!
                isProcessingRemoteUpdate.current = true;
                
                setWatchlistRef.current(() => merged.watchlist);
                setPairMarketTypesRef.current(() => merged.pairMarketTypes);
                
                // Reset flag after a short delay (after state update effects have run)
                setTimeout(() => {
                  isProcessingRemoteUpdate.current = false;
                }, 1000);
              }
            }
          }
        }
        
        // 2. Sync Thresholds - newer timestamp wins
        const remoteThresholds = await pullThresholdsFromBackend();
        if (remoteThresholds && remoteThresholds.settings !== undefined) {
          const localData = createThresholdsSyncData(currentTrendPriceSettings);
          
          // Only update if remote is newer
          if (remoteThresholds.timestamp > (localData?.timestamp || 0)) {
            const merged = mergeAllThresholds(localData, remoteThresholds);
            
            if (merged) {
              const isDifferent = JSON.stringify(merged.settings) !== JSON.stringify(currentTrendPriceSettings);
              if (isDifferent) {
                console.log('[CROSS-DEVICE-SYNC] Thresholds updated:', Object.keys(merged.settings));
                
                // ROBUST FIX: Store hash of what we're receiving
                const receivedHash = hashContent(merged.settings);
                lastReceivedThresholdsHash.current = receivedHash;
                
                // SET FLAG before updating state to prevent push-back!
                isProcessingRemoteUpdate.current = true;
                
                setTrendPriceSettingsRef.current(() => merged.settings);
                
                setTimeout(() => {
                  isProcessingRemoteUpdate.current = false;
                }, 1000);
              }
            }
          }
        }
        
        // 3. Sync Alarm Levels - newer timestamp wins
        const remoteAlarmLevels = await pullAlarmLevelsFromBackend();
        if (remoteAlarmLevels && remoteAlarmLevels.configs !== undefined) {
          const localData = createAlarmLevelsSyncData(currentAlarmLevelConfigs);
          
          if (remoteAlarmLevels.timestamp > (localData?.timestamp || 0)) {
            const merged = mergeAlarmLevelConfigs(localData, remoteAlarmLevels);
            
            if (merged) {
              const isDifferent = JSON.stringify(merged.configs) !== JSON.stringify(currentAlarmLevelConfigs);
              if (isDifferent) {
                console.log('[CROSS-DEVICE-SYNC] Alarm levels updated');
                
                // ROBUST FIX: Store hash of what we're receiving
                const receivedHash = hashContent(merged.configs);
                lastReceivedAlarmLevelsHash.current = receivedHash;
                
                // SET FLAG before updating state to prevent push-back!
                isProcessingRemoteUpdate.current = true;
                
                setAlarmLevelConfigsRef.current(merged.configs);
                
                setTimeout(() => {
                  isProcessingRemoteUpdate.current = false;
                }, 1000);
              }
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
