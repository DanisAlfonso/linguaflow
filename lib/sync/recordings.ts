import { getUnsyncedRecordings, updateRecordingAfterSync } from '../db';
import { getRecordingUri } from '../fs/recordings';
import { uploadRecording } from '../api/audio';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';

let isSyncing = false;

export async function syncRecordings(): Promise<void> {
  // Prevent multiple sync operations
  if (isSyncing) {
    console.log('Sync already in progress');
    return;
  }

  try {
    isSyncing = true;

    // Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      console.log('No internet connection available');
      return;
    }

    // Get all unsynced recordings
    const unsyncedRecordings = await getUnsyncedRecordings();
    if (unsyncedRecordings.length === 0) {
      console.log('No recordings to sync');
      return;
    }

    console.log(`Found ${unsyncedRecordings.length} recordings to sync`);

    // Upload each recording
    let successCount = 0;
    let failureCount = 0;

    for (const recording of unsyncedRecordings) {
      try {
        console.log(`Processing recording for sync: ${recording.id}, path: ${recording.file_path}`);
        
        // First check if the file exists
        const fileInfo = await FileSystem.getInfoAsync(recording.file_path);
        if (!fileInfo.exists) {
          console.error(`Recording file not found at ${recording.file_path}`);
          failureCount++;
          continue;
        }
        
        // Get the local URI for the recording
        const uri = await getRecordingUri(recording.file_path);
        console.log(`Got URI for recording: ${uri}`);

        // Upload to Supabase
        const uploaded = await uploadRecording(recording.card_id, {
          uri,
          duration: Number(recording.duration),
        });

        // Update local record with sync status and remote URL
        await updateRecordingAfterSync(recording.id, uploaded.audio_url, uploaded.id);

        console.log(`Successfully synced recording ${recording.id}`);
        successCount++;
      } catch (error) {
        console.error(`Error syncing recording ${recording.id}:`, error);
        failureCount++;
      }
    }

    console.log(`Sync completed: ${successCount} successful, ${failureCount} failed`);
    
    if (successCount > 0) {
      Toast.show({
        type: 'success',
        text1: 'Sync Complete',
        text2: `Synced ${successCount} recordings${failureCount > 0 ? ` (${failureCount} failed)` : ''}`,
      });
    } else if (failureCount > 0) {
      Toast.show({
        type: 'error',
        text1: 'Sync Error',
        text2: `Failed to sync ${failureCount} recordings`,
      });
    }
  } catch (error) {
    console.error('Error during sync:', error);
    Toast.show({
      type: 'error',
      text1: 'Sync Error',
      text2: 'Failed to sync recordings',
    });
  } finally {
    isSyncing = false;
  }
}

// Function to check if there are any unsynced recordings
export async function hasUnsyncedRecordings(): Promise<boolean> {
  try {
    const unsyncedRecordings = await getUnsyncedRecordings();
    return unsyncedRecordings.length > 0;
  } catch (error) {
    console.error('Error checking unsynced recordings:', error);
    return false;
  }
} 