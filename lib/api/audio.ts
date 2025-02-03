import { supabase } from '@/lib/supabase';
import type { AudioFile, AudioSegment, AudioUploadResponse, CardAudioSegment } from '@/types/audio';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

interface UploadFileParams {
  uri: string;
  type: string;
  name: string;
  file?: File;
}

// Upload an audio file to Supabase Storage
export async function uploadAudioFile(params: UploadFileParams): Promise<AudioUploadResponse> {
  try {
    // Sanitize the filename to remove problematic characters
    const sanitizedName = params.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}-${sanitizedName}`;

    let fileData: File | Blob;
    
    if (Platform.OS === 'web') {
      // On web, we must use the File object directly
      if (!params.file) {
        throw new Error('File object is required for web uploads');
      }
      fileData = params.file;
    } else {
      // On native, we need to fetch the file data from the URI
      const fileInfo = await FileSystem.getInfoAsync(params.uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      // Read the file as base64 and convert to blob
      const base64 = await FileSystem.readAsStringAsync(params.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const arrayBuffer = Buffer.from(base64, 'base64');
      fileData = new Blob([arrayBuffer], { type: params.type });
    }

    // Verify file size (max 10MB)
    if (fileData.size > 10 * 1024 * 1024) {
      throw new Error('File size must be less than 10MB');
    }

    // Verify file type
    if (!params.type.startsWith('audio/')) {
      throw new Error('File must be an audio file');
    }

    console.log('Uploading file:', {
      name: filename,
      type: params.type,
      size: fileData.size,
    });

    // For web uploads, we'll use a different upload method
    if (Platform.OS === 'web') {
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filename, fileData, {
          contentType: params.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading audio file:', error);
        throw error;
      }

      if (!data?.path) {
        throw new Error('No path returned from upload');
      }

      return {
        path: data.path,
        fullPath: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${data.path}`,
      };
    } else {
      // For native uploads
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filename, fileData, {
          contentType: params.type,
          duplex: 'half',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading audio file:', error);
        throw error;
      }

      if (!data?.path) {
        throw new Error('No path returned from upload');
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

// Get all audio segments for a card
export async function getCardAudioSegments(cardId: string): Promise<CardAudioSegment[]> {
  const { data, error } = await supabase
    .rpc('get_card_audio_segments', {
      p_card_id: cardId,
    });

  if (error) {
    console.error('Error getting card audio segments:', error);
    throw error;
  }

  return data || [];
}

// Delete an audio segment
export async function deleteAudioSegment(segmentId: string): Promise<void> {
  const { error } = await supabase
    .from('card_audio_segments')
    .delete()
    .eq('id', segmentId);

  if (error) {
    console.error('Error deleting audio segment:', error);
    throw error;
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