import { Platform } from 'react-native';
import { ensureDatabase } from './index';
import type { Deck, Card } from '../../types/flashcards';

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
  modified_offline?: boolean;
  deleted_offline?: boolean;
}

// Local card type with sync status
export interface LocalCard extends Card {
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

    // Create cards table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT NOT NULL,
        notes TEXT,
        tags TEXT,
        language_specific_data TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_reviewed_at TEXT,
        next_review_at TEXT,
        review_count INTEGER DEFAULT 0,
        consecutive_correct INTEGER DEFAULT 0,
        state INTEGER,
        difficulty REAL,
        stability REAL,
        retrievability REAL,
        elapsed_days REAL,
        scheduled_days REAL,
        reps INTEGER DEFAULT 0,
        lapses INTEGER DEFAULT 0,
        scheduled_in_minutes INTEGER,
        step_index INTEGER DEFAULT 0,
        queue TEXT DEFAULT 'new',
        synced INTEGER DEFAULT 0,
        remote_id TEXT,
        modified_offline INTEGER DEFAULT 0,
        deleted_offline INTEGER DEFAULT 0,
        FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
      );
    `);
    console.log('Cards table created or already exists');

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
    const requiredDeckColumns = [
      { name: 'settings', type: 'TEXT' },
      { name: 'tags', type: 'TEXT' },
      { name: 'color_preset', type: 'TEXT' },
      { name: 'synced', type: 'BOOLEAN DEFAULT 0' },
      { name: 'remote_id', type: 'TEXT' },
      { name: 'modified_offline', type: 'INTEGER DEFAULT 0' },
      { name: 'deleted_offline', type: 'INTEGER DEFAULT 0' }
    ];
    
    for (const column of requiredDeckColumns) {
      const hasColumn = deckColumns.some((col: {name: string}) => col.name === column.name);
      if (!hasColumn) {
        console.log(`Adding ${column.name} column to decks table...`);
        await db.execAsync(`ALTER TABLE decks ADD COLUMN ${column.name} ${column.type}`);
        console.log(`Added ${column.name} column to decks table`);
      } else {
        console.log(`${column.name} column already exists in decks table`);
      }
    }
    
    // Check and migrate card table if needed
    const cardColumns = await db.getAllAsync<{name: string}>(`PRAGMA table_info(cards)`);
    console.log('Current card table columns:', cardColumns.map(col => col.name).join(', '));
    
    // Add missing columns to cards table if needed
    const requiredCardColumns = [
      { name: 'synced', type: 'BOOLEAN DEFAULT 0' },
      { name: 'remote_id', type: 'TEXT' },
      { name: 'modified_offline', type: 'INTEGER DEFAULT 0' },
      { name: 'deleted_offline', type: 'INTEGER DEFAULT 0' }
    ];
    
    for (const column of requiredCardColumns) {
      const hasColumn = cardColumns.some((col: {name: string}) => col.name === column.name);
      if (!hasColumn) {
        console.log(`Adding ${column.name} column to cards table...`);
        await db.execAsync(`ALTER TABLE cards ADD COLUMN ${column.name} ${column.type}`);
        console.log(`Added ${column.name} column to cards table`);
      } else {
        console.log(`${column.name} column already exists in cards table`);
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

// Create a new card locally
export async function createLocalCard(data: Partial<Card>): Promise<LocalCard> {
  // On web platform, throw error as we don't support local storage
  if (Platform.OS === 'web') {
    throw new Error('Local card storage is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    // Get the current table structure to determine available columns
    const cardColumns = await database.getAllAsync<{name: string}>(`PRAGMA table_info(cards)`);
    const columnNames = cardColumns.map(col => col.name);
    console.log('Available columns for card insert:', columnNames.join(', '));

    const id = generateId();
    const created_at = new Date().toISOString();
    const updated_at = created_at;

    // Build the SQL query dynamically based on available columns
    let columns = ['id', 'deck_id', 'front', 'back', 'created_at', 'updated_at'];
    let placeholders = ['?', '?', '?', '?', '?', '?'];
    let values: any[] = [id, data.deck_id, data.front, data.back, created_at, updated_at];

    // Add optional columns if they exist in the table
    if (data.notes !== undefined && columnNames.includes('notes')) {
      columns.push('notes');
      placeholders.push('?');
      values.push(data.notes);
    }

    if (data.tags && columnNames.includes('tags')) {
      columns.push('tags');
      placeholders.push('?');
      values.push(JSON.stringify(data.tags));
    }

    if (data.language_specific_data && columnNames.includes('language_specific_data')) {
      columns.push('language_specific_data');
      placeholders.push('?');
      values.push(JSON.stringify(data.language_specific_data));
    }

    // Add FSRS fields if they exist in the data
    const fsrsFields = [
      'state', 'difficulty', 'stability', 'retrievability',
      'elapsed_days', 'scheduled_days', 'reps', 'lapses',
      'scheduled_in_minutes', 'step_index', 'queue'
    ];

    fsrsFields.forEach(field => {
      if (data[field as keyof typeof data] !== undefined && columnNames.includes(field)) {
        columns.push(field);
        placeholders.push('?');
        values.push(data[field as keyof typeof data]);
      }
    });

    // Add sync status fields
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
      INSERT INTO cards (${columns.join(', ')})
      VALUES (${placeholders.join(', ')});
    `;

    console.log('Executing card insert query:', query);
    console.log('With values:', values);

    const result = await database.runAsync(query, values);

    if (result.changes === 0) {
      throw new Error('Failed to insert card');
    }

    // Update the deck's card count
    await updateDeckCardCount(data.deck_id as string);

    // Return the created card with local properties
    return {
      id,
      deck_id: data.deck_id as string,
      front: data.front as string,
      back: data.back as string,
      notes: data.notes || null,
      tags: data.tags || [],
      language_specific_data: data.language_specific_data,
      created_at: new Date(created_at),
      last_reviewed_at: null,
      next_review_at: null,
      review_count: 0,
      consecutive_correct: 0,
      state: data.state || 0,
      difficulty: data.difficulty || 0,
      stability: data.stability || 0,
      retrievability: data.retrievability || 0,
      elapsed_days: data.elapsed_days || 0,
      scheduled_days: data.scheduled_days || 0,
      reps: data.reps || 0,
      lapses: data.lapses || 0,
      scheduled_in_minutes: data.scheduled_in_minutes,
      step_index: data.step_index || 0,
      queue: data.queue || 'new',
      synced: false,
      remote_id: null
    };
  } catch (error) {
    console.error('Error creating local card:', error);
    throw error;
  }
}

