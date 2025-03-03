import { Platform } from 'react-native';
import { Deck, Card, GradientPreset } from '../../types/flashcards';
import * as SupabaseAPI from '../api/flashcards';
import * as LocalDB from '../db/flashcards';
import { initFlashcardsDatabase } from '../db/flashcards';
import { ensureDatabase } from '../db/index';
import NetInfo from '@react-native-community/netinfo';
import { createNewCard } from '@/lib/spaced-repetition/fsrs';
import { getLocalCards, getDeckByRemoteId } from '../db/flashcards';
import { supabase } from '../supabase';

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

    // Check if the provided ID is a UUID (likely a remote ID)
    const isRemoteId = id.includes('-') && id.length > 30;
    console.log(`📊 [SERVICE] Update deck called with ${isRemoteId ? 'remote' : 'local'} ID: ${id}`);

    // On mobile, check if online
    const online = await isOnline();
    console.log(`📡 [SERVICE] Network status for updateDeck: ${online ? 'Online' : 'Offline'}`);

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
              console.log(`✅ [SERVICE] Updated local deck ${localDeckResult.id} with remote changes`);
            } else {
              // If not found, this might be a deck that exists only remotely
              // We could create a local copy here if needed
              console.log(`ℹ️ [SERVICE] No local deck found with remote_id ${id}, skipping local update`);
            }
          }
        } catch (localError) {
          console.error('❌ [SERVICE] Error updating deck locally:', localError);
          // Continue anyway since we have the remote update
        }
        
        return remoteDeck;
      } catch (remoteError) {
        console.error('❌ [SERVICE] Error updating deck in Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
      }
    }
    
    // Get local deck ID if we have a remote ID
    let localId = id;
    if (isRemoteId) {
      console.log(`🔍 [SERVICE] Looking for local deck with remote ID: ${id}`);
      try {
        // Try to find the corresponding local deck ID
        const localDeck = await LocalDB.getDeckByRemoteId(id);
        if (localDeck) {
          localId = localDeck.id;
          console.log(`✅ [SERVICE] Found local deck ID ${localId} for remote ID ${id}`);
        } else {
          console.error(`❌ [SERVICE] No local deck found with remote ID ${id}`);
          throw new Error('Deck not found');
        }
      } catch (error) {
        console.error(`❌ [SERVICE] Error finding local deck with remote ID ${id}:`, error);
        throw new Error('Deck not found');
      }
    } else {
      // Check if the local ID exists
      try {
        const deckExists = await LocalDB.getLocalDeck(id);
        if (!deckExists) {
          console.error(`❌ [SERVICE] No deck found with local ID ${id}`);
          throw new Error('Deck not found');
        }
      } catch (error) {
        console.error(`❌ [SERVICE] Error checking local deck with ID ${id}:`, error);
        throw new Error('Deck not found');
      }
    }
    
    // Offline mode - update locally only
    console.log(`💾 [SERVICE] Updating local deck with ID: ${localId}`);
    try {
      // Use type assertion to add modified_offline flag
      const updatedData = {
        ...data,
        modified_offline: true
      };
      
      const localDeck = await LocalDB.updateLocalDeck(localId, updatedData as any);
      
      console.log(`✅ [SERVICE] Successfully updated local deck ${localId}`);
      
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
    } catch (error) {
      console.error(`❌ [SERVICE] Error updating local deck:`, error);
      throw error;
    }
  } catch (error) {
    console.error('❌ [SERVICE] Error in updateDeck service:', error);
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

    // Check if the provided ID is a UUID (likely a remote ID)
    const isRemoteId = id.includes('-') && id.length > 30;
    console.log(`📊 [SERVICE] Delete deck called with ${isRemoteId ? 'remote' : 'local'} ID: ${id}`);

    // On mobile, check if online
    const online = await isOnline();
    console.log(`📡 [SERVICE] Network status for deleteDeck: ${online ? 'Online' : 'Offline'}`);

    if (online) {
      try {
        // Try to delete from Supabase first
        if (isRemoteId) {
          await SupabaseAPI.deleteDeck(id);
          console.log(`✅ [SERVICE] Successfully deleted remote deck ${id}`);
        }
        
        // Then delete locally - first find the local deck that corresponds to this remote deck
        try {
          const db = await ensureDatabase();
          if (db) {
            let localId = id;
            
            // If this is a remote ID, find the corresponding local ID
            if (isRemoteId) {
              // Try to find a local deck with this remote_id
              const localDeckResult = await db.getFirstAsync<{ id: string }>(
                'SELECT id FROM decks WHERE remote_id = ?',
                [id]
              );
              
              if (localDeckResult) {
                localId = localDeckResult.id;
                console.log(`🔍 [SERVICE] Found local ID ${localId} for remote ID ${id}`);
              } else {
                console.log(`ℹ️ [SERVICE] No local deck found with remote_id ${id}`);
              }
            }
            
            // Delete the local deck using the local ID
            await LocalDB.deleteLocalDeck(localId);
            console.log(`✅ [SERVICE] Deleted local deck ${localId}`);
          }
        } catch (localError) {
          console.error('❌ [SERVICE] Error deleting deck locally:', localError);
          // We've already deleted from Supabase, so consider it a partial success
        }
      } catch (remoteError) {
        console.error('❌ [SERVICE] Error deleting deck from Supabase, falling back to local:', remoteError);
        
        // Fall back to local storage if Supabase fails - but still need proper ID mapping
        let localId = id;
        
        // Get local deck ID if we have a remote ID
        if (isRemoteId) {
          try {
            const localDeck = await LocalDB.getDeckByRemoteId(id);
            if (localDeck) {
              localId = localDeck.id;
              console.log(`✅ [SERVICE] Found local deck ID ${localId} for remote ID ${id}`);
            } else {
              console.error(`❌ [SERVICE] No local deck found with remote ID ${id}`);
              throw new Error('Deck not found');
            }
          } catch (error) {
            console.error(`❌ [SERVICE] Error finding local deck with remote ID ${id}:`, error);
            throw new Error('Deck not found');
          }
        }
        
        // Delete using the local ID
        await LocalDB.deleteLocalDeck(localId);
        console.log(`✅ [SERVICE] Deleted local deck ${localId} after Supabase error`);
      }
    } else {
      // Offline mode - mark deck for deletion instead of deleting directly
      console.log(`💾 [SERVICE] Offline mode - marking deck for deletion: ${id}`);
      
      // Get local deck ID if we have a remote ID
      let localId = id;
      if (isRemoteId) {
        try {
          const localDeck = await LocalDB.getDeckByRemoteId(id);
          if (localDeck) {
            localId = localDeck.id;
            console.log(`✅ [SERVICE] Found local deck ID ${localId} for remote ID ${id}`);
          } else {
            console.error(`❌ [SERVICE] No local deck found with remote ID ${id}`);
            throw new Error('Deck not found');
          }
        } catch (error) {
          console.error(`❌ [SERVICE] Error finding local deck with remote ID ${id}:`, error);
          throw new Error('Deck not found');
        }
      } else {
        // Check if the local ID exists
        try {
          const deckExists = await LocalDB.getLocalDeck(id);
          if (!deckExists) {
            console.error(`❌ [SERVICE] No deck found with local ID ${id}`);
            throw new Error('Deck not found');
          }
        } catch (error) {
          console.error(`❌ [SERVICE] Error checking local deck with ID ${id}:`, error);
          throw new Error('Deck not found');
        }
      }
      
      console.log(`💾 [SERVICE] Marking local deck for deletion: ${localId}`);
      
      try {
        // Instead of deleting, mark the deck as deleted_offline
        const db = await ensureDatabase();
        if (db) {
          await db.runAsync(
            'UPDATE decks SET deleted_offline = 1 WHERE id = ?',
            [localId]
          );
          console.log(`✅ [SERVICE] Successfully marked deck ${localId} as deleted_offline`);
        }
      } catch (error) {
        console.error(`❌ [SERVICE] Error marking deck as deleted:`, error);
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ [SERVICE] Error in deleteDeck service:', error);
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
    
    // First, sync new decks created offline (synced=0 or remote_id is NULL)
    const unsyncedDecks = localDecks.filter(deck => 
      !deck.synced || 
      !deck.remote_id || 
      deck.remote_id === 'null' || 
      deck.remote_id === 'NULL' || 
      (typeof deck.remote_id === 'string' && deck.remote_id.startsWith('local_'))
    );
    console.log(`Found ${unsyncedDecks.length} unsynced decks to create remotely`, 
      unsyncedDecks.map(d => ({ id: d.id, name: d.name, synced: d.synced, remote_id: d.remote_id })));
    
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
        
        // Mark local deck as synced and store the remote ID
        await db.runAsync(
          'UPDATE decks SET synced = 1, remote_id = ?, modified_offline = 0 WHERE id = ?',
          [remoteDeck.id, deck.id]
        );
        
        console.log(`Updated local deck ${deck.id} with remote ID ${remoteDeck.id}`);
        
        // Now sync any cards for this deck that were created offline
        const localCards = await db.getAllAsync<any>(
          'SELECT * FROM cards WHERE deck_id = ?',
          [deck.id]
        );
        
        console.log(`Found ${localCards.length} local cards for deck ${deck.id} to process`);
        
        for (const cardData of localCards) {
          try {
            console.log(`Syncing offline card for new deck: ${cardData.front} (${cardData.id})`);
            
            // Parse JSON fields
            const tags = cardData.tags ? JSON.parse(cardData.tags) : [];
            const language_specific_data = cardData.language_specific_data 
              ? JSON.parse(cardData.language_specific_data) 
              : undefined;
            
            // Create card in Supabase with the remote deck ID
            const remoteCard = await SupabaseAPI.createCard({
              deck_id: remoteDeck.id, // Use the remote deck ID!
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
            
            // Update local card to point to remote deck ID and mark as synced
            await db.runAsync(
              'UPDATE cards SET synced = 1, remote_id = ?, deck_id = ?, modified_offline = 0 WHERE id = ?',
              [remoteCard.id, remoteDeck.id, cardData.id]
            );
            
            console.log(`Updated local card ${cardData.id} with remote ID ${remoteCard.id} and deck ID ${remoteDeck.id}`);
          } catch (cardError) {
            console.error(`Error syncing card ${cardData.id} for new deck:`, cardError);
            // Continue with next card
          }
        }
      } catch (error) {
        console.error(`Error syncing deck ${deck.id}:`, error);
        // Continue with next deck
      }
    }
    
    // Then, update modified decks
    const modifiedDecks = localDecks.filter(deck => 
      deck.synced && 
      deck.remote_id && 
      !deck.remote_id.startsWith('local_') && 
      deck.modified_offline
    );
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

    // Now sync cards for already synced decks
    console.log('Starting to sync cards for already synced decks...');
    
    // Get all local decks that are synced and have valid remote IDs (not local_* IDs)
    const syncedDecks = localDecks.filter(deck => 
      deck.synced && 
      deck.remote_id && 
      typeof deck.remote_id === 'string' && 
      !deck.remote_id.startsWith('local_')
    );
    console.log(`Found ${syncedDecks.length} synced decks to process cards for`);
    
    for (const deck of syncedDecks) {
      try {
        console.log(`Processing cards for synced deck: ${deck.name} (${deck.id})`);
        
        // Get all unsynchronized cards for this deck
        const unsyncedCards = await db.getAllAsync<any>(
          'SELECT * FROM cards WHERE deck_id = ? AND (synced = 0 OR synced IS NULL) AND (deleted_offline = 0 OR deleted_offline IS NULL)',
          [deck.id]
        );
        
        console.log(`Found ${unsyncedCards.length} unsynced cards to create remotely for synced deck ${deck.id}`);
        
        for (const cardData of unsyncedCards) {
          try {
            console.log(`Syncing card: ${cardData.id}, front: "${cardData.front}"`);
            
            // Parse JSON fields
            const tags = cardData.tags ? JSON.parse(cardData.tags) : [];
            const language_specific_data = cardData.language_specific_data 
              ? JSON.parse(cardData.language_specific_data) 
              : undefined;
            
            // Create card in Supabase with the remote deck ID
            const remoteCard = await SupabaseAPI.createCard({
              deck_id: deck.remote_id as string,  // Use the remote ID of the deck
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
            
            // Mark local card as synced and update its deck_id to the remote deck ID
            await db.runAsync(
              'UPDATE cards SET synced = 1, remote_id = ?, deck_id = ?, modified_offline = 0 WHERE id = ?',
              [remoteCard.id, deck.remote_id, cardData.id]
            );
            
            console.log(`Updated local card ${cardData.id} with remote ID ${remoteCard.id}`);
          } catch (error) {
            console.error(`Error syncing card ${cardData.id}:`, error);
            // Continue with next card
          }
        }
        
        // Get modified but already synced cards
        const modifiedCards = await db.getAllAsync<any>(
          'SELECT * FROM cards WHERE deck_id = ? AND synced = 1 AND remote_id IS NOT NULL AND modified_offline = 1 AND (deleted_offline = 0 OR deleted_offline IS NULL)',
          [deck.id]
        );
        
        console.log(`Found ${modifiedCards.length} modified cards to update remotely for deck ${deck.id}`);
        
        for (const cardData of modifiedCards) {
          try {
            console.log(`Updating modified card: ${cardData.id}`);
            
            // Parse JSON fields
            const tags = cardData.tags ? JSON.parse(cardData.tags) : [];
            const language_specific_data = cardData.language_specific_data 
              ? JSON.parse(cardData.language_specific_data) 
              : undefined;
            
            // Update card in Supabase
            await SupabaseAPI.updateCard(cardData.remote_id, {
              front: cardData.front,
              back: cardData.back,
              notes: cardData.notes,
              tags,
              language_specific_data,
            });
            
            console.log(`Updated remote card: ${cardData.remote_id}`);
            
            // Mark local card as no longer modified offline
            await db.runAsync(
              'UPDATE cards SET modified_offline = 0 WHERE id = ?',
              [cardData.id]
            );
            
            console.log(`Marked local card ${cardData.id} as synced`);
          } catch (error) {
            console.error(`Error updating card ${cardData.id}:`, error);
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
    
    // Check if this is a local ID (starts with 'local_')
    const isLocalId = id.startsWith('local_');

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      if (isLocalId) {
        console.log('Cannot fetch local deck on web platform');
        return null;
      }
      return await SupabaseAPI.getDeck(id);
    }

    // On mobile, check if online
    const online = await isOnline();
    
    // If it's a local ID, always get from local storage
    if (isLocalId) {
      console.log(`Local deck ID detected (${id}), fetching from local database`);
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

    if (online) {
      try {
        // Try to get from Supabase first
        const remoteDeck = await SupabaseAPI.getDeck(id);
        return remoteDeck;
      } catch (remoteError) {
        console.error('Error getting deck from Supabase, falling back to local:', remoteError);
        
        // Fall back to local storage if Supabase fails - first try by remote_id
        const localDeck = await LocalDB.getDeckByRemoteId(id);
        
        // If not found by remote_id, try as a regular local id
        if (!localDeck) {
          const directLocalDeck = await LocalDB.getLocalDeck(id);
          if (!directLocalDeck) return null;
          
          return {
            id: directLocalDeck.id,
            user_id: directLocalDeck.user_id,
            name: directLocalDeck.name,
            description: directLocalDeck.description,
            language: directLocalDeck.language,
            settings: directLocalDeck.settings,
            tags: directLocalDeck.tags,
            color_preset: directLocalDeck.color_preset,
            created_at: directLocalDeck.created_at,
            updated_at: directLocalDeck.updated_at,
            total_cards: directLocalDeck.total_cards || 0,
            new_cards: directLocalDeck.new_cards || 0,
            cards_to_review: directLocalDeck.cards_to_review || 0
          };
        }
        
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
      if (!localDeck) {
        // If not found directly, try looking up by remote_id
        const deckByRemoteId = await LocalDB.getDeckByRemoteId(id);
        if (!deckByRemoteId) return null;
        
        return {
          id: deckByRemoteId.id,
          user_id: deckByRemoteId.user_id,
          name: deckByRemoteId.name,
          description: deckByRemoteId.description,
          language: deckByRemoteId.language,
          settings: deckByRemoteId.settings,
          tags: deckByRemoteId.tags,
          color_preset: deckByRemoteId.color_preset,
          created_at: deckByRemoteId.created_at,
          updated_at: deckByRemoteId.updated_at,
          total_cards: deckByRemoteId.total_cards || 0,
          new_cards: deckByRemoteId.new_cards || 0,
          cards_to_review: deckByRemoteId.cards_to_review || 0
        };
      }
      
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
    const networkStatus = await isOnline();
    console.log(`📊 [SERVICE] Fetching cards for deck: ${deckId}`);
    console.log(`📡 [SERVICE] Network status for getCards: ${networkStatus ? 'Online' : 'Offline'}`);
    
    let effectiveDeckId = deckId;
    let localDeckId = null;
    
    // If we're online and have a local ID, try to find the corresponding remote ID for API calls
    if (networkStatus && deckId.startsWith('local_')) {
      try {
        // Get the local deck to find its remote ID
        const localDeck = await getDeckByRemoteId(deckId);
        if (localDeck && localDeck.remote_id) {
          console.log(`🔄 [SERVICE] Found remote ID ${localDeck.remote_id} for local deck ${deckId}`);
          effectiveDeckId = localDeck.remote_id;
          localDeckId = deckId; // Store the local ID for fallback
        }
      } catch (error) {
        console.error('Error checking for remote deck ID:', error);
      }
    }
    // If we're offline and have a remote ID, try to find the corresponding local ID
    else if (!networkStatus && !deckId.startsWith('local_')) {
      try {
        // Try to get the local deck by remote ID
        const db = await ensureDatabase();
        if (db) {
          const localDecks = await db.getAllAsync<{id: string}>(
            'SELECT id FROM decks WHERE remote_id = ?',
            [deckId]
          );
          
          if (localDecks && localDecks.length > 0) {
            localDeckId = localDecks[0].id;
            console.log(`🔄 [SERVICE] Found local ID ${localDeckId} for remote deck ${deckId}`);
            effectiveDeckId = localDeckId;
          }
        }
      } catch (error) {
        console.error('Error checking for local deck ID:', error);
      }
    }

    if (networkStatus) {
      console.log(`🔄 [SERVICE] Fetching cards from Supabase using deck ID: ${effectiveDeckId}`);
      try {
        // Use the effective deck ID (remote ID if we found one, original ID otherwise)
        const cards = await getCardsFromSupabase(effectiveDeckId);
        
        // Cache cards locally if on mobile
        if (Platform.OS !== 'web') {
          console.log(`💾 [SERVICE] Caching ${cards.length} cards locally`);
          await cacheCardsLocally(cards, effectiveDeckId);
          
          // If we used a remote ID but have a local ID, also cache with the local ID for offline use
          if (localDeckId && effectiveDeckId !== localDeckId) {
            console.log(`💾 [SERVICE] Also caching cards with local deck ID ${localDeckId}`);
            
            // Update the deck_id in the cards for this cache operation
            const localCards = cards.map(card => ({
              ...card,
              deck_id: localDeckId
            }));
            
            await cacheCardsLocally(localCards, localDeckId);
          }
        }
        
        return cards;
      } catch (error) {
        console.error(`❌ [SERVICE] Error fetching cards from Supabase, falling back to local:`, error);
        if (Platform.OS !== 'web') {
          console.log(`💾 [SERVICE] Falling back to local database for cards`);
          // Try with original deck ID first
          const localCards = await getLocalCards(deckId);
          
          // If we found no cards but have a different effective ID, try that
          if (localCards.length === 0 && effectiveDeckId !== deckId) {
            console.log(`💾 [SERVICE] No cards found with ID ${deckId}, trying ${effectiveDeckId}`);
            const effectiveLocalCards = await getLocalCards(effectiveDeckId);
            console.log(`💾 [SERVICE] Retrieved ${effectiveLocalCards.length} cards from local database`);
            return effectiveLocalCards.map(formatLocalCard);
          }
          
          console.log(`💾 [SERVICE] Retrieved ${localCards.length} cards from local database`);
          return localCards.map(formatLocalCard);
        } else {
          throw error;
        }
      }
    } else {
      console.log(`💾 [SERVICE] In offline mode, retrieving cards from local database using ID: ${effectiveDeckId}`);
      if (Platform.OS === 'web') {
        console.log(`⚠️ [SERVICE] Local database not available on web platform`);
        return [];
      }
      
      // Try with effective ID first (which may be the local ID we found)
      const localCards = await getLocalCards(effectiveDeckId);
      
      // If no cards found and we have a different original ID, try with that as fallback
      if (localCards.length === 0 && effectiveDeckId !== deckId) {
        console.log(`💾 [SERVICE] No cards found with ID ${effectiveDeckId}, trying original ID ${deckId}`);
        const originalLocalCards = await getLocalCards(deckId);
        console.log(`💾 [SERVICE] Retrieved ${originalLocalCards.length} cards from local database in offline mode`);
        return originalLocalCards.map(formatLocalCard);
      }
      
      console.log(`💾 [SERVICE] Retrieved ${localCards.length} cards from local database in offline mode`);
      return localCards.map(formatLocalCard);
    }
  } catch (error) {
    console.error(`❌ [SERVICE] Error in getCards:`, error);
    return [];
  }
}

// Delete a card
export async function deleteCard(cardId: string): Promise<void> {
  try {
    if (!cardId) {
      console.error('Cannot delete card: cardId is null or undefined');
      throw new Error('Card ID is required to delete a card');
    }

    console.log(`📊 [SERVICE] Deleting card with ID: ${cardId}`);

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.deleteCard(cardId);
    }

    // On mobile, check if online
    const online = await isOnline();
    console.log(`📡 [SERVICE] Network status for deleteCard: ${online ? 'Online' : 'Offline'}`);

    if (online) {
      try {
        // Try to delete from Supabase first
        await SupabaseAPI.deleteCard(cardId);
        console.log(`✅ [SERVICE] Successfully deleted card from Supabase: ${cardId}`);
        
        // Also delete from local storage to keep them in sync
        await LocalDB.deleteLocalCard(cardId);
        console.log(`✅ [SERVICE] Successfully deleted card from local storage: ${cardId}`);
      } catch (remoteError) {
        console.error('❌ [SERVICE] Error deleting card from Supabase:', remoteError);
        
        // If Supabase delete fails but we're online, it might be an authorization issue or the card doesn't exist remotely
        // Still attempt to delete locally
        await LocalDB.deleteLocalCard(cardId);
        console.log(`✅ [SERVICE] Deleted card from local storage after Supabase error: ${cardId}`);
      }
    } else {
      // Offline mode - delete from local database and mark for sync when back online
      console.log(`💾 [SERVICE] Device is offline. Deleting card from local storage: ${cardId}`);
      await LocalDB.deleteLocalCard(cardId);
      console.log(`✅ [SERVICE] Successfully deleted card from local storage in offline mode: ${cardId}`);
    }
  } catch (error) {
    console.error('❌ [SERVICE] Error in deleteCard service:', error);
    throw error;
  }
}

// Function to format a local card to the Card interface expected by the app
function formatLocalCard(card: any): Card {
  return {
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
  };
}

// Function to get cards from Supabase
async function getCardsFromSupabase(deckId: string): Promise<Card[]> {
  console.log('📡 [NETWORK] Status check:', await isOnline() ? 'Online' : 'Offline');
  console.log('📊 [API] getCards called:', { deckId, networkStatus: await isOnline() ? 'online' : 'offline' });
  console.log('🔄 [API] Fetching cards for deck from Supabase');

  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [API] Error fetching cards from Supabase:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ [API] Error in getCards:', error);
    throw error;
  }
}

// Function to cache cards locally
async function cacheCardsLocally(cards: Card[], deckId: string): Promise<void> {
  try {
    const db = await ensureDatabase();
    if (!db) return;

    // Find the local deck ID if we're using a remote ID
    let localDeckId = null;
    if (!deckId.startsWith('local_')) {
      // This is a remote ID, try to find the corresponding local deck
      try {
        const localDecks = await db.getAllAsync<{id: string, remote_id: string}>(
          'SELECT id, remote_id FROM decks WHERE remote_id = ?',
          [deckId]
        );
        
        if (localDecks && localDecks.length > 0) {
          localDeckId = localDecks[0].id;
          console.log(`🔄 [SERVICE] Found corresponding local deck ID ${localDeckId} for remote deck ${deckId}`);
        }
      } catch (err) {
        console.error('Error finding local deck:', err);
      }
    } else {
      // This is a local ID, try to find the remote ID
      try {
        const deckData = await db.getFirstAsync<{remote_id: string}>(
          'SELECT remote_id FROM decks WHERE id = ?',
          [deckId]
        );
        
        if (deckData && deckData.remote_id) {
          console.log(`🔄 [SERVICE] Found corresponding remote deck ID ${deckData.remote_id} for local deck ${deckId}`);
        }
      } catch (err) {
        console.error('Error finding remote deck:', err);
      }
    }

    for (const card of cards) {
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
      
      // Insert the card with the provided deck ID
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
      
      // If we found a local deck ID corresponding to this remote deck ID,
      // create a duplicate mapping with the local deck ID to ensure the card
      // is accessible when using either ID
      if (localDeckId && !deckId.startsWith('local_')) {
        // Generate a unique id for this mapping
        const mappingId = `mapping_${card.id}_${localDeckId}`;
        
        // Delete any existing mapping first
        await db.runAsync(
          'DELETE FROM cards WHERE id = ?',
          [mappingId]
        );
        
        // Create a mapping entry that points to the local deck
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
          mappingId, localDeckId, card.front, card.back, card.notes, tags, language_specific_data,
          cardData.created_at, updatedAtStr, cardData.last_reviewed_at, cardData.next_review_at,
          card.review_count || 0, card.consecutive_correct || 0,
          card.state, card.difficulty, card.stability, card.retrievability,
          card.elapsed_days, card.scheduled_days, card.reps, card.lapses,
          card.step_index, card.queue,
          1, card.id, 0, 0  // Synced = 1, remote_id = card.id, not modified, not deleted
        ]);
        
        console.log(`🔄 [SERVICE] Created mapping from local deck ID ${localDeckId} to card ${card.id}`);
      }
    }
    console.log(`💾 [SERVICE] Cached ${cards.length} cards locally`);
  } catch (error) {
    console.error('❌ [SERVICE] Error caching cards locally:', error);
  }
}

// Function to sync cards that were deleted while offline
export async function syncDeletedCards(): Promise<void> {
  try {
    // Check if we're online
    const online = await isOnline();
    if (!online) {
      console.log('📡 [SERVICE] Cannot sync deleted cards - device is offline');
      return;
    }

    console.log('🔄 [SERVICE] Starting sync of cards deleted while offline...');
    
    // Get all cards marked for deletion
    const deletedCards = await LocalDB.getOfflineDeletedCards();
    console.log(`📊 [SERVICE] Found ${deletedCards.length} cards marked for deletion`);
    
    if (deletedCards.length === 0) {
      console.log('✅ [SERVICE] No cards to sync for deletion');
      return;
    }
    
    // Track successfully deleted card IDs
    const successfullyDeletedIds: string[] = [];
    
    // Process each deleted card
    for (const card of deletedCards) {
      try {
        if (card.remote_id) {
          // Delete from Supabase
          await SupabaseAPI.deleteCard(card.remote_id);
          console.log(`✅ [SERVICE] Deleted remote card: ${card.remote_id}`);
          
          // Add to list of successfully deleted cards
          successfullyDeletedIds.push(card.id);
        }
      } catch (error) {
        console.error(`❌ [SERVICE] Error deleting card ${card.id} from Supabase:`, error);
        // Continue with next card
      }
    }
    
    // Remove successfully deleted cards from local database
    if (successfullyDeletedIds.length > 0) {
      await LocalDB.removeDeletedCards(successfullyDeletedIds);
      console.log(`✅ [SERVICE] Removed ${successfullyDeletedIds.length} synced deleted cards from local database`);
    }
    
    console.log('✅ [SERVICE] Deleted cards sync completed successfully');
  } catch (error) {
    console.error('❌ [SERVICE] Error syncing deleted cards:', error);
  }
}

// Store cards locally for offline access
async function storeCardsLocally(cards: Card[]): Promise<void> {
  if (Platform.OS === 'web') return;
  
  try {
    const db = await ensureDatabase();
    if (!db) return;
    
    console.log(`💾 [SERVICE] Storing ${cards.length} cards locally`);
    
    for (const card of cards) {
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
        // Card already exists, skip
        console.log(`💾 [SERVICE] Card ${card.id} already exists locally, skipping`);
        continue;
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
      
      console.log(`💾 [SERVICE] Stored card ${card.id} locally`);
    }
  } catch (error) {
    console.error('Error storing cards locally:', error);
    throw error;
  }
}

// Get a single card by ID
export async function getCard(id: string): Promise<Card | null> {
  try {
    console.log(`📡 [SERVICE] Getting card with ID: ${id}`);
    
    // Check if we're online
    const networkStatus = await isOnline();
    console.log(`📡 [SERVICE] Network status for getCard: ${networkStatus ? 'Online' : 'Offline'}`);
    
    // Check if this is a local ID
    const isLocalId = id.startsWith('local_') || id.startsWith('offline_');
    
    if (networkStatus && !isLocalId) {
      // Online mode and not a local ID - try to get from Supabase
      try {
        console.log(`📡 [SERVICE] Fetching card from Supabase: ${id}`);
        const card = await SupabaseAPI.getCard(id);
        
        if (card) {
          console.log(`📡 [SERVICE] Card found in Supabase: ${card.front}`);
          
          // Store in local DB for offline access
          try {
            await storeCardsLocally([card]);
            console.log(`📡 [SERVICE] Card stored locally for offline access`);
          } catch (localError) {
            console.error(`❌ [SERVICE] Error storing card locally:`, localError);
            // Continue even if local storage fails
          }
          
          return card;
        } else {
          console.log(`📡 [SERVICE] Card not found in Supabase, checking local storage`);
        }
      } catch (error) {
        console.error(`❌ [SERVICE] Error fetching card from Supabase:`, error);
        console.log(`📡 [SERVICE] Falling back to local storage`);
      }
    }
    
    // Offline mode or Supabase failed - try to get from local DB
    console.log(`📡 [SERVICE] Fetching card from local storage: ${id}`);
    const localCard = await LocalDB.getLocalCardById(id);
    
    if (localCard) {
      console.log(`📡 [SERVICE] Card found in local storage: ${localCard.front}`);
      return localCard;
    }
    
    console.log(`❌ [SERVICE] Card not found in local storage`);
    return null;
  } catch (error) {
    console.error(`❌ [SERVICE] Error in getCard:`, error);
    throw error;
  }
} 