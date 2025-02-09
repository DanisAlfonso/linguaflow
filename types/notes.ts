import { Database } from './supabase';

export type Note = Database['public']['Tables']['notes']['Row'];
export type NoteInsert = Database['public']['Tables']['notes']['Insert'];
export type NoteUpdate = Database['public']['Tables']['notes']['Update'];

export type NoteAttachment = Database['public']['Tables']['note_attachments']['Row'];
export type NoteAttachmentInsert = Database['public']['Tables']['note_attachments']['Insert'];

export type ColorPreset = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

export interface NoteWithAttachments extends Note {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  language: string | null;
  tags: string[] | null;
  is_pinned: boolean;
  folder_path: string;
  color_preset: ColorPreset | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  attachments: NoteAttachment[];
}

export interface NotesState {
  notes: NoteWithAttachments[];
  selectedNote: NoteWithAttachments | null;
  isLoading: boolean;
  error: string | null;
  view: 'grid' | 'list';
  sortBy: 'created' | 'updated' | 'accessed' | 'title';
  sortDirection: 'asc' | 'desc';
  currentFolder: string;
  searchQuery: string;
  selectedTags: string[];
}

export interface CreateNoteData {
  title: string;
  content?: string;
  language?: string;
  tags?: string[];
  is_pinned?: boolean;
  folder_path?: string;
  color_preset?: ColorPreset;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  language?: string;
  tags?: string[];
  is_pinned?: boolean;
  folder_path?: string;
  color_preset?: ColorPreset;
} 