// Update a deck's card count
async function updateDeckCardCount(deckId: string): Promise<void> {
  try {
    const database = await ensureDatabase();
    if (!database) return;

    // Count the cards for this deck
    const result = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM cards WHERE deck_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL)',
      [deckId]
    );

    const count = result?.count || 0;

    // Update the deck's total_cards field
    await database.runAsync(
      'UPDATE decks SET total_cards = ?, modified_offline = 1, updated_at = ? WHERE id = ?',
      [count, new Date().toISOString(), deckId]
    );

    console.log(`Updated deck ${deckId} card count to ${count}`);
  } catch (error) {
    console.error(`Error updating deck card count: ${error}`);
  }
}

// Get cards for a deck from local database
export async function getLocalCards(deckId: string): Promise<LocalCard[]> {
  // On web platform, return empty array
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    let cards: any[] = [];
    let usedLocalId = false;
    
    console.log(`🔍 [DB] Getting local cards for deck ID: ${deckId}`);
    
    // Check if this is a local ID or a remote ID
    if (deckId.startsWith('local_')) {
      // This is a local ID, fetch directly
      console.log(`🔍 [DB] Fetching cards by local deck ID: ${deckId}`);
      usedLocalId = true;
      
      cards = await database.getAllAsync<any>(
        'SELECT * FROM cards WHERE deck_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL) ORDER BY created_at DESC',
        [deckId]
      );
      
      // If no cards found, check if this deck has a remote ID and try that
      if (cards.length === 0) {
        const deck = await database.getFirstAsync<{remote_id: string}>(
          'SELECT remote_id FROM decks WHERE id = ?',
          [deckId]
        );
        
        if (deck && deck.remote_id) {
          console.log(`🔍 [DB] No cards found with local deck ID. Trying with remote ID: ${deck.remote_id}`);
          
          const remoteCards = await database.getAllAsync<any>(
            'SELECT * FROM cards WHERE deck_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL) ORDER BY created_at DESC',
            [deck.remote_id]
          );
          
          if (remoteCards.length > 0) {
            console.log(`🔍 [DB] Found ${remoteCards.length} cards using remote deck ID`);
            cards = remoteCards;
          }
        }
      }
    } else {
      // This is a remote ID, fetch directly
      console.log(`🔍 [DB] Fetching cards by remote deck ID: ${deckId}`);
      
      cards = await database.getAllAsync<any>(
        'SELECT * FROM cards WHERE deck_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL) ORDER BY created_at DESC',
        [deckId]
      );
      
      // If no cards found, check if there's a corresponding local deck ID
      if (cards.length === 0) {
        const localDecks = await database.getAllAsync<{id: string}>(
          'SELECT id FROM decks WHERE remote_id = ?',
          [deckId]
        );
        
        if (localDecks && localDecks.length > 0) {
          const localDeckId = localDecks[0].id;
          console.log(`🔍 [DB] No cards found with remote deck ID. Trying with local ID: ${localDeckId}`);
          
          const localCards = await database.getAllAsync<any>(
            'SELECT * FROM cards WHERE deck_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL) ORDER BY created_at DESC',
            [localDeckId]
          );
          
          if (localCards.length > 0) {
            console.log(`🔍 [DB] Found ${localCards.length} cards using local deck ID`);
            cards = localCards;
          }
        }
      }
    }
    
    console.log(`🔍 [DB] Found ${cards.length} cards for deck ${deckId}`);

    return cards.map(item => ({
      id: item.id,
      deck_id: usedLocalId ? item.deck_id : deckId, // Ensure we return with the requested deck ID
      front: item.front,
      back: item.back,
      notes: item.notes || null,
      tags: item.tags ? JSON.parse(item.tags) : [],
      language_specific_data: item.language_specific_data ? JSON.parse(item.language_specific_data) : undefined,
      created_at: new Date(item.created_at),
      last_reviewed_at: item.last_reviewed_at ? new Date(item.last_reviewed_at) : null,
      next_review_at: item.next_review_at ? new Date(item.next_review_at) : null,
      review_count: item.review_count || 0,
      consecutive_correct: item.consecutive_correct || 0,
      state: item.state || 0,
      difficulty: item.difficulty || 0,
      stability: item.stability || 0,
      retrievability: item.retrievability || 0,
      elapsed_days: item.elapsed_days || 0,
      scheduled_days: item.scheduled_days || 0,
      reps: item.reps || 0,
      lapses: item.lapses || 0,
      scheduled_in_minutes: item.scheduled_in_minutes,
      step_index: item.step_index || 0,
      queue: item.queue || 'new',
      synced: Boolean(item.synced),
      remote_id: item.remote_id || null
    }));
  } catch (error) {
    console.error('Error getting local cards:', error);
    throw error;
  }
}

