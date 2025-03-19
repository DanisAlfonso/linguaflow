import { ensureDatabase } from './index';
import { Platform } from 'react-native';
import { 
  CreateNoteData, 
  Note, 
  NoteAttachment, 
  NoteWithAttachments, 
  UpdateNoteData, 
  ColorPreset 
} from '../../types/notes';

// Simple ID generation function
const generateId = (prefix = '') => {
  return `${prefix}${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
};

// Helper function to parse tags from SQLite
const parseTags = (tagsString: string | null): string[] | null => {
  if (!tagsString) return null;
  try {
    return JSON.parse(tagsString);
  } catch (e) {
    console.error('Error parsing tags:', e);
    return null;
  }
};

// SQLite type for notes - matches our database schema
export interface LocalNote {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  language: string | null;
  tags: string | null; // Stored as JSON string in SQLite
  is_pinned: number; // SQLite doesn't have boolean
  folder_path: string;
  color_preset: ColorPreset | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  synced: number; // SQLite doesn't have boolean
  remote_id: string | null;
}

// SQLite type for note attachments
export interface LocalNoteAttachment {
  id: string;
  note_id: string;
  file_path: string;
  file_type: string;
  original_filename: string;
  mime_type: string;
  created_at: string;
  synced: number;
  remote_id: string | null;
  remote_url: string | null;
}

// Convert SQLite note to app Note type
const convertToNote = (localNote: LocalNote): Note => {
  return {
    ...localNote,
    is_pinned: Boolean(localNote.is_pinned),
    tags: parseTags(localNote.tags),
  };
};

// Convert SQLite attachment to app NoteAttachment type
const convertToAttachment = (localAttachment: LocalNoteAttachment): NoteAttachment => {
  return {
    ...localAttachment,
    // Convert any SQLite-specific types if needed
  };
};

/**
 * Get all notes for a user from local SQLite database
 */
export async function getLocalNotes(userId: string): Promise<NoteWithAttachments[]> {
  // On web, we don't use SQLite
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    // Get all notes for the user
    const notes = await database.getAllAsync<LocalNote>(
      'SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC;',
      [userId]
    );

    const notesWithAttachments = await Promise.all(
      notes.map(async (note) => {
        // Get attachments for this note
        const attachments = await database.getAllAsync<LocalNoteAttachment>(
          'SELECT * FROM note_attachments WHERE note_id = ?;',
          [note.id]
        );

        return {
          ...convertToNote(note),
          attachments: attachments.map(convertToAttachment),
        };
      })
    );

    return notesWithAttachments;
  } catch (error) {
    console.error('Error getting local notes:', error);
    return [];
  }
}

/**
 * Get a single note by ID from SQLite
 */
export async function getLocalNoteById(noteId: string): Promise<NoteWithAttachments | null> {
  // On web, we don't use SQLite
  if (Platform.OS === 'web') return null;

  try {
    const database = await ensureDatabase();
    if (!database) return null;

    // Get the note
    const note = await database.getFirstAsync<LocalNote>(
      'SELECT * FROM notes WHERE id = ?;',
      [noteId]
    );

    if (!note) return null;

    // Get attachments for this note
    const attachments = await database.getAllAsync<LocalNoteAttachment>(
      'SELECT * FROM note_attachments WHERE note_id = ?;',
      [noteId]
    );

    return {
      ...convertToNote(note),
      attachments: attachments.map(convertToAttachment),
    };
  } catch (error) {
    console.error('Error getting local note by ID:', error);
    return null;
  }
}

/**
 * Create a new note in SQLite
 */
export async function createLocalNote(data: CreateNoteData, userId: string): Promise<Note> {
  if (Platform.OS === 'web') {
    throw new Error('Local note creation is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    const id = generateId('note_');
    const now = new Date().toISOString();
    
    // Set defaults
    const folder_path = data.folder_path || '/';
    const is_pinned = data.is_pinned ? 1 : 0;
    
    // Convert tags to JSON string if present
    const tags = data.tags ? JSON.stringify(data.tags) : null;
    
    await database.runAsync(
      `INSERT INTO notes (
        id, user_id, title, content, language, tags, is_pinned, folder_path, 
        color_preset, created_at, updated_at, last_accessed_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
      [
        id, userId, data.title, data.content || null, data.language || null,
        tags, is_pinned, folder_path, data.color_preset || null, now, now, now
      ]
    );

    // Return the newly created note
    return {
      id,
      user_id: userId,
      title: data.title,
      content: data.content || null,
      language: data.language || null,
      tags: data.tags || null,
      is_pinned: Boolean(is_pinned),
      folder_path,
      color_preset: data.color_preset || null,
      created_at: now,
      updated_at: now,
      last_accessed_at: now
    };
  } catch (error) {
    console.error('Error creating local note:', error);
    throw error;
  }
}

