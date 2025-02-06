import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const RECORDINGS_DIRECTORY = `${FileSystem.documentDirectory}recordings/`;

// Ensure the recordings directory exists
export async function ensureRecordingsDirectory() {
  const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIRECTORY, { intermediates: true });
  }
}

// Generate a unique file path for a new recording
export function generateRecordingPath(cardId: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  return `${RECORDINGS_DIRECTORY}${cardId}_${timestamp}_${randomString}.m4a`;
}

// Save a recording file
export async function saveRecordingFile(uri: string, targetPath: string): Promise<void> {
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

// Delete a recording file
export async function deleteRecordingFile(filePath: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
    }
  } catch (error) {
    console.error('Error deleting recording file:', error);
    throw error;
  }
}

// Get the local URI for a recording file
export async function getRecordingUri(filePath: string): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  if (!fileInfo.exists) {
    throw new Error('Recording file not found');
  }
  return fileInfo.uri;
}

// Clean up temporary recording files
export async function cleanupTemporaryRecordings(): Promise<void> {
  try {
    const tempDirectory = FileSystem.cacheDirectory + 'Recording/';
    await FileSystem.deleteAsync(tempDirectory, { idempotent: true });
  } catch (error) {
    console.error('Error cleaning up temporary recordings:', error);
  }
} 