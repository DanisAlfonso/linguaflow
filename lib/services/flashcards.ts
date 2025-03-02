import { Platform } from 'react-native';
import { Deck, Card } from '../../types/flashcards';
import * as SupabaseAPI from '../api/flashcards';
import * as LocalDB from '../db/flashcards';
import { initFlashcardsDatabase } from '../db/flashcards';
import { ensureDatabase } from '../db/index';
import NetInfo from '@react-native-community/netinfo';

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
  color_preset?: string;
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
            user_id: localDeck.user_id,
            name: localDeck.name,
            description: localDeck.description,
            language: localDeck.language,
            settings: localDeck.settings,
            tags: localDeck.tags,
            color_preset: localDeck.color_preset,
            created_at: localDeck.created_at,
            updated_at: localDeck.updated_at,
            total_cards: 0,
            new_cards: 0,
            cards_to_review: 0
          };
        } catch (localError) {
          console.error('Error creating local deck after Supabase failure:', localError);
          throw localError;
        }
      }
    } else {
      // Offline mode - save locally only
      try {
        const localDeck = await LocalDB.createLocalDeck(data);
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
          total_cards: 0,
          new_cards: 0,
          cards_to_review: 0
        };
      } catch (localError) {
        console.error('Error creating deck in offline mode:', localError);
        throw localError;
      }
    }
  } catch (error) {
    console.error('Error in createDeck service:', error);
    throw error;
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
  // Skip on web platform
  if (Platform.OS === 'web') return;
  
  try {
    console.log('Starting sync of offline decks to server...');
    
    // Check if we're online
    const online = await isOnline();
    if (!online) {
      console.log('Cannot sync offline decks: device is offline');
      return;
    }
    
    // Get all local decks that were modified offline
    const modifiedDecks = await LocalDB.getModifiedOfflineDecks(userId);
    
    console.log(`Found ${modifiedDecks.length} modified decks to sync to server`);
    
    // Get all remote decks to check for duplicates
    const remoteDecks = await SupabaseAPI.getDecks(userId);
    console.log(`Retrieved ${remoteDecks.length} remote decks for comparison`);
    
    // Process each modified deck
    for (const localDeck of modifiedDecks) {
      try {
        console.log(`Processing modified deck: ${localDeck.id} - ${localDeck.name}`);
        
        // Check if this deck was deleted offline
        if (localDeck.deleted_offline) {
          // If it has a remote_id, delete it from the server
          if (localDeck.remote_id) {
            console.log(`Deleting remote deck: ${localDeck.remote_id}`);
            try {
              await SupabaseAPI.deleteDeck(localDeck.remote_id);
              console.log(`Successfully deleted remote deck ${localDeck.remote_id}`);
            } catch (deleteError) {
              console.error(`Error deleting remote deck ${localDeck.remote_id}:`, deleteError);
              // Continue with local deletion even if remote deletion fails
            }
            
            // Then delete it locally
            await LocalDB.deleteLocalDeck(localDeck.id);
            console.log(`Deleted local deck ${localDeck.id} after syncing deletion`);
          } else {
            // If it doesn't have a remote_id, just delete it locally
            await LocalDB.deleteLocalDeck(localDeck.id);
            console.log(`Deleted local-only deck ${localDeck.id}`);
          }
          continue; // Skip to the next deck
        }
        
        // Handle deck creation or update
        if (localDeck.remote_id) {
          // This is an existing deck that was modified offline
          console.log(`Updating remote deck: ${localDeck.remote_id}`);
          
          try {
            // Update the remote deck with the local changes
            const remoteDeck = await SupabaseAPI.updateDeck(localDeck.remote_id, {
              name: localDeck.name,
              description: localDeck.description,
              language: localDeck.language,
              tags: localDeck.tags,
              settings: localDeck.settings,
              color_preset: localDeck.color_preset
            });
            
            // Mark the local deck as synced
            await LocalDB.markDeckAsSynced(localDeck.id, remoteDeck.id);
            console.log(`Updated remote deck ${remoteDeck.id} with local changes`);
          } catch (updateError) {
            console.error(`Error updating remote deck ${localDeck.remote_id}:`, updateError);
            // Keep the deck marked as modified offline so we can try again later
          }
        } else {
          // This is a new deck created offline
          // Check if a deck with the same name already exists on the server
          const existingRemoteDeck = remoteDecks.find(
            remoteDeck => remoteDeck.name === localDeck.name
          );
          
          if (existingRemoteDeck) {
            console.log(`Found existing remote deck with name "${localDeck.name}", using ID: ${existingRemoteDeck.id}`);
            
            // Mark the local deck as synced with the existing remote deck
            await LocalDB.markDeckAsSynced(localDeck.id, existingRemoteDeck.id);
            console.log(`Linked local deck ${localDeck.id} with existing remote deck ${existingRemoteDeck.id}`);
          } else {
            // Create a new deck on the server
            try {
              const remoteDeck = await SupabaseAPI.createDeck({
                userId: localDeck.user_id,
                name: localDeck.name,
                description: localDeck.description,
                language: localDeck.language,
                settings: localDeck.settings,
                tags: localDeck.tags,
                color_preset: localDeck.color_preset
              });
              
              console.log(`Created new remote deck: ${remoteDeck.id}`);
              
              // Mark the local deck as synced
              await LocalDB.markDeckAsSynced(localDeck.id, remoteDeck.id);
              console.log(`Marked local deck ${localDeck.id} as synced with new remote deck ${remoteDeck.id}`);
            } catch (createError) {
              console.error(`Error creating remote deck for local deck ${localDeck.id}:`, createError);
              // Keep the deck marked as modified offline so we can try again later
            }
          }
        }
      } catch (deckError) {
        console.error(`Error processing deck ${localDeck.id}:`, deckError);
        // Continue with the next deck even if this one fails
      }
    }
    
    console.log('Finished syncing offline decks to server');
  } catch (error) {
    console.error('Error in syncOfflineDecks:', error);
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
    if (!deckId) {
      console.error('Cannot get cards: deckId is null or undefined');
      return [];
    }

    console.log(`Getting cards for deck ID: ${deckId}`);

    // On web, always use Supabase
    if (Platform.OS === 'web') {
      return await SupabaseAPI.getCards(deckId);
    }

    // On mobile, check if online
    const online = await isOnline();

    if (online) {
      try {
        // Try to get from Supabase first
        const remoteCards = await SupabaseAPI.getCards(deckId);
        return remoteCards;
      } catch (remoteError) {
        console.error('Error getting cards from Supabase, falling back to local:', remoteError);
        // Fall back to local storage if Supabase fails
        // For now, return empty array as local card storage is not implemented yet
        return [];
      }
    } else {
      // Offline mode - get from local only
      // For now, return empty array as local card storage is not implemented yet
      return [];
    }
  } catch (error) {
    console.error('Error in getCards service:', error);
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