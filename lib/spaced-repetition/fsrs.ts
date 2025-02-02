import { FSRS, Rating, State as CardState, Card as FSRSCard } from 'ts-fsrs';
import { generatorParameters } from 'ts-fsrs';
import { createEmptyCard } from 'ts-fsrs';
import type { RecordLogItem, ReviewLog } from 'ts-fsrs';
import { DEFAULT_PARAMETERS } from 'ts-fsrs/lib/constants';

// Re-export Rating enum from ts-fsrs
export { Rating, CardState };

// Default parameters for FSRS
const DEFAULT_PARAMETERS_OBJ = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
});

// Initialize FSRS with default parameters
const fsrs = new FSRS(DEFAULT_PARAMETERS_OBJ);

// Learning and relearning steps (in minutes)
const LEARNING_STEPS = [1, 10];
const RELEARNING_STEPS = [10];

// Interface for card scheduling info
export interface SchedulingInfo {
  due: Date;
  state: CardState;
  difficulty: number;
  stability: number;
  retrievability: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  scheduled_in_minutes?: number; // For learning/relearning cards
}

// Convert our card data to FSRS card format
function toFSRSCard(card: {
  state: CardState;
  difficulty: number;
  stability: number;
  retrievability: number;
  elapsed_days: number;
  last_reviewed_at: Date | null;
  reps?: number;
  lapses?: number;
}): FSRSCard {
  return {
    due: card.last_reviewed_at || new Date(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: card.state,
    last_review: card.last_reviewed_at || new Date(),
  };
}

// Clamp a number between min and max values
function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

// Main function to schedule a card review
export function scheduleReview(
  card: {
    state: number;
    difficulty: number;
    stability: number;
    retrievability: number;
    elapsed_days: number;
    last_reviewed_at: Date | null;
    reps: number;
    lapses: number;
  },
  rating: Rating
): {
  state: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  scheduled_days: number;
  scheduled_in_minutes?: number;
} {
  const now = new Date();
  
  // Convert our card to FSRS format
  const fsrsCard: FSRSCard = {
    due: now,
    stability: card.stability || 0,
    difficulty: clamp(card.difficulty || 0, 0, 1),
    elapsed_days: card.elapsed_days || 0,
    scheduled_days: 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: card.state,
    last_review: card.last_reviewed_at || now,
  };

  const results = fsrs.repeat(fsrsCard, now);
  const result = results[rating];

  // Ensure difficulty stays within valid range (0-1)
  const difficulty = clamp(result.card.difficulty, 0, 1);

  // For learning/relearning cards, schedule in minutes
  if (result.card.state === CardState.Learning || result.card.state === CardState.Relearning) {
    return {
      state: result.card.state,
      difficulty,
      stability: result.card.stability,
      retrievability: result.retrievability,
      scheduled_days: 0,
      scheduled_in_minutes: 10, // Default to 10 minutes for learning/relearning
    };
  }

  // For review cards, schedule in days
  return {
    state: result.card.state,
    difficulty,
    stability: result.card.stability,
    retrievability: result.retrievability,
    scheduled_days: Math.max(1, Math.round(result.card.scheduled_days)), // Ensure minimum 1 day interval
  };
}

// Create a new card with initial FSRS state
export function createNewCard(): Pick<SchedulingInfo, 'state' | 'difficulty' | 'stability' | 'retrievability' | 'elapsed_days' | 'scheduled_days' | 'reps' | 'lapses'> {
  const card = createEmptyCard();
  return {
    state: card.state,
    difficulty: card.difficulty,
    stability: card.stability,
    retrievability: 1,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
  };
} 