// Get a single deck by remote ID
export async function getDeckByRemoteId(id: string): Promise<LocalDeck | null> {
  // On web platform, return null
  if (Platform.OS === 'web') return null;

  try {
    const database = await ensureDatabase();
    if (!database) return null;

    console.log(`🔍 [DB] Looking up deck with ID: ${id}`);
    
    let result: any = null;
    
    // First, try using the provided ID directly
    if (id.startsWith('local_')) {
      // This is a local ID, get it directly
      console.log(`🔍 [DB] Looking up deck by local ID: ${id}`);
      result = await database.getFirstAsync<any>(
        'SELECT * FROM decks WHERE id = ?;',
        [id]
      );
    } else {
      // This is a remote ID, check if we have it
      console.log(`🔍 [DB] Looking up deck by remote ID: ${id}`);
      result = await database.getFirstAsync<any>(
        'SELECT * FROM decks WHERE remote_id = ?;',
        [id]
      );
      
      // If not found but it's a local ID formatted like remote_XX, try local lookup
      if (!result && id.includes('_')) {
        const possibleLocalId = `local_${id}`;
        console.log(`🔍 [DB] Not found as remote ID. Trying possible local ID: ${possibleLocalId}`);
        result = await database.getFirstAsync<any>(
          'SELECT * FROM decks WHERE id = ?;',
          [possibleLocalId]
        );
      }
    }

    if (!result) {
      console.log(`🔍 [DB] No deck found with ID: ${id}`);
      return null;
    }

    console.log(`🔍 [DB] Found deck: ${result.name} (${result.id})`);

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
    console.error('Error getting deck by remote ID:', error);
    return null;
  }
}

