import { useState, useCallback, useEffect } from 'react';
import { createStudySession, updateStudySession, reviewCard } from '../../api/flashcards';
import { Rating } from '../../spaced-repetition/fsrs';
import type { Card, StudySession } from '../../../types/flashcards';
import Toast from 'react-native-toast-message';

interface UseStudySessionProps {
  deckId: string;
  onSessionComplete: () => void;
}

interface UseStudySessionReturn {
  // Session state
  cards: Card[];
  currentCard: Card | null;
  currentCardIndex: number;
  progress: number;
  reviewing: boolean;
  cardsStudied: number;
  correctResponses: number;
  
  // Card management
  setCards: (cards: Card[]) => void;
  moveToNextCard: () => void;
  moveCurrentCardToEnd: () => void;
  
  // Response handling
  handleResponse: (rating: Rating, responseTimeMs?: number) => Promise<void>;
}

export function useStudySession({
  deckId,
  onSessionComplete,
}: UseStudySessionProps): UseStudySessionReturn {
  // Session state
  const [studySession, setStudySession] = useState<StudySession | null>(null);
  const [startTime] = useState(new Date());
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardsStudied, setCardsStudied] = useState(0);
  const [correctResponses, setCorrectResponses] = useState(0);
  const [reviewing, setReviewing] = useState(false);

  // Computed values
  const currentCard = cards[currentCardIndex] ?? null;
  const progress = cards.length > 0 ? ((currentCardIndex) / cards.length) * 100 : 0;

  // Initialize study session
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await createStudySession(deckId);
        setStudySession(session);
      } catch (error) {
        console.error('Error creating study session:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to create study session',
        });
      }
    };

    initSession();
  }, [deckId]);

  const moveToNextCard = useCallback(() => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      return true;
    }
    return false;
  }, [currentCardIndex, cards.length]);

  const moveCurrentCardToEnd = useCallback(() => {
    setCards(prevCards => {
      const newCards = [...prevCards];
      const currentCard = newCards.splice(currentCardIndex, 1)[0];
      return [...newCards, currentCard];
    });
  }, [currentCardIndex]);

  const completeSession = useCallback(async () => {
    if (!studySession) return;

    const endTime = new Date();
    const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    try {
      await updateStudySession(studySession.id, {
        ended_at: endTime.toISOString(),
        duration: `${timeSpent} seconds`,
        cards_reviewed: cardsStudied + 1,
      });
      
      Toast.show({
        type: 'success',
        text1: 'Study session complete!',
        text2: `You reviewed ${cardsStudied + 1} cards in ${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`,
      });

      onSessionComplete();
    } catch (error) {
      console.error('Error completing session:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save session',
      });
    }
  }, [studySession, startTime, cardsStudied, onSessionComplete]);

  const handleResponse = useCallback(async (rating: Rating, responseTimeMs?: number) => {
    if (!currentCard || reviewing) return;
    setReviewing(true);

    try {
      await reviewCard(currentCard.id, rating, responseTimeMs);

      // Update statistics
      setCardsStudied(prev => prev + 1);
      if (rating === Rating.Good || rating === Rating.Easy) {
        setCorrectResponses(prev => prev + 1);
      }

      if (rating === Rating.Again) {
        // Move current card to the end of the deck
        moveCurrentCardToEnd();
      } else {
        // For other ratings, try to move to next card
        const hasNextCard = moveToNextCard();
        if (!hasNextCard) {
          await completeSession();
        }
      }
    } catch (error) {
      console.error('Error reviewing card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save review',
      });
    } finally {
      setReviewing(false);
    }
  }, [currentCard, reviewing, moveCurrentCardToEnd, moveToNextCard, completeSession]);

  return {
    // Session state
    cards,
    currentCard,
    currentCardIndex,
    progress,
    reviewing,
    cardsStudied,
    correctResponses,
    
    // Card management
    setCards,
    moveToNextCard,
    moveCurrentCardToEnd,
    
    // Response handling
    handleResponse,
  };
} 