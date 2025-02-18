import { supabase } from '@/lib/supabase';
import type { AudioFile, AudioSegment, AudioUploadResponse, CardAudioSegment, Recording, RecordingFile } from '@/types/audio';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode as base64Decode } from 'base-64';
import { getLocalRecordings, deleteLocalRecording } from '../db';
import { deleteRecordingFile, cleanupLocalRecordings } from '../fs/recordings';

// Re-export the cleanupLocalRecordings function
export { cleanupLocalRecordings } from '../fs/recordings';

// Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = base64Decode(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

// Define the progress event type
interface UploadProgressEvent {
  loaded: number;
  total: number;
}

interface UploadFileParams {
  uri: string;
  type: string;
  name: string;
  file?: File;
  onProgress?: (progress: number) => void;
}

// Upload an audio file to Supabase Storage
export async function uploadAudioFile(params: UploadFileParams): Promise<AudioUploadResponse> {
  try {
    // Sanitize the filename to remove problematic characters
    const sanitizedName = params.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}-${sanitizedName}`;

    // Verify file type
    if (!params.type.startsWith('audio/')) {
      throw new Error('File must be an audio file');
    }

    if (Platform.OS === 'web') {
      // On web, we must use the File object directly
      if (!params.file) {
        throw new Error('File object is required for web uploads');
      }

      // Verify file size (max 10MB)
      if (params.file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filename, params.file, {
          contentType: params.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      if (!data?.path) {
        throw new Error('No path returned from upload');
      }

      // Simulate upload progress on web
      if (params.onProgress) {
        params.onProgress(100);
      }

      return {
        path: data.path,
        fullPath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${data.path}`,
      };
    } else {
      // On native, we need to fetch the file data from the URI
      const fileInfo = await FileSystem.getInfoAsync(params.uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Verify file size (max 10MB)
      if (fileInfo.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB');
      }

      // Read the file as base64
      const base64Data = await FileSystem.readAsStringAsync(params.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to binary data
      const binaryData = base64ToUint8Array(base64Data);

      // Upload with simulated progress
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filename, binaryData, {
          contentType: params.type,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      if (!data?.path) {
        throw new Error('No path returned from upload');
      }

      // Simulate upload progress on native
      if (params.onProgress) {
        params.onProgress(100);
      }

      return {
        path: data.path,
        fullPath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${data.path}`,
      };
    }
  } catch (error) {
    console.error('Error in uploadAudioFile:', error);
    throw error;
  }
}

// Create an audio file record in the database
export async function createAudioFile(
  filePath: string,
  originalFilename: string,
  mimeType: string
): Promise<AudioFile> {
  const { data, error } = await supabase
    .from('audio_files')
    .insert({
      file_path: filePath,
      original_filename: originalFilename,
      mime_type: mimeType,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating audio file record:', error);
    throw error;
  }

  return data;
}

// Create an audio segment for a card
export async function createAudioSegment(
  cardId: string,
  audioFileId: string,
  textStart: number,
  textEnd: number,
  side: 'front' | 'back'
): Promise<AudioSegment> {
  const { data, error } = await supabase
    .from('card_audio_segments')
    .insert({
      card_id: cardId,
      audio_file_id: audioFileId,
      text_start: textStart,
      text_end: textEnd,
      side,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating audio segment:', error);
    throw error;
  }

  return data;
}

// Add interface for database response
interface CardAudioSegmentRow {
  id: string;
  audio_file_path: string;
  text_start: number;
  text_end: number;
  side: string;
}

// Get all audio segments for a card
export async function getCardAudioSegments(cardId: string): Promise<CardAudioSegment[]> {
  const { data, error } = await supabase
    .rpc('get_card_audio_segments', {
      p_card_id: cardId,
    }) as { data: CardAudioSegmentRow[] | null, error: any };

  if (error) {
    console.error('Error getting card audio segments:', error);
    throw error;
  }

  // Transform the data to match the CardAudioSegment interface
  return (data || []).map(segment => {
    // Get the public URL for the audio file
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(segment.audio_file_path);

    // Ensure the URL is using the correct Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const finalUrl = publicUrl.startsWith('http') 
      ? publicUrl 
      : `${supabaseUrl}/storage/v1/object/public/audio/${segment.audio_file_path}`;

    console.log('Audio segment processing:', {
      segmentId: segment.id,
      path: segment.audio_file_path,
      publicUrl,
      finalUrl,
      side: segment.side
    });

    return {
      id: segment.id,
      audio_file: {
        url: finalUrl,
        name: segment.audio_file_path.split('/').pop() || 'audio file',
      },
      text_start: segment.text_start,
      text_end: segment.text_end,
      side: segment.side as 'front' | 'back',
    };
  });
}

// Add interface for the segment with audio file info
interface AudioSegmentWithFile {
  id: string;
  audio_file_id: string;
  audio_files: {
    id: string;
    file_path: string;
  };
}

// Delete an audio segment and its associated audio file
export async function deleteAudioSegment(segmentId: string): Promise<void> {
  // First get the segment with its audio file info
  const { data: segment, error: fetchError } = await supabase
    .from('card_audio_segments')
    .select(`
      id,
      audio_file_id,
      audio_files (
        id,
        file_path
      )
    `)
    .eq('id', segmentId)
    .single<AudioSegmentWithFile>();

  if (fetchError) {
    console.error('Error fetching audio segment:', fetchError);
    throw fetchError;
  }

  if (!segment) {
    throw new Error('Audio segment not found');
  }

  // Delete the segment first
  const { error: deleteError } = await supabase
    .from('card_audio_segments')
    .delete()
    .eq('id', segmentId);

  if (deleteError) {
    console.error('Error deleting audio segment:', deleteError);
    throw deleteError;
  }

  // Then delete the audio file and its storage object
  if (segment.audio_files?.file_path) {
    try {
      await deleteAudioFile(segment.audio_file_id, segment.audio_files.file_path);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      // We don't throw here since the segment is already deleted
    }
  }
}

// Delete an audio file and its storage object
export async function deleteAudioFile(audioFileId: string, filePath: string): Promise<void> {
  // First delete the storage object
  const { error: storageError } = await supabase.storage
    .from('audio')
    .remove([filePath]);

  if (storageError) {
    console.error('Error deleting audio file from storage:', storageError);
    throw storageError;
  }

  // Then delete the database record
  const { error: dbError } = await supabase
    .from('audio_files')
    .delete()
    .eq('id', audioFileId);

  if (dbError) {
    console.error('Error deleting audio file record:', dbError);
    throw dbError;
  }
}

// Get a signed URL for an audio file
export async function getAudioFileUrl(filePath: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from('audio')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned');
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting audio file URL:', error);
    throw error;
  }
}

/**
 * Validates if a track's audio file exists in storage
 */
export const validateTrackFile = async (trackId: string): Promise<boolean> => {
  try {
    const { data: exists, error } = await supabase
      .rpc('validate_track_file', { p_track_id: trackId });

    if (error) {
      console.error('Error validating track file:', error);
      return false;
    }

    return exists;
  } catch (error) {
    console.error('Error validating track file:', error);
    return false;
  }
};

// Add type definition for the track response
type TrackWithFile = {
  id: string;
  audioFile: {
    id: string;
    file_path: string;
  };
};

/**
 * Deletes a track and its associated audio file
 */
export const deleteTrack = async (trackId: string): Promise<void> => {
  try {
    // First get the track details to get the file path
    const { data: track, error: trackError } = await supabase
      .from('audio_tracks')
      .select(`
        id,
        audioFile:audio_files!inner(
          id,
          file_path
        )
      `)
      .eq('id', trackId)
      .single<TrackWithFile>();

    if (trackError) {
      throw trackError;
    }

    if (!track) {
      throw new Error('Track not found');
    }

    // Try to delete the file from storage first
    if (track.audioFile?.file_path) {
      try {
        const { error: storageError } = await supabase.storage
          .from('audio')
          .remove([track.audioFile.file_path]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      } catch (storageError) {
        console.error('Error accessing storage:', storageError);
      }
    }

    // Delete the audio file record (this will cascade to audio_tracks)
    if (track.audioFile?.id) {
      const { error: audioFileError } = await supabase
        .from('audio_files')
        .delete()
        .eq('id', track.audioFile.id);

      if (audioFileError) {
        throw audioFileError;
      }
    }
  } catch (error) {
    console.error('Error deleting track:', error);
    throw error;
  }
};

export async function uploadRecording(cardId: string, file: RecordingFile): Promise<Recording> {
  // Create a user-friendly default name with date and time
  const now = new Date();
  const defaultName = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  const fileName = `${cardId}/${Date.now()}.m4a`;
  const filePath = `recordings/${fileName}`;

  try {
    // Read the file data
    const fileInfo = await FileSystem.getInfoAsync(file.uri);
    if (!fileInfo.exists) {
      throw new Error('Recording file not found');
    }

    let fileData;
    if (Platform.OS === 'web') {
      fileData = file.uri;
    } else {
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      fileData = base64ToUint8Array(base64);
    }

    // Upload the recording file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, fileData, {
        contentType: 'audio/mp4',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(filePath);

    // Get the current user's ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Failed to get current user');
    }

    // Create the recording record in the database with the user-friendly name
    const { data: recording, error: dbError } = await supabase
      .from('recordings')
      .insert({
        card_id: cardId,
        user_id: user.id,
        audio_url: publicUrl,
        duration: file.duration,
        name: defaultName,
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    return recording;
  } catch (error) {
    console.error('Error uploading recording:', error);
    throw error;
  }
}

// Get recordings for a specific card
export async function getCardRecordings(cardId: string): Promise<Recording[]> {
  console.log('Fetching recordings from API for card:', cardId);
  const { data, error } = await supabase
    .rpc('get_card_recordings', {
      p_card_id: cardId,
    });

  if (error) {
    console.error('Error fetching recordings:', error);
    throw new Error('Failed to fetch recordings');
  }

  console.log('API response:', data);
  return data || [];
}

export async function deleteRecording(recordingId: string): Promise<void> {
  // First get the recording to get the file path
  const { data: recording, error: fetchError } = await supabase
    .from('recordings')
    .select('audio_url')
    .eq('id', recordingId)
    .single();

  if (fetchError) {
    console.error('Error fetching recording:', fetchError);
    throw new Error('Failed to fetch recording');
  }

  // Delete from storage
  const filePath = recording.audio_url.split('/').slice(-2).join('/');
  const { error: storageError } = await supabase.storage
    .from('audio')
    .remove([`recordings/${filePath}`]);

  if (storageError) {
    console.error('Error deleting recording file:', storageError);
    // Continue to delete the record even if file deletion fails
  }

  // Delete the record
  const { error: deleteError } = await supabase
    .from('recordings')
    .delete()
    .eq('id', recordingId);

  if (deleteError) {
    console.error('Error deleting recording:', deleteError);
    throw new Error('Failed to delete recording');
  }
}