// Get a single card by ID
export async function getLocalCardById(id: string): Promise<LocalCard | null> {
  // On web platform, return null
  if (Platform.OS === 'web') return null;

  try {
    const database = await ensureDatabase();
    if (!database) return null;

    console.log(`🔍 [DB] Looking up card with ID: ${id}`);
    
    let result: any = null;
    
    // First, try using the provided ID directly
    if (id.startsWith('local_') || id.startsWith('offline_')) {
      // This is a local ID, get it directly
      console.log(`🔍 [DB] Looking up card by local ID: ${id}`);
      result = await database.getFirstAsync<any>(
        'SELECT * FROM cards WHERE id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL);',
        [id]
      );
    } else {
      // This is a remote ID, check if we have it
      console.log(`🔍 [DB] Looking up card by remote ID: ${id}`);
      result = await database.getFirstAsync<any>(
        'SELECT * FROM cards WHERE remote_id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL);',
        [id]
      );
      
      // If not found but it's a local ID formatted like remote_XX, try local lookup
      if (!result && id.includes('_')) {
        const possibleLocalId = `local_${id}`;
        console.log(`🔍 [DB] Not found as remote ID. Trying possible local ID: ${possibleLocalId}`);
        result = await database.getFirstAsync<any>(
          'SELECT * FROM cards WHERE id = ? AND (deleted_offline = 0 OR deleted_offline IS NULL);',
          [possibleLocalId]
        );
      }
    }

    if (!result) {
      console.log(`🔍 [DB] No card found with ID: ${id}`);
      return null;
    }

    console.log(`🔍 [DB] Found card: ${result.front} (${result.id})`);

    // Create a card object with default values for missing fields
    return {
      id: result.id,
      deck_id: result.deck_id,
      front: result.front,
      back: result.back,
      notes: result.notes || null,
      tags: result.tags ? JSON.parse(result.tags) : [],
      language_specific_data: result.language_specific_data ? JSON.parse(result.language_specific_data) : undefined,
      created_at: new Date(result.created_at),
      last_reviewed_at: result.last_reviewed_at ? new Date(result.last_reviewed_at) : null,
      next_review_at: result.next_review_at ? new Date(result.next_review_at) : null,
      review_count: result.review_count || 0,
      consecutive_correct: result.consecutive_correct || 0,
      state: result.state || 0,
      difficulty: result.difficulty || 0,
      stability: result.stability || 0,
      retrievability: result.retrievability || 0,
      elapsed_days: result.elapsed_days || 0,
      scheduled_days: result.scheduled_days || 0,
      reps: result.reps || 0,
      lapses: result.lapses || 0,
      scheduled_in_minutes: result.scheduled_in_minutes,
      step_index: result.step_index || 0,
      queue: result.queue || 'new',
      synced: Boolean(result.synced),
      remote_id: result.remote_id || null
    };
  } catch (error) {
    console.error('Error getting local card:', error);
    return null;
  }
}

// Delete a card from local storage
export async function deleteLocalCard(id: string): Promise<void> {
  try {
    console.log('🔍 [DB] Deleting local card with ID:', id);
    
    if (Platform.OS === 'web') {
      console.log('🔍 [DB] Skipping local delete on web platform');
      return;
    }
    
    const db = await ensureDatabase();
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // First get the card to check if it exists and get its deck_id
    const card = await db.getFirstAsync<LocalCard>('SELECT * FROM cards WHERE id = ?', [id]);
    
    if (!card) {
      console.log('🔍 [DB] Card not found in local database:', id);
      return;
    }
    
    const deckId = card.deck_id;
    
    // Check if this is a remotely synced card
    if (card.remote_id) {
      // If this card is synced with Supabase, mark it as deleted instead of actually deleting
      console.log('🔍 [DB] Card has remote ID, marking as deleted_offline:', id);
      await db.runAsync(
        'UPDATE cards SET deleted_offline = 1 WHERE id = ?',
        [id]
      );
    } else {
      // If it's a local-only card, delete it permanently
      console.log('🔍 [DB] Permanently deleting local-only card:', id);
      await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
    }
    
    // Update the card count for the deck
    await updateDeckCardCount(deckId);
    
    console.log('✅ [DB] Successfully deleted local card:', id);
  } catch (error) {
    console.error('❌ [DB] Error deleting local card:', error);
    throw error;
  }
}

// Get a list of cards that were marked for deletion while offline
export async function getOfflineDeletedCards(): Promise<LocalCard[]> {
  try {
    console.log('🔍 [DB] Getting cards marked for deletion while offline');
    
    if (Platform.OS === 'web') {
      console.log('🔍 [DB] Skipping on web platform');
      return [];
    }
    
    const db = await ensureDatabase();
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Get all cards marked as deleted_offline=1 that have a remote_id (meaning they exist in Supabase)
    const deletedCards = await db.getAllAsync<LocalCard>(
      'SELECT * FROM cards WHERE deleted_offline = 1 AND remote_id IS NOT NULL'
    );
    
    console.log(`🔍 [DB] Found ${deletedCards.length} cards marked for deletion`);
    return deletedCards;
  } catch (error) {
    console.error('❌ [DB] Error getting offline deleted cards:', error);
    return [];
  }
}

// Remove cards that were successfully deleted from Supabase
export async function removeDeletedCards(cardIds: string[]): Promise<void> {
  try {
    if (!cardIds.length) {
      return;
    }
    
    console.log(`🔍 [DB] Removing ${cardIds.length} cards that were synced for deletion`);
    
    if (Platform.OS === 'web') {
      console.log('🔍 [DB] Skipping on web platform');
      return;
    }
    
    const db = await ensureDatabase();
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Delete each card that was successfully synced
    for (const cardId of cardIds) {
      await db.runAsync('DELETE FROM cards WHERE id = ?', [cardId]);
      console.log(`🔍 [DB] Permanently removed card after sync: ${cardId}`);
    }
    
    console.log('✅ [DB] Successfully removed all synced deleted cards');
  } catch (error) {
    console.error('❌ [DB] Error removing deleted cards:', error);
    throw error;
  }
} 