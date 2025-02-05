import { AudioFile } from './audio';

export type AudioTrackType = 'recording' | 'upload';
export type PlaylistVisibility = 'private' | 'public' | 'unlisted';

export interface AudioTrack {
  id: string;
  userId: string;
  title: string;
  description?: string;
  audioFileId: string;
  audioFile?: AudioFile;
  duration?: number;
  trackType: AudioTrackType;
  waveformData?: number[]; // Normalized waveform data points
  language?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AudioPlaylist {
  id: string;
  userId: string;
  title: string;
  description?: string;
  visibility: PlaylistVisibility;
  coverImage?: string;
  totalDuration: number;
  trackCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AudioPlaylistTrack {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
  track?: AudioTrack;
  createdAt: Date;
}

export interface AudioTrackMetadata {
  id: string;
  trackId: string;
  playCount: number;
  lastPlayedAt?: Date;
  favorite: boolean;
  customMetadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Player state types
export interface PlayerState {
  currentTrack?: AudioTrack;
  currentPlaylist?: AudioPlaylist;
  isPlaying: boolean;
  isSeeking: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'none' | 'track' | 'playlist';
}

export interface PlaybackProgress {
  position: number;
  duration: number;
  buffered: number;
} 