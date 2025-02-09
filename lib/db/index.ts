import { Platform } from 'react-native';
import type { LocalRecording, LocalRecordingInput } from '../../types/audio';

// Define SQLite types
type SQLiteType = {
  openDatabaseAsync: (name: string) => Promise<SQLiteDatabase>;
};

type SQLiteDatabase = {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  runAsync: (sql: string, params?: any[]) => Promise<{ changes: number }>;
};

// Conditionally import SQLite only for native platforms
let SQLite: SQLiteType | null = null;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

// Database instance and initialization state
let db: SQLiteDatabase | null = null;
let isInitializing = false;
let initializationError: Error | null = null;

// Ensure database is initialized
export async function ensureDatabase(): Promise<SQLiteDatabase | null> {
  // On web platform, return null as we don't need SQLite
  if (Platform.OS === 'web') return null;
  
  if (db) return db;
  
  if (initializationError) {
    throw initializationError;
  }

  if (isInitializing) {
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return ensureDatabase();
  }

  await initDatabase();
  if (!db) {
    throw new Error('Database failed to initialize');
  }
  return db;
}

// Initialize the database
export async function initDatabase(): Promise<void> {
  // Skip initialization on web platform
  if (Platform.OS === 'web') return;
  if (!SQLite) return;

  if (db) return;
  if (isInitializing) return;

  try {
    isInitializing = true;
    initializationError = null;

    // Open database with the new async API
    const database = await SQLite.openDatabaseAsync('linguaflow.db');

    // Create the recordings table with updated schema
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        duration INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        synced BOOLEAN DEFAULT 0,
        audio_url TEXT,
        remote_id TEXT,
        UNIQUE(card_id, file_path)
      );

      CREATE INDEX IF NOT EXISTS idx_recordings_card_id ON recordings(card_id);
      CREATE INDEX IF NOT EXISTS idx_recordings_synced ON recordings(synced);

      -- New tables for audio library
      CREATE TABLE IF NOT EXISTS audio_folders (
        id TEXT PRIMARY KEY,
        parent_id TEXT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        user_id TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES audio_folders(id) ON DELETE CASCADE,
        UNIQUE(parent_id, path)
      );

      CREATE TABLE IF NOT EXISTS audio_files (
        id TEXT PRIMARY KEY,
        folder_id TEXT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        genre TEXT,
        year INTEGER,
        duration INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced BOOLEAN DEFAULT 0,
        remote_id TEXT,
        remote_url TEXT,
        FOREIGN KEY (folder_id) REFERENCES audio_folders(id) ON DELETE SET NULL,
        UNIQUE(file_path)
      );

      CREATE INDEX IF NOT EXISTS idx_audio_folders_parent ON audio_folders(parent_id);
      CREATE INDEX IF NOT EXISTS idx_audio_folders_path ON audio_folders(path);
      CREATE INDEX IF NOT EXISTS idx_audio_files_folder ON audio_files(folder_id);
      CREATE INDEX IF NOT EXISTS idx_audio_files_synced ON audio_files(synced);
    `);

    db = database;
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    initializationError = error instanceof Error ? error : new Error('Unknown error during initialization');
    throw initializationError;
  } finally {
    isInitializing = false;
  }
}

// Get all recordings for a card
export async function getLocalRecordings(cardId: string): Promise<LocalRecording[]> {
  // On web platform, return empty array as we don't store recordings locally
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const result = await database.getAllAsync<LocalRecording>(
      'SELECT * FROM recordings WHERE card_id = ? ORDER BY created_at DESC;',
      [cardId]
    );
    return result.map(recording => ({
      ...recording,
      synced: Boolean(recording.synced),
      audio_url: recording.audio_url || null
    }));
  } catch (error) {
    console.error('Error getting local recordings:', error);
    throw error;
  }
}

// Save a recording locally
export async function saveLocalRecording(recording: LocalRecordingInput): Promise<LocalRecording> {
  // On web platform, throw error as we don't support local recording
  if (Platform.OS === 'web') {
    throw new Error('Local recording storage is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    const id = Math.random().toString(36).substring(7);
    const created_at = new Date().toISOString();

    const result = await database.runAsync(
      `INSERT INTO recordings (id, card_id, user_id, file_path, duration, created_at, synced, audio_url)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL);`,
      [id, recording.card_id, recording.user_id, recording.file_path, recording.duration, created_at]
    );

    if (result.changes === 0) {
      throw new Error('Failed to insert recording');
    }

    return {
      id,
      ...recording,
      created_at,
      synced: false,
      audio_url: null,
      remote_id: null
    };
  } catch (error) {
    console.error('Error saving local recording:', error);
    throw error;
  }
}

// Delete a recording locally
export async function deleteLocalRecording(id: string): Promise<void> {
  // On web platform, do nothing as we don't store recordings locally
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    const result = await database.runAsync(
      'DELETE FROM recordings WHERE id = ?;',
      [id]
    );

    if (result.changes === 0) {
      console.warn('No recording found to delete with id:', id);
    }
  } catch (error) {
    console.error('Error deleting local recording:', error);
    throw error;
  }
}

// Update sync status and audio_url after successful upload
export async function updateRecordingAfterSync(
  id: string, 
  audio_url: string, 
  remote_id: string
): Promise<void> {
  // On web platform, do nothing as we don't store recordings locally
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    const result = await database.runAsync(
      'UPDATE recordings SET synced = 1, audio_url = ?, remote_id = ? WHERE id = ?;',
      [audio_url, remote_id, id]
    );

    if (result.changes === 0) {
      throw new Error('Recording not found');
    }
  } catch (error) {
    console.error('Error updating recording after sync:', error);
    throw error;
  }
}

// Get all unsynced recordings
export async function getUnsyncedRecordings(): Promise<LocalRecording[]> {
  // On web platform, return empty array as we don't store recordings locally
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const result = await database.getAllAsync<LocalRecording>(
      'SELECT * FROM recordings WHERE synced = 0;'
    );
    return result.map(recording => ({
      ...recording,
      synced: false,
      audio_url: null
    }));
  } catch (error) {
    console.error('Error getting unsynced recordings:', error);
    throw error;
  }
}

// Get a specific recording by ID
export async function getLocalRecordingById(id: string): Promise<LocalRecording | null> {
  // On web platform, return null as we don't store recordings locally
  if (Platform.OS === 'web') return null;

  try {
    const database = await ensureDatabase();
    if (!database) return null;

    const result = await database.getFirstAsync<LocalRecording>(
      'SELECT * FROM recordings WHERE id = ?;',
      [id]
    );
    
    if (!result) return null;
    
    return {
      ...result,
      synced: Boolean(result.synced),
      audio_url: result.audio_url || null
    };
  } catch (error) {
    console.error('Error getting recording by id:', error);
    throw error;
  }
}

// New functions for audio library

export interface LocalAudioFolder {
  id: string;
  parent_id: string | null;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface LocalAudioFile {
  id: string;
  folder_id: string | null;
  user_id: string;
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration: number;
  file_path: string;
  original_filename: string;
  mime_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  synced: boolean;
  remote_id: string | null;
  remote_url: string | null;
}

// Get all audio files in a folder
export async function getAudioFilesInFolder(folderId: string | null): Promise<LocalAudioFile[]> {
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const result = await database.getAllAsync<LocalAudioFile>(
      'SELECT * FROM audio_files WHERE folder_id IS ? ORDER BY title ASC;',
      [folderId]
    );

    return result.map(file => ({
      ...file,
      synced: Boolean(file.synced),
      remote_url: file.remote_url || null,
      remote_id: file.remote_id || null
    }));
  } catch (error) {
    console.error('Error getting audio files:', error);
    throw error;
  }
}

// Get all subfolders in a folder
export async function getSubfolders(parentId: string | null): Promise<LocalAudioFolder[]> {
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    return await database.getAllAsync<LocalAudioFolder>(
      'SELECT * FROM audio_folders WHERE parent_id IS ? ORDER BY name ASC;',
      [parentId]
    );
  } catch (error) {
    console.error('Error getting subfolders:', error);
    throw error;
  }
}

// Save a new audio folder
export async function saveAudioFolder(folder: Omit<LocalAudioFolder, 'id' | 'created_at' | 'updated_at'>): Promise<LocalAudioFolder> {
  if (Platform.OS === 'web') {
    throw new Error('Local folder storage is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    const id = Math.random().toString(36).substring(7);
    const timestamp = new Date().toISOString();

    const result = await database.runAsync(
      `INSERT INTO audio_folders (id, parent_id, name, path, created_at, updated_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [id, folder.parent_id, folder.name, folder.path, timestamp, timestamp, folder.user_id]
    );

    if (result.changes === 0) {
      throw new Error('Failed to insert folder');
    }

    return {
      id,
      ...folder,
      created_at: timestamp,
      updated_at: timestamp
    };
  } catch (error) {
    console.error('Error saving audio folder:', error);
    throw error;
  }
}

