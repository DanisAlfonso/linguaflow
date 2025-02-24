import { supabase } from '../supabase';
import type { Card, Deck, MandarinCardData } from '../../types/flashcards';
import { scheduleReview, Rating, CardState } from '../spaced-repetition/fsrs';
import { createNewCard } from '@/lib/spaced-repetition/fsrs';
import { getCardAudioSegments, deleteAudioFile, cleanupLocalRecordings } from './audio';

export async function createDeck(
  data: {
    name: string;
    description?: string;
    language?: string;
    settings?: Record<string, any>;
    tags?: string[];
    userId: string;
  }
): Promise<Deck> {
  console.log('Creating deck with data:', data);
  
  try {
    // Create the deck directly with the user_id
    const { data: deck, error } = await supabase
      .from('decks')
      .insert({
        user_id: data.userId,
        name: data.name,
        description: data.description || null,
        language: data.language || 'General',
        settings: data.settings || {},
        tags: data.tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating deck:', {
        error,
        errorMessage: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    console.log('Deck created successfully:', deck);
    return deck;
  } catch (error) {
    console.error('Unexpected error in createDeck:', error);
    throw error;
  }
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
  try {
    // First update the deck's review stats
    const { error: statsError } = await supabase.rpc('update_deck_review_stats', {
      p_deck_id: id,
    });

    if (statsError) {
      console.error('Error updating deck stats:', statsError);
      throw statsError;
    }

    // Then get the deck with updated stats
    const { data: deck, error } = await supabase
      .from('decks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching deck:', error);
      throw error;
    }

    return deck;
  } catch (error) {
    console.error('Error in getDeck:', error);
    throw error;
  }
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
  try {
    console.log('🗑️ Starting deletion process for card:', id);

    // Get audio segments before deletion to verify cleanup
    const { data: audioSegments } = await supabase
      .from('card_audio_segments')
      .select('*, audio_files(*)')
      .eq('card_id', id);
    console.log('📊 Found audio segments for card:', audioSegments?.length || 0);
    
    // Delete audio files from storage first
    if (audioSegments?.length) {
      console.log('🎵 Audio files to be deleted:', audioSegments.map(segment => ({
        segmentId: segment.id,
        audioFileId: segment.audio_file_id,
        filePath: segment.audio_files?.file_path
      })));

      // Delete each audio file from storage
      for (const segment of audioSegments) {
        if (segment.audio_files?.file_path) {
          console.log(`🗑️ Deleting audio file from storage: ${segment.audio_files.file_path}`);
          const { error: storageError } = await supabase.storage
            .from('audio')
            .remove([segment.audio_files.file_path]);
          
          if (storageError) {
            console.error('❌ Error deleting audio file from storage:', storageError);
          } else {
            console.log('✅ Audio file deleted from storage successfully');
          }

          // Delete the audio file record
          const { error: audioFileError } = await supabase
            .from('audio_files')
            .delete()
            .eq('id', segment.audio_file_id);

          if (audioFileError) {
            console.error('❌ Error deleting audio file record:', audioFileError);
          } else {
            console.log('✅ Audio file record deleted successfully');
          }
        }
      }
    }

    // First clean up local recordings
    console.log('📱 Cleaning up local recordings for card:', id);
    await cleanupLocalRecordings(id);
    console.log('✅ Local recordings cleaned up successfully');

    // Get recordings before deletion to verify cleanup
    const { data: recordings } = await supabase
      .from('recordings')
      .select('*')
      .eq('card_id', id);
    console.log('📊 Found recordings for card:', recordings?.length || 0);

    // Then delete the card from Supabase
    console.log('🗑️ Deleting card from Supabase...');
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error in deleteCard:', error);
      throw error;
    }

    console.log('✅ Card deleted successfully');

    // Verify audio segments deletion
    const { data: remainingSegments } = await supabase
      .from('card_audio_segments')
      .select('*')
      .eq('card_id', id);
    console.log('📊 Remaining audio segments after deletion:', remainingSegments?.length || 0);

    // Verify audio files deletion
    if (audioSegments?.length) {
      for (const segment of audioSegments) {
        const { data: remainingFile } = await supabase
          .from('audio_files')
          .select('*')
          .eq('id', segment.audio_file_id)
          .single();
        console.log(`📊 Audio file ${segment.audio_file_id} exists after deletion:`, !!remainingFile);

        // Verify storage deletion
        const { data: storageExists } = await supabase.storage
          .from('audio')
          .list('', {
            search: segment.audio_files?.file_path
          });
        console.log(`📊 Audio file exists in storage:`, !!storageExists?.length);
      }
    }

    // Verify recordings deletion
    const { data: remainingRecordings } = await supabase
      .from('recordings')
      .select('*')
      .eq('card_id', id);
    console.log('📊 Remaining recordings after deletion:', remainingRecordings?.length || 0);

  } catch (error) {
    console.error('❌ Error in deleteCard:', error);
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
  data: Partial<Pick<Deck, 'name' | 'description' | 'tags' | 'language' | 'settings' | 'color_preset'>>
): Promise<Deck> {
  const { data: deck, error } = await supabase
    .from('decks')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating deck:', error);
    throw error;
  }

  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  try {
    console.log('🗑️ Starting deletion process for deck:', id);

    // First get all cards in the deck
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', id);

    if (cardsError) {
      console.error('❌ Error fetching deck cards:', cardsError);
      throw cardsError;
    }

    console.log('📊 Found cards in deck:', cards?.length || 0);

    // Get all audio segments and files for all cards in the deck
    if (cards && cards.length > 0) {
      console.log('🔍 Fetching audio segments for all cards...');
      const cardIds = cards.map(card => card.id);
      
      // First check for audio segments
      const { data: audioSegments, error: segmentsError } = await supabase
        .from('card_audio_segments')
        .select('*, audio_files(*)')
        .in('card_id', cardIds);

      if (segmentsError) {
        console.error('❌ Error fetching audio segments:', segmentsError);
      }

      console.log('📊 Found audio segments:', audioSegments?.length || 0);

      // Combine all audio files that need to be deleted
      const allAudioFiles = (audioSegments?.map(segment => segment.audio_files) || [])
        .filter(file => file && file.file_path);

      console.log('🎵 Total audio files to be deleted:', allAudioFiles.length);

      // Delete each audio file from storage
      for (const file of allAudioFiles) {
        if (file.file_path) {
          console.log(`🗑️ Attempting to delete audio file from storage: ${file.file_path}`);
          
          // Check if file exists in storage first
          const { data: fileExists } = await supabase.storage
            .from('audio')
            .list('', {
              search: file.file_path
            });
          
          console.log(`📊 File exists in storage: ${!!fileExists?.length}`);

          if (fileExists?.length) {
            const { error: storageError } = await supabase.storage
              .from('audio')
              .remove([file.file_path]);
            
            if (storageError) {
              console.error('❌ Error deleting audio file from storage:', storageError);
            } else {
              console.log('✅ Audio file deleted from storage successfully');
            }
          }

          // Delete the audio file record
          const { error: audioFileError } = await supabase
            .from('audio_files')
            .delete()
            .eq('id', file.id);

          if (audioFileError) {
            console.error('❌ Error deleting audio file record:', audioFileError);
          } else {
            console.log('✅ Audio file record deleted successfully');
          }
        }
      }
    }

    // Clean up local recordings for each card
    console.log('🧹 Cleaning up recordings for all cards in deck...');
    for (const card of cards) {
      console.log(`📱 Processing card: ${card.id}`);
      await cleanupLocalRecordings(card.id);
    }
    console.log('✅ All card recordings cleaned up');

    // Delete the deck (this will cascade delete cards and recordings)
    console.log('🗑️ Deleting deck from Supabase...');
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting deck:', error);
      throw error;
    }

    console.log('✅ Deck deleted successfully');

    // Verify cleanup
    const { data: remainingCards } = await supabase
      .from('cards')
      .select('id')
      .eq('deck_id', id);
    console.log('📊 Remaining cards after deletion:', remainingCards?.length || 0);

    // Verify audio segments deletion
    if (cards?.length) {
      const cardIds = cards.map(card => card.id);
      const { data: remainingSegments } = await supabase
        .from('card_audio_segments')
        .select('*')
        .in('card_id', cardIds);
      console.log('📊 Remaining audio segments after deletion:', remainingSegments?.length || 0);
    }

    // Verify recordings deletion
    if (cards) {
      for (const card of cards) {
        const { data: remainingRecordings } = await supabase
          .from('recordings')
          .select('*')
          .eq('card_id', card.id);
        console.log(`📊 Remaining recordings for card ${card.id}:`, remainingRecordings?.length || 0);
      }
    }

  } catch (error) {
    console.error('❌ Error in deleteDeck:', error);
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
  rating: Rating,
  responseTimeMs?: number
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

    // Record the review in card_reviews table
    const { error: reviewError } = await supabase
      .from('card_reviews')
      .insert({
        card_id: id,
        deck_id: currentCard.deck_id,
        rating,
        response_time_ms: responseTimeMs,
      });

    if (reviewError) {
      console.error('Error recording card review:', reviewError);
      throw reviewError;
    }

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
      step_index: currentCard.step_index || 0,
    };

    console.log('Card state for FSRS:', cardState);
    
    const schedule = scheduleReview(cardState, rating, {
      learning_steps: deck.learning_steps || [1, 10],
      relearning_steps: deck.relearning_steps || [10],
    });
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

