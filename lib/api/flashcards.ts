import { supabase } from '../supabase/client';
import type { Card, Deck, MandarinCardData } from '../../types/flashcards';
import { scheduleReview, Rating, CardState } from '../spaced-repetition/fsrs';
import { createNewCard } from '@/lib/spaced-repetition/fsrs';

export async function createDeck(
  data: {
    name: string;
    description?: string;
    language?: string;
    settings?: Record<string, any>;
    tags?: string[];
  }
): Promise<Deck> {
  const session = await supabase.auth.getSession();
  if (!session.data.session?.user) {
    throw new Error('User must be authenticated to create a deck');
  }

  const { data: deck, error } = await supabase
    .from('decks')
    .insert({
      user_id: session.data.session.user.id,
      name: data.name,
      description: data.description || null,
      language: data.language || 'General',
      settings: data.settings || {},
      tags: data.tags || [],
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return deck;
}

export async function createCard(data: Partial<Card>): Promise<Card> {
  const fsrsState = createNewCard();
  
  const { data: card, error } = await supabase
    .from('cards')
    .insert({
      ...data,
      ...fsrsState,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating card:', error);
    throw error;
  }

  return card;
}

export async function getDeck(id: string): Promise<Deck | null> {
  const { data: deck, error } = await supabase
    .from('decks')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return deck;
}

export async function getCards(deckId: string): Promise<Card[]> {
  const { data: cards, error } = await supabase
    .from('cards')
    .select()
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return cards;
}

export async function updateCard(
  id: string,
  data: Partial<Pick<Card, 'front' | 'back' | 'notes' | 'tags' | 'language_specific_data'>>
): Promise<Card> {
  const { data: card, error } = await supabase
    .from('cards')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return card;
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function getDecks(): Promise<Deck[]> {
  const { data: decks, error } = await supabase
    .from('decks')
    .select()
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return decks;
}

export async function getCard(id: string): Promise<Card | null> {
  const { data: card, error } = await supabase
    .from('cards')
    .select()
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return card;
}

export async function updateDeck(
  id: string,
  data: Partial<Pick<Deck, 'name' | 'description' | 'tags' | 'language' | 'settings'>>
): Promise<Deck> {
  const { data: deck, error } = await supabase
    .from('decks')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function getDueCards(deckId: string, limit: number = 20): Promise<Card[]> {
  try {
    // Use the new get_due_cards function
    const { data: cards, error } = await supabase
      .rpc('get_due_cards', {
        p_deck_id: deckId,
        p_limit: limit,
      });

    if (error) {
      console.error('Error getting due cards:', error);
      throw error;
    }

    return cards || [];
  } catch (error) {
    console.error('Error in getDueCards:', error);
    throw error;
  }
}

export async function reviewCard(
  id: string,
  rating: Rating
): Promise<Card> {
  try {
    console.log('Reviewing card:', id, 'with rating:', rating);
    
    // First get the card
    const { data: currentCard, error: getCardError } = await supabase
      .from('cards')
      .select('*')  // Explicitly select all columns
      .eq('id', id)
      .single();

    if (getCardError) {
      console.error('Error fetching card:', getCardError);
      throw getCardError;
    }

    if (!currentCard) {
      console.error('Card not found:', id);
      throw new Error('Card not found');
    }

    console.log('Current card data:', currentCard);

    // Then get the deck
    const { data: deck, error: getDeckError } = await supabase
      .from('decks')
      .select('*')  // Explicitly select all columns
      .eq('id', currentCard.deck_id)
      .single();

    if (getDeckError) {
      console.error('Error fetching deck:', getDeckError);
      throw getDeckError;
    }

    console.log('Deck data:', deck);

    // Calculate the next schedule using FSRS
    const now = new Date();
    const cardState = {
      state: currentCard.state,
      difficulty: currentCard.difficulty || 0,
      stability: currentCard.stability || 0,
      retrievability: currentCard.retrievability || 1,
      elapsed_days: currentCard.elapsed_days || 0,
      last_reviewed_at: currentCard.last_reviewed_at,
      reps: currentCard.reps || 0,
      lapses: currentCard.lapses || 0,
    };

    console.log('Card state for FSRS:', cardState);
    
    const schedule = scheduleReview(cardState, rating);
    console.log('New schedule:', schedule);

    // Determine the queue based on the state
    let queue: 'new' | 'learn' | 'review';
    if (schedule.state === CardState.New) {
      queue = 'new';
    } else if (schedule.state === CardState.Learning || schedule.state === CardState.Relearning) {
      queue = 'learn';
    } else {
      queue = 'review';
    }

    const updateData = {
      state: schedule.state,
      difficulty: schedule.difficulty,
      stability: schedule.stability,
      retrievability: schedule.retrievability,
      elapsed_days: 0, // Reset elapsed days since we're reviewing now
      scheduled_days: schedule.scheduled_days,
      scheduled_in_minutes: schedule.scheduled_in_minutes,
      queue,
      last_reviewed_at: now.toISOString(),
      next_review_at: schedule.scheduled_in_minutes
        ? new Date(now.getTime() + schedule.scheduled_in_minutes * 60 * 1000).toISOString()
        : new Date(now.getTime() + schedule.scheduled_days * 24 * 60 * 60 * 1000).toISOString(),
      review_count: (currentCard.review_count || 0) + 1,
      consecutive_correct: rating === Rating.Again ? 0 : (currentCard.consecutive_correct || 0) + 1,
      reps: (currentCard.reps || 0) + 1,
      lapses: rating === Rating.Again ? (currentCard.lapses || 0) + 1 : (currentCard.lapses || 0),
    };

    console.log('Update data:', updateData);

    // Update the card with new spaced repetition data
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating card:', updateError);
      console.error('Update data that caused error:', updateData);
      throw updateError;
    }

    console.log('Card updated successfully:', updatedCard);

    // Update deck statistics
    const { error: statsError } = await supabase.rpc('update_deck_review_stats', {
      p_deck_id: currentCard.deck_id,
    });

    if (statsError) {
      console.error('Error updating deck stats:', statsError);
      throw statsError;
    }

    return updatedCard;
  } catch (error) {
    console.error('Error in reviewCard:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
} 