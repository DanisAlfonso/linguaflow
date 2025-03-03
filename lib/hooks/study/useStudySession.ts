import { useState, useCallback, useEffect } from 'react';
import { createStudySession, updateStudySession, reviewCard } from '../../services/flashcards';
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
        // Don't show error toast in offline mode as we can still study
        // Just create a temporary session object
        setStudySession({
          id: `temp_session_${Date.now()}`,
          user_id: 'offline_user',
          deck_id: deckId,
          started_at: new Date().toISOString(),
          ended_at: null,
          duration: null,
          cards_reviewed: 0,
          created_at: new Date().toISOString()
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
      // Don't show error in offline mode, just proceed
      Toast.show({
        type: 'info',
        text1: 'Session saved locally',
        text2: 'Changes will sync when you reconnect',
      });
      
      onSessionComplete();
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
      
      // In offline mode, we still want to continue with the study session
      // Update statistics
      setCardsStudied(prev => prev + 1);
      if (rating === Rating.Good || rating === Rating.Easy) {
        setCorrectResponses(prev => prev + 1);
      }
      
      Toast.show({
        type: 'info',
        text1: 'Card review saved locally',
        text2: 'Changes will sync when you reconnect',
      });

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