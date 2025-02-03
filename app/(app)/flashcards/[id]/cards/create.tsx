import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, TextInput } from 'react-native';
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
      console.log('Creating card...');
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
      console.log('Card created:', card);
      setCreatedCard(card.id);
      console.log('CreatedCard state set to:', card.id);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Card created! You can now add audio.',
      });
    } catch (error) {
      console.error('Error creating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create card. Please try again.',
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <View style={styles.header}>
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={theme.colors.grey5}
              />
            }
            onPress={() => router.back()}
            containerStyle={styles.backButton}
          />
          <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
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
                      <View style={styles.inputHeader}>
                        <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                          Front
                        </Text>
                        <View style={styles.audioButton}>
                          <AudioAttachButton
                            cardId={createdCard || ''}
                            side="front"
                            onAudioAttached={handleAudioAttached}
                          />
                        </View>
                      </View>
                      <MandarinCardInput
                        value={front}
                        onChangeText={setFront}
                        onMandarinDataChange={setFrontMandarinData}
                        placeholder="Front side of the card"
                        characterSize={characterSize}
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
                      <View style={styles.inputHeader}>
                        <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                          Back
                        </Text>
                        <View style={styles.audioButton}>
                          <AudioAttachButton
                            cardId={createdCard || ''}
                            side="back"
                            onAudioAttached={handleAudioAttached}
                          />
                        </View>
                      </View>
                      <MandarinCardInput
                        value={back}
                        onChangeText={setBack}
                        onMandarinDataChange={setBackMandarinData}
                        placeholder="Back side of the card"
                        characterSize={characterSize}
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
                      <View style={styles.inputHeader}>
                        <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                          Front
                        </Text>
                        <View style={styles.audioButton}>
                          <AudioAttachButton
                            cardId={createdCard || ''}
                            side="front"
                            onAudioAttached={handleAudioAttached}
                          />
                        </View>
                      </View>
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
                          placeholderTextColor={theme.colors.grey3}
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
                      <View style={styles.inputHeader}>
                        <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                          Back
                        </Text>
                        <View style={styles.audioButton}>
                          <AudioAttachButton
                            cardId={createdCard || ''}
                            side="back"
                            onAudioAttached={handleAudioAttached}
                          />
                        </View>
                      </View>
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
                          placeholderTextColor={theme.colors.grey3}
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
                  <Text style={[styles.label, { color: theme.colors.grey4 }]}>
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
                    placeholderTextColor={theme.colors.grey3}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.colors.grey4 }]}>
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
                    placeholderTextColor={theme.colors.grey3}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.preview}>
                <Pressable
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
                </Pressable>

                <View style={styles.previewDivider}>
                  <View
                    style={[styles.dividerLine, { backgroundColor: theme.colors.grey2 }]}
                  />
                  <Text style={[styles.dividerText, { color: theme.colors.grey3 }]}>
                    Tap to flip
                  </Text>
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

            <View style={styles.actions}>
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
                buttonStyle={styles.secondaryButton}
                containerStyle={[styles.secondaryButtonContainer, { backgroundColor: '#4F46E515' }]}
                titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
                onPress={togglePreview}
              />
              {!createdCard ? (
                <Button
                  title="Create Card"
                  loading={loading}
                  icon={
                    <MaterialIcons
                      name="add"
                      size={20}
                      color="white"
                      style={styles.buttonIcon}
                    />
                  }
                  type="clear"
                  buttonStyle={styles.primaryButton}
                  containerStyle={[styles.primaryButtonContainer, { backgroundColor: '#4F46E5' }]}
                  titleStyle={styles.primaryButtonText}
                  onPress={handleCreateCard}
                />
              ) : (
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
                  type="clear"
                  buttonStyle={styles.primaryButton}
                  containerStyle={[styles.primaryButtonContainer, { backgroundColor: '#4F46E5' }]}
                  titleStyle={styles.primaryButtonText}
                  onPress={handleFinish}
                />
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
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    gap: 24,
  },
  characterSizeControl: {
    marginBottom: 8,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  input: {
    paddingHorizontal: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: -8,
  },
  inputText: {
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  secondaryButton: {
    height: 48,
    borderWidth: 0,
  },
  secondaryButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    height: 48,
    borderWidth: 0,
  },
  primaryButtonContainer: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  audioButton: {
    marginRight: 4,
  },
  audioSegments: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
}); 