export interface UserStatistics {
  total_cards_learned: number;
  study_time_minutes: number;
  day_streak: number;
  accuracy: number;
  avg_response_time: number;
  review_rate: number;
}

export async function getUserStatistics(): Promise<UserStatistics> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_statistics');

    if (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserStatistics:', error);
    throw error;
  }
}

export interface StudySession {
  id: string;
  user_id: string;
  deck_id: string;
  started_at: string;
  ended_at: string | null;
  duration: string | null;
  cards_reviewed: number;
  created_at: string;
}

export async function createStudySession(deckId: string): Promise<StudySession> {
  try {
    const { data: session, error } = await supabase
      .from('study_sessions')
      .insert({
        deck_id: deckId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating study session:', error);
      throw error;
    }

    return session;
  } catch (error) {
    console.error('Error in createStudySession:', error);
    throw error;
  }
}

export async function updateStudySession(
  sessionId: string,
  data: {
    ended_at: string;
    duration: string;
    cards_reviewed: number;
  }
): Promise<StudySession> {
  try {
    const { data: session, error } = await supabase
      .from('study_sessions')
      .update(data)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating study session:', error);
      throw error;
    }

    return session;
  } catch (error) {
    console.error('Error in updateStudySession:', error);
    throw error;
  }
}

