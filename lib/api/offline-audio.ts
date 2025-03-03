import * as FileSystem from 'expo-file-system';
import { saveAudioFile, generateAudioPath, ensureAudioDirectory } from '../fs/audio';
import { saveAudioFile as saveAudioFileToDb, LocalAudioFile, getAudioFilesInFolder, ensureDatabase } from '../db';
import { Platform } from 'react-native';
import type { CardAudioSegment } from '@/types/audio';
import { uploadAudioFile, createAudioFile, createAudioSegment } from '../api/audio';
import { getCard, isOnline } from '../services/flashcards';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Key for storing the mapping in AsyncStorage
const AUDIO_SEGMENT_MAP_KEY = 'linguaflow_audio_segment_map';

// Load the audio segment map from AsyncStorage
async function loadAudioSegmentMap() {
  try {
    const storedMap = await AsyncStorage.getItem(AUDIO_SEGMENT_MAP_KEY);
    if (storedMap) {
      const parsedMap = JSON.parse(storedMap);
      // Merge with the current map
      Object.assign(audioSegmentMap, parsedMap);
      console.log(`🔄 [OFFLINE AUDIO] Loaded ${Object.keys(parsedMap).length} audio segment mappings from storage`);
      
      // Debug log to verify back side mappings are correctly loaded
      const backSideCount = Object.values(parsedMap)
        .filter((mapping: any) => mapping.side === 'back')
        .length;
      
      console.log(`🔍 [OFFLINE AUDIO] Loaded mappings by side: back=${backSideCount}, front=${Object.keys(parsedMap).length - backSideCount}`);
    }
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error loading audio segment map:', error);
  }
}

// Save the audio segment map to AsyncStorage
async function saveAudioSegmentMap() {
  try {
    await AsyncStorage.setItem(AUDIO_SEGMENT_MAP_KEY, JSON.stringify(audioSegmentMap));
    console.log(`🔄 [OFFLINE AUDIO] Saved ${Object.keys(audioSegmentMap).length} audio segment mappings to storage`);
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error saving audio segment map:', error);
  }
}

