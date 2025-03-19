import { Platform } from 'react-native';
import { isOnline } from '../network';
import { CreateNoteData, Note, NoteAttachment, NoteWithAttachments, UpdateNoteData } from '../../types/notes';
import { 
  getNotes as getSupabaseNotes,
  getNoteById as getSupabaseNoteById,
  createNote as createSupabaseNote,
  updateNote as updateSupabaseNote,
  deleteNote as deleteSupabaseNote,
  addNoteAttachment as addSupabaseNoteAttachment,
  deleteNoteAttachment as deleteSupabaseNoteAttachment,
  searchNotes as searchSupabaseNotes
} from './notes';
import {
  getLocalNotes,
  getLocalNoteById,
  createLocalNote,
  updateLocalNote,
  deleteLocalNote,
  addLocalNoteAttachment,
  deleteLocalNoteAttachment,
  searchLocalNotes
} from './notes-sqlite';
import { syncNotes } from '../sync/notes';

let lastSyncTimestamp = 0;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Trigger a sync if we haven't synced recently
 */
async function maybeSyncNotes(): Promise<void> {
  // Skip on web
  if (Platform.OS === 'web') return;
  
  const now = Date.now();
  if (now - lastSyncTimestamp > SYNC_INTERVAL) {
    lastSyncTimestamp = now;
    syncNotes().catch(err => {
      console.error('Background sync failed:', err);
    });
  }
}

/**
 * Get all notes for a user - uses offline storage first, then online if available
 */
export async function getNotes(userId: string): Promise<NoteWithAttachments[]> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return getSupabaseNotes(userId);
  }
  
  try {
    // Check if we're online
    const online = await isOnline();
    
    // Get notes from local storage
    const localNotes = await getLocalNotes(userId);
    
    // If offline, just return local notes
    if (!online) {
      console.log('📱 [NOTES] Offline mode - returning local notes only');
      return localNotes;
    }
    
    // If online, trigger sync in the background and return local notes
    maybeSyncNotes();
    return localNotes;
  } catch (error) {
    console.error('Error in hybrid getNotes:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      return await getSupabaseNotes(userId);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      return [];
    }
  }
}

/**
 * Get a note by ID - uses offline storage first, then online if available
 */
export async function getNoteById(noteId: string): Promise<NoteWithAttachments | null> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return getSupabaseNoteById(noteId);
  }
  
  try {
    // Check if we have the note locally
    const localNote = await getLocalNoteById(noteId);
    
    // If we have it locally, use that version
    if (localNote) {
      return localNote;
    }
    
    // If not found locally and online, try Supabase
    const online = await isOnline();
    if (online) {
      return await getSupabaseNoteById(noteId);
    }
    
    // If offline and not in local storage, return null
    return null;
  } catch (error) {
    console.error('Error in hybrid getNoteById:', error);
    
    // Fallback to Supabase if there's an error
    try {
      return await getSupabaseNoteById(noteId);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      return null;
    }
  }
}

/**
 * Create a new note - stores locally and syncs when online
 */
export async function createNote(data: CreateNoteData, userId: string): Promise<Note> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return createSupabaseNote(data, userId);
  }
  
  try {
    // Always create locally first
    const localNote = await createLocalNote(data, userId);
    
    // Check if we're online
    const online = await isOnline();
    if (online) {
      // If online, trigger sync in the background
      maybeSyncNotes();
    }
    
    return localNote;
  } catch (error) {
    console.error('Error in hybrid createNote:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      return await createSupabaseNote(data, userId);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      throw error; // Re-throw the original error
    }
  }
}

/**
 * Update an existing note - updates locally and syncs when online
 */
