import { differenceInDays } from 'date-fns';

// Card states
export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

// Rating values for card reviews
export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

// Parameters for the FSRS algorithm
// These values are based on the default parameters from the FSRS research
const FSRS_PARAMETERS = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
};

// Calculate the stability after a successful review
function nextStability(
  difficulty: number,
  stability: number,
  retrievability: number,
  rating: Rating,
  state: CardState,
): number {
  const w = FSRS_PARAMETERS.w;
  
  // Hard rating
  if (rating === Rating.Hard) {
    return stability * (1 + w[0] * (difficulty ** w[1]) * (stability ** w[2]) * (retrievability ** w[3]));
  }
  
  // Good rating
  if (rating === Rating.Good) {
    return stability * (1 + w[4] * (difficulty ** w[5]) * (stability ** w[6]) * (retrievability ** w[7]));
  }
  
  // Easy rating
  if (rating === Rating.Easy) {
    return stability * (1 + w[8] * (difficulty ** w[9]) * (stability ** w[10]) * (retrievability ** w[11]));
  }
  
  // Again rating - start over with initial stability
  return initialStability(difficulty);
}

// Calculate initial stability for new cards or after forgetting
function initialStability(difficulty: number): number {
  const w = FSRS_PARAMETERS.w;
  return w[12] * (difficulty ** w[13]);
}

// Update difficulty based on rating
function nextDifficulty(difficulty: number, rating: Rating): number {
  const w = FSRS_PARAMETERS.w;
  
  // Calculate new difficulty
  let nextD = difficulty;
  if (rating === Rating.Again) {
    nextD += w[14];
  } else if (rating === Rating.Hard) {
    nextD += w[15];
  } else if (rating === Rating.Easy) {
    nextD -= w[16];
  }
  
  // Constrain difficulty between 0 and 1
  return Math.min(Math.max(nextD, 0), 1);
}

// Calculate retrievability given stability and elapsed time
function retrievability(stability: number, elapsedDays: number): number {
  return Math.exp(Math.log(0.9) * elapsedDays / stability);
}

// Calculate next interval based on stability and desired retention
function nextInterval(stability: number): number {
  const interval = Math.ceil(stability * Math.log(FSRS_PARAMETERS.request_retention) / Math.log(0.9));
  return Math.min(interval, FSRS_PARAMETERS.maximum_interval);
}

// Main function to schedule a card review
export function scheduleReview(
  card: {
    state: CardState;
    difficulty: number;
    stability: number;
    retrievability: number;
    elapsed_days: number;
    last_reviewed_at: Date | null;
  },
  rating: Rating,
): {
  state: CardState;
  difficulty: number;
  stability: number;
  retrievability: number;
  scheduled_days: number;
} {
  const now = new Date();
  const elapsedDays = card.last_reviewed_at
    ? differenceInDays(now, card.last_reviewed_at)
    : 0;
  
  // Update difficulty
  const newDifficulty = nextDifficulty(card.difficulty, rating);
  
  // Calculate current retrievability
  const currentRetrievability = card.state === CardState.New
    ? 1
    : retrievability(card.stability, elapsedDays);
  
  // Calculate new stability
  const newStability = nextStability(
    newDifficulty,
    card.stability,
    currentRetrievability,
    rating,
    card.state,
  );
  
  // Determine new state
  let newState: CardState;
  if (rating === Rating.Again) {
    newState = CardState.Relearning;
  } else if (card.state === CardState.New || card.state === CardState.Learning) {
    newState = rating === Rating.Easy ? CardState.Review : CardState.Learning;
  } else {
    newState = CardState.Review;
  }
  
  // Calculate next interval
  const scheduledDays = nextInterval(newStability);
  
  // Calculate new retrievability for the scheduled interval
  const newRetrievability = retrievability(newStability, scheduledDays);
  
  return {
    state: newState,
    difficulty: newDifficulty,
    stability: newStability,
    retrievability: newRetrievability,
    scheduled_days: scheduledDays,
  };
} 