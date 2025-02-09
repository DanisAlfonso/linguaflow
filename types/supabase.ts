export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string | null
          language: string | null
          tags: string[] | null
          is_pinned: boolean
          folder_path: string
          color_preset: 'blue' | 'purple' | 'green' | 'orange' | 'pink' | null
          created_at: string
          updated_at: string
          last_accessed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content?: string | null
          language?: string | null
          tags?: string[] | null
          is_pinned?: boolean
          folder_path?: string
          color_preset?: 'blue' | 'purple' | 'green' | 'orange' | 'pink' | null
          created_at?: string
          updated_at?: string
          last_accessed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string | null
          language?: string | null
          tags?: string[] | null
          is_pinned?: boolean
          folder_path?: string
          color_preset?: 'blue' | 'purple' | 'green' | 'orange' | 'pink' | null
          created_at?: string
          updated_at?: string
          last_accessed_at?: string
        }
      }
      note_attachments: {
        Row: {
          id: string
          note_id: string
          file_path: string
          file_type: string
          original_filename: string
          mime_type: string
          created_at: string
        }
        Insert: {
          id?: string
          note_id: string
          file_path: string
          file_type: string
          original_filename: string
          mime_type: string
          created_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          file_path?: string
          file_type?: string
          original_filename?: string
          mime_type?: string
          created_at?: string
        }
      }
    }
  }
} 