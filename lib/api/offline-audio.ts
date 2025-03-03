import * as FileSystem from 'expo-file-system';
import { saveAudioFile, generateAudioPath, ensureAudioDirectory } from '../fs/audio';
import { saveAudioFile as saveAudioFileToDb, LocalAudioFile, getAudioFilesInFolder } from '../db';
import { Platform } from 'react-native';

// Generate a random ID that's compatible with React Native
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${randomPart}`;
}

// Track which audio files are associated with which cards and sides
// This is a memory-based solution since we're not modifying the database schema
// In a full implementation, this would be stored in SQLite
const audioSegmentMap: Record<string, {cardId: string, side: 'front' | 'back', timestamp: number}> = {};

// Interface for offline audio file parameters
interface OfflineAudioParams {
  uri: string;
  mimeType: string;
  name: string;
  size: number;
  cardId: string;
  side: 'front' | 'back';
}

// Response interface for saved offline audio
interface SavedOfflineAudio {
  id: string;
  filePath: string;
  cardId: string;
  side: 'front' | 'back';
}

// Save an audio file locally and create necessary records
export async function saveAudioFileOffline(params: OfflineAudioParams): Promise<SavedOfflineAudio> {
  console.log('🔄 [OFFLINE AUDIO] Saving audio file offline', {
    cardId: params.cardId,
    side: params.side,
    name: params.name,
    size: params.size
  });

  try {
    // Ensure the audio directory exists
    console.log('🔄 [OFFLINE AUDIO] Ensuring audio directory exists');
    await ensureAudioDirectory();
    
    // Generate a path for the audio file
    const filePath = generateAudioPath(params.name);
    
    // Save the audio file to the filesystem
    console.log('🔄 [OFFLINE AUDIO] Copying file to local storage', { 
      source: params.uri, 
      destination: filePath 
    });
    await saveAudioFile(params.uri, filePath);
    console.log('✅ [OFFLINE AUDIO] File copied successfully to:', filePath);
    
    // Create an ID for the local audio file
    const audioFileId = generateId('local_audio');
    console.log('🔄 [OFFLINE AUDIO] Generated audio file ID:', audioFileId);
    
    // Get duration (if possible)
    let duration = 0;
    try {
      // We'll calculate an estimated duration from the file size
      // This is just a rough estimate (1MB ≈ 60 seconds for compressed audio)
      duration = Math.round((params.size / 1024 / 1024) * 60);
      console.log('🔄 [OFFLINE AUDIO] Estimated duration:', duration, 'seconds');
    } catch (error) {
      console.warn('⚠️ [OFFLINE AUDIO] Could not determine audio duration', error);
    }
    
    // Save audio file record to SQLite database
    console.log('🔄 [OFFLINE AUDIO] Creating database record for offline audio file');
    const userId = 'offline_user';  // Will be updated when synced
    
    const audioFile = await saveAudioFileToDb({
      user_id: userId,
      folder_id: null,
      title: params.name,
      artist: '',
      album: '',
      genre: '',
      year: new Date().getFullYear(),
      duration: duration,
      file_path: filePath,
      original_filename: params.name,
      mime_type: params.mimeType,
      size: params.size
    });
    console.log('✅ [OFFLINE AUDIO] Audio file saved to database with ID:', audioFile.id);
    
    // Create a local audio segment record
    // NOTE: Currently this is only a file record, we'll need to add a segments table 
    // in a future update to fully match the Supabase schema
    
    // Create a segment ID for this audio file
    const segmentId = generateId('offline_segment');
    console.log('🔄 [OFFLINE AUDIO] Generated segment ID:', segmentId);
    
    // Store the mapping between audio file and card/side
    audioSegmentMap[audioFile.id] = {
      cardId: params.cardId,
      side: params.side,
      timestamp: Date.now()
    };
    
    console.log('✅ [OFFLINE AUDIO] Audio file saved offline successfully', {
      id: audioFile.id,
      filePath: audioFile.file_path,
      cardId: params.cardId,
      side: params.side,
      segmentId
    });
    
    // In a production app, you would create an entry in a card_audio_segments table
    // For now, we'll return the necessary information to update the UI
    return {
      id: segmentId,
      filePath: audioFile.file_path,
      cardId: params.cardId,
      side: params.side
    };
    
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error saving audio file offline:', error);
    // Add more detailed error information
    if (error instanceof Error) {
      console.error('❌ [OFFLINE AUDIO] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    throw new Error(`Failed to save audio file offline: ${error}`);
  }
}

// Get offline audio segments for a card
export async function getOfflineAudioSegments(cardId: string): Promise<any[]> {
  console.log('🔄 [OFFLINE AUDIO] Fetching offline audio segments for card', { cardId });
  
  try {
    // Get all audio files from the database
    const audioFiles = await getAudioFilesInFolder(null);
    console.log('🔄 [OFFLINE AUDIO] Found audio files in database:', audioFiles.length);
    
    // Filter and map audio files to segments
    const segments = audioFiles
      .filter((file: LocalAudioFile) => {
        // Only include files that are mapped to this card
        const mapping = audioSegmentMap[file.id];
        return mapping && mapping.cardId === cardId;
      })
      .map((file: LocalAudioFile) => {
        // Create a segment ID
        const segmentId = generateId('offline_segment');
        
        // Get the side information from our mapping
        const side = audioSegmentMap[file.id]?.side || 'front';
        
        return {
          id: segmentId,
          card_id: cardId,
          audio_file: {
            id: file.id,
            name: file.title || file.original_filename,
            url: file.file_path, // Local file path
            duration: file.duration || 0
          },
          text_start: 0,
          text_end: 100, // Cover the entire text
          audio_start: 0,
          audio_end: (file.duration || 5) * 1000, // Convert seconds to milliseconds
          side: side
        };
      });
    
    // Log the side distribution
    const frontSegments = segments.filter(s => s.side === 'front').length;
    const backSegments = segments.filter(s => s.side === 'back').length;
    
    console.log('✅ [OFFLINE AUDIO] Returning segments for offline card', { 
      cardId,
      segmentCount: segments.length,
      frontSegments,
      backSegments,
      segments: segments.map((s: any) => ({ 
        id: s.id, 
        audioFile: s.audio_file.name,
        side: s.side
      }))
    });
    
    return segments;
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error fetching offline audio segments:', error);
    return [];
  }
}

// Sync offline audio files when coming back online
export async function syncOfflineAudioFiles(): Promise<void> {
  // This function would:
  // 1. Find all unsynced audio files
  // 2. Upload them to Supabase storage
  // 3. Create Supabase records for each file
  // 4. Update local records with sync status
  
  console.log('🔄 [OFFLINE AUDIO] Syncing offline audio files is not yet implemented');
  // Implementation to be added in a future update
} 