/**
 * Update an existing note in SQLite
 */
export async function updateLocalNote(noteId: string, data: UpdateNoteData): Promise<Note> {
  if (Platform.OS === 'web') {
    throw new Error('Local note update is not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    // Get the current note to merge with updates
    const currentNote = await database.getFirstAsync<LocalNote>(
      'SELECT * FROM notes WHERE id = ?;',
      [noteId]
    );

    if (!currentNote) {
      throw new Error('Note not found');
    }

    // Prepare update data
    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    // Only add fields that are being updated
    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    
    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }
    
    if (data.language !== undefined) {
      updates.push('language = ?');
      values.push(data.language);
    }
    
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(data.tags ? JSON.stringify(data.tags) : null);
    }
    
    if (data.is_pinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(data.is_pinned ? 1 : 0);
    }
    
    if (data.folder_path !== undefined) {
      updates.push('folder_path = ?');
      values.push(data.folder_path);
    }
    
    if (data.color_preset !== undefined) {
      updates.push('color_preset = ?');
      values.push(data.color_preset);
    }
    
    // Always update these fields
    updates.push('updated_at = ?');
    values.push(now);
    
    // Mark as unsynced if on native platform
    updates.push('synced = 0');
    
    // Add noteId to values array for WHERE clause
    values.push(noteId);

    // Execute the update
    await database.runAsync(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = ?;`,
      values
    );

    // Get the updated note
    const updatedNote = await database.getFirstAsync<LocalNote>(
      'SELECT * FROM notes WHERE id = ?;',
      [noteId]
    );

    if (!updatedNote) {
      throw new Error('Failed to retrieve updated note');
    }

    return convertToNote(updatedNote);
  } catch (error) {
    console.error('Error updating local note:', error);
    throw error;
  }
}

/**
 * Delete a note from SQLite
 */
export async function deleteLocalNote(noteId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    // Get the note to check if it has a remote ID (for sync later)
    const note = await database.getFirstAsync<LocalNote>(
      'SELECT remote_id FROM notes WHERE id = ?;',
      [noteId]
    );

    // If this note has a remote ID, we should store it for sync deletion
    if (note?.remote_id) {
      // TODO: Implement deletion tracking for sync
    }

    // Delete the note
    await database.runAsync(
      'DELETE FROM notes WHERE id = ?;',
      [noteId]
    );
  } catch (error) {
    console.error('Error deleting local note:', error);
    throw error;
  }
}

/**
 * Add an attachment to a note in SQLite
 */
export async function addLocalNoteAttachment(
  noteId: string,
  filePath: string,
  fileType: string,
  originalFilename: string,
  mimeType: string
): Promise<NoteAttachment> {
  if (Platform.OS === 'web') {
    throw new Error('Local note attachments are not supported on web platform');
  }

  try {
    const database = await ensureDatabase();
    if (!database) throw new Error('Database not initialized');

    const id = generateId('att_');
    const now = new Date().toISOString();

    await database.runAsync(
      `INSERT INTO note_attachments (
        id, note_id, file_path, file_type, original_filename, mime_type, created_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0);`,
      [id, noteId, filePath, fileType, originalFilename, mimeType, now]
    );

    return {
      id,
      note_id: noteId,
      file_path: filePath,
      file_type: fileType,
      original_filename: originalFilename,
      mime_type: mimeType,
      created_at: now
    };
  } catch (error) {
    console.error('Error adding local note attachment:', error);
    throw error;
  }
}

/**
 * Delete an attachment from a note in SQLite
 */
export async function deleteLocalNoteAttachment(attachmentId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    await database.runAsync(
      'DELETE FROM note_attachments WHERE id = ?;',
      [attachmentId]
    );
  } catch (error) {
    console.error('Error deleting local note attachment:', error);
    throw error;
  }
}

/**
 * Search for notes in SQLite
 */
export async function searchLocalNotes(
  userId: string,
  query: string,
  folder?: string,
  tags?: string[]
): Promise<NoteWithAttachments[]> {
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const params: any[] = [userId, `%${query}%`];
    
    let sql = `SELECT * FROM notes WHERE user_id = ? AND 
               (title LIKE ? OR content LIKE ?)`;
    
    params.push(`%${query}%`);
    
    if (folder) {
      sql += ' AND folder_path = ?';
      params.push(folder);
    }
    
    // For tags, we need to check if any of the tags in the array match
    if (tags && tags.length > 0) {
      // Since tags are stored as JSON, we need to check each tag individually
      // This is not ideal for performance, but a simple solution for now
      const tagClauses = tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagClauses})`;
      
      // Add each tag as a parameter
      tags.forEach(tag => {
        params.push(`%"${tag}"%`);
      });
    }
    
    sql += ' ORDER BY is_pinned DESC, updated_at DESC';
    
    const notes = await database.getAllAsync<LocalNote>(sql, params);
    
    const notesWithAttachments = await Promise.all(
      notes.map(async (note) => {
        const attachments = await database.getAllAsync<LocalNoteAttachment>(
          'SELECT * FROM note_attachments WHERE note_id = ?;',
          [note.id]
        );
        
        return {
          ...convertToNote(note),
          attachments: attachments.map(convertToAttachment)
        };
      })
    );
    
    return notesWithAttachments;
  } catch (error) {
    console.error('Error searching local notes:', error);
    return [];
  }
}

