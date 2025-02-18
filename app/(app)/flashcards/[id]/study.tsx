import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDueCards, reviewCard, getDeck, createStudySession, updateStudySession } from '../../../../lib/api/flashcards';
import { Rating } from '../../../../lib/spaced-repetition/fsrs';
import { getCardAudioSegments } from '../../../../lib/api/audio';
import { RecordingInterface } from '../../../../components/flashcards/RecordingInterface';
import { StudyCardFront } from '../../../../components/flashcards/study/StudyCardFront';
import { StudyCardBack } from '../../../../components/flashcards/study/StudyCardBack';
import { StudyHeader } from '../../../../components/flashcards/study/StudyHeader';
import { StudyControls } from '../../../../components/flashcards/study/StudyControls';
import { StudyCharacterControl } from '../../../../components/flashcards/study/StudyCharacterControl';
import type { Card, Deck, StudySession } from '../../../../types/flashcards';
import type { CardAudioSegment } from '../../../../types/audio';
import Toast from 'react-native-toast-message';
import { initDatabase } from '../../../../lib/db';
import { ensureRecordingsDirectory } from '../../../../lib/fs/recordings';
import { useStudySettings } from '../../../../contexts/StudySettingsContext';
import { useTabBar } from '../../../../contexts/TabBarContext';
import { AnimatedCard } from '../../../../components/flashcards/AnimatedCard';
import { useKeyboardShortcuts } from '../../../../lib/hooks/study/useKeyboardShortcuts';
import { useAudioManager } from '../../../../lib/hooks/study/useAudioManager';
import { useCardAnimation } from '../../../../lib/hooks/study/useCardAnimation';

