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
    
    const now = getCurrentTimestamp();
    
    // Debounce rapid pushes
    if (now - lastPushTimestamp.current < PUSH_DEBOUNCE_MS) {
      return;
    }
    lastPushTimestamp.current = now;
    
    console.log('[CROSS-DEVICE-SYNC] Pushing data to backend...');
    
    try {
      // SAFETY: Only push if we have actual data - never overwrite remote with empty
      if (watchlist.length > 0) {
        await pushWatchlistToBackend(watchlist, pairMarketTypes);
        console.log('[CROSS-DEVICE-SYNC] Watchlist pushed (items:', watchlist.length, ')');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Skipping watchlist push - no local data');
      }
      
      // Push Thresholds only if we have any
      const hasThresholds = Object.values(trendPriceSettings).some(s => s.thresholds && s.thresholds.length > 0);
      if (hasThresholds) {
        await pushThresholdsToBackend(trendPriceSettings);
        console.log('[CROSS-DEVICE-SYNC] Thresholds pushed');
      } else {
        console.log('[CROSS-DEVICE-SYNC] Skipping thresholds push - no local data');
      }
      
      // Alarm levels can always be pushed (they have defaults)
      await pushAlarmLevelsToBackend(alarmLevelConfigs);
      
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
  // POLLING - Sync every 3.5 seconds
  // ===========================================
  useEffect(() => {
    const myDeviceId = getDeviceId();
    
    const performSync = async () => {
      try {
        console.log('[CROSS-DEVICE-SYNC] Polling for updates...');
        
        // 1. Sync Watchlist - ALWAYS merge, use UNION strategy
        const remoteWatchlist = await pullWatchlistFromBackend();
        if (remoteWatchlist && remoteWatchlist.watchlist && remoteWatchlist.watchlist.length > 0) {
          // Only update if remote has data we don't have locally
          const localSet = new Set(watchlist);
          const remoteSet = new Set(remoteWatchlist.watchlist);
          const hasNewItems = remoteWatchlist.watchlist.some(item => !localSet.has(item));
          const hasMissingItems = watchlist.some(item => !remoteSet.has(item));
          
          if (hasNewItems || (hasMissingItems && remoteWatchlist.deviceId !== myDeviceId)) {
            const localData = createWatchlistSyncData(watchlist, pairMarketTypes);
            const merged = mergeWatchlist(localData, remoteWatchlist);
            
            if (merged && merged.watchlist.length > 0) {
              console.log('[CROSS-DEVICE-SYNC] Watchlist updated:', merged.watchlist);
              setWatchlist(() => merged.watchlist);
              setPairMarketTypes(() => merged.pairMarketTypes);
            }
          }
        }
        
        // 2. Sync Thresholds - UNION merge for configurations
        const remoteThresholds = await pullThresholdsFromBackend();
        if (remoteThresholds && Object.keys(remoteThresholds.settings || {}).length > 0) {
          const localData = createThresholdsSyncData(trendPriceSettings);
          const merged = mergeAllThresholds(localData, remoteThresholds);
          
          // Update if remote has newer data OR if remote has more thresholds
          const remoteThresholdCount = Object.values(remoteThresholds.settings || {}).reduce((sum, s: any) => sum + (s.thresholds?.length || 0), 0);
          const localThresholdCount = Object.values(trendPriceSettings).reduce((sum, s) => sum + (s.thresholds?.length || 0), 0);
          
          if (merged && (remoteThresholdCount > localThresholdCount || remoteThresholds.timestamp > (localData?.timestamp || 0))) {
            console.log('[CROSS-DEVICE-SYNC] Thresholds updated:', Object.keys(merged.settings));
            setTrendPriceSettings(() => merged.settings);
          }
        }
        
        // 3. Sync Alarm Levels
        const remoteAlarmLevels = await pullAlarmLevelsFromBackend();
        if (remoteAlarmLevels && Object.keys(remoteAlarmLevels.configs || {}).length > 0) {
          const localData = createAlarmLevelsSyncData(alarmLevelConfigs);
          const merged = mergeAlarmLevelConfigs(localData, remoteAlarmLevels);
          
          if (merged && remoteAlarmLevels.timestamp > (localData?.timestamp || 0)) {
            console.log('[CROSS-DEVICE-SYNC] Alarm levels updated');
            setAlarmLevelConfigs(merged.configs);
          }
        }
        
      } catch (error) {
        console.error('[CROSS-DEVICE-SYNC] Polling error:', error);
      }
    };
    
    // Start polling after 3 seconds (give time for initial sync)
    const startPolling = setTimeout(() => {
      console.log('[CROSS-DEVICE-SYNC] Starting polling interval (3.5s)');
      syncIntervalRef.current = setInterval(performSync, 3500);
    }, 3000);
    
    return () => {
      clearTimeout(startPolling);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [watchlist, pairMarketTypes, trendPriceSettings, alarmLevelConfigs, setWatchlist, setPairMarketTypes, setTrendPriceSettings, setAlarmLevelConfigs]);

  return {
    pushAllToBackend
  };
}
