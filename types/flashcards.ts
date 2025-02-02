export interface Deck {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  total_cards: number;
  new_cards: number;
  cards_to_review: number;
  created_at: Date;
  last_studied_at: Date | null;
  tags: string[];
}

export interface Card {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  notes: string | null;
  tags: string[];
  created_at: Date;
  last_reviewed_at: Date | null;
  next_review_at: Date | null;
  review_count: number;
  consecutive_correct: number;
  ease_factor: number;
  interval: number;
}

export type ReviewResponse = 'again' | 'hard' | 'good' | 'easy';

export interface StudySession {
  deckId: string;
  startedAt: Date;
  cardsStudied: number;
  correctResponses: number;
  timeSpent: number; // in seconds
} 