/**
 * Get all unsynced notes from SQLite
 */
export async function getUnsyncedNotes(): Promise<NoteWithAttachments[]> {
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    const notes = await database.getAllAsync<LocalNote>(
      'SELECT * FROM notes WHERE synced = 0;'
    );

    const notesWithAttachments = await Promise.all(
      notes.map(async (note) => {
        const attachments = await database.getAllAsync<LocalNoteAttachment>(
          'SELECT * FROM note_attachments WHERE note_id = ?;',
          [note.id]
        );

        return {
          ...convertToNote(note),
          attachments: attachments.map(convertToAttachment),
        };
      })
    );

    return notesWithAttachments;
  } catch (error) {
    console.error('Error getting unsynced notes:', error);
    return [];
  }
}

/**
 * Get all unsynced note attachments
 */
export async function getUnsyncedNoteAttachments(): Promise<LocalNoteAttachment[]> {
  if (Platform.OS === 'web') return [];

  try {
    const database = await ensureDatabase();
    if (!database) return [];

    return await database.getAllAsync<LocalNoteAttachment>(
      'SELECT * FROM note_attachments WHERE synced = 0;'
    );
  } catch (error) {
    console.error('Error getting unsynced note attachments:', error);
    return [];
  }
}

/**
 * Update a note in SQLite after it has been synced to Supabase
 */
export async function updateNoteAfterSync(localId: string, remoteId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    await database.runAsync(
      'UPDATE notes SET synced = 1, remote_id = ? WHERE id = ?;',
      [remoteId, localId]
    );
  } catch (error) {
    console.error('Error updating note after sync:', error);
    throw error;
  }
}

/**
 * Update a note attachment in SQLite after it has been synced to Supabase
 */
export async function updateAttachmentAfterSync(
  localId: string,
  remoteId: string,
  remoteUrl: string
): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const database = await ensureDatabase();
    if (!database) return;

    await database.runAsync(
      'UPDATE note_attachments SET synced = 1, remote_id = ?, remote_url = ? WHERE id = ?;',
      [remoteId, remoteUrl, localId]
    );
  } catch (error) {
    console.error('Error updating attachment after sync:', error);
    throw error;
  }
} 