import { Platform } from 'react-native';
import { Deck, Card, GradientPreset } from '../../types/flashcards';
import * as SupabaseAPI from '../api/flashcards';
import * as LocalDB from '../db/flashcards';
import { initFlashcardsDatabase } from '../db/flashcards';
import { ensureDatabase } from '../db/index';
import NetInfo from '@react-native-community/netinfo';
import { createNewCard } from '@/lib/spaced-repetition/fsrs';

// Initialize the database
export async function initializeDatabase(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await initFlashcardsDatabase();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
}

// Check if the device is online
export async function isOnline(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return navigator.onLine;
  }
  
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected ?? false;
}

// Create a new deck
export async function createDeck(data: {
  name: string;
  description?: string;
  language?: string;
  settings?: Record<string, any>;
  tags?: string[];
  userId: string;
  color_preset?: GradientPreset;
}): Promise<Deck> {
  try {
    // Ensure userId is not null
    if (!data.userId) {
      console.error('Cannot create deck: userId is null or undefined');
      throw new Error('User ID is required to create a deck');
    }

    console.log('Creating deck with data:', data);

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.createDeck(data);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Try to create in Supabase first
        const remoteDeck = await SupabaseAPI.createDeck(data);
        
        // Then save locally with sync status
        try {
          await LocalDB.createLocalDeck({
            ...data,
            // Mark as already synced
          });
          
          // Mark the local deck as synced with the remote ID
          const db = await ensureDatabase();
          if (db) {
            // Find the local deck with the same name
            const result = await db.getFirstAsync<{ id: string }>(
              'SELECT id FROM decks WHERE name = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
              [data.name, data.userId]
            );
            
            if (result) {
              await db.runAsync(
                'UPDATE decks SET synced = 1, remote_id = ?, modified_offline = 0 WHERE id = ?',
                [remoteDeck.id, result.id]
              );
              console.log(`Marked local deck ${result.id} as synced with remote ID ${remoteDeck.id}`);
            }
          }
        } catch (localError) {
          console.error('Error saving remote deck locally:', localError);
          // Continue anyway since we have the remote deck
        }
        
        return remoteDeck;
      } catch (remoteError) {
        console.error('Error creating deck in Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
        try {
          const localDeck = await LocalDB.createLocalDeck(data);
          return {
            id: localDeck.id,
            user_id: data.userId,
            name: data.name,
            description: data.description,
            language: data.language || 'General',
            settings: data.settings || {},
            tags: data.tags || [],
            color_preset: data.color_preset,
            created_at: localDeck.created_at,
            updated_at: localDeck.updated_at,
            total_cards: 0,
            new_cards: 0,
            cards_to_review: 0
          };
        } catch (localError) {
          console.error('Error creating deck locally:', localError);
          throw new Error('Failed to create deck online or offline');
        }
      }
    } else {
      // Offline mode, create locally
      console.log('Creating deck in offline mode');
      try {
        const localDeck = await LocalDB.createLocalDeck(data);
        return {
          id: localDeck.id,
          user_id: data.userId,
          name: data.name,
          description: data.description,
          language: data.language || 'General',
          settings: data.settings || {},
          tags: data.tags || [],
          color_preset: data.color_preset,
          created_at: localDeck.created_at,
          updated_at: localDeck.updated_at,
          total_cards: 0,
          new_cards: 0,
          cards_to_review: 0
        };
      } catch (error) {
        console.error('Error creating deck locally:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error in createDeck service:', error);
    throw error;
  }
}

// Create a new card
export async function createCard(data: Partial<Card>): Promise<Card> {
  try {
    // Validate required fields
    if (!data.deck_id) throw new Error('Deck ID is required');
    if (!data.front) throw new Error('Front side is required');
    if (!data.back) throw new Error('Back side is required');

    console.log('💾 [SERVICE] Creating card with data:', {
      deck_id: data.deck_id,
      front: data.front,
      back: data.back,
      has_notes: Boolean(data.notes),
      has_tags: Boolean(data.tags?.length),
      has_language_data: Boolean(data.language_specific_data)
    });

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.createCard(data);
    }

    // On mobile, check if online
    const online = await isOnline();
    console.log(`💾 [SERVICE] Network status for card creation: ${online ? 'Online' : 'Offline'}`);

    if (online) {
      try {
        // Generate FSRS state if not provided
        if (!data.state) {
          console.log('💾 [SERVICE] Generating FSRS state for card');
          const fsrsState = createNewCard();
          data = { ...data, ...fsrsState };
        }

        // Try to create in Supabase first
        console.log('💾 [SERVICE] Attempting to create card in Supabase');
        const remoteCard = await SupabaseAPI.createCard(data);
        
        // Then save locally with sync status for offline access
        try {
          console.log('💾 [SERVICE] Saving remote card locally for offline access');
          const localCardData = {
            ...data,
            id: remoteCard.id, // Use remote ID
          };
          
          const db = await ensureDatabase();
          if (db) {
            // Check if table exists
            const tableExists = await db.getFirstAsync<{count: number}>(
              "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='cards'"
            );
            
            if (tableExists && tableExists.count > 0) {
              // Check if card already exists locally
              const existingCard = await db.getFirstAsync<{id: string}>(
                'SELECT id FROM cards WHERE id = ?',
                [remoteCard.id]
              );
              
              if (existingCard) {
                // Update existing record - we'll just recreate it for simplicity
                console.log('💾 [SERVICE] Card already exists locally, updating:', remoteCard.id);
                await LocalDB.createLocalCard({
                  ...localCardData,
                  id: remoteCard.id,
                });
              } else {
                // Insert as new record
                console.log('💾 [SERVICE] Creating local copy of remote card:', remoteCard.id);
                await LocalDB.createLocalCard({
                  ...localCardData,
                  id: remoteCard.id,
                });
              }
              
              // Mark as synced
              await db.runAsync(
                'UPDATE cards SET synced = 1, modified_offline = 0 WHERE id = ?',
                [remoteCard.id]
              );
            }
          }
        } catch (localError) {
          console.error('❌ [SERVICE] Error saving remote card locally:', localError);
          // Continue anyway since we have the remote card
        }
        
        console.log('✅ [SERVICE] Card created successfully online and cached locally');
        return remoteCard;
      } catch (remoteError) {
        console.error('❌ [SERVICE] Error creating card in Supabase, falling back to local:', remoteError);
        
        // Check if this is a network error (temporary offline)
        const isNetworkError = remoteError instanceof Error && 
          (remoteError.message.includes('Network') || remoteError.message.includes('network'));
          
        if (isNetworkError) {
          console.log('📡 [SERVICE] Network error detected, falling back to offline mode');
          // Fall back to local storage for network errors
          return await createCardLocally(data);
        } else {
          // For other errors, re-throw
          throw remoteError;
        }
      }
    } else {
      // Offline mode, create locally
      console.log('💾 [SERVICE] Creating card in offline mode');
      return await createCardLocally(data);
    }
  } catch (error) {
    console.error('❌ [SERVICE] Error in createCard service:', error);
    throw error;
  }
}

