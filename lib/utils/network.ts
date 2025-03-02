import NetInfo from '@react-native-community/netinfo';

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
        console.log('📡 [NETWORK] Connection restored, sync may be needed');
      } else {
        console.log('📡 [NETWORK] Device is offline, switching to local mode');
      }
    }
  });
  
  return unsubscribe;
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