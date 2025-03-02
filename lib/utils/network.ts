import NetInfo from '@react-native-community/netinfo';
import { syncOfflineDecks } from '../services/flashcards';
import { Platform } from 'react-native';

/**
 * Utility functions for network status detection and logging
 */

// Flag to track current network status
let isConnected = true;

/**
 * Initialize network status monitoring
 */
export const initNetworkMonitoring = () => {
  console.log('📡 [NETWORK] Initializing network status monitoring');
  
  // Subscribe to network status changes
  const unsubscribe = NetInfo.addEventListener(state => {
    const prevConnected = isConnected;
    isConnected = state.isConnected === true;
    
    // Log network status changes
    if (prevConnected !== isConnected) {
      if (isConnected) {
        console.log('📡 [NETWORK] Connection restored, triggering sync');
        
        // Trigger sync when connection is restored
        // Only for mobile platforms since they have SQLite
        if (Platform.OS !== 'web') {
          syncReconnected();
        }
      } else {
        console.log('📡 [NETWORK] Device is offline, switching to local mode');
      }
    }
  });
  
  return unsubscribe;
};

/**
 * Trigger synchronization when connection is restored
 */
const syncReconnected = async () => {
  try {
    console.log('🔄 [SYNC] Attempting to sync offline data after reconnection');
    
    // For now, we'll skip auto-syncing here because we don't have direct access
    // to the auth context. The sync will be handled elsewhere where we have access
    // to the user ID.
    console.log('ℹ️ [SYNC] Auto-sync temporarily disabled - will sync on next app interaction');
    
    // When we can access the auth context:
    // const userId = getCurrentUserId();
    // if (userId) {
    //   await syncOfflineDecks(userId);
    // }
  } catch (error) {
    console.error('❌ [SYNC] Error syncing after reconnection:', error);
  }
};

/**
 * Check if the device is currently connected to the internet
 * @returns Promise<boolean> resolving to connection status
 */
export const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    isConnected = state.isConnected === true;
    console.log(`📡 [NETWORK] Status check: ${isConnected ? 'Online' : 'Offline'}`);
    return isConnected;
  } catch (error) {
    console.log('📡 [NETWORK] Error checking network status:', error);
    return false;
  }
};

/**
 * Get the current cached network status
 * @returns boolean indicating if device is connected
 */
export const isNetworkConnected = (): boolean => {
  return isConnected;
};

/**
 * Log an operation that will be performed online or offline
 * @param operationType The type of operation being performed
 * @param details Additional details about the operation
 */
export const logOperationMode = (operationType: string, details?: any): void => {
  if (isConnected) {
    console.log(`🌐 [ONLINE] ${operationType}`, details || '');
  } else {
    console.log(`💾 [OFFLINE] ${operationType}`, details || '');
  }
}; 