// Helper function to create a card locally
async function createCardLocally(data: Partial<Card>): Promise<Card> {
  try {
    // Generate FSRS state if not provided
    if (!data.state) {
      console.log('💾 [SERVICE] Generating FSRS state for local card');
      const fsrsState = createNewCard();
      data = { ...data, ...fsrsState };
    }
    
    console.log('💾 [SERVICE] Creating card locally with FSRS state');
    const localCard = await LocalDB.createLocalCard(data);
    
    console.log('✅ [SERVICE] Card created successfully in local database:', {
      localId: localCard.id,
      synced: false,
      pendingSync: true
    });
    
    return {
      id: localCard.id,
      deck_id: localCard.deck_id,
      front: localCard.front,
      back: localCard.back,
      notes: localCard.notes,
      tags: localCard.tags || [],
      language_specific_data: localCard.language_specific_data,
      created_at: localCard.created_at,
      last_reviewed_at: null,
      next_review_at: null,
      review_count: 0,
      consecutive_correct: 0,
      state: localCard.state,
      difficulty: localCard.difficulty,
      stability: localCard.stability,
      retrievability: localCard.retrievability,
      elapsed_days: localCard.elapsed_days,
      scheduled_days: localCard.scheduled_days,
      reps: localCard.reps,
      lapses: localCard.lapses,
      scheduled_in_minutes: localCard.scheduled_in_minutes,
      step_index: localCard.step_index,
      queue: localCard.queue as 'new' | 'learn' | 'review',
    };
  } catch (error: unknown) {
    console.error('❌ [SERVICE] Error creating card locally:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create card offline: ${errorMessage}`);
  }
}

// Get all decks
export async function getDecks(userId: string): Promise<Deck[]> {
  try {
    if (!userId) {
      console.error('Cannot get decks: userId is null or undefined');
      return [];
    }

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.getDecks(userId);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Get remote decks from Supabase
        const remoteDecks = await SupabaseAPI.getDecks(userId);
        
        // Also get local decks to merge with remote decks
        const localDecks = await LocalDB.getLocalDecks(userId);
        
        // Create a map of remote deck IDs and names for quick lookup
        const remoteDeckIds = new Set(remoteDecks.map(deck => deck.id));
        const remoteDeckNames = new Set(remoteDecks.map(deck => deck.name));
        
        // Filter local decks to only include those not in remote decks
        // These are decks created offline that haven't been synced yet
        const offlineCreatedDecks = localDecks.filter(deck => 
          !remoteDeckIds.has(deck.id) && 
          !deck.synced && 
          !remoteDeckNames.has(deck.name) // Skip if a remote deck with the same name exists
        );
        
        console.log(`Found ${offlineCreatedDecks.length} offline-created decks to merge with ${remoteDecks.length} remote decks`);
        
        // Combine remote decks with offline-created decks
        const mergedDecks = [
          ...remoteDecks,
          ...offlineCreatedDecks.map(deck => ({
            id: deck.id,
            user_id: deck.user_id,
            name: deck.name,
            description: deck.description,
            language: deck.language,
            settings: deck.settings,
            tags: deck.tags,
            color_preset: deck.color_preset,
            created_at: deck.created_at,
            updated_at: deck.updated_at,
            total_cards: deck.total_cards || 0,
            new_cards: deck.new_cards || 0,
            cards_to_review: deck.cards_to_review || 0
          }))
        ];
        
        return mergedDecks;
      } catch (remoteError) {
        console.error('Error getting decks from Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
        const localDecks = await LocalDB.getLocalDecks(userId);
        return localDecks.map(deck => ({
          id: deck.id,
          user_id: deck.user_id,
          name: deck.name,
          description: deck.description,
          language: deck.language,
          settings: deck.settings,
          tags: deck.tags,
          color_preset: deck.color_preset,
          created_at: deck.created_at,
          updated_at: deck.updated_at,
          total_cards: deck.total_cards || 0,
          new_cards: deck.new_cards || 0,
          cards_to_review: deck.cards_to_review || 0
        }));
      }
    } else {
      // Offline mode - get from local only
      const localDecks = await LocalDB.getLocalDecks(userId);
      return localDecks.map(deck => ({
        id: deck.id,
        user_id: deck.user_id,
        name: deck.name,
        description: deck.description,
        language: deck.language,
        settings: deck.settings,
        tags: deck.tags,
        color_preset: deck.color_preset,
        created_at: deck.created_at,
        updated_at: deck.updated_at,
        total_cards: deck.total_cards || 0,
        new_cards: deck.new_cards || 0,
        cards_to_review: deck.cards_to_review || 0
      }));
    }
  } catch (error) {
    console.error('Error in getDecks service:', error);
    throw error;
  }
}

