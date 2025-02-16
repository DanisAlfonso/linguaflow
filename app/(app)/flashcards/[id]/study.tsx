import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Platform, Pressable, Animated, ViewStyle } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDueCards, reviewCard, getDeck, createStudySession, updateStudySession } from '../../../../lib/api/flashcards';
import { Rating } from '../../../../lib/spaced-repetition/fsrs';
import { MandarinText } from '../../../../components/flashcards/MandarinText';
import { CharacterSizeControl } from '../../../../components/flashcards/CharacterSizeControl';
import { AudioEnabledText } from '../../../../components/flashcards/AudioEnabledText';
import { getCardAudioSegments } from '../../../../lib/api/audio';
import { Audio } from 'expo-av';
import { RecordingInterface } from '../../../../components/flashcards/RecordingInterface';
import type { Card, Deck, StudySession } from '../../../../types/flashcards';
import type { CardAudioSegment, Recording } from '../../../../types/audio';
import Toast from 'react-native-toast-message';
import { uploadRecording } from '../../../../lib/api/audio';
import { initDatabase } from '../../../../lib/db';
import { ensureRecordingsDirectory } from '../../../../lib/fs/recordings';
import { useStudySettings } from '../../../../contexts/StudySettingsContext';
import { useTabBar } from '../../../../contexts/TabBarContext';
import { AnimatedCard } from '../../../../components/flashcards/AnimatedCard';

// Keyboard shortcuts for web
const KEYBOARD_SHORTCUTS = {
  '1': Rating.Again,
  '2': Rating.Hard,
  '3': Rating.Good,
  '4': Rating.Easy,
  ' ': 'flip', // Space bar to flip card
  'Control+ ': 'playAudio', // Ctrl+Space to play audio
} as const;

async function configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.error('Error configuring audio session:', error);
  }
}