export default function StudyScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardsStudied, setCardsStudied] = useState(0);
  const [correctResponses, setCorrectResponses] = useState(0);
  const [startTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [characterSize, setCharacterSize] = useState(24);
  const [frontAudioSegments, setFrontAudioSegments] = useState<CardAudioSegment[]>([]);
  const [backAudioSegments, setBackAudioSegments] = useState<CardAudioSegment[]>([]);
  const [studySession, setStudySession] = useState<StudySession | null>(null);
  const [cardFlipTime, setCardFlipTime] = useState<Date | null>(null);
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const isMandarin = deck?.language === 'Mandarin';
  const currentCard = cards[currentCardIndex];
  const progress = cards.length > 0 ? ((currentCardIndex) / cards.length) * 100 : 0;

  const { hideNavigationBar, cardAnimationType } = useStudySettings();
  const { temporarilyHideTabBar, restoreTabBar } = useTabBar();

  // Use the card animation hook
  const {
    isFlipped,
    flipCard,
    resetCard,
    frontAnimatedStyle,
    backAnimatedStyle,
  } = useCardAnimation({
    onFlip: () => setCardFlipTime(new Date()),
  });

  // Use the audio manager hook
  const {
    isRecording,
    recordingDuration,
    meterLevel,
    hasRecording,
    uploadedRecording,
    isPlaying,
    playbackProgress,
    startRecording,
    stopRecording,
    deleteRecording,
    startPlayback,
    stopPlayback,
    handleSeek,
    setIsPlaying,
    setPlaybackProgress,
    setHasRecording,
    setUploadedRecording,
  } = useAudioManager({
    cardId: currentCard?.id ?? '',
    onClose: () => setIsRecordingEnabled(false),
  });

  // Effect to handle tab bar visibility
  useEffect(() => {
    if (hideNavigationBar) {
      temporarilyHideTabBar();
    } else {
      restoreTabBar();
    }

    // Restore tab bar when leaving the screen
    return () => {
      restoreTabBar();
    };
  }, [hideNavigationBar]);

  const loadData = useCallback(async () => {
    try {
      console.log('Loading deck and cards:', id);
      const [dueCards, deckData] = await Promise.all([
        getDueCards(id as string),
        getDeck(id as string),
      ]);
      console.log('Loaded due cards:', dueCards);
      
      if (!dueCards || dueCards.length === 0) {
        console.log('No cards to review');
        Toast.show({
          type: 'info',
          text1: 'No cards to review',
          text2: 'All caught up! Come back later.',
        });
        router.back();
        return;
      }

      setCards(dueCards);
      setDeck(deckData);

      if (deckData?.language === 'Mandarin' && deckData.settings?.defaultCharacterSize) {
        setCharacterSize(deckData.settings.defaultCharacterSize);
      }

      // Create a new study session
      const session = await createStudySession(id as string);
      setStudySession(session);
    } catch (error) {
      console.error('Error in loadData:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to load cards',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (currentCard) {
      // Load audio segments when card changes
      const loadAudioSegments = async () => {
        try {
          console.log('Loading audio segments for card:', currentCard.id);
          const segments = await getCardAudioSegments(currentCard.id);
          console.log('Loaded audio segments:', segments);
          setFrontAudioSegments(segments.filter(s => s.side === 'front'));
          setBackAudioSegments(segments.filter(s => s.side === 'back'));
        } catch (error) {
          console.error('Error loading audio segments:', error);
        }
      };
      loadAudioSegments();
    }
  }, [currentCard]);

  const handleResponse = async (rating: Rating) => {
    if (reviewing) return;
    setReviewing(true);

    try {
      // Calculate response time if card was flipped
      const responseTimeMs = cardFlipTime 
        ? new Date().getTime() - cardFlipTime.getTime()
        : undefined;

      await reviewCard(currentCard.id, rating, responseTimeMs);

      // Update statistics
      setCardsStudied(prev => prev + 1);
      if (rating === Rating.Good || rating === Rating.Easy) {
        setCorrectResponses(prev => prev + 1);
      }

      // Reset card flip time for next card
      setCardFlipTime(null);

      if (rating === Rating.Again) {
        // Move current card to the end of the deck
        setCards(prevCards => {
          const newCards = [...prevCards];
          const currentCard = newCards.splice(currentCardIndex, 1)[0];
          return [...newCards, currentCard];
        });
        // Stay on the same index (which will now show the next card)
        resetCard();
      } else {
        // For other ratings, move to next card
        if (currentCardIndex < cards.length - 1) {
          setCurrentCardIndex(prev => prev + 1);
          resetCard();
        } else {
          // End of deck
          const endTime = new Date();
          const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          
          // Update study session
          if (studySession) {
            await updateStudySession(studySession.id, {
              ended_at: endTime.toISOString(),
              duration: `${timeSpent} seconds`,
              cards_reviewed: cardsStudied + 1,
            });
          }
          
          Toast.show({
            type: 'success',
            text1: 'Study session complete!',
            text2: `You reviewed ${cardsStudied + 1} cards in ${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`,
          });

          // Navigate back to deck view
          router.back();
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
  };

  // Add effect to handle tab bar visibility when recording interface is shown
  useEffect(() => {
    if (isRecordingEnabled) {
      temporarilyHideTabBar();
    } else {
      restoreTabBar();
    }
  }, [isRecordingEnabled]);

  // Initialize database and file system
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([
          initDatabase(),
          ensureRecordingsDirectory(),
        ]);
      } catch (error) {
        console.error('Error initializing storage:', error);
      }
    };
    init();
  }, []);

  const handlePlayAudio = (audioPath: string) => {
    const audioElement = document.getElementById(`audio-${audioPath}`);
    if (audioElement instanceof HTMLAudioElement) {
      audioElement.currentTime = 0; // Reset to start
      audioElement.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    } else {
      console.warn('Audio element not found:', `audio-${audioPath}`);
    }
  };

  // Use the keyboard shortcuts hook
  useKeyboardShortcuts({
    isFlipped,
    reviewing,
    frontAudioSegments,
    backAudioSegments,
    onFlip: flipCard,
    onResponse: handleResponse,
    onPlayAudio: handlePlayAudio,
  });

  if (loading || !currentCard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Container>
          <View style={styles.header}>
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name="close"
                  size={24}
                  color={theme.colors.grey5}
                />
              }
              onPress={() => router.back()}
            />
          </View>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.grey5 }]}>
              Loading cards...
            </Text>
          </View>
        </Container>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[
      styles.container, 
      { 
        backgroundColor: theme.colors.background,
        paddingBottom: hideNavigationBar ? 0 : undefined 
      }
    ]}>
      <Container>
        <StudyHeader
          currentIndex={currentCardIndex}
          totalCards={cards.length}
          isRecordingEnabled={isRecordingEnabled}
          onRecordingToggle={() => setIsRecordingEnabled(!isRecordingEnabled)}
          currentCardId={currentCard.id}
        />

        {isMandarin && (
          <StudyCharacterControl
            size={characterSize}
            onSizeChange={setCharacterSize}
          />
        )}

        <View style={styles.cardContainer}>
          <AnimatedCard
            front={
              <StudyCardFront
                card={currentCard}
                isMandarin={isMandarin}
                characterSize={characterSize}
                frontAudioSegments={frontAudioSegments}
              />
            }
            back={
              <StudyCardBack
                card={currentCard}
                isMandarin={isMandarin}
                characterSize={characterSize}
                backAudioSegments={backAudioSegments}
              />
            }
            isFlipped={isFlipped}
            onPress={flipCard}
            animationType={cardAnimationType}
            cardStyle={{
              minHeight: 300,
              padding: 24,
              borderRadius: 24,
              borderWidth: 1,
              backgroundColor: theme.colors.grey0,
              borderColor: theme.colors.grey2,
            }}
          />

          <StudyControls
            onResponse={handleResponse}
            reviewing={reviewing}
          />
        </View>

        {isWeb && (
          <View style={styles.shortcuts}>
            <Text style={[styles.shortcutText, { color: theme.colors.grey3 }]}>
              Keyboard shortcuts: Space to flip • 1-4 to rate card
            </Text>
          </View>
        )}

        <RecordingInterface
          isVisible={isRecordingEnabled}
          isRecording={isRecording}
          isPlaying={isPlaying}
          recordingDuration={recordingDuration}
          playbackProgress={playbackProgress}
          meterLevel={meterLevel}
          hasRecording={hasRecording}
          cardId={currentCard.id}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onStartPlayback={startPlayback}
          onStopPlayback={stopPlayback}
          onDeleteRecording={deleteRecording}
          onClose={() => setIsRecordingEnabled(false)}
          setIsPlaying={setIsPlaying}
          setPlaybackProgress={setPlaybackProgress}
          uploadedRecording={uploadedRecording}
          setHasRecording={setHasRecording}
          setUploadedRecording={setUploadedRecording}
        />
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: {
    flex: 1,
    marginHorizontal: 16,
    gap: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  characterSizeControl: {
    marginBottom: 24,
  },
  cardContainer: {
    flex: 1,
    gap: 32,
  },
  card: {
    minHeight: 300,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  cardText: {
    fontSize: 32,
    textAlign: 'center',
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  notes: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  responseButton: {
    height: 48,
    borderWidth: 0,
  },
  responseButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shortcuts: {
    marginTop: 16,
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: 14,
    fontWeight: '500',
  },
  audioEnabledText: {
    textDecorationLine: 'underline',
  },
  audioHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  mandarinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
}); 