// Update a deck
export async function updateDeck(
  id: string,
  data: Partial<Pick<Deck, 'name' | 'description' | 'tags' | 'language' | 'settings' | 'color_preset'>>
): Promise<Deck> {
  try {
    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.updateDeck(id, data);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Try to update in Supabase first
        const remoteDeck = await SupabaseAPI.updateDeck(id, data);
        
        // Then update locally - first find the local deck that corresponds to this remote deck
        try {
          const db = await ensureDatabase();
          if (db) {
            // Try to find a local deck with this remote_id
            const localDeckResult = await db.getFirstAsync<{ id: string }>(
              'SELECT id FROM decks WHERE remote_id = ?',
              [id]
            );
            
            if (localDeckResult) {
              // If found, update the local deck using its local ID
              await LocalDB.updateLocalDeck(localDeckResult.id, data);
              console.log(`Updated local deck ${localDeckResult.id} with remote changes`);
            } else {
              // If not found, this might be a deck that exists only remotely
              // We could create a local copy here if needed
              console.log(`No local deck found with remote_id ${id}, skipping local update`);
            }
          }
        } catch (localError) {
          console.error('Error updating deck locally:', localError);
          // Continue anyway since we have the remote update
        }
        
        return remoteDeck;
      } catch (remoteError) {
        console.error('Error updating deck in Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
        const localDeck = await LocalDB.updateLocalDeck(id, data);
        return {
          id: localDeck.id,
          user_id: localDeck.user_id,
          name: localDeck.name,
          description: localDeck.description,
          language: localDeck.language,
          settings: localDeck.settings,
          tags: localDeck.tags,
          color_preset: localDeck.color_preset,
          created_at: localDeck.created_at,
          updated_at: localDeck.updated_at,
          total_cards: localDeck.total_cards || 0,
          new_cards: localDeck.new_cards || 0,
          cards_to_review: localDeck.cards_to_review || 0
        };
      }
    } else {
      // Offline mode - update locally only
      const localDeck = await LocalDB.updateLocalDeck(id, data);
      return {
        id: localDeck.id,
        user_id: localDeck.user_id,
        name: localDeck.name,
        description: localDeck.description,
        language: localDeck.language,
        settings: localDeck.settings,
        tags: localDeck.tags,
        color_preset: localDeck.color_preset,
        created_at: localDeck.created_at,
        updated_at: localDeck.updated_at,
        total_cards: localDeck.total_cards || 0,
        new_cards: localDeck.new_cards || 0,
        cards_to_review: localDeck.cards_to_review || 0
      };
    }
  } catch (error) {
    console.error('Error in updateDeck service:', error);
    throw error;
  }
}