export async function updateNote(noteId: string, data: UpdateNoteData): Promise<Note> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return updateSupabaseNote(noteId, data);
  }
  
  try {
    // Always update locally first
    const updatedNote = await updateLocalNote(noteId, data);
    
    // Check if we're online
    const online = await isOnline();
    if (online) {
      // If online, trigger sync in the background
      maybeSyncNotes();
    }
    
    return updatedNote;
  } catch (error) {
    console.error('Error in hybrid updateNote:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      return await updateSupabaseNote(noteId, data);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      throw error; // Re-throw the original error
    }
  }
}

/**
 * Delete a note - deletes locally and syncs when online
 */
export async function deleteNote(noteId: string): Promise<void> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return deleteSupabaseNote(noteId);
  }
  
  try {
    // Always delete locally first
    await deleteLocalNote(noteId);
    
    // Check if we're online
    const online = await isOnline();
    if (online) {
      // If online, trigger sync in the background
      maybeSyncNotes();
    }
  } catch (error) {
    console.error('Error in hybrid deleteNote:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      await deleteSupabaseNote(noteId);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      throw error; // Re-throw the original error
    }
  }
}

/**
 * Add an attachment to a note - adds locally and syncs when online
 */
export async function addNoteAttachment(
  noteId: string,
  filePath: string,
  fileType: string,
  originalFilename: string,
  mimeType: string
): Promise<NoteAttachment> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return addSupabaseNoteAttachment(noteId, filePath, fileType, originalFilename, mimeType);
  }
  
  try {
    // Always add locally first
    const attachment = await addLocalNoteAttachment(
      noteId, 
      filePath, 
      fileType, 
      originalFilename, 
      mimeType
    );
    
    // Check if we're online
    const online = await isOnline();
    if (online) {
      // If online, trigger sync in the background
      maybeSyncNotes();
    }
    
    return attachment;
  } catch (error) {
    console.error('Error in hybrid addNoteAttachment:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      return await addSupabaseNoteAttachment(
        noteId, 
        filePath, 
        fileType, 
        originalFilename, 
        mimeType
      );
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      throw error; // Re-throw the original error
    }
  }
}

/**
 * Delete an attachment from a note - deletes locally and syncs when online
 */
export async function deleteNoteAttachment(attachmentId: string): Promise<void> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return deleteSupabaseNoteAttachment(attachmentId);
  }
  
  try {
    // Always delete locally first
    await deleteLocalNoteAttachment(attachmentId);
    
    // Check if we're online
    const online = await isOnline();
    if (online) {
      // If online, trigger sync in the background
      maybeSyncNotes();
    }
  } catch (error) {
    console.error('Error in hybrid deleteNoteAttachment:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      await deleteSupabaseNoteAttachment(attachmentId);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      throw error; // Re-throw the original error
    }
  }
}

/**
 * Search notes - searches locally and merges with online results if available
 */
export async function searchNotes(
  userId: string,
  query: string,
  folder?: string,
  tags?: string[]
): Promise<NoteWithAttachments[]> {
  if (Platform.OS === 'web') {
    // On web, use Supabase directly
    return searchSupabaseNotes(userId, query, folder, tags);
  }
  
  try {
    // Always search locally first
    const localResults = await searchLocalNotes(userId, query, folder, tags);
    
    // Check if we're online
    const online = await isOnline();
    if (!online) {
      // If offline, just return local results
      return localResults;
    }
    
    // If online, consider triggering a sync before searching
    const shouldSync = Date.now() - lastSyncTimestamp > SYNC_INTERVAL;
    if (shouldSync) {
      try {
        // Sync first, then search locally again for updated results
        await syncNotes();
        return await searchLocalNotes(userId, query, folder, tags);
      } catch (syncError) {
        console.error('Error syncing before search:', syncError);
        // Continue with local results if sync fails
        return localResults;
      }
    }
    
    return localResults;
  } catch (error) {
    console.error('Error in hybrid searchNotes:', error);
    
    // Fallback to Supabase if there's an error with local storage
    try {
      return await searchSupabaseNotes(userId, query, folder, tags);
    } catch (supabaseError) {
      console.error('Supabase fallback failed:', supabaseError);
      return [];
    }
  }
} 