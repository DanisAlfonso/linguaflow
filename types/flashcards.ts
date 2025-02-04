export type Language = 'General' | 'Mandarin' | 'Spanish' | 'French' | 'German' | 'Japanese' | 'Korean' | 'Italian' | 'Portuguese' | 'Russian';

export interface DeckSettings {
  showPinyin?: boolean;
  defaultCharacterSize?: number;
}

export interface MandarinCardData {
  characters: string[];
  pinyin: string[];
}

export interface MandarinCardSide {
  front: MandarinCardData;
  back: MandarinCardData;
}

export type Deck = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  language?: string;
  settings?: Record<string, any>;
  total_cards: number;
  new_cards: number;
  cards_to_review: number;
  color_preset?: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
  created_at: string;
  updated_at: string;
};

export interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  notes: string | null;
  tags: string[];
  language_specific_data?: {
    mandarin?: MandarinCardSide;
  };
  created_at: Date;
  last_reviewed_at: Date | null;
  next_review_at: Date | null;
  review_count: number;
  consecutive_correct: number;
  
  // FSRS fields
  state: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  scheduled_in_minutes?: number;
  step_index: number;
  queue: 'new' | 'learn' | 'review';
}

export type ReviewResponse = 'again' | 'hard' | 'good' | 'easy';

export interface StudySession {
  deckId: string;
  startedAt: Date;
  cardsStudied: number;
  correctResponses: number;
  timeSpent: number; // in seconds
} 