// Delete a deck
export async function deleteDeck(id: string): Promise<void> {
  try {
    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.deleteDeck(id);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Try to delete from Supabase first
        await SupabaseAPI.deleteDeck(id);
        
        // Then delete locally - first find the local deck that corresponds to this remote deck
        try {
          const db = await ensureDatabase();
          if (db) {
            // Try to find a local deck with this remote_id
            const localDeckResult = await db.getFirstAsync<{ id: string }>(
              'SELECT id FROM decks WHERE remote_id = ?',
              [id]
            );
            
            if (localDeckResult) {
              // If found, delete the local deck using its local ID
              await LocalDB.deleteLocalDeck(localDeckResult.id);
              console.log(`Deleted local deck ${localDeckResult.id} with remote ID ${id}`);
            } else {
              // If not found, try to delete using the provided ID directly
              // This handles cases where the local and remote IDs are the same
              try {
                await LocalDB.deleteLocalDeck(id);
                console.log(`Deleted local deck with ID ${id}`);
              } catch (directDeleteError) {
                console.log(`No local deck found with ID ${id} or remote_id ${id}`);
              }
            }
          }
        } catch (localError) {
          console.error('Error deleting deck locally:', localError);
          // Continue anyway since we've deleted from Supabase
        }
      } catch (remoteError) {
        console.error('Error deleting deck from Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
        await LocalDB.deleteLocalDeck(id);
      }
    } else {
      // Offline mode - delete locally only
      await LocalDB.deleteLocalDeck(id);
    }
  } catch (error) {
    console.error('Error in deleteDeck service:', error);
    throw error;
  }
}

