import { supabase } from '../supabase/client';
import type { Card, Deck } from '../../types/flashcards';

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
    })
    .select()
    .single();

  if (error) {
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