import { supabase } from '../supabase';
import { CreateNoteData, Note, NoteAttachment, NoteWithAttachments, UpdateNoteData } from '../../types/notes';

export async function getNotes(userId: string): Promise<NoteWithAttachments[]> {
  const { data: notes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!notes) return [];

  const notesWithAttachments = await Promise.all(
    notes.map(async (note: Note) => {
      const { data: attachments } = await supabase
        .from('note_attachments')
        .select('*')
        .eq('note_id', note.id);

      return {
        ...note,
        attachments: attachments || [],
      };
    })
  );

  return notesWithAttachments;
}

export async function getNoteById(noteId: string): Promise<NoteWithAttachments | null> {
  const { data: note, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .single();

  if (error || !note) return null;

  const { data: attachments } = await supabase
    .from('note_attachments')
    .select('*')
    .eq('note_id', noteId);

  return {
    ...note,
    attachments: attachments || [],
  };
}

export async function createNote(data: CreateNoteData, userId: string): Promise<Note> {
  const { data: note, error } = await supabase
    .from('notes')
    .insert([{ ...data, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  if (!note) throw new Error('Failed to create note');

  return note;
}

export async function updateNote(noteId: string, data: UpdateNoteData): Promise<Note> {
  const { data: note, error } = await supabase
    .from('notes')
    .update(data)
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  if (!note) throw new Error('Failed to update note');

  return note;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}

export async function addNoteAttachment(
  noteId: string,
  filePath: string,
  fileType: string,
  originalFilename: string,
  mimeType: string
): Promise<NoteAttachment> {
  const { data: attachment, error } = await supabase
    .from('note_attachments')
    .insert([
      {
        note_id: noteId,
        file_path: filePath,
        file_type: fileType,
        original_filename: originalFilename,
        mime_type: mimeType,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  if (!attachment) throw new Error('Failed to create attachment');

  return attachment;
}

export async function deleteNoteAttachment(attachmentId: string): Promise<void> {
  const { error } = await supabase
    .from('note_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
}

export async function searchNotes(
  userId: string,
  query: string,
  folder?: string,
  tags?: string[]
): Promise<NoteWithAttachments[]> {
  let notesQuery = supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .ilike('title', `%${query}%`);

  if (folder) {
    notesQuery = notesQuery.eq('folder_path', folder);
  }

  if (tags && tags.length > 0) {
    notesQuery = notesQuery.contains('tags', tags);
  }

  const { data: notes, error } = await notesQuery
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;
  if (!notes) return [];

  const notesWithAttachments = await Promise.all(
    notes.map(async (note: Note) => {
      const { data: attachments } = await supabase
        .from('note_attachments')
        .select('*')
        .eq('note_id', note.id);

      return {
        ...note,
        attachments: attachments || [],
      };
    })
  );

  return notesWithAttachments;
} 