// Sync offline decks to the server
export async function syncOfflineDecks(userId: string): Promise<void> {
  try {
    // Check if we're online
    const online = await isOnline();
    if (!online) {
      console.log('Cannot sync - device is offline');
      throw new Error('Cannot sync offline decks: device is offline');
    }

    console.log(`Starting sync of offline decks for user ${userId}...`);
    
    // Get all local decks
    const localDecks = await LocalDB.getLocalDecks(userId);
    console.log(`Found ${localDecks.length} local decks to process`);
    
    // Get the database connection
    const db = await ensureDatabase();
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    // First, sync new decks created offline
    const unsyncedDecks = localDecks.filter(deck => !deck.synced);
    console.log(`Found ${unsyncedDecks.length} unsynced decks to create remotely`);
    
    for (const deck of unsyncedDecks) {
      try {
        console.log(`Syncing offline deck: ${deck.name} (${deck.id})`);
        
        // Create the deck in Supabase
        const remoteDeck = await SupabaseAPI.createDeck({
          name: deck.name,
          description: deck.description,
          language: deck.language,
          settings: deck.settings,
          tags: deck.tags,
          userId,
          color_preset: deck.color_preset as GradientPreset,
        });
        
        console.log(`Created remote deck: ${remoteDeck.id}`);
        
        // Mark local deck as synced
        await db.runAsync(
          'UPDATE decks SET synced = 1, remote_id = ?, modified_offline = 0 WHERE id = ?',
          [remoteDeck.id, deck.id]
        );
        
        console.log(`Updated local deck ${deck.id} with remote ID ${remoteDeck.id}`);
        
        // Update card references to point to the new remote deck ID
        await db.runAsync(
          'UPDATE cards SET deck_id = ? WHERE deck_id = ?',
          [remoteDeck.id, deck.id]
        );
        
        console.log(`Updated card references from local deck ${deck.id} to remote deck ${remoteDeck.id}`);
      } catch (error) {
        console.error(`Error syncing deck ${deck.id}:`, error);
        // Continue with next deck
      }
    }
    
    // Then, update modified decks
    const modifiedDecks = localDecks.filter(deck => deck.synced && deck.remote_id && deck.modified_offline);
    console.log(`Found ${modifiedDecks.length} modified decks to update remotely`);
    
    for (const deck of modifiedDecks) {
      try {
        console.log(`Updating modified deck: ${deck.name} (${deck.id})`);
        
        // Update the deck in Supabase
        await SupabaseAPI.updateDeck(deck.remote_id as string, {
          name: deck.name,
          description: deck.description,
          language: deck.language,
          settings: deck.settings,
          tags: deck.tags,
          color_preset: deck.color_preset as GradientPreset,
        });
        
        console.log(`Updated remote deck: ${deck.remote_id}`);
        
        // Mark local deck as synced
        await db.runAsync(
          'UPDATE decks SET modified_offline = 0 WHERE id = ?',
          [deck.id]
        );
        
        console.log(`Marked local deck ${deck.id} as synced`);
      } catch (error) {
        console.error(`Error updating deck ${deck.id}:`, error);
        // Continue with next deck
      }
    }
    
    // Handle deleted decks
    try {
      // Get decks marked as deleted offline
      const deletedDecks = await db.getAllAsync<{ id: string, remote_id: string }>(
        'SELECT id, remote_id FROM decks WHERE deleted_offline = 1'
      );
      
      console.log(`Found ${deletedDecks.length} deleted decks to remove remotely`);
      
      for (const deck of deletedDecks) {
        try {
          if (deck.remote_id) {
            // Delete from Supabase
            await SupabaseAPI.deleteDeck(deck.remote_id);
            console.log(`Deleted remote deck: ${deck.remote_id}`);
          }
          
          // Remove from local DB
          await db.runAsync('DELETE FROM decks WHERE id = ?', [deck.id]);
          console.log(`Removed local deck: ${deck.id}`);
        } catch (error) {
          console.error(`Error deleting deck ${deck.id}:`, error);
          // Continue with next deck
        }
      }
    } catch (error) {
      console.error('Error processing deleted decks:', error);
    }

    // Now sync cards
    console.log('Starting to sync cards...');
    
    // Get all local decks that are synced and have remote IDs
    const syncedDecks = localDecks.filter(deck => deck.synced && deck.remote_id);
    console.log(`Found ${syncedDecks.length} synced decks to process cards for`);
    
    for (const deck of syncedDecks) {
      try {
        console.log(`Processing cards for deck: ${deck.name} (${deck.id})`);
        
        // Get all unsynchronized cards for this deck
        const unsyncedCards = await db.getAllAsync<any>(
          'SELECT * FROM cards WHERE deck_id = ? AND synced = 0 AND (deleted_offline = 0 OR deleted_offline IS NULL)',
          [deck.id]
        );
        
        console.log(`Found ${unsyncedCards.length} unsynced cards to create remotely for deck ${deck.id}`);
        
        for (const cardData of unsyncedCards) {
          try {
            console.log(`Syncing card: ${cardData.id}`);
            
            // Parse JSON fields
            const tags = cardData.tags ? JSON.parse(cardData.tags) : [];
            const language_specific_data = cardData.language_specific_data 
              ? JSON.parse(cardData.language_specific_data) 
              : undefined;
            
            // Create card in Supabase
            const remoteCard = await SupabaseAPI.createCard({
              deck_id: deck.remote_id as string,
              front: cardData.front,
              back: cardData.back,
              notes: cardData.notes,
              tags,
              language_specific_data,
              state: cardData.state,
              difficulty: cardData.difficulty,
              stability: cardData.stability,
              retrievability: cardData.retrievability,
              elapsed_days: cardData.elapsed_days,
              scheduled_days: cardData.scheduled_days,
              reps: cardData.reps,
              lapses: cardData.lapses,
              step_index: cardData.step_index,
              queue: cardData.queue,
            });
            
            console.log(`Created remote card: ${remoteCard.id}`);
            
            // Mark local card as synced
            await db.runAsync(
              'UPDATE cards SET synced = 1, remote_id = ?, modified_offline = 0 WHERE id = ?',
              [remoteCard.id, cardData.id]
            );
            
            console.log(`Updated local card ${cardData.id} with remote ID ${remoteCard.id}`);
          } catch (error) {
            console.error(`Error syncing card ${cardData.id}:`, error);
            // Continue with next card
          }
        }
        
        // Handle deleted cards
        const deletedCards = await db.getAllAsync<{ id: string, remote_id: string }>(
          'SELECT id, remote_id FROM cards WHERE deck_id = ? AND deleted_offline = 1',
          [deck.id]
        );
        
        console.log(`Found ${deletedCards.length} deleted cards to remove remotely for deck ${deck.id}`);
        
        for (const card of deletedCards) {
          try {
            if (card.remote_id) {
              // Delete from Supabase
              await SupabaseAPI.deleteCard(card.remote_id);
              console.log(`Deleted remote card: ${card.remote_id}`);
            }
            
            // Remove from local DB
            await db.runAsync('DELETE FROM cards WHERE id = ?', [card.id]);
            console.log(`Removed local card: ${card.id}`);
          } catch (error) {
            console.error(`Error deleting card ${card.id}:`, error);
            // Continue with next card
          }
        }
      } catch (error) {
        console.error(`Error processing cards for deck ${deck.id}:`, error);
        // Continue with next deck
      }
    }
    
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error syncing offline decks:', error);
    throw error;
  }
}

