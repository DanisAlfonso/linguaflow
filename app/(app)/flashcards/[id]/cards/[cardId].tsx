import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Text, Input, Button, useTheme, Badge } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../../components/layout/Container';
import { updateCard, deleteCard } from '../../../../../lib/api/flashcards';
import { getCard, getDeck } from '../../../../../lib/services/flashcards';
import { getCardAudioSegments } from '../../../../../lib/services/audio';
import { getOfflineAudioSegments } from '../../../../../lib/api/offline-audio';
import { MandarinCardInput } from '../../../../../components/flashcards/MandarinCardInput';
import { CharacterSizeControl } from '../../../../../components/flashcards/CharacterSizeControl';
import { MandarinText } from '../../../../../components/flashcards/MandarinText';
import { FlashcardAudioSection } from '../../../../../components/flashcards/audio/FlashcardAudioSection';
import type { Card, Deck, MandarinCardData } from '../../../../../types/flashcards';
import type { CardAudioSegment } from '../../../../../types/audio';
import Toast from 'react-native-toast-message';
import NetInfo from '@react-native-community/netinfo';
import { AudioAttachButton } from '../../../../../components/flashcards/AudioAttachButton';

export default function CardDetailsScreen() {
  const [card, setCard] = useState<Card | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [characterSize, setCharacterSize] = useState(24);
  const [frontMandarinData, setFrontMandarinData] = useState<MandarinCardData>({ characters: [], pinyin: [] });
  const [backMandarinData, setBackMandarinData] = useState<MandarinCardData>({ characters: [], pinyin: [] });
  const [frontAudioSegments, setFrontAudioSegments] = useState<CardAudioSegment[]>([]);
  const [backAudioSegments, setBackAudioSegments] = useState<CardAudioSegment[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  
  const router = useRouter();
  const { id, cardId } = useLocalSearchParams();
  const { theme } = useTheme();
  const isMandarin = deck?.language === 'Mandarin';

  // Check network status
  useEffect(() => {
    const checkNetworkStatus = async () => {
      const networkStatus = await NetInfo.fetch();
      setIsOffline(!(networkStatus.isConnected && networkStatus.isInternetReachable));
    };
    
    checkNetworkStatus();
    
    // Subscribe to network status updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected && state.isInternetReachable));
    });
    
    return () => unsubscribe();
  }, []);

  const loadCard = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get deck data
      const deckData = await getDeck(id as string);
      setDeck(deckData);
      
      // Get card data
      const cardData = await getCard(cardId as string);
      if (!cardData) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Card not found',
        });
        router.back();
        return;
      }
      
      setCard(cardData);
      setFront(cardData.front);
      setBack(cardData.back);
      setNotes(cardData.notes || '');
      setTags(cardData.tags?.join(', ') || '');
      
      // Load audio segments based on network status
      let audioSegments: CardAudioSegment[] = [];
      
      try {
        if (isOffline) {
          console.log('🔄 [CARD DETAILS] Loading offline audio segments for card:', cardId);
          audioSegments = await getOfflineAudioSegments(cardId as string);
          console.log(`✅ [CARD DETAILS] Loaded ${audioSegments.length} offline audio segments`);
        } else {
          console.log('🔄 [CARD DETAILS] Loading online audio segments for card:', cardId);
          audioSegments = await getCardAudioSegments(cardId as string);
          console.log(`✅ [CARD DETAILS] Loaded ${audioSegments.length} online audio segments`);
        }
      } catch (audioError) {
        console.error('❌ [CARD DETAILS] Error loading audio segments:', audioError);
        // Continue even if audio loading fails
      }
      
      // Distribute audio segments by side
      const frontSegments = audioSegments.filter(s => s.side === 'front');
      const backSegments = audioSegments.filter(s => s.side === 'back');
      console.log(`🔄 [CARD DETAILS] Audio segments: ${frontSegments.length} front, ${backSegments.length} back`);
      
      setFrontAudioSegments(frontSegments);
      setBackAudioSegments(backSegments);

      if (deckData?.language === 'Mandarin') {
        if (deckData.settings?.defaultCharacterSize) {
          setCharacterSize(deckData.settings.defaultCharacterSize);
        }
        
        const mandarinData = cardData.language_specific_data?.mandarin;
        if (mandarinData) {
          setFrontMandarinData(mandarinData.front);
          setBackMandarinData(mandarinData.back);
        }
      }
    } catch (error) {
      console.error('Error loading card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load card',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  }, [cardId, id, router, isOffline]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Front and back of the card are required',
      });
      return;
    }

    if (isOffline) {
      Toast.show({
        type: 'info',
        text1: 'Offline Mode',
        text2: 'Editing card content is not available in offline mode, but you can still attach audio files.',
      });
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateCard(cardId as string, {
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

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Card updated successfully',
      });

      setIsEditing(false);
      loadCard();
    } catch (error) {
      console.error('Error updating card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update card',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isOffline) {
      Toast.show({
        type: 'info',
        text1: 'Offline Mode',
        text2: 'Deleting cards is not available in offline mode',
      });
      return;
    }

    setDeleting(true);
    try {
      await deleteCard(cardId as string);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Card deleted successfully',
      });

      router.back();
    } catch (error) {
      console.error('Error deleting card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete card',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Audio attachment handler
  const handleAudioAttached = useCallback((updatedCardId: string) => {
    console.log('🔄 [CARD DETAILS] Audio attached to card:', updatedCardId);
    loadCard(); // Reload card data to show the new audio
  }, [loadCard]);

  if (loading || !card) {
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
              Loading...
            </Text>
          </View>
        </Container>
      </SafeAreaView>
    );
  }

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
            {isEditing ? 'Edit Card' : 'Card Details'}
          </Text>
          
          {isOffline && (
            <>
              <Badge
                value="OFFLINE"
                status="warning"
                containerStyle={styles.offlineBadge}
                textStyle={styles.offlineBadgeText}
              />
              <Text style={styles.offlineInfo}>
                Audio files can be attached while offline and will sync when you reconnect.
              </Text>
            </>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
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
                {isEditing ? (
                  <>
                    <MandarinCardInput
                      label="Front"
                      value={front}
                      onChangeText={setFront}
                      onMandarinDataChange={setFrontMandarinData}
                      placeholder="Front side of the card"
                      characterSize={characterSize}
                    />

                    <MandarinCardInput
                      label="Back"
                      value={back}
                      onChangeText={setBack}
                      onMandarinDataChange={setBackMandarinData}
                      placeholder="Back side of the card"
                      characterSize={characterSize}
                    />
                  </>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                        Front
                      </Text>
                      <View style={[styles.contentCard, { 
                        backgroundColor: theme.colors.grey0,
                        borderColor: theme.colors.grey2,
                      }]}>
                        <MandarinText
                          data={card.language_specific_data?.mandarin?.front || frontMandarinData}
                          characterSize={characterSize}
                          color={theme.colors.grey5}
                        />
                      </View>
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                        Back
                      </Text>
                      <View style={[styles.contentCard, { 
                        backgroundColor: theme.colors.grey0,
                        borderColor: theme.colors.grey2,
                      }]}>
                        <MandarinText
                          data={card.language_specific_data?.mandarin?.back || backMandarinData}
                          characterSize={characterSize}
                          color={theme.colors.grey5}
                        />
                      </View>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                    Front
                  </Text>
                  {isEditing ? (
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
                  ) : (
                    <Text style={[styles.content, { color: theme.colors.grey5 }]}>
                      {card.front}
                    </Text>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                    Back
                  </Text>
                  {isEditing ? (
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
                  ) : (
                    <Text style={[styles.content, { color: theme.colors.grey5 }]}>
                      {card.back}
                    </Text>
                  )}
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Notes (Optional)
              </Text>
              {isEditing ? (
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
              ) : (
                <Text style={[styles.content, { color: theme.colors.grey5 }]}>
                  {card.notes || 'No notes'}
                </Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Tags (Optional)
              </Text>
              {isEditing ? (
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
              ) : (
                <View style={styles.tags}>
                  {card.tags?.map((tag, index) => (
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

            <View style={styles.form}>
              <FlashcardAudioSection
                label="Front Audio"
                audioSegments={frontAudioSegments}
                cardId={cardId as string}
                side="front"
                isEditing={isEditing}
                onAudioChange={loadCard}
              />

              <FlashcardAudioSection
                label="Back Audio"
                audioSegments={backAudioSegments}
                cardId={cardId as string}
                side="back"
                isEditing={isEditing}
                onAudioChange={loadCard}
              />
            </View>

            <View style={styles.actions}>
              {isEditing ? (
                <>
                  <Button
                    title="Cancel"
                    type="clear"
                    icon={
                      <MaterialIcons
                        name="close"
                        size={20}
                        color="#DC2626"
                        style={styles.buttonIcon}
                      />
                    }
                    buttonStyle={styles.secondaryButton}
                    containerStyle={[styles.secondaryButtonContainer, { backgroundColor: '#DC262615' }]}
                    titleStyle={{ color: '#DC2626', fontWeight: '600' }}
                    onPress={() => setIsEditing(false)}
                  />
                  <Button
                    title="Save"
                    loading={saving}
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
                    onPress={handleSave}
                  />
                </>
              ) : (
                <>
                  <Button
                    title="Delete"
                    loading={deleting}
                    icon={
                      <MaterialIcons
                        name="delete"
                        size={20}
                        color="#DC2626"
                        style={styles.buttonIcon}
                      />
                    }
                    type="clear"
                    buttonStyle={styles.secondaryButton}
                    containerStyle={[styles.secondaryButtonContainer, { backgroundColor: '#DC262615' }]}
                    titleStyle={{ color: '#DC2626', fontWeight: '600' }}
                    onPress={handleDelete}
                  />
                  <Button
                    title="Edit"
                    icon={
                      <MaterialIcons
                        name="edit"
                        size={20}
                        color="white"
                        style={styles.buttonIcon}
                      />
                    }
                    type="clear"
                    buttonStyle={styles.primaryButton}
                    containerStyle={[styles.primaryButtonContainer, { backgroundColor: '#4F46E5' }]}
                    titleStyle={styles.primaryButtonText}
                    onPress={() => setIsEditing(true)}
                  />
                </>
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
    paddingBottom: Platform.OS === 'ios' ? 120 : 90,
  },
  form: {
    gap: 32,
  },
  characterSizeControl: {
    marginBottom: 16,
  },
  inputContainer: {
    gap: 12,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    marginBottom: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
    marginLeft: 4,
  },
  contentCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  inputText: {
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 4,
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
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  offlineBadge: {
    backgroundColor: '#FFB700',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  offlineBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  offlineInfo: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8a8a8a',
  },
}); 