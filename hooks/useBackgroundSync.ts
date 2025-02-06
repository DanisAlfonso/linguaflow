import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { syncRecordings, hasUnsyncedRecordings } from '../lib/sync/recordings';

// Interval to check for unsynced recordings (5 minutes)
const SYNC_INTERVAL = 5 * 60 * 1000;

export function useBackgroundSync() {
  const syncTimer = useRef<NodeJS.Timeout>();
  const lastSyncAttempt = useRef<number>(0);

  // Function to check and sync if needed
  const checkAndSync = async () => {
    try {
      // Check if we have anything to sync
      const hasUnsynced = await hasUnsyncedRecordings();
      if (!hasUnsynced) {
        return;
      }

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        return;
      }

      // Prevent too frequent sync attempts
      const now = Date.now();
      if (now - lastSyncAttempt.current < SYNC_INTERVAL) {
        return;
      }

      lastSyncAttempt.current = now;
      await syncRecordings();
    } catch (error) {
      console.error('Error in background sync:', error);
    }
  };

  // Start periodic sync when app is in foreground
  const startSync = () => {
    if (syncTimer.current) {
      clearInterval(syncTimer.current);
    }
    syncTimer.current = setInterval(checkAndSync, SYNC_INTERVAL);
    checkAndSync(); // Check immediately when starting
  };

  // Stop sync when app is in background
  const stopSync = () => {
    if (syncTimer.current) {
      clearInterval(syncTimer.current);
      syncTimer.current = undefined;
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        startSync();
      } else if (nextAppState === 'background') {
        stopSync();
      }
    });

    // Start sync when hook is first used
    startSync();

    // Cleanup
    return () => {
      subscription.remove();
      stopSync();
    };
  }, []);

  // Also sync when network status changes to connected
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        checkAndSync();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
} 