import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDueCards, getDeck } from '../../../../lib/api/flashcards';
import { Rating } from '../../../../lib/spaced-repetition/fsrs';
import { getCardAudioSegments } from '../../../../lib/api/audio';
import { RecordingInterface } from '../../../../components/flashcards/RecordingInterface';
import { StudyCardFront } from '../../../../components/flashcards/study/StudyCardFront';
import { StudyCardBack } from '../../../../components/flashcards/study/StudyCardBack';
import { StudyHeader } from '../../../../components/flashcards/study/StudyHeader';
import { StudyControls } from '../../../../components/flashcards/study/StudyControls';
import { StudyCharacterControl } from '../../../../components/flashcards/study/StudyCharacterControl';
import type { Card, Deck } from '../../../../types/flashcards';
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
import { useStudySession } from '../../../../lib/hooks/study/useStudySession';

export default function StudyScreen() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [characterSize, setCharacterSize] = useState(24);
  const [frontAudioSegments, setFrontAudioSegments] = useState<CardAudioSegment[]>([]);
  const [backAudioSegments, setBackAudioSegments] = useState<CardAudioSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFlipTime, setCardFlipTime] = useState<Date | null>(null);
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const isMandarin = deck?.language === 'Mandarin';

  const { hideNavigationBar, cardAnimationType, moveControlsToBottom } = useStudySettings();
  const { temporarilyHideTabBar, restoreTabBar } = useTabBar();

  // Use the study session hook
  const {
    cards,
    currentCard,
    currentCardIndex,
    progress,
    reviewing,
    setCards,
    handleResponse,
  } = useStudySession({
    deckId: id as string,
    onSessionComplete: () => router.back(),
  });

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
    console.log('Study screen - Tab bar visibility effect:', {
      hideNavigationBar,
      moveControlsToBottom,
      isRecordingEnabled
    });

    const shouldHideTabBar = hideNavigationBar || moveControlsToBottom || isRecordingEnabled;
    
    if (shouldHideTabBar) {
      console.log('Study screen - Hiding tab bar');
      temporarilyHideTabBar();
    } else {
      console.log('Study screen - Showing tab bar');
      restoreTabBar();
    }

    // Always restore tab bar when unmounting the study screen
    return () => {
      console.log('Study screen - Cleanup: always restore tab bar when leaving study screen');
      restoreTabBar();
    };
  }, [hideNavigationBar, moveControlsToBottom, isRecordingEnabled]);

  // Add a separate effect to handle navigation cleanup
  useEffect(() => {
    return () => {
      console.log('Study screen - Navigation cleanup: restoring tab bar');
      restoreTabBar();
    };
  }, []);

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
  }, [id, router, setCards]);

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

  const handleCardResponse = async (rating: Rating) => {
    const responseTimeMs = cardFlipTime 
      ? new Date().getTime() - cardFlipTime.getTime()
      : undefined;

    await handleResponse(rating, responseTimeMs);
    setCardFlipTime(null);
    resetCard();
  };

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
    onResponse: handleCardResponse,
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

        <View style={[
          styles.cardContainer,
          moveControlsToBottom && styles.cardContainerWithBottomControls,
          isMandarin && styles.mandarinCardContainer
        ]}>
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
              minHeight: moveControlsToBottom ? (isMandarin ? 465 : 535) : 300,
              padding: 24,
              borderRadius: 24,
              borderWidth: 1,
              backgroundColor: theme.colors.grey0,
              borderColor: theme.colors.grey2,
              marginBottom: moveControlsToBottom ? 80 : 32,
            }}
          />

          <StudyControls
            onResponse={handleCardResponse}
            reviewing={reviewing}
            style={moveControlsToBottom ? {
              ...styles.bottomControls,
              backgroundColor: theme.colors.background
            } : undefined}
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
    paddingHorizontal: 4,
  },
  cardContainerWithBottomControls: {
    position: 'relative',
    paddingBottom: 80,
  },
  mandarinCardContainer: {
    paddingTop: 0,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    right: 4,
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1,
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