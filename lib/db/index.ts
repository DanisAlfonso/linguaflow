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
async function ensureDatabase(): Promise<SQLiteDatabase | null> {
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