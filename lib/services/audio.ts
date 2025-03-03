import { Platform } from 'react-native';
import * as SupabaseAPI from '../api/audio';
import * as OfflineAPI from '../api/offline-audio';
import { isOnline } from './flashcards';
import type { CardAudioSegment } from '../../types/audio';

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