// Get a single deck by ID
export async function getDeck(id: string): Promise<Deck | null> {
  try {
    if (!id) {
      console.error('Cannot get deck: id is null or undefined');
      return null;
    }

    console.log(`Getting deck with ID: ${id}`);

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.getDeck(id);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Try to get from Supabase first
        const remoteDeck = await SupabaseAPI.getDeck(id);
        return remoteDeck;
      } catch (remoteError) {
        console.error('Error getting deck from Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
        const localDeck = await LocalDB.getLocalDeck(id);
        if (!localDeck) return null;
        
        return {
          id: localDeck.id,
          user_id: localDeck.user_id,
          name: localDeck.name,
          description: localDeck.description,
          language: localDeck.language,
          settings: localDeck.settings,
          tags: localDeck.tags,
          color_preset: localDeck.color_preset,
          created_at: localDeck.created_at,
          updated_at: localDeck.updated_at,
          total_cards: localDeck.total_cards || 0,
          new_cards: localDeck.new_cards || 0,
          cards_to_review: localDeck.cards_to_review || 0
        };
      }
    } else {
      // Offline mode - get from local only
      const localDeck = await LocalDB.getLocalDeck(id);
      if (!localDeck) return null;
      
      return {
        id: localDeck.id,
        user_id: localDeck.user_id,
        name: localDeck.name,
        description: localDeck.description,
        language: localDeck.language,
        settings: localDeck.settings,
        tags: localDeck.tags,
        color_preset: localDeck.color_preset,
        created_at: localDeck.created_at,
        updated_at: localDeck.updated_at,
        total_cards: localDeck.total_cards || 0,
        new_cards: localDeck.new_cards || 0,
        cards_to_review: localDeck.cards_to_review || 0
      };
    }
  } catch (error) {
    console.error('Error in getDeck service:', error);
    throw error;
  }
}