// Load the mapping on module initialization
loadAudioSegmentMap();

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
    const timestamp = Date.now();
    const sanitizedName = params.name.replace(/[^a-zA-Z0-9]/g, '_');
    const targetPath = await generateAudioPath(`${timestamp}_${sanitizedName}`);
    
    console.log('🔄 [OFFLINE AUDIO] Saving audio file from', { 
      source: params.uri,
      destination: targetPath
    });
    
    // Save the file to the filesystem
    await saveAudioFile(params.uri, targetPath);
    console.log('✅ [OFFLINE AUDIO] Audio file saved to filesystem');
    
    // Estimate audio duration based on file size
    // This is a rough estimate and can be improved
    let estimatedDuration = 1; // Default to 1 second
    try {
      // Assuming average of 128 kbps bit rate for MP3
      estimatedDuration = Math.max(1, Math.round(params.size / (128 * 1024 / 8)));
      console.log('🔄 [OFFLINE AUDIO] Estimated audio duration:', estimatedDuration, 'seconds');
    } catch (durationError) {
      console.error('❌ [OFFLINE AUDIO] Error estimating duration, using default:', durationError);
    }
    
    // Create a record in the database
    console.log('🔄 [OFFLINE AUDIO] Creating audio file record in database');
    const audioFile = await saveAudioFileToDb({
      folder_id: null,
      user_id: 'offline_user', // This will be replaced when syncing
      title: params.name,
      artist: undefined,
      album: undefined,
      genre: undefined,
      year: undefined,
      duration: estimatedDuration,
      file_path: targetPath,
      original_filename: params.name,
      mime_type: params.mimeType,
      size: params.size,
    });
    
    console.log('✅ [OFFLINE AUDIO] Audio file record created in database:', audioFile.id);
    
    // Create a segment ID for this audio file
    const segmentId = generateId('offline_segment');
    console.log('🔄 [OFFLINE AUDIO] Generated segment ID:', segmentId);
    
    // Store the mapping between audio file and card/side
    audioSegmentMap[audioFile.id] = {
      cardId: params.cardId,
      side: params.side,
      timestamp: Date.now()
    };
    
    // Save the updated mapping to persistent storage
    await saveAudioSegmentMap();
    console.log('✅ [OFFLINE AUDIO] Audio segment mapping stored:', {
      fileId: audioFile.id,
      cardId: params.cardId,
      side: params.side
    });
    
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
export async function getOfflineAudioSegments(cardId: string): Promise<CardAudioSegment[]> {
  try {
    console.log('🔄 [OFFLINE AUDIO] Fetching offline audio segments for card:', cardId);
    
    // Debug log the current mapping state
    console.log('🔍 [OFFLINE AUDIO DEBUG] Current audioSegmentMap state:', 
      Object.entries(audioSegmentMap).map(([fileId, data]) => ({
        fileId,
        cardId: data.cardId,
        side: data.side,
        timestamp: new Date(data.timestamp).toISOString()
      }))
    );
    
    // Ensure database is ready
    await ensureDatabase();
    
    // Get all audio files
    const audioFiles = await getAudioFilesInFolder(null);
    console.log('🔄 [OFFLINE AUDIO] Found audio files in database:', audioFiles.length);
    
    // List all audio files for debugging
    console.log('🔍 [OFFLINE AUDIO DEBUG] Audio files in database:', 
      audioFiles.map(file => ({
        id: file.id,
        title: file.title,
        filename: file.original_filename,
        hasMapping: Boolean(audioSegmentMap[file.id]),
        mappingSide: audioSegmentMap[file.id]?.side || 'unknown'
      }))
    );
    
    // Filter to get front and back sides
    const frontFiles = audioFiles.filter((file) => {
      const mapping = audioSegmentMap[file.id];
      return mapping && mapping.cardId === cardId && mapping.side === 'front';
    });
    
    const backFiles = audioFiles.filter((file) => {
      const mapping = audioSegmentMap[file.id];
      return mapping && mapping.cardId === cardId && mapping.side === 'back';
    });
    
    console.log(`🔄 [OFFLINE AUDIO] Distribution: front=${frontFiles.length}, back=${backFiles.length}`);

    // Debug individual mappings for back files to identify potential issues
    if (backFiles.length > 0) {
      console.log('🔍 [OFFLINE AUDIO DEBUG] Back files details:', 
        backFiles.map(file => ({
          id: file.id,
          title: file.title,
          mapping: audioSegmentMap[file.id]
        }))
      );
    } else {
      // Check if there are any back mappings for this card at all
      const anyBackMappings = Object.entries(audioSegmentMap)
        .filter(([_, data]) => data.cardId === cardId && data.side === 'back')
        .map(([fileId, data]) => ({ fileId, ...data }));
      
      if (anyBackMappings.length > 0) {
        console.log('⚠️ [OFFLINE AUDIO] Found back mappings but no matching files:', anyBackMappings);
        
        // Check if those file IDs exist in the database at all
        const missingFileIds = anyBackMappings.map(m => m.fileId);
        const foundFiles = audioFiles.filter(f => missingFileIds.includes(f.id));
        console.log('🔍 [OFFLINE AUDIO DEBUG] Files that should have back mappings:', 
          foundFiles.map(f => ({ id: f.id, title: f.title }))
        );
      }
    }
    
    // Filter and map audio files to segments
    const segments = audioFiles
      .filter((file) => {
        // Only include files that are mapped to this card
        const mapping = audioSegmentMap[file.id];
        const isMapped = mapping && mapping.cardId === cardId;
        
        if (mapping && mapping.cardId === cardId) {
          console.log(`🔄 [OFFLINE AUDIO] Mapping found for file ${file.id}: side=${mapping.side}`);
        }
        
        return isMapped;
      })
      .map((file) => {
        // Generate a deterministic segment ID based on the file ID
        // This ensures the same segment ID is used for the same audio file
        const fileId = file.id;
        const segmentId = `offline_segment_${fileId.split('_').slice(-2).join('_')}`;
        
        // Get the side information from our mapping
        const side = audioSegmentMap[file.id]?.side || 'front';
        
        console.log(`🔄 [OFFLINE AUDIO] Created segment for ${side} side:`, {
          fileId,
          segmentId,
          side,
          fileName: file.title || file.original_filename
        });
        
        // Ensure side is properly set
        if (!['front', 'back'].includes(side)) {
          console.error(`⚠️ [OFFLINE AUDIO] Invalid side value: ${side}, defaulting to 'front'`);
        }
        
        return {
          id: segmentId,
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
          side: side as 'front' | 'back' // Explicitly cast to ensure correct type
        };
      });
    
    console.log(`🔄 [OFFLINE AUDIO] Found ${segments.length} segments for card ${cardId}`);
    
    // Debug logging for segment distribution by side
    const frontSegments = segments.filter(s => s.side === 'front');
    const backSegments = segments.filter(s => s.side === 'back');
    console.log(`🔄 [OFFLINE AUDIO] Returning segments by side: front=${frontSegments.length}, back=${backSegments.length}`);
    
    return segments;
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error getting offline audio segments:', error);
    return []; // Return empty array instead of throwing
  }
}

