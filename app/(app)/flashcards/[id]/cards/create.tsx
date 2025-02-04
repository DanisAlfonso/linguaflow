import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
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

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const isMandarin = deck?.language === 'Mandarin';

  useEffect(() => {
    const loadDeck = async () => {
      try {
        const deckData = await getDeck(id as string);
        setDeck(deckData);
        if (deckData?.language === 'Mandarin' && deckData.settings?.defaultCharacterSize) {
          setCharacterSize(deckData.settings.defaultCharacterSize);
        }
      } catch (error) {
        console.error('Error loading deck:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load deck information',
        });
      }
    };
    loadDeck();
  }, [id]);

  const handleCreateCard = async () => {
    if (!front.trim() || !back.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Front and back of the card are required',
      });
      return;
    }

    setLoading(true);
    try {
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
      setCreatedCard(card.id);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Card created successfully',
      });
    } catch (error) {
      console.error('Error creating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create card',
      });
    } finally {
      setLoading(false);
    }
  };

  // Add a debug effect to monitor createdCard state
  useEffect(() => {
    console.log('CreatedCard state changed to:', createdCard);
  }, [createdCard]);

  const handleFinish = () => {
    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: 'Card saved successfully',
    });
    router.back();
  };

  const handleAudioAttached = async () => {
    // If card doesn't exist yet, create it first
    if (!createdCard) {
      if (!front.trim() || !back.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Front and back of the card are required before adding audio',
        });
        return;
      }

      setLoading(true);
      try {
        console.log('Creating card before audio attachment...');
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
        console.log('Card created for audio:', card);
        setCreatedCard(card.id);
      } catch (error) {
        console.error('Error creating card:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to create card. Please try again.',
        });
        return;
      } finally {
        setLoading(false);
      }
    }

    // Now that we have a card ID, reload the audio segments
    try {
      console.log('Loading audio segments for card:', createdCard);
      const segments = await getCardAudioSegments(createdCard!);
      setFrontAudioSegments(segments.filter(s => s.side === 'front'));
      setBackAudioSegments(segments.filter(s => s.side === 'back'));
    } catch (error) {
      console.error('Error loading audio segments:', error);
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
            Add Card
          </Text>
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
                  <View>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
                        Front
                      </Text>
                      <MandarinCardInput
                        value={front}
                        onChangeText={setFront}
                        onMandarinDataChange={setFrontMandarinData}
                        placeholder="Front side of the card"
                        characterSize={characterSize}
                        audioButton={
                          <View style={styles.audioButton}>
                            <AudioAttachButton
                              cardId={createdCard || ''}
                              side="front"
                              onAudioAttached={handleAudioAttached}
                              onCreateCard={async () => {
                                if (!front.trim() || !back.trim()) {
                                  Toast.show({
                                    type: 'error',
                                    text1: 'Error',
                                    text2: 'Front and back of the card are required',
                                  });
                                  return '';
                                }
                                
                                try {
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
                                  setCreatedCard(card.id);
                                  return card.id;
                                } catch (error) {
                                  console.error('Error creating card:', error);
                                  Toast.show({
                                    type: 'error',
                                    text1: 'Error',
                                    text2: 'Failed to create card',
                                  });
                                  return '';
                                }
                              }}
                              disabled={!front.trim() || !back.trim()}
                            />
                          </View>
                        }
                      />
                      {frontAudioSegments.length > 0 && (
                        <View style={[styles.audioSegments, {
                          backgroundColor: Platform.select({
                            ios: 'rgba(0, 0, 0, 0.02)',
                            android: 'rgba(0, 0, 0, 0.04)',
                            default: 'rgba(0, 0, 0, 0.02)',
                          })
                        }]}>
                          <AudioEnabledText
                            text={front}
                            audioSegments={frontAudioSegments}
                            color={theme.colors.grey5}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
                        Back
                      </Text>
                      <MandarinCardInput
                        value={back}
                        onChangeText={setBack}
                        onMandarinDataChange={setBackMandarinData}
                        placeholder="Back side of the card"
                        characterSize={characterSize}
                        audioButton={
                          <View style={styles.audioButton}>
                            <AudioAttachButton
                              cardId={createdCard || ''}
                              side="back"
                              onAudioAttached={handleAudioAttached}
                              onCreateCard={async () => {
                                if (!front.trim() || !back.trim()) {
                                  Toast.show({
                                    type: 'error',
                                    text1: 'Error',
                                    text2: 'Front and back of the card are required',
                                  });
                                  return '';
                                }
                                
                                try {
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
                                  setCreatedCard(card.id);
                                  return card.id;
                                } catch (error) {
                                  console.error('Error creating card:', error);
                                  Toast.show({
                                    type: 'error',
                                    text1: 'Error',
                                    text2: 'Failed to create card',
                                  });
                                  return '';
                                }
                              }}
                              disabled={!front.trim() || !back.trim()}
                            />
                          </View>
                        }
                      />
                      {backAudioSegments.length > 0 && (
                        <View style={[styles.audioSegments, {
                          backgroundColor: Platform.select({
                            ios: 'rgba(0, 0, 0, 0.02)',
                            android: 'rgba(0, 0, 0, 0.04)',
                            default: 'rgba(0, 0, 0, 0.02)',
                          })
                        }]}>
                          <AudioEnabledText
                            text={back}
                            audioSegments={backAudioSegments}
                            color={theme.colors.grey5}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
                        Front
                      </Text>
                      <View style={styles.inputWrapper}>
                        <Input
                          placeholder="Front side of the card"
                          value={front}
                          onChangeText={setFront}
                          multiline
                          numberOfLines={3}
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
                          rightIcon={
                            <View style={styles.audioButton}>
                              <AudioAttachButton
                                cardId={createdCard || ''}
                                side="front"
                                onAudioAttached={handleAudioAttached}
                                onCreateCard={async () => {
                                  if (!front.trim() || !back.trim()) {
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Front and back of the card are required',
                                    });
                                    return '';
                                  }
                                  
                                  try {
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
                                    setCreatedCard(card.id);
                                    return card.id;
                                  } catch (error) {
                                    console.error('Error creating card:', error);
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Failed to create card',
                                    });
                                    return '';
                                  }
                                }}
                                disabled={!front.trim() || !back.trim()}
                              />
                            </View>
                          }
                        />
                      </View>
                      {frontAudioSegments.length > 0 && (
                        <View style={[styles.audioSegments, {
                          backgroundColor: Platform.select({
                            ios: 'rgba(0, 0, 0, 0.02)',
                            android: 'rgba(0, 0, 0, 0.04)',
                            default: 'rgba(0, 0, 0, 0.02)',
                          })
                        }]}>
                          <AudioEnabledText
                            text={front}
                            audioSegments={frontAudioSegments}
                            color={theme.colors.grey5}
                          />
                        </View>
                      )}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.grey5 }]}>
                        Back
                      </Text>
                      <View style={styles.inputWrapper}>
                        <Input
                          placeholder="Back side of the card"
                          value={back}
                          onChangeText={setBack}
                          multiline
                          numberOfLines={3}
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
                          rightIcon={
                            <View style={styles.audioButton}>
                              <AudioAttachButton
                                cardId={createdCard || ''}
                                side="back"
                                onAudioAttached={handleAudioAttached}
                                onCreateCard={async () => {
                                  if (!front.trim() || !back.trim()) {
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Front and back of the card are required',
                                    });
                                    return '';
                                  }
                                  
                                  try {
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
                                    setCreatedCard(card.id);
                                    return card.id;
                                  } catch (error) {
                                    console.error('Error creating card:', error);
                                    Toast.show({
                                      type: 'error',
                                      text1: 'Error',
                                      text2: 'Failed to create card',
                                    });
                                    return '';
                                  }
                                }}
                                disabled={!front.trim() || !back.trim()}
                              />
                            </View>
                          }
                        />
                      </View>
                      {backAudioSegments.length > 0 && (
                        <View style={[styles.audioSegments, {
                          backgroundColor: Platform.select({
                            ios: 'rgba(0, 0, 0, 0.02)',
                            android: 'rgba(0, 0, 0, 0.04)',
                            default: 'rgba(0, 0, 0, 0.02)',
                          })
                        }]}>
                          <AudioEnabledText
                            text={back}
                            audioSegments={backAudioSegments}
                            color={theme.colors.grey5}
                          />
                        </View>
                      )}
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
                  titleStyle={{ color: '#4F46E5', fontWeight: '600', fontSize: 17 }}
                  onPress={() => {
                    animatePress(previewButtonScale);
                    togglePreview();
                  }}
                />
              </Animated.View>
              
              {!createdCard ? (
                <Animated.View
                  style={[
                    styles.buttonContainer,
                    styles.createButton,
                    { transform: [{ scale: createButtonScale }] },
                  ]}
                >
                  <Button
                    title="Create Card"
                    loading={loading}
                    onPress={() => {
                      animatePress(createButtonScale);
                      handleCreateCard();
                    }}
                    type="clear"
                    buttonStyle={styles.button}
                    titleStyle={[styles.buttonTitle, { color: 'white' }]}
                  />
                </Animated.View>
              ) : (
                <Animated.View
                  style={[
                    styles.buttonContainer,
                    styles.createButton,
                    { transform: [{ scale: createButtonScale }] },
                  ]}
                >
                  <Button
                    title="Finish"
                    icon={
                      <MaterialIcons
                        name="check"
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
                    buttonStyle={styles.button}
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
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: -8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        ':focus-within': {
          borderColor: '#4F46E5',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.15,
          shadowRadius: 3,
          transform: [{translateY: -1}],
        },
      },
      default: {},
    }),
  },
  inputText: {
    fontSize: 17,
    lineHeight: 24,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
    paddingBottom: 16,
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
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: Platform.select({
      ios: 'rgba(0, 0, 0, 0.1)',
      android: 'rgba(0, 0, 0, 0.12)',
      default: 'rgba(0, 0, 0, 0.1)',
    }),
    marginTop: 'auto',
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
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        ':hover': {
          transform: [{translateY: -1}],
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.15,
          shadowRadius: 3,
        },
        ':active': {
          transform: [{translateY: 0}],
          shadowOffset: {
            width: 0,
            height: 1,
          },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
      },
      default: {},
    }),
  },
  buttonTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  audioButton: {
    padding: 8,
    marginRight: 8,
    marginTop: Platform.OS === 'web' ? 8 : 0,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : '#FFFFFF',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  audioSegments: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
  },
  createButton: {
    backgroundColor: '#4F46E5',
  },
  buttonWrapper: {
    flex: 1,
  },
  buttonPressed: {
    opacity: Platform.OS === 'ios' ? 0.8 : 1,
  },
}); 