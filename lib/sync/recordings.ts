import { getUnsyncedRecordings, updateRecordingAfterSync } from '../db';
import { getRecordingUri } from '../fs/recordings';
import { uploadRecording } from '../api/audio';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

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
    for (const recording of unsyncedRecordings) {
      try {
        // Get the local URI for the recording
        const uri = await getRecordingUri(recording.file_path);

        // Upload to Supabase
        const uploaded = await uploadRecording(recording.card_id, {
          uri,
          duration: recording.duration,
        });

        // Update local record with sync status and remote URL
        await updateRecordingAfterSync(recording.id, uploaded.audio_url);

        console.log(`Synced recording ${recording.id}`);
      } catch (error) {
        console.error(`Error syncing recording ${recording.id}:`, error);
      }
    }

    Toast.show({
      type: 'success',
      text1: 'Sync Complete',
      text2: `Synced ${unsyncedRecordings.length} recordings`,
    });
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