// Sync offline audio files when coming back online
export async function syncOfflineAudioFiles(): Promise<void> {
  console.log('🔄 [OFFLINE AUDIO] Starting sync of offline audio files');
  
  try {
    // 1. Find all unsynced audio files
    const audioFiles = await getAudioFilesInFolder(null);
    
    // Filter for unsynced files (those that don't have a remote_id)
    const unsyncedFiles = audioFiles.filter(file => !file.remote_id || file.remote_id === 'null');
    
    console.log(`🔄 [OFFLINE AUDIO] Found ${unsyncedFiles.length} unsynced audio files`);
    
    if (unsyncedFiles.length === 0) {
      console.log('✅ [OFFLINE AUDIO] No offline audio files to sync');
      return;
    }
    
    // Check if we're online
    const networkAvailable = await isOnline();
    if (!networkAvailable) {
      console.log('❌ [OFFLINE AUDIO] Cannot sync - device is offline');
      return;
    }
    
    // 2. Upload each file to Supabase and create records
    for (const file of unsyncedFiles) {
      try {
        console.log(`🔄 [OFFLINE AUDIO] Syncing file: ${file.title} (${file.id})`);
        
        // Find the mapping for this file to get the cardId and side
        const fileMapping = Object.entries(audioSegmentMap)
          .find(([key]) => key === file.id);
          
        if (!fileMapping) {
          console.log(`⚠️ [OFFLINE AUDIO] No mapping found for file ${file.id}, skipping`);
          continue;
        }
        
        const [fileId, { cardId, side }] = fileMapping;
        console.log(`🔄 [OFFLINE AUDIO] File belongs to card ${cardId}, side: ${side}`);
        
        // Check if the card exists
        const card = await getCard(cardId);
        
        if (!card) {
          console.log(`⚠️ [OFFLINE AUDIO] Card ${cardId} not found, skipping audio sync`);
          continue;
        }
        
        // If the card is still a local card, we need to wait for it to be synced first
        // Checking if the card ID starts with 'local_' indicates it hasn't been synced yet
        if (cardId.startsWith('local_')) {
          console.log(`⚠️ [OFFLINE AUDIO] Card ${cardId} appears to be local, marking for later sync`);
          // We'll skip for now - these will be synced once the card is synced
          continue;
        }
        
        // Get the effective card ID for the remote operation
        // For now, just use the cardId directly as we're checking local IDs above
        const effectiveCardId = cardId;
        
        // Get file from filesystem
        const fileUri = file.file_path;
        
        try {
          // Upload the file to Supabase storage
          console.log(`🔄 [OFFLINE AUDIO] Uploading file from ${fileUri}`);
          const uploadResponse = await uploadAudioFile({
            uri: fileUri,
            type: file.mime_type,
            name: file.original_filename,
          });
          
          console.log(`✅ [OFFLINE AUDIO] File uploaded to Supabase storage: ${uploadResponse.path}`);
          
          // Create audio file record in Supabase
          const audioFile = await createAudioFile(
            uploadResponse.path,
            file.original_filename,
            file.mime_type
          );
          
          console.log(`✅ [OFFLINE AUDIO] Audio file record created in Supabase: ${audioFile.id}`);
          
          // Create audio segment in Supabase
          const segment = await createAudioSegment(
            effectiveCardId,
            audioFile.id,
            0, // start time
            file.duration || 1, // duration
            side
          );
          
          console.log(`✅ [OFFLINE AUDIO] Audio segment created in Supabase: ${segment.id}`);
          
          // Update local record with remote IDs
          const database = await ensureDatabase();
          if (database) {
            await database.runAsync(
              'UPDATE audio_files SET remote_id = ?, remote_url = ?, synced = 1 WHERE id = ?',
              [audioFile.id, uploadResponse.path, file.id]
            );
            console.log(`✅ [OFFLINE AUDIO] Local file record updated with remote ID`);
          }
        } catch (uploadError) {
          console.error(`❌ [OFFLINE AUDIO] Error syncing file ${file.id}:`, uploadError);
          // Continue with next file
        }
      } catch (fileError) {
        console.error(`❌ [OFFLINE AUDIO] Error processing file ${file.id}:`, fileError);
        // Continue with next file
      }
    }
    
    console.log('✅ [OFFLINE AUDIO] Offline audio sync completed');
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error syncing offline audio files:', error);
    throw new Error(`Failed to sync offline audio files: ${error}`);
  }
}

