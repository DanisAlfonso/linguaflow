import NetInfo from '@react-native-community/netinfo';

/**
 * Check if the device is currently online
 * @returns Promise<boolean> True if the device is online
 */
export async function isOnline(): Promise<boolean> {
  try {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected !== null ? netInfo.isConnected : false;
  } catch (error) {
    console.error('Error checking network status:', error);
    // Default to assuming we're online if we can't check
    return true;
  }
} 