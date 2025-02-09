import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const AUDIO_DIRECTORY = `${FileSystem.documentDirectory}audio/`;

// Ensure the audio directory exists
export async function ensureAudioDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, { intermediates: true });
  }
}

// Generate a unique path for an audio file
export function generateAudioPath(filename: string): string {
  // Sanitize filename to prevent path traversal
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const timestamp = Date.now();
  return `${AUDIO_DIRECTORY}${timestamp}_${sanitizedFilename}`;
}

// Save an audio file to local storage
export async function saveAudioFile(uri: string, targetPath: string): Promise<void> {
  if (Platform.OS === 'web') {
    // For web, fetch the file and write it
    const response = await fetch(uri);
    const blob = await response.blob();
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          await FileSystem.writeAsStringAsync(targetPath, base64.split(',')[1], {
            encoding: FileSystem.EncodingType.Base64,
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } else {
    // For mobile, move the temporary file to permanent storage
    await FileSystem.moveAsync({
      from: uri,
      to: targetPath,
    });
  }
}

// Delete an audio file
export async function deleteAudioFile(filePath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  } catch (error) {
    console.error('Error deleting audio file:', error);
    throw error;
  }
}

// Get the local URI for an audio file
export async function getAudioFileUri(filePath: string): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  if (!fileInfo.exists) {
    throw new Error('Audio file not found');
  }
  return fileInfo.uri;
}

// Check if a file exists in local storage
export async function checkAudioFileExists(filePath: string): Promise<boolean> {
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  return fileInfo.exists;
} 