// Save a new audio file
export async function saveAudioFile(file: Omit<LocalAudioFile, 'id' | 'created_at' | 'updated_at' | 'synced' | 'remote_id' | 'remote_url'>): Promise<LocalAudioFile> {
  if (Platform.OS === 'web') {
    throw new Error('Local audio storage is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    const id = Math.random().toString(36).substring(7);
    const timestamp = new Date().toISOString();

    const result = await database.runAsync(
      `INSERT INTO audio_files (
        id, folder_id, user_id, title, artist, album, genre, year,
        duration, file_path, original_filename, mime_type, size,
        created_at, updated_at, synced, remote_id, remote_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL);`,
      [
        id, file.folder_id, file.user_id, file.title, file.artist, file.album,
        file.genre, file.year, file.duration, file.file_path, file.original_filename,
        file.mime_type, file.size, timestamp, timestamp
      ]
    );

    if (result.changes === 0) {
      throw new Error('Failed to insert audio file');
    }

    return {
      id,
      ...file,
      created_at: timestamp,
      updated_at: timestamp,
      synced: false,
      remote_id: null,
      remote_url: null
    };
  } catch (error) {
    console.error('Error saving audio file:', error);
    throw error;
  }
}

// Delete an audio file
export async function deleteAudioFile(id: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    const result = await database.runAsync(
      'DELETE FROM audio_files WHERE id = ?;',
      [id]
    );

    if (result.changes === 0) {
      console.warn('No audio file found to delete with id:', id);
    }
  } catch (error) {
    console.error('Error deleting audio file:', error);
    throw error;
  }
}

