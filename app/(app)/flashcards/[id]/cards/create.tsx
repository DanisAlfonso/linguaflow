import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { Text, Input, Button, useTheme, Badge } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../../components/layout/Container';
import { createCard, getDeck } from '../../../../../lib/api/flashcards';
import { MandarinCardInput } from '../../../../../components/flashcards/MandarinCardInput';
import { CharacterSizeControl } from '../../../../../components/flashcards/CharacterSizeControl';
import { MandarinText } from '../../../../../components/flashcards/MandarinText';
import { AudioAttachButton } from '../../../../../components/flashcards/AudioAttachButton';
import { AudioEnabledText } from '../../../../../components/flashcards/AudioEnabledText';
import type { Deck, MandarinCardData } from '../../../../../types/flashcards';
import type { CardAudioSegment } from '../../../../../types/audio';
import { getCardAudioSegments } from '../../../../../lib/api/audio';
import Toast from 'react-native-toast-message';
import { checkNetworkStatus, logOperationMode, isNetworkConnected } from '../../../../../lib/utils/network';

export default function CreateCardScreen() {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [characterSize, setCharacterSize] = useState(24);
  const [frontMandarinData, setFrontMandarinData] = useState<MandarinCardData>({ characters: [], pinyin: [] });
  const [backMandarinData, setBackMandarinData] = useState<MandarinCardData>({ characters: [], pinyin: [] });
  const [createdCard, setCreatedCard] = useState<string | null>(null);
  const [frontAudioSegments, setFrontAudioSegments] = useState<CardAudioSegment[]>([]);
  const [backAudioSegments, setBackAudioSegments] = useState<CardAudioSegment[]>([]);
  const [previewButtonScale] = useState(new Animated.Value(1));
  const [createButtonScale] = useState(new Animated.Value(1));
  const [cardsCreated, setCardsCreated] = useState(0);
  const [sessionStartTime] = useState(new Date());
  const [showFinishButton, setShowFinishButton] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const isMandarin = deck?.language === 'Mandarin';

  useEffect(() => {
    const loadDeck = async () => {
      // Check network status before loading deck
      const isOnline = await checkNetworkStatus();
      
      console.log('🔄 [CREATE CARD] Screen mounted, loading deck information', { 
        deckId: id,
        networkStatus: isOnline ? 'online' : 'offline'
      });
      
      try {
        logOperationMode('Fetching deck data for card creation', { deckId: id });
        const deckData = await getDeck(id as string);
        
        console.log('✅ [CREATE CARD] Deck loaded successfully', { 
          deckName: deckData?.name, 
          language: deckData?.language,
          settings: deckData?.settings,
          source: isOnline ? 'remote' : 'local'
        });
        
        setDeck(deckData);
        if (deckData?.language === 'Mandarin' && deckData.settings?.defaultCharacterSize) {
          setCharacterSize(deckData.settings.defaultCharacterSize);
        }
      } catch (error) {
        console.error('❌ [CREATE CARD] Error loading deck:', error);
        console.log('❌ [CREATE CARD] Offline status during error:', !isNetworkConnected());
        
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: isNetworkConnected() 
            ? 'Failed to load deck information' 
            : 'You are offline. Offline card creation will be available soon.',
        });
      }
    };
    loadDeck();
  }, [id]);

  const clearForm = useCallback(() => {
    setFront('');
    setBack('');
    setNotes('');
    setTags('');
    setFrontMandarinData({ characters: [], pinyin: [] });
    setBackMandarinData({ characters: [], pinyin: [] });
    setCreatedCard(null);
    setFrontAudioSegments([]);
    setBackAudioSegments([]);
    setIsPreview(false);
  }, []);

  const handleCreateCard = async (andContinue = false) => {
    console.log('🔄 [CREATE CARD] handleCreateCard called:', { 
      andContinue, 
      currentCreatedCard: createdCard,
      frontLength: front.length,
      backLength: back.length 
    });
    
    if (!front.trim() || !back.trim()) {
      console.log('❌ [CREATE CARD] Validation failed: front or back is empty');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Front and back of the card are required',
      });
      return;
    }

    setLoading(true);
    try {
      let cardId = createdCard;
      
      // Only create a new card if one doesn't exist
      if (!cardId) {
        console.log('🔄 [CREATE CARD] No existing card ID, creating new card');
        cardId = await audioButtonProps.onCreateCard();
        if (!cardId) {
          console.log('❌ [CREATE CARD] Failed to create card (no ID returned)');
          return;
        }
        console.log('✅ [CREATE CARD] Card created successfully with ID:', cardId);
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Card created successfully${andContinue ? ' - Add another card' : ''}`,
      });

      // Show finish button after creating a card
      setShowFinishButton(true);
      setCardsCreated(prev => prev + 1);
      console.log('🔄 [CREATE CARD] Updated cards created count:', cardsCreated + 1);

      if (andContinue) {
        console.log('🔄 [CREATE CARD] Clearing form after card creation to add another card');
        clearForm();
      }
    } catch (error) {
      console.error('❌ [CREATE CARD] Error creating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create card',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - sessionStartTime.getTime()) / 1000);
    
    console.log('✅ [CREATE CARD] Session complete', { 
      cardsCreated,
      sessionDuration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
      networkStatus: isNetworkConnected() ? 'online' : 'offline',
      pendingSyncRequired: !isNetworkConnected() && cardsCreated > 0
    });
    
    Toast.show({
      type: 'success',
      text1: 'Session Complete',
      text2: `Created ${cardsCreated} cards in ${Math.floor(duration / 60)}m ${duration % 60}s`,
    });
    router.back();
  };

  const handleAudioAttached = async () => {
    const isOnline = isNetworkConnected();
    
    console.log('🔄 [CREATE CARD] Audio attachment requested', { 
      currentCreatedCard: createdCard,
      networkStatus: isOnline ? 'online' : 'offline'
    });
    
    if (!isOnline) {
      console.log('❌ [CREATE CARD] Cannot attach audio while offline');
      Toast.show({
        type: 'error',
        text1: 'Offline Mode',
        text2: 'Audio attachment is not available offline.',
      });
      return;
    }
    
    try {
      // Load audio segments for the card
      console.log('🔄 [CREATE CARD] Fetching audio segments', { cardId: createdCard });
      const segments = await getCardAudioSegments(createdCard!);
      
      console.log('✅ [CREATE CARD] Audio segments loaded', { 
        frontSegments: segments.filter(s => s.side === 'front').length,
        backSegments: segments.filter(s => s.side === 'back').length
      });
      
      setFrontAudioSegments(segments.filter(s => s.side === 'front'));
      setBackAudioSegments(segments.filter(s => s.side === 'back'));
    } catch (error) {
      console.error('❌ [CREATE CARD] Error attaching audio:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to attach audio',
      });
    }
  };

  const togglePreview = () => {
    setIsPreview(!isPreview);
  };

  const animatePress = (scale: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const audioButtonProps = {
    cardId: createdCard || '',
    onAudioAttached: handleAudioAttached,
    onCreateCard: async () => {
      setLoading(true);
      // Validation checks
      if (!front.trim() || !back.trim()) {
        console.log('❌ [CREATE CARD] Validation failed: Missing front or back content');
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Front and back content are required',
        });
        setLoading(false);
        return '';
      }
      
      try {
        // Check network status before card creation
        const isOnline = await checkNetworkStatus();
        
        console.log('🔄 [CREATE CARD] Creating card with data:', {
          deckId: id,
          front: front.trim(),
          back: back.trim(),
          notes: notes.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
          hasMandarinData: Boolean(isMandarin),
          frontMandarinDataLength: isMandarin ? frontMandarinData.characters.length : 0,
          backMandarinDataLength: isMandarin ? backMandarinData.characters.length : 0,
          networkStatus: isOnline ? 'online' : 'offline'
        });
        
        logOperationMode('Creating new flashcard', { 
          deckId: id,
          method: isOnline ? 'api' : 'localDatabase'
        });
        
        const card = await createCard({
          deck_id: id as string,
          front: front.trim(),
          back: back.trim(),
          notes: notes.trim() || undefined,
          tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
          language_specific_data: isMandarin ? {
            mandarin: {
              front: frontMandarinData,
              back: backMandarinData,
            },
          } : undefined,
        });
        
        console.log('✅ [CREATE CARD] Card created successfully:', { 
          cardId: card.id,
          createdAt: card.created_at,
          storageLocation: isOnline ? 'remote' : 'local',
          pendingSync: !isOnline
        });
        
        setCreatedCard(card.id);
        return card.id;
      } catch (error) {
        const isOfflineError = !isNetworkConnected() || 
          (error && String(error).includes('Network request failed'));
          
        console.error('❌ [CREATE CARD] Error in onCreateCard:', error);
        console.log('❌ [CREATE CARD] Error appears to be network-related:', isOfflineError);
        
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: isOfflineError 
            ? 'You are offline. Offline card creation will be available soon.'
            : 'Failed to create card',
        });
        setLoading(false);
        return '';
      }
    },
    disabled: !front.trim() || !back.trim()
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.mode === 'dark' ? theme.colors.black : theme.colors.white }]}>
      <Container>
        <View style={[styles.header, { borderBottomColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey1 }]}>
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5}
              />
            }
            onPress={() => router.back()}
            containerStyle={styles.backButton}
          />
          <Text h1 style={[styles.title, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
            Add Cards
          </Text>
          {cardsCreated > 0 && (
            <Badge
              value={cardsCreated}
              status="primary"
              containerStyle={styles.badge}
            />
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
            {!isPreview ? (
              <View>
                {isMandarin && (
                  <View style={styles.characterSizeControl}>
                    <CharacterSizeControl
                      size={characterSize}
                      onSizeChange={setCharacterSize}
                      color={theme.colors.grey4}
                    />
                  </View>
                )}

                {isMandarin ? (
                  <>
                    <MandarinCardInput
                      value={front}
                      onChangeText={setFront}
                      onMandarinDataChange={setFrontMandarinData}
                      placeholder="Front of card"
                      label="Front"
                      characterSize={characterSize}
                      showPreview={isPreview}
                      audioButton={
                        <AudioAttachButton
                          {...audioButtonProps}
                          side="front"
                        />
                      }
                      isMandarin={true}
                    />
                    <MandarinCardInput
                      value={back}
                      onChangeText={setBack}
                      onMandarinDataChange={setBackMandarinData}
                      placeholder="Back of card"
                      label="Back"
                      characterSize={characterSize}
                      showPreview={isPreview}
                      audioButton={
                        <AudioAttachButton
                          {...audioButtonProps}
                          side="back"
                        />
                      }
                      isMandarin={true}
                    />
                  </>
                ) : (
                  <View>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3 }]}>
                        Front
                      </Text>
                      <Input
                        placeholder="Front of card"
                        value={front}
                        onChangeText={setFront}
                        multiline
                        numberOfLines={3}
                        containerStyle={styles.input}
                        inputContainerStyle={[
                          styles.inputField,
                          styles.textArea,
                          {
                            borderColor: theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey2,
                            backgroundColor: theme.mode === 'dark' ? theme.colors.grey0 : '#FFFFFF',
                          },
                        ]}
                        inputStyle={[
                          styles.inputText,
                          { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.black },
                        ]}
                        placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey4}
                        rightIcon={
                          <AudioAttachButton
                            {...audioButtonProps}
                            side="front"
                          />
                        }
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3 }]}>
                        Back
                      </Text>
                      <Input
                        placeholder="Back of card"
                        value={back}
                        onChangeText={setBack}
                        multiline
                        numberOfLines={3}
                        containerStyle={styles.input}
                        inputContainerStyle={[
                          styles.inputField,
                          styles.textArea,
                          {
                            borderColor: theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey2,
                            backgroundColor: theme.mode === 'dark' ? theme.colors.grey0 : '#FFFFFF',
                          },
                        ]}
                        inputStyle={[
                          styles.inputText,
                          { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.black },
                        ]}
                        placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey4}
                        rightIcon={
                          <AudioAttachButton
                            {...audioButtonProps}
                            side="back"
                          />
                        }
                      />
                    </View>
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
                    Notes (Optional)
                  </Text>
                  <Input
                    placeholder="Additional notes or context"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={2}
                    containerStyle={styles.input}
                    inputContainerStyle={[
                      styles.inputField,
                      styles.textArea,
                      {
                        borderColor: theme.colors.grey2,
                        backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey0,
                      },
                    ]}
                    inputStyle={[
                      styles.inputText,
                      { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.black },
                    ]}
                    placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey4}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
                    Tags (Optional)
                  </Text>
                  <Input
                    placeholder="Add tags (comma separated)"
                    value={tags}
                    onChangeText={setTags}
                    containerStyle={styles.input}
                    inputContainerStyle={[
                      styles.inputField,
                      {
                        borderColor: theme.colors.grey2,
                        backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey0,
                      },
                    ]}
                    inputStyle={[
                      styles.inputText,
                      { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.black },
                    ]}
                    placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey4}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.preview}>
                <View
                  style={[
                    styles.previewCard,
                    {
                      backgroundColor: theme.colors.grey0,
                      borderColor: theme.colors.grey2,
                    },
                  ]}
                >
                  {isMandarin ? (
                    <MandarinText
                      data={frontMandarinData}
                      characterSize={characterSize}
                      color={theme.colors.grey5}
                    />
                  ) : (
                    <Text style={[styles.previewText, { color: theme.colors.grey5 }]}>
                      {front || 'Front side preview'}
                    </Text>
                  )}
                  {tags && (
                    <View style={styles.previewTags}>
                      {tags.split(',').map((tag, index) => (
                        <View
                          key={index}
                          style={[styles.tag, { backgroundColor: theme.colors.grey1 }]}
                        >
                          <Text style={[styles.tagText, { color: theme.colors.grey4 }]}>
                            {tag.trim()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.previewDivider}>
                  <View
                    style={[styles.dividerLine, { backgroundColor: theme.colors.grey2 }]}
                  />
                </View>

                <View
                  style={[
                    styles.previewCard,
                    {
                      backgroundColor: theme.colors.grey0,
                      borderColor: theme.colors.grey2,
                    },
                  ]}
                >
                  {isMandarin ? (
                    <MandarinText
                      data={backMandarinData}
                      characterSize={characterSize}
                      color={theme.colors.grey5}
                    />
                  ) : (
                    <Text style={[styles.previewText, { color: theme.colors.grey5 }]}>
                      {back || 'Back side preview'}
                    </Text>
                  )}
                  {notes && (
                    <Text style={[styles.previewNotes, { color: theme.colors.grey3 }]}>
                      {notes}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.actionButtons}>
              <View style={styles.actionButtonsRow}>
                <Animated.View
                  style={[
                    styles.buttonContainer,
                    { 
                      backgroundColor: '#EEF2FF',
                      borderWidth: 0,
                      transform: [{ scale: previewButtonScale }] 
                    },
                  ]}
                >
                  <Button
                    title={isPreview ? "Edit" : "Preview"}
                    type="clear"
                    icon={
                      <MaterialIcons
                        name={isPreview ? "edit" : "visibility"}
                        size={20}
                        color="#4F46E5"
                        style={styles.buttonIcon}
                      />
                    }
                    buttonStyle={[styles.button, { backgroundColor: 'transparent' }]}
                    titleStyle={{ color: '#4F46E5', fontWeight: '600', fontSize: 16 }}
                    onPress={() => {
                      animatePress(previewButtonScale);
                      togglePreview();
                    }}
                  />
                </Animated.View>

                <Animated.View
                  style={[
                    styles.buttonContainer,
                    styles.createButton,
                    { transform: [{ scale: createButtonScale }] },
                  ]}
                >
                  <Button
                    title={createdCard ? "Create New" : "Create"}
                    loading={loading}
                    icon={
                      <MaterialIcons
                        name={createdCard ? "add" : "check"}
                        size={20}
                        color="white"
                        style={styles.buttonIcon}
                      />
                    }
                    onPress={() => {
                      animatePress(createButtonScale);
                      handleCreateCard(true);
                    }}
                    type="clear"
                    buttonStyle={styles.button}
                    titleStyle={[styles.buttonTitle, { color: 'white' }]}
                  />
                </Animated.View>
              </View>

              {showFinishButton && (
                <Animated.View
                  style={[
                    styles.buttonContainer,
                    styles.finishButton,
                    { transform: [{ scale: createButtonScale }] },
                  ]}
                >
                  <Button
                    title="Finish"
                    icon={
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="white"
                        style={styles.buttonIcon}
                      />
                    }
                    onPress={() => {
                      animatePress(createButtonScale);
                      handleFinish();
                    }}
                    type="clear"
                    buttonStyle={[styles.button, { backgroundColor: '#10B981' }]}
                    titleStyle={[styles.buttonTitle, { color: 'white' }]}
                  />
                </Animated.View>
              )}
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  form: {
    padding: 20,
    gap: 28,
  },
  characterSizeControl: {
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 56,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 4,
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  input: {
    paddingHorizontal: 0,
    width: '100%',
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    marginBottom: -8,
    backgroundColor: Platform.select({
      ios: 'rgba(0, 0, 0, 0.02)',
      android: 'rgba(0, 0, 0, 0.04)',
      default: 'rgba(0, 0, 0, 0.02)',
    }),
  },
  inputText: {
    fontSize: 16,
    lineHeight: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  preview: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Platform.select({
      ios: 'rgba(0, 0, 0, 0.02)',
      android: 'rgba(0, 0, 0, 0.04)',
      default: 'rgba(0, 0, 0, 0.02)',
    }),
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewNotes: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  previewTags: {
    position: 'absolute',
    bottom: 24,
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
  previewDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
  },
  actionButtons: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    gap: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    height: 52,
    borderRadius: 16,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      },
      default: {},
    }),
  },
  buttonContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  createButton: {
    backgroundColor: '#4F46E5',
  },
  finishButton: {
    backgroundColor: '#10B981',
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
  },
  actionRow: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...Platform.select({
      ios: {
        bottom: 12,
      },
      android: {
        bottom: 12,
      },
    }),
  },
  audioButtonWrapper: {
    height: 32,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        ':hover': {
          opacity: 0.8,
        },
      },
      default: {
        bottom: 4,
      }
    }),
  },
  audioSegments: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
  },
  badge: {
    position: 'absolute',
    right: 20,
    top: 20,
  },
}); 