// Delete an offline audio segment
export async function deleteOfflineAudioSegment(segmentId: string): Promise<void> {
  console.log('🔄 [OFFLINE AUDIO] Deleting offline audio segment', { segmentId });
  
  try {
    // Extract the audio file ID from the segment ID
    // This is a simple implementation - in a full app you'd likely have a mapping table
    
    // First, find audio files that are mapped to segments with this ID
    const audioFiles = await getAudioFilesInFolder(null);
    
    // Find audio files that correspond to this segment
    let deletedFile = false;
    
    for (const audioFile of audioFiles) {
      // Check if this file is associated with the segmentId
      // In a real implementation, you'd query a card_audio_segments table
      // For now, we'll just delete if the ID pattern matches
      
      const fileId = audioFile.id;
      const mappedSegmentId = `offline_segment_${fileId.split('_').slice(-2).join('_')}`;
      
      if (mappedSegmentId === segmentId) {
        console.log('🔄 [OFFLINE AUDIO] Found matching audio file to delete', { 
          fileId, 
          filePath: audioFile.file_path 
        });
        
        // Delete the file from the filesystem
        try {
          await FileSystem.deleteAsync(audioFile.file_path, { idempotent: true });
          console.log('✅ [OFFLINE AUDIO] Deleted file from filesystem');
        } catch (fsError) {
          console.error('❌ [OFFLINE AUDIO] Error deleting file from filesystem:', fsError);
          // Continue to delete from database even if file deletion fails
        }
        
        // Delete from database
        try {
          // Delete the audio file from the database
          // We need to use a different approach since saveAudioFileToDb expects a file object
          const database = await ensureDatabase();
          if (database) {
            await database.runAsync('DELETE FROM audio_files WHERE id = ?', [audioFile.id]);
            console.log('✅ [OFFLINE AUDIO] Deleted audio file record from database');
            deletedFile = true;
          }
        } catch (dbError) {
          console.error('❌ [OFFLINE AUDIO] Error deleting from database:', dbError);
          throw dbError;
        }
        
        // Remove from the mapping
        if (audioSegmentMap[audioFile.id]) {
          delete audioSegmentMap[audioFile.id];
          console.log('✅ [OFFLINE AUDIO] Removed file from segment mapping');
          
          // Save the updated mapping to persistent storage
          await saveAudioSegmentMap();
        }
        
        // In a full implementation, you'd also delete from the card_audio_segments table
        break;
      }
    }
    
    if (!deletedFile) {
      console.log('⚠️ [OFFLINE AUDIO] No matching audio file found for segment', { segmentId });
    }
    
  } catch (error) {
    console.error('❌ [OFFLINE AUDIO] Error deleting offline audio segment:', error);
    throw new Error(`Failed to delete offline audio segment: ${error}`);
  }
} 