// Delete a folder and all its contents
export async function deleteAudioFolder(id: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    // Note: Due to ON DELETE CASCADE, this will automatically delete all subfolders
    const result = await database.runAsync(
      'DELETE FROM audio_folders WHERE id = ?;',
      [id]
    );

    if (result.changes === 0) {
      console.warn('No folder found to delete with id:', id);
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
}

// Get all unsynced audio files
export async function getUnsyncedAudioFiles(): Promise<LocalAudioFile[]> {
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const result = await database.getAllAsync<LocalAudioFile>(
      'SELECT * FROM audio_files WHERE synced = 0;'
    );

    return result.map(file => ({
      ...file,
      synced: false,
      remote_url: null,
      remote_id: null
    }));
  } catch (error) {
    console.error('Error getting unsynced audio files:', error);
    throw error;
  }
}

// Update sync status for an audio file
export async function updateAudioFileAfterSync(
  id: string,
  remote_url: string,
  remote_id: string
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    const result = await database.runAsync(
      'UPDATE audio_files SET synced = 1, remote_url = ?, remote_id = ? WHERE id = ?;',
      [remote_url, remote_id, id]
    );

    if (result.changes === 0) {
      throw new Error('Audio file not found');
    }
  } catch (error) {
    console.error('Error updating audio file after sync:', error);
    throw error;
  }
} 