export default function StudyScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipAnim] = useState(new Animated.Value(0));
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

  // Recording states
  const [isRecordingEnabled, setIsRecordingEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const recordingTimer = useRef<NodeJS.Timeout>();

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const sound = useRef<Audio.Sound>();
  const playbackTimer = useRef<NodeJS.Timeout>();

  const [hasRecording, setHasRecording] = useState(false);

  // Add a new state for the uploaded recording
  const [uploadedRecording, setUploadedRecording] = useState<Recording | null>(null);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const isMandarin = deck?.language === 'Mandarin';
  const currentCard = cards[currentCardIndex];
  const progress = cards.length > 0 ? ((currentCardIndex) / cards.length) * 100 : 0;

  const { hideNavigationBar, cardAnimationType } = useStudySettings();
  const { temporarilyHideTabBar, restoreTabBar } = useTabBar();

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

  // Handle keyboard shortcuts on web
  useEffect(() => {
    if (!isWeb) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key;
      const ctrlKey = event.ctrlKey;
      
      if (ctrlKey && key === ' ') {
        event.preventDefault();
        // Play audio of current side
        const currentSegments = isFlipped ? backAudioSegments : frontAudioSegments;
        if (currentSegments.length > 0) {
          console.log('Playing audio:', currentSegments[0].audio_file_path);
          const audioElement = document.getElementById(`audio-${currentSegments[0].audio_file_path}`);
          if (audioElement instanceof HTMLAudioElement) {
            audioElement.currentTime = 0; // Reset to start
            audioElement.play().catch(error => {
              console.error('Error playing audio:', error);
            });
          } else {
            console.warn('Audio element not found:', `audio-${currentSegments[0].audio_file_path}`);
          }
        }
        return;
      }

      if (key in KEYBOARD_SHORTCUTS) {
        event.preventDefault();
        const action = KEYBOARD_SHORTCUTS[key as keyof typeof KEYBOARD_SHORTCUTS];
        if (action === 'flip') {
          flipCard();
        } else if (isFlipped && !reviewing) {
          handleResponse(action as Rating);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isWeb, isFlipped, reviewing, frontAudioSegments, backAudioSegments]);

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

  const loadAudioSegments = async (cardId: string) => {
    try {
      const segments = await getCardAudioSegments(cardId);
      setFrontAudioSegments(segments.filter(s => s.side === 'front'));
      setBackAudioSegments(segments.filter(s => s.side === 'back'));
    } catch (error) {
      console.error('Error loading audio segments:', error);
    }
  };

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

  const flipCard = () => {
    setIsFlipped(!isFlipped);
    setCardFlipTime(new Date());
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: false,
    }).start();
  };

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
        setIsFlipped(false);
        flipAnim.setValue(0);
      } else {
        // For other ratings, move to next card
        if (currentCardIndex < cards.length - 1) {
          setCurrentCardIndex(prev => prev + 1);
          setIsFlipped(false);
          flipAnim.setValue(0);
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

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  // Handle recording permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (!permissionResponse) return;
      
      if (isRecordingEnabled && permissionResponse.status !== 'granted') {
        console.log('Requesting recording permission..');
        const permission = await requestPermission();
        if (!permission.granted) {
          Toast.show({
            type: 'error',
            text1: 'Permission Required',
            text2: 'Microphone access is needed for recording',
          });
          setIsRecordingEnabled(false);
        }
      }
    };

    checkPermissions();
  }, [isRecordingEnabled, permissionResponse, requestPermission]);

  // Clean up recording timer
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!permissionResponse || permissionResponse.status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Microphone access is needed for recording',
        });
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          // Update meter level from recording status
          if (status.isRecording && status.metering !== undefined) {
            // Convert dB meter level to a value between 0 and 1
            // Typical values are between -160 and 0 dB
            const db = status.metering;
            const normalized = (db + 160) / 160; // Convert to 0-1 range
            const clamped = Math.max(0, Math.min(1, normalized)); // Ensure between 0 and 1
            setMeterLevel(clamped);
          }
        },
        1000 // Update metering every 1000ms
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      setMeterLevel(0);

      // Start duration timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1000);
      }, 1000);

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start recording',
      });
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      console.log('Stopping recording..');
      await recording.stopAndUnloadAsync();
      
      // Stop and clear duration timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('No recording URI available');
      }

      console.log('Recording stopped and stored at', uri);

      // Upload the recording
      const uploaded = await uploadRecording(currentCard.id, {
        uri,
        duration: recordingDuration,
      });

      // Store the uploaded recording
      setUploadedRecording(uploaded);

      // Reset states but keep duration for display
      setRecording(null);
      setIsRecording(false);
      setMeterLevel(0);
      setHasRecording(true);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recording saved',
      });
    } catch (err) {
      console.error('Failed to stop recording', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save recording',
      });
    }
  };

  const deleteRecording = () => {
    if (sound.current) {
      sound.current.unloadAsync();
      sound.current = undefined;
    }
    setUploadedRecording(null);
    setHasRecording(false);
    setRecordingDuration(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
  };

  const startPlayback = async () => {
    try {
      if (!uploadedRecording) {
        console.error('No uploaded recording available');
        return;
      }

      // Configure audio session
      await configureAudioSession();

      if (!sound.current) {
        console.log('Creating new sound from URL:', uploadedRecording.audio_url);
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: uploadedRecording.audio_url },
          { 
            progressUpdateIntervalMillis: 100,
            shouldPlay: true,
            volume: 1.0,
          },
          (status) => {
            if (status.isLoaded) {
              const durationMillis = status.durationMillis ?? 1; // Fallback to 1 to avoid division by zero
              setPlaybackProgress(status.positionMillis / durationMillis);
              
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackProgress(0);
                if (playbackTimer.current) {
                  clearInterval(playbackTimer.current);
                }
              }
            }
          }
        );

        console.log('Sound created with status:', status);
        sound.current = newSound;
      } else {
        await sound.current.playAsync();
      }
      
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to play recording',
      });
    }
  };

  const stopPlayback = async () => {
    try {
      if (!sound.current) return;

      await sound.current.stopAsync();
      await sound.current.setPositionAsync(0);
      setIsPlaying(false);
      setPlaybackProgress(0);

      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const handleSeek = async (progress: number) => {
    try {
      if (!sound.current) return;

      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded) return;

      const durationMillis = status.durationMillis ?? 0;
      if (durationMillis === 0) return;

      const position = progress * durationMillis;
      await sound.current.setPositionAsync(position);
      setPlaybackProgress(progress);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

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

  // Add effect to handle tab bar visibility when recording interface is shown
  useEffect(() => {
    if (isRecordingEnabled) {
      temporarilyHideTabBar();
    } else {
      restoreTabBar();
    }
  }, [isRecordingEnabled]);

  // Handle cleanup when component unmounts
  useEffect(() => {
    return () => {
      restoreTabBar();
    };
  }, []);

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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
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
          <View style={styles.progress}>
            <View 
              style={[
                styles.progressBar, 
                { backgroundColor: theme.colors.grey2 }
              ]}
            >
              <View 
                style={[
                  styles.progressFill,
                  { 
                    backgroundColor: '#4F46E5',
                    width: `${progress}%`,
                  },
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.grey4 }]}>
              {currentCardIndex + 1} / {cards.length}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name="headset"
                  size={24}
                  color={theme.colors.grey5}
                />
              }
              onPress={() => router.push(`/flashcards/${currentCard.id}/recordings`)}
            />
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name={isRecordingEnabled ? "mic" : "mic-none"}
                  size={24}
                  color={isRecordingEnabled ? theme.colors.primary : theme.colors.grey5}
                />
              }
              onPress={() => setIsRecordingEnabled(!isRecordingEnabled)}
            />
          </View>
        </View>

        {isMandarin && (
          <View style={styles.characterSizeControl}>
            <CharacterSizeControl
              size={characterSize}
              onSizeChange={setCharacterSize}
              color={theme.colors.grey4}
            />
          </View>
        )}

        <View style={styles.cardContainer}>
          <AnimatedCard
            front={
              <View style={styles.cardContent}>
                {isMandarin && currentCard.language_specific_data?.mandarin ? (
                  <View style={styles.mandarinContainer}>
                    <MandarinText
                      data={currentCard.language_specific_data.mandarin.front}
                      characterSize={characterSize}
                      color={theme.colors.grey5}
                      audioUrl={frontAudioSegments.length > 0 ? frontAudioSegments[0].audio_file_path : undefined}
                      isStudyMode={true}
                    />
                    {frontAudioSegments.length > 0 && (
                      <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
                        Click text or press Ctrl+Space to play audio
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.textContainer}>
                    <AudioEnabledText
                      text={currentCard.front}
                      audioSegments={frontAudioSegments}
                      isStudyMode={true}
                      color={theme.colors.primary}
                      style={styles.audioEnabledText}
                    />
                    {frontAudioSegments.length > 0 && (
                      <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
                        Click text or press Ctrl+Space to play audio
                      </Text>
                    )}
                  </View>
                )}
                {currentCard.tags && currentCard.tags.length > 0 && (
                  <View style={styles.cardTags}>
                    {currentCard.tags.map((tag, index) => (
                      <View
                        key={index}
                        style={[styles.tag, { backgroundColor: theme.colors.grey1 }]}
                      >
                        <Text style={[styles.tagText, { color: theme.colors.grey4 }]}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            }
            back={
              <View style={styles.cardContent}>
                {isMandarin && currentCard.language_specific_data?.mandarin ? (
                  <View style={styles.mandarinContainer}>
                    <MandarinText
                      data={currentCard.language_specific_data.mandarin.back}
                      characterSize={characterSize}
                      color={theme.colors.grey5}
                      audioUrl={backAudioSegments.length > 0 ? backAudioSegments[0].audio_file_path : undefined}
                      isStudyMode={true}
                    />
                    {backAudioSegments.length > 0 && (
                      <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
                        Click text or press Ctrl+Space to play audio
                      </Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.textContainer}>
                    <AudioEnabledText
                      text={currentCard.back}
                      audioSegments={backAudioSegments}
                      isStudyMode={true}
                      color={theme.colors.primary}
                      style={styles.audioEnabledText}
                    />
                    {backAudioSegments.length > 0 && (
                      <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
                        Click text or press Ctrl+Space to play audio
                      </Text>
                    )}
                  </View>
                )}
                {currentCard.notes && (
                  <Text style={[styles.notes, { color: theme.colors.grey3 }]}>
                    {currentCard.notes}
                  </Text>
                )}
              </View>
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

          <View style={styles.controls}>
            <Button
              title={isWeb ? "Again (1)" : "Again"}
              icon={
                <MaterialIcons
                  name="refresh"
                  size={20}
                  color="#DC2626"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#DC262615' }]}
              titleStyle={{ color: '#DC2626', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Again)}
            />
            <Button
              title={isWeb ? "Hard (2)" : "Hard"}
              icon={
                <MaterialIcons
                  name="trending-down"
                  size={20}
                  color="#D97706"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#D9770615' }]}
              titleStyle={{ color: '#D97706', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Hard)}
            />
            <Button
              title={isWeb ? "Good (3)" : "Good"}
              icon={
                <MaterialIcons
                  name="check"
                  size={20}
                  color="#059669"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#05966915' }]}
              titleStyle={{ color: '#059669', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Good)}
            />
            <Button
              title={isWeb ? "Easy (4)" : "Easy"}
              icon={
                <MaterialIcons
                  name="trending-up"
                  size={20}
                  color="#4F46E5"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#4F46E515' }]}
              titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Easy)}
            />
          </View>
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