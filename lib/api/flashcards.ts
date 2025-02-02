import { supabase } from '../supabase/client';
import type { Card, Deck } from '../../types/flashcards';
import { scheduleReview, Rating, CardState } from '../spaced-repetition/fsrs';

export async function createDeck(
  data: {
    name: string;
    description?: string;
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
      tags: data.tags || [],
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return deck;
}

export async function createCard(
  deckId: string,
  data: {
    front: string;
    back: string;
    notes?: string;
    tags?: string[];
  }
): Promise<Card> {
  const { data: card, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      front: data.front,
      back: data.back,
      notes: data.notes || null,
      tags: data.tags || [],
      state: CardState.New,
      difficulty: 0,
      stability: 0,
      retrievability: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
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
  data: Partial<Pick<Card, 'front' | 'back' | 'notes' | 'tags'>>
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
  data: Partial<Pick<Deck, 'name' | 'description' | 'tags'>>
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

export async function reviewCard(
  id: string,
  rating: Rating
): Promise<Card> {
  try {
    console.log('Reviewing card:', id, 'with rating:', rating);
    
    // Get the current card data
    const { data: card, error: getError } = await supabase
      .from('cards')
      .select()
      .eq('id', id)
      .single();

    if (getError) {
      console.error('Error fetching card:', getError);
      throw getError;
    }

    if (!card) {
      console.error('Card not found:', id);
      throw new Error('Card not found');
    }

    // Calculate the next review schedule
    const now = new Date();
    console.log('Current card state:', {
      state: card.state,
      difficulty: card.difficulty || 0,
      stability: card.stability || 0,
      retrievability: card.retrievability || 1,
      elapsed_days: card.elapsed_days || 0,
      last_reviewed_at: card.last_reviewed_at,
    });
    
    const schedule = scheduleReview(
      {
        state: card.state,
        difficulty: card.difficulty || 0,
        stability: card.stability || 0,
        retrievability: card.retrievability || 1,
        elapsed_days: card.elapsed_days || 0,
        last_reviewed_at: card.last_reviewed_at,
      },
      rating
    );
    
    console.log('New schedule:', schedule);

    // Update the card with new spaced repetition data
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update({
        state: schedule.state,
        difficulty: schedule.difficulty,
        stability: schedule.stability,
        retrievability: schedule.retrievability,
        elapsed_days: 0, // Reset elapsed days since we're reviewing now
        scheduled_days: schedule.scheduled_days,
        last_reviewed_at: now.toISOString(),
        next_review_at: new Date(now.getTime() + schedule.scheduled_days * 24 * 60 * 60 * 1000).toISOString(),
        review_count: (card.review_count || 0) + 1,
        consecutive_correct: rating === Rating.Again ? 0 : (card.consecutive_correct || 0) + 1,
        reps: (card.reps || 0) + 1,
        lapses: rating === Rating.Again ? (card.lapses || 0) + 1 : (card.lapses || 0),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating card:', updateError);
      throw updateError;
    }

    // Update deck statistics
    const { error: deckError } = await supabase.rpc('update_deck_review_stats', {
      p_deck_id: card.deck_id,
    });

    if (deckError) {
      console.error('Error updating deck stats:', deckError);
      throw deckError;
    }

    return updatedCard;
  } catch (error) {
    console.error('Error in reviewCard:', error);
    throw error;
  }
}

export async function getDueCards(deckId: string, limit: number = 20): Promise<Card[]> {
  try {
    const now = new Date().toISOString();
    console.log('Getting due cards for deck:', deckId);
    console.log('Current time:', now);
    
    // First try to get new cards
    const { data: newCards, error: newError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .eq('state', CardState.New)
      .limit(limit);

    if (newError) {
      console.error('Error getting new cards:', newError);
      throw newError;
    }

    // If we have new cards, return them
    if (newCards && newCards.length > 0) {
      console.log('Found new cards:', newCards.length);
      return newCards;
    }

    // Otherwise, get cards that are due for review
    const { data: dueCards, error: dueError } = await supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .or(`state.in.(${CardState.Learning},${CardState.Relearning}),and(state.eq.${CardState.Review},next_review_at.lte.${now})`)
      .order('next_review_at', { ascending: true })
      .limit(limit);

    if (dueError) {
      console.error('Error getting due cards:', dueError);
      throw dueError;
    }

    console.log('Found due cards:', dueCards?.length ?? 0);
    return dueCards || [];
  } catch (error) {
    console.error('Error in getDueCards:', error);
    throw error;
  }
} 