export interface HourlyActivity {
  hour_of_day: number;
  cards_reviewed: number;
}

export interface ResponseDistribution {
  response_bucket: string;
  count: number;
}

export async function getHourlyActivity(daysBack: number = 30): Promise<HourlyActivity[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_hourly_activity', { p_days_back: daysBack });

    if (error) {
      console.error('Error getting hourly activity:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getHourlyActivity:', error);
    throw error;
  }
}

export async function getResponseDistribution(daysBack: number = 30): Promise<ResponseDistribution[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_response_distribution', { p_days_back: daysBack });

    if (error) {
      console.error('Error getting response distribution:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getResponseDistribution:', error);
    throw error;
  }
}

export interface DailyActivity {
  date: string;
  cards_reviewed: number;
  study_minutes: number;
  accuracy: number;
}

export async function getDailyActivity(daysBack: number = 30): Promise<DailyActivity[]> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_daily_activity', { p_days_back: daysBack });

    if (error) {
      console.error('Error getting daily activity:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getDailyActivity:', error);
    throw error;
  }
}

export interface RecentActivity {
  id: string;
  deck_id: string;
  deck_name: string;
  cards_reviewed: number;
  accuracy: number;
  study_minutes: number;
  created_at: string;
}

export async function getRecentActivity(limit: number = 5): Promise<RecentActivity[]> {
  try {
    // First get study sessions with deck info
    const { data: sessions, error: sessionsError } = await supabase
      .from('study_sessions')
      .select(`
        id,
        deck_id,
        cards_reviewed,
        duration,
        created_at,
        ended_at,
        decks:decks (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionsError) {
      console.error('Error getting study sessions:', sessionsError);
      throw sessionsError;
    }

    // Then get accuracy for each session
    const sessionsWithAccuracy = await Promise.all((sessions || []).map(async (session: any) => {
      const { data: reviews, error: reviewsError } = await supabase
        .from('card_reviews')
        .select('rating')
        .eq('deck_id', session.deck_id)
        .gte('created_at', session.created_at)
        .lte('created_at', session.ended_at || session.created_at);

      if (reviewsError) {
        console.error('Error getting reviews:', reviewsError);
        return {
          ...session,
          accuracy: 0,
        };
      }

      const goodReviews = (reviews || []).filter(r => r.rating >= 3).length;
      const accuracy = reviews?.length 
        ? Math.round((goodReviews / reviews.length) * 100)
        : 0;

      return {
        ...session,
        accuracy,
      };
    }));

    return sessionsWithAccuracy.map(session => {
      // Calculate study minutes based on created_at and ended_at if duration is not available
      let studyMinutes = 0;
      if (session.duration) {
        // Parse PostgreSQL interval string (e.g., "1 hour 30 minutes" or "45 minutes")
        const durationStr = session.duration.toString();
        if (durationStr.includes('hour')) {
          const hours = parseInt(durationStr.split('hour')[0]) || 0;
          const minutes = parseInt(durationStr.split('minutes')[0].split('hour')[1]) || 0;
          studyMinutes = hours * 60 + minutes;
        } else {
          studyMinutes = parseInt(durationStr.split('minutes')[0]) || 0;
        }
      } else if (session.ended_at) {
        // Calculate minutes between created_at and ended_at
        const start = new Date(session.created_at);
        const end = new Date(session.ended_at);
        studyMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      }

      return {
        id: session.id,
        deck_id: session.deck_id,
        deck_name: session.decks?.name || 'Unknown Deck',
        cards_reviewed: session.cards_reviewed || 0,
        accuracy: session.accuracy,
        study_minutes: studyMinutes,
        created_at: session.created_at,
      };
    });
  } catch (error) {
    console.error('Error in getRecentActivity:', error);
    throw error;
  }
} 