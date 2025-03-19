import { Platform } from 'react-native';
import { isOnline } from '../network';
import { 
  getLocalNotes, 
  getLocalNoteById,
  getUnsyncedNotes, 
  updateNoteAfterSync,
  getUnsyncedNoteAttachments,
  updateAttachmentAfterSync 
} from '../db/notes-sqlite';
import {
  createNote,
  updateNote,
  deleteNote,
  addNoteAttachment
} from '../db/notes';
import { NoteWithAttachments } from '../../types/notes';

/**
 * Synchronize notes between local SQLite and Supabase
 * 
 * This will:
 * 1. Sync all unsynced notes to Supabase
 * 2. Sync all unsynced attachments to Supabase
 * 
 * @returns {Promise<boolean>} Success status
 */
export async function syncNotes(): Promise<boolean> {
  // Skip sync on web platform (web uses Supabase directly)
  if (Platform.OS === 'web') return true;
  
  try {
    // Check if device is online
    const networkAvailable = await isOnline();
    if (!networkAvailable) {
      console.log('📡 [NOTES SYNC] Cannot sync notes - device is offline');
      return false;
    }
    
    console.log('📡 [NOTES SYNC] Starting notes synchronization...');
    
    // Get all unsynced notes
    const unsyncedNotes = await getUnsyncedNotes();
    console.log(`📡 [NOTES SYNC] Found ${unsyncedNotes.length} unsynced notes`);
    
    // Sync each note
    for (const note of unsyncedNotes) {
      try {
        // Check if this is a new note or an update to an existing note
        if (!note.remote_id) {
          // New note - create in Supabase
          console.log(`📡 [NOTES SYNC] Creating new note in Supabase: ${note.title}`);
          
          const createdNote = await createNote({
            title: note.title,
            content: note.content || undefined,
            language: note.language || undefined,
            tags: note.tags || undefined,
            is_pinned: note.is_pinned,
            folder_path: note.folder_path,
            color_preset: note.color_preset || undefined
          }, note.user_id);
          
          // Update local note with remote ID and mark as synced
          await updateNoteAfterSync(note.id, createdNote.id);
          console.log(`✅ [NOTES SYNC] Note created successfully: ${createdNote.id}`);
        } else {
          // Existing note - update in Supabase
          console.log(`📡 [NOTES SYNC] Updating note in Supabase: ${note.remote_id}`);
          
          await updateNote(note.remote_id, {
            title: note.title,
            content: note.content || undefined,
            language: note.language || undefined,
            tags: note.tags || undefined,
            is_pinned: note.is_pinned,
            folder_path: note.folder_path,
            color_preset: note.color_preset || undefined
          });
          
          // Mark note as synced
          await updateNoteAfterSync(note.id, note.remote_id);
          console.log(`✅ [NOTES SYNC] Note updated successfully: ${note.remote_id}`);
        }
      } catch (error) {
        console.error(`❌ [NOTES SYNC] Error syncing note ${note.id}:`, error);
        // Continue with the next note
      }
    }
    
    // Sync attachments
    await syncNoteAttachments();
    
    console.log('✅ [NOTES SYNC] Notes synchronization completed successfully');
    return true;
  } catch (error) {
    console.error('❌ [NOTES SYNC] Error synchronizing notes:', error);
    return false;
  }
}

/**
 * Synchronize note attachments
 */
async function syncNoteAttachments(): Promise<void> {
  try {
    // Get all unsynced attachments
    const unsyncedAttachments = await getUnsyncedNoteAttachments();
    console.log(`📡 [NOTES SYNC] Found ${unsyncedAttachments.length} unsynced attachments`);
    
    // Skip if no attachments to sync
    if (unsyncedAttachments.length === 0) return;
    
    for (const attachment of unsyncedAttachments) {
      try {
        // Create attachment in Supabase
        console.log(`📡 [NOTES SYNC] Creating attachment in Supabase for note: ${attachment.note_id}`);
        
        // Get the local note that this attachment belongs to
        const localNote = await getLocalNoteById(attachment.note_id);
        
        if (!localNote || !localNote.remote_id) {
          console.log(`⚠️ [NOTES SYNC] Cannot sync attachment: note ${attachment.note_id} not synced yet`);
          continue;
        }
        
        // Create attachment in Supabase
        const createdAttachment = await addNoteAttachment(
          localNote.remote_id,
          attachment.file_path,
          attachment.file_type,
          attachment.original_filename,
          attachment.mime_type
        );
        
        // Update local attachment with remote ID and mark as synced
        await updateAttachmentAfterSync(
          attachment.id, 
          createdAttachment.id,
          attachment.file_path // In a real app, you'd get the remote URL from the created attachment
        );
        
        console.log(`✅ [NOTES SYNC] Attachment created successfully: ${createdAttachment.id}`);
      } catch (error) {
        console.error(`❌ [NOTES SYNC] Error syncing attachment ${attachment.id}:`, error);
        // Continue with the next attachment
      }
    }
    
    console.log('✅ [NOTES SYNC] Attachments synchronization completed');
  } catch (error) {
    console.error('❌ [NOTES SYNC] Error synchronizing attachments:', error);
  }
} 