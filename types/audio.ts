export interface AudioFile {
  id: string;
  file_path: string;
  original_filename: string;
  mime_type: string;
  created_at: Date;
  updated_at: Date;
}

export interface AudioSegment {
  id: string;
  card_id: string;
  audio_file_id: string;
  text_start: number;
  text_end: number;
  side: 'front' | 'back';
  created_at: Date;
  updated_at: Date;
}

export interface CardAudioSegment {
  id: string;
  audio_file_path: string;
  text_start: number;
  text_end: number;
  side: 'front' | 'back';
}

// Type for the audio upload response from Supabase Storage
export interface AudioUploadResponse {
  path: string;
  fullPath: string;
}

export interface Recording {
  id: string;
  audio_url: string;
  duration: number;
  created_at: string;
}

export interface RecordingFile {
  uri: string;
  duration: number;
} 