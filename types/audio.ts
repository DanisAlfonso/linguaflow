export interface AudioFile {
  id: string;
  file_path: string;
  original_filename: string;
  mime_type: string;
  created_at: Date;
  updated_at: Date;
}

export type AudioTrackType = 'upload' | 'recording' | 'local';

export interface AudioTrack {
  id: string;
  userId: string;
  title: string;
  description: string;
  audioFileId: string;
  audioFile?: AudioFile;
  trackType: AudioTrackType;
  createdAt: Date;
  updatedAt: Date;
  duration?: number;
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
  audio_file: {
    url: string;
    name: string;
  };
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
  card_id: string;
  user_id: string;
  audio_url: string;
  duration: number;
  created_at: string;
  name?: string;
}

export interface RecordingFile {
  uri: string;
  duration: number;
}

export interface LocalRecording {
  id: string;
  card_id: string;
  user_id: string;
  file_path: string;
  duration: number;
  created_at: string;
  synced: boolean;
  audio_url: string | null;
  remote_id: string | null;
}

export interface LocalRecordingInput {
  card_id: string;
  user_id: string;
  file_path: string;
  duration: number;
}

export interface DatabaseTransaction {
  executeSql: (
    sqlStatement: string,
    args?: any[],
    callback?: (transaction: DatabaseTransaction, resultSet: DatabaseResultSet) => void,
    errorCallback?: (transaction: DatabaseTransaction, error: Error) => boolean
  ) => void;
}

export interface DatabaseResultSet {
  insertId: number;
  rowsAffected: number;
  rows: {
    length: number;
    item: (index: number) => any;
    _array: any[];
  };
} 