// Get cards for a deck
export async function getCards(deckId: string): Promise<Card[]> {
  try {
    console.log(`📊 [SERVICE] Fetching cards for deck: ${deckId}`);
    
    // Check if we're online
    const online = await isOnline();
    console.log(`📡 [SERVICE] Network status for getCards: ${online ? 'Online' : 'Offline'}`);

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.getCards(deckId);
    }

    if (online) {
      try {
        // Try to get from Supabase first
        console.log('🔄 [SERVICE] Fetching cards from Supabase');
        const remoteCards = await SupabaseAPI.getCards(deckId);
        console.log(`✅ [SERVICE] Retrieved ${remoteCards.length} cards from Supabase`);
        
        // Cache them locally for offline access
        try {
          console.log('💾 [SERVICE] Caching cards locally for offline access');
          const db = await ensureDatabase();
          if (db) {
            for (const card of remoteCards) {
              // Convert dates to ISO strings for storage
              const cardData = {
                ...card,
                created_at: card.created_at instanceof Date ? card.created_at.toISOString() : card.created_at,
                last_reviewed_at: card.last_reviewed_at instanceof Date ? card.last_reviewed_at.toISOString() : card.last_reviewed_at,
                next_review_at: card.next_review_at instanceof Date ? card.next_review_at.toISOString() : card.next_review_at,
              };
              
              // Ensure we have an updated_at value (required by SQLite schema)
              const updatedAt = (card as any).updated_at || cardData.created_at;
              const updatedAtStr = updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt);

              // Check if card already exists
              const existingCard = await db.getFirstAsync<{count: number}>(
                'SELECT COUNT(*) as count FROM cards WHERE id = ?',
                [card.id]
              );
              
              if (existingCard && existingCard.count > 0) {
                // Update existing card
                // For simplicity, we'll just delete and re-insert
                await db.runAsync('DELETE FROM cards WHERE id = ?', [card.id]);
              }
              
              // Prepare data for insertion
              const tags = JSON.stringify(card.tags || []);
              const language_specific_data = card.language_specific_data 
                ? JSON.stringify(card.language_specific_data) 
                : null;
              
              // Insert the card
              await db.runAsync(`
                INSERT INTO cards (
                  id, deck_id, front, back, notes, tags, language_specific_data,
                  created_at, updated_at, last_reviewed_at, next_review_at,
                  review_count, consecutive_correct,
                  state, difficulty, stability, retrievability,
                  elapsed_days, scheduled_days, reps, lapses,
                  step_index, queue,
                  synced, remote_id, modified_offline, deleted_offline
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                card.id, card.deck_id, card.front, card.back, card.notes, tags, language_specific_data,
                cardData.created_at, updatedAtStr, cardData.last_reviewed_at, cardData.next_review_at,
                card.review_count || 0, card.consecutive_correct || 0,
                card.state, card.difficulty, card.stability, card.retrievability,
                card.elapsed_days, card.scheduled_days, card.reps, card.lapses,
                card.step_index, card.queue,
                1, card.id, 0, 0  // Synced = 1, remote_id = card.id, not modified, not deleted
              ]);
            }
            console.log(`💾 [SERVICE] Cached ${remoteCards.length} cards locally`);
          }
        } catch (localError) {
          console.error('❌ [SERVICE] Error caching cards locally:', localError);
          // Continue anyway since we have the remote cards
        }
        
        return remoteCards;
      } catch (remoteError) {
        console.error('❌ [SERVICE] Error fetching cards from Supabase, falling back to local:', remoteError);
        
        // Fall back to local storage if Supabase fails
        console.log('💾 [SERVICE] Falling back to local database for cards');
        const localCards = await LocalDB.getLocalCards(deckId);
        console.log(`💾 [SERVICE] Retrieved ${localCards.length} cards from local database`);
        
        return localCards.map(card => ({
          id: card.id,
          deck_id: card.deck_id,
          front: card.front,
          back: card.back,
          notes: card.notes,
          tags: card.tags || [],
          language_specific_data: card.language_specific_data,
          created_at: card.created_at,
          last_reviewed_at: card.last_reviewed_at,
          next_review_at: card.next_review_at,
          review_count: card.review_count,
          consecutive_correct: card.consecutive_correct,
          state: card.state,
          difficulty: card.difficulty,
          stability: card.stability,
          retrievability: card.retrievability,
          elapsed_days: card.elapsed_days,
          scheduled_days: card.scheduled_days,
          reps: card.reps,
          lapses: card.lapses,
          scheduled_in_minutes: card.scheduled_in_minutes,
          step_index: card.step_index,
          queue: card.queue,
        }));
      }
    } else {
      // Offline mode - get from local storage
      console.log('💾 [SERVICE] In offline mode, retrieving cards from local database');
      const localCards = await LocalDB.getLocalCards(deckId);
      console.log(`💾 [SERVICE] Retrieved ${localCards.length} cards from local database in offline mode`);
      
      return localCards.map(card => ({
        id: card.id,
        deck_id: card.deck_id,
        front: card.front,
        back: card.back,
        notes: card.notes,
        tags: card.tags || [],
        language_specific_data: card.language_specific_data,
        created_at: card.created_at,
        last_reviewed_at: card.last_reviewed_at,
        next_review_at: card.next_review_at,
        review_count: card.review_count,
        consecutive_correct: card.consecutive_correct,
        state: card.state,
        difficulty: card.difficulty,
        stability: card.stability,
        retrievability: card.retrievability,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        scheduled_in_minutes: card.scheduled_in_minutes,
        step_index: card.step_index,
        queue: card.queue,
      }));
    }
  } catch (error) {
    console.error('❌ [SERVICE] Error in getCards service:', error);
    throw error;
  }
}

// Delete a card
export async function deleteCard(cardId: string): Promise<void> {
  try {
    if (!cardId) {
      console.error('Cannot delete card: cardId is null or undefined');
      throw new Error('Card ID is required to delete a card');
    }

    console.log(`Deleting card with ID: ${cardId}`);

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.deleteCard(cardId);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Try to delete from Supabase first
        await SupabaseAPI.deleteCard(cardId);
        // Since we don't have local card storage yet, we don't need to delete locally
      } catch (remoteError) {
        console.error('Error deleting card from Supabase:', remoteError);
        // Since we don't have local card storage yet, just throw the error
        throw remoteError;
      }
    } else {
      // Offline mode - since we don't have local card storage yet, show error
      console.log('Device is offline. Cannot delete card when offline.');
      throw new Error('Cannot delete card when offline. Please try again when you have an internet connection.');
    }
  } catch (error) {
    console.error('Error in deleteCard service:', error);
    throw error;
  }
} 