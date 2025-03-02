import { Platform } from 'react-native';
import { ensureDatabase } from './index';
import type { Deck } from '../../types/flashcards';

// Define SQLiteDatabase type to match the one in index.ts
type SQLiteDatabase = {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  runAsync: (sql: string, params?: any[]) => Promise<{ changes: number }>;
};

// Local deck type with sync status
export interface LocalDeck extends Deck {
  synced: boolean;
  remote_id: string | null;
}

// Generate a simple unique ID that works in React Native
function generateId(): string {
  return 'local_' + 
    Math.random().toString(36).substring(2, 15) + 
    Math.random().toString(36).substring(2, 15) + 
    '_' + Date.now().toString(36);
}

// Initialize the flashcards tables
export async function initFlashcardsDatabase(): Promise<void> {
  // Skip initialization on web platform
  if (Platform.OS === 'web') return;

  try {
    console.log('Starting flashcards database initialization...');
    const db = await ensureDatabase();
    if (!db) {
      console.error('Database connection not established');
      return;
    }

    // Create decks table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        language TEXT,
        color_preset TEXT,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        total_cards INTEGER DEFAULT 0,
        new_cards INTEGER DEFAULT 0,
        cards_to_review INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        remote_id TEXT,
        settings TEXT,
        modified_offline INTEGER DEFAULT 0,
        deleted_offline INTEGER DEFAULT 0
      );
    `);
    console.log('Decks table created or already exists');

    // Check if the table has all required columns and add them if missing
    await migrateFlashcardsDatabase(db);

    console.log('Flashcards database initialized successfully');
  } catch (error) {
    console.error('Error initializing flashcards database:', error);
    throw error;
  }
}

// Function to migrate the database schema if needed
async function migrateFlashcardsDatabase(db: SQLiteDatabase): Promise<void> {
  try {
    console.log('Starting database migration check...');
    
    // Check if the settings column exists in the decks table
    const deckColumns = await db.getAllAsync<{name: string}>(`PRAGMA table_info(decks)`);
    console.log('Current deck table columns:', deckColumns.map(col => col.name).join(', '));
    
    // Add missing columns to decks table if needed
    const requiredColumns = [
      { name: 'settings', type: 'TEXT' },
      { name: 'tags', type: 'TEXT' },
      { name: 'color_preset', type: 'TEXT' },
      { name: 'synced', type: 'BOOLEAN DEFAULT 0' },
      { name: 'remote_id', type: 'TEXT' },
      { name: 'modified_offline', type: 'INTEGER DEFAULT 0' },
      { name: 'deleted_offline', type: 'INTEGER DEFAULT 0' }
    ];
    
    for (const column of requiredColumns) {
      const hasColumn = deckColumns.some((col: {name: string}) => col.name === column.name);
      if (!hasColumn) {
        console.log(`Adding ${column.name} column to decks table...`);
        await db.execAsync(`ALTER TABLE decks ADD COLUMN ${column.name} ${column.type}`);
        console.log(`Added ${column.name} column to decks table`);
      } else {
        console.log(`${column.name} column already exists in decks table`);
      }
    }
    
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Error migrating flashcards database:', error);
    throw error;
  }
}

// Create a new deck locally
export async function createLocalDeck(data: {
  name: string;
  description?: string;
  language?: string;
  settings?: Record<string, any>;
  tags?: string[];
  userId: string;
}): Promise<LocalDeck> {
  // On web platform, throw error as we don't support local storage
  if (Platform.OS === 'web') {
    throw new Error('Local deck storage is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    // Get the current table structure to determine available columns
    const deckColumns = await database.getAllAsync<{name: string}>(`PRAGMA table_info(decks)`);
    const columnNames = deckColumns.map(col => col.name);
    console.log('Available columns for insert:', columnNames.join(', '));

    const id = generateId();
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    // Build the SQL query dynamically based on available columns
    let columns = ['id', 'user_id', 'name', 'created_at', 'updated_at'];
    let placeholders = ['?', '?', '?', '?', '?'];
    let values: any[] = [id, data.userId, data.name, created_at, updated_at];

    // Add optional columns if they exist in the table
    if (data.description && columnNames.includes('description')) {
      columns.push('description');
      placeholders.push('?');
      values.push(data.description);
    }

    if (columnNames.includes('language')) {
      columns.push('language');
      placeholders.push('?');
      values.push(data.language || 'General');
    }

    if (columnNames.includes('settings') && data.settings) {
      columns.push('settings');
      placeholders.push('?');
      values.push(JSON.stringify(data.settings));
    }

    if (columnNames.includes('tags') && data.tags?.length) {
      columns.push('tags');
      placeholders.push('?');
      values.push(JSON.stringify(data.tags));
    }

    if (columnNames.includes('synced')) {
      columns.push('synced');
      placeholders.push('0');
    }

    if (columnNames.includes('remote_id')) {
      columns.push('remote_id');
      placeholders.push('NULL');
    }

    if (columnNames.includes('modified_offline')) {
      columns.push('modified_offline');
      placeholders.push('1');
    }

    if (columnNames.includes('deleted_offline')) {
      columns.push('deleted_offline');
      placeholders.push('0');
    }

    const query = `
      INSERT INTO decks (${columns.join(', ')})
      VALUES (${placeholders.join(', ')});
    `;

    console.log('Executing query:', query);
    console.log('With values:', values);

    const result = await database.runAsync(query, values);

    if (result.changes === 0) {
      throw new Error('Failed to insert deck');
    }

    return {
      id,
      user_id: data.userId,
      name: data.name,
      description: data.description,
      language: data.language || 'General',
      settings: data.settings || {},
      tags: data.tags || [],
      created_at,
      updated_at,
      synced: false,
      remote_id: null,
      total_cards: 0,
      new_cards: 0,
      cards_to_review: 0,
      color_preset: undefined
    };
  } catch (error) {
    console.error('Error creating local deck:', error);
    throw error;
  }
}

// Get all decks for a user
export async function getLocalDecks(userId: string): Promise<LocalDeck[]> {
  // On web platform, return empty array
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const result = await database.getAllAsync<any>(
      'SELECT * FROM decks WHERE user_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL) ORDER BY updated_at DESC;',
      [userId]
    );

    return result.map(item => ({
      id: item.id,
      user_id: item.user_id,
      name: item.name,
      description: item.description || null,
      language: item.language || 'General',
      settings: item.settings ? JSON.parse(item.settings) : {},
      tags: item.tags ? JSON.parse(item.tags) : [],
      color_preset: item.color_preset || undefined,
      created_at: item.created_at,
      updated_at: item.updated_at || item.created_at,
      synced: Boolean(item.synced),
      remote_id: item.remote_id || null,
      total_cards: item.total_cards || 0,
      new_cards: item.new_cards || 0,
      cards_to_review: item.cards_to_review || 0
    }));
  } catch (error) {
    console.error('Error getting local decks:', error);
    throw error;
  }
}

// Update a deck
export async function updateLocalDeck(
  id: string,
  data: Partial<Pick<Deck, 'name' | 'description' | 'tags' | 'language' | 'settings' | 'color_preset'>>
): Promise<LocalDeck> {
  // On web platform, throw error
  if (Platform.OS === 'web') {
    throw new Error('Local deck update is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    // Get the current deck
    const currentDeck = await getLocalDeck(id);
    if (!currentDeck) {
      throw new Error('Deck not found');
    }

    // Get the current table structure to determine available columns
    const deckColumns = await database.getAllAsync<{name: string}>(`PRAGMA table_info(decks)`);
    const columnNames = deckColumns.map(col => col.name);
    console.log('Available columns for update:', columnNames.join(', '));

    // Prepare update fields
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined && columnNames.includes('name')) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.description !== undefined && columnNames.includes('description')) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.language !== undefined && columnNames.includes('language')) {
      updates.push('language = ?');
      params.push(data.language);
    }

    if (data.settings !== undefined && columnNames.includes('settings')) {
      updates.push('settings = ?');
      params.push(JSON.stringify(data.settings));
    }

    if (data.tags !== undefined && columnNames.includes('tags')) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }

    if (data.color_preset !== undefined && columnNames.includes('color_preset')) {
      updates.push('color_preset = ?');
      params.push(data.color_preset);
    }

    // Always update these fields if they exist
    if (columnNames.includes('updated_at')) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
    }
    
    if (columnNames.includes('synced')) {
      updates.push('synced = 0');
    }

    if (columnNames.includes('modified_offline')) {
      updates.push('modified_offline = 1');
    }

    // If no updates, return the current deck
    if (updates.length === 0) {
      return currentDeck;
    }

    // Add the ID as the last parameter
    params.push(id);

    const query = `UPDATE decks SET ${updates.join(', ')} WHERE id = ?;`;
    console.log('Executing update query:', query);
    console.log('With values:', params);

    // Execute the update
    const result = await database.runAsync(query, params);

    if (result.changes === 0) {
      console.warn('No changes made to deck:', id);
    }

    // Get the updated deck
    const updatedDeck = await getLocalDeck(id);
    if (!updatedDeck) {
      throw new Error('Failed to retrieve updated deck');
    }

    return updatedDeck;
  } catch (error) {
    console.error('Error updating local deck:', error);
    throw error;
  }
}

// Delete a deck
export async function deleteLocalDeck(id: string): Promise<void> {
  // On web platform, do nothing
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    // Check if this deck has a remote_id (was synced before)
    const deck = await database.getFirstAsync<{ remote_id: string | null }>(
      'SELECT remote_id FROM decks WHERE id = ?',
      [id]
    );
    
    if (deck && deck.remote_id) {
      // If it has a remote_id, mark it as deleted offline instead of actually deleting
      await database.runAsync(
        'UPDATE decks SET deleted_offline = 1, modified_offline = 1 WHERE id = ?',
        [id]
      );
      console.log(`Marked deck ${id} as deleted offline`);
    } else {
      // If it doesn't have a remote_id, just delete it locally
      await database.runAsync(
        'DELETE FROM decks WHERE id = ?',
        [id]
      );
      console.log(`Deleted local deck ${id}`);
    }
  } catch (error) {
    console.error('Error deleting local deck:', error);
    throw error;
  }
}

// Get a single deck by ID
export async function getLocalDeck(id: string): Promise<LocalDeck | null> {
  // On web platform, return null
  if (Platform.OS === 'web') return null;

  try {
    const database = await ensureDatabase();
    if (!database) return null;

    const result = await database.getFirstAsync<any>(
      'SELECT * FROM decks WHERE id = ?;',
      [id]
    );

    if (!result) return null;

    // Create a deck object with default values for missing fields
    const deck: LocalDeck = {
      id: result.id,
      user_id: result.user_id,
      name: result.name,
      description: result.description || null,
      language: result.language || 'General',
      settings: result.settings ? JSON.parse(result.settings) : {},
      tags: result.tags ? JSON.parse(result.tags) : [],
      color_preset: result.color_preset || undefined,
      created_at: result.created_at,
      updated_at: result.updated_at || result.created_at,
      synced: Boolean(result.synced),
      remote_id: result.remote_id || null,
      total_cards: result.total_cards || 0,
      new_cards: result.new_cards || 0,
      cards_to_review: result.cards_to_review || 0
    };

    return deck;
  } catch (error) {
    console.error('Error getting local deck:', error);
    throw error;
  }
}

// Get decks that were modified offline and need to be synced
export async function getModifiedOfflineDecks(userId: string): Promise<any[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  try {
    const database = await ensureDatabase();
    if (!database) return [];
    
    // Get all decks that were modified offline
    const result = await database.getAllAsync<any>(
      'SELECT * FROM decks WHERE user_id = ? AND modified_offline = 1 ORDER BY updated_at DESC;',
      [userId]
    );
    
    // Parse JSON fields
    return result.map(deck => {
      if (deck.tags && typeof deck.tags === 'string') {
        try {
          deck.tags = JSON.parse(deck.tags);
        } catch (e) {
          deck.tags = [];
        }
      }
      
      if (deck.settings && typeof deck.settings === 'string') {
        try {
          deck.settings = JSON.parse(deck.settings);
        } catch (e) {
          deck.settings = {};
        }
      }
      
      return deck;
    });
  } catch (error) {
    console.error('Error getting modified offline decks:', error);
    return [];
  }
}

// Mark a deck as synced
export async function markDeckAsSynced(id: string, remoteId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const database = await ensureDatabase();
    if (!database) return;
    
    await database.runAsync(
      'UPDATE decks SET synced = 1, remote_id = ?, modified_offline = 0 WHERE id = ?;',
      [remoteId, id]
    );
    
    console.log(`Marked deck ${id} as synced with remote ID ${remoteId}`);
  } catch (error) {
    console.error('Error marking deck as synced:', error);
    throw error;
  }
} 