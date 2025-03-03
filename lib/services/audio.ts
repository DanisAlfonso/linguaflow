import { Platform } from 'react-native';
import * as SupabaseAPI from '../api/audio';
import * as OfflineAPI from '../api/offline-audio';
import { isOnline } from './flashcards';
import { syncRecordings } from '../sync/recordings';
import type { CardAudioSegment, Recording } from '../../types/audio';

/**
 * Get audio segments for a card with offline support
 * 
 * This service function provides unified access to card audio segments,
 * working in both online and offline modes. It first attempts to fetch
 * segments from Supabase when online, then falls back to local storage
 * for offline operation or if the Supabase request fails.
 */
export async function getCardAudioSegments(cardId: string): Promise<CardAudioSegment[]> {
  try {
    console.log(`📡 [AUDIO SERVICE] Getting audio segments for card: ${cardId}`);
    
    // Check if we're online
    const networkStatus = await isOnline();
    console.log(`📡 [AUDIO SERVICE] Network status: ${networkStatus ? 'Online' : 'Offline'}`);
    
    // Check if this is a local card ID
    const isLocalId = cardId.startsWith('local_') || cardId.startsWith('offline_');
    
    if (networkStatus && !isLocalId) {
      // Online mode and not a local ID - try to get from Supabase
      try {
        console.log(`📡 [AUDIO SERVICE] Fetching audio segments from Supabase: ${cardId}`);
        const segments = await SupabaseAPI.getCardAudioSegments(cardId);
        
        if (segments && segments.length > 0) {
          console.log(`📡 [AUDIO SERVICE] Found ${segments.length} audio segments in Supabase`);
          return segments;
        } else {
          console.log(`📡 [AUDIO SERVICE] No audio segments found in Supabase, checking offline storage`);
        }
      } catch (error) {
        console.error(`❌ [AUDIO SERVICE] Error fetching audio segments from Supabase:`, error);
        console.log(`📡 [AUDIO SERVICE] Falling back to offline storage`);
      }
    }
    
    // Offline mode or Supabase failed - try to get from offline storage
    console.log(`📡 [AUDIO SERVICE] Fetching audio segments from offline storage: ${cardId}`);
    try {
      const offlineSegments = await OfflineAPI.getOfflineAudioSegments(cardId);
      console.log(`📡 [AUDIO SERVICE] Found ${offlineSegments.length} offline audio segments`);
      return offlineSegments;
    } catch (error) {
      console.error(`❌ [AUDIO SERVICE] Error fetching offline audio segments:`, error);
      // Return empty array if offline fetch fails
      return [];
    }
  } catch (error) {
    console.error(`❌ [AUDIO SERVICE] Error in getCardAudioSegments:`, error);
    return [];
  }
}

/**
 * Save an audio recording with offline support
 * 
 * This function saves an audio recording to local storage when offline,
 * or uploads it to Supabase when online. In either case, the recording
 * is always saved locally first to ensure it's available offline.
 */
export async function saveAudioRecording(params: {
  uri: string,
  cardId: string,
  side: 'front' | 'back',
  name: string,
  size: number,
  duration: number
}): Promise<{ segmentId: string, audioUrl: string }> {
  try {
    console.log(`📡 [AUDIO SERVICE] Saving audio recording for card: ${params.cardId}`);
    
    // Always save locally first to ensure it's available offline
    console.log(`📡 [AUDIO SERVICE] Saving audio file to local storage`);
    const offlineResult = await OfflineAPI.saveAudioFileOffline({
      uri: params.uri,
      cardId: params.cardId,
      side: params.side,
      name: params.name,
      size: params.size,
      mimeType: 'audio/mp4',
    });
    
    // Check if we're online
    const networkStatus = await isOnline();
    console.log(`📡 [AUDIO SERVICE] Network status: ${networkStatus ? 'Online' : 'Offline'}`);
    
    // If online, also upload to Supabase
    if (networkStatus) {
      try {
        console.log(`📡 [AUDIO SERVICE] Uploading audio to Supabase`);
        const uploadResult = await SupabaseAPI.uploadRecording(params.cardId, {
          uri: params.uri,
          duration: params.duration,
        });
        
        console.log(`📡 [AUDIO SERVICE] Uploaded to Supabase successfully`);
        return {
          segmentId: uploadResult.id,
          audioUrl: uploadResult.audio_url,
        };
      } catch (error) {
        console.error(`❌ [AUDIO SERVICE] Error uploading to Supabase:`, error);
        console.log(`📡 [AUDIO SERVICE] Using local storage only`);
      }
    }
    
    // Return the offline result if we're offline or if the upload failed
    return {
      segmentId: offlineResult.id,
      audioUrl: offlineResult.filePath,
    };
  } catch (error) {
    console.error(`❌ [AUDIO SERVICE] Error saving audio recording:`, error);
    throw error;
  }
}

/**
 * Sync audio recordings between local storage and Supabase
 * 
 * This function checks for any locally saved recordings that haven't been
 * synced to Supabase yet, and uploads them when the device is online.
 */
export async function syncAudioRecordings(): Promise<boolean> {
  try {
    console.log(`📡 [AUDIO SERVICE] Syncing audio recordings`);
    
    // Check if we're online
    const networkStatus = await isOnline();
    if (!networkStatus) {
      console.log(`📡 [AUDIO SERVICE] Offline - cannot sync recordings`);
      return false;
    }
    
    // Use the existing sync mechanism
    await syncRecordings();
    return true;
  } catch (error) {
    console.error(`❌ [AUDIO SERVICE] Error syncing audio recordings:`, error);
    return false;
  }
}

/**
 * Get recordings for a card with offline support
 */
export async function getCardRecordings(cardId: string): Promise<Recording[]> {
  try {
    console.log(`📡 [AUDIO SERVICE] Getting recordings for card: ${cardId}`);
    
    // Check if we're online
    const networkStatus = await isOnline();
    console.log(`📡 [AUDIO SERVICE] Network status: ${networkStatus ? 'Online' : 'Offline'}`);
    
    if (networkStatus) {
      try {
        console.log(`📡 [AUDIO SERVICE] Fetching recordings from Supabase: ${cardId}`);
        const recordings = await SupabaseAPI.getCardRecordings(cardId);
        
        if (recordings && recordings.length > 0) {
          console.log(`📡 [AUDIO SERVICE] Found ${recordings.length} recordings in Supabase`);
          return recordings;
        }
      } catch (error) {
        console.error(`❌ [AUDIO SERVICE] Error fetching recordings from Supabase:`, error);
      }
    }
    
    // No recordings found online or offline - return empty array
    console.log(`📡 [AUDIO SERVICE] No recordings found`);
    return [];
  } catch (error) {
    console.error(`❌ [AUDIO SERVICE] Error in getCardRecordings:`, error);
    return [];
  }
} 