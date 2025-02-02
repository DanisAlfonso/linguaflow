import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../../components/layout/Container';
import { getCard, updateCard, deleteCard } from '../../../../../lib/api/flashcards';
import type { Card } from '../../../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function CardDetailsScreen() {
  const [card, setCard] = useState<Card | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const router = useRouter();
  const { id, cardId } = useLocalSearchParams();
  const { theme } = useTheme();

  const loadCard = useCallback(async () => {
    try {
      const data = await getCard(cardId as string);
      if (!data) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Card not found',
        });
        router.back();
        return;
      }

      setCard(data);
      setFront(data.front);
      setBack(data.back);
      setNotes(data.notes || '');
      setTags(data.tags?.join(', ') || '');
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
  }, [cardId, router]);

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

    setSaving(true);
    try {
      await updateCard(cardId as string, {
        front: front.trim(),
        back: back.trim(),
        notes: notes.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
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
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
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
                card.notes && (
                  <Text style={[styles.content, { color: theme.colors.grey3 }]}>
                    {card.notes}
                  </Text>
                )
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
                card.tags && card.tags.length > 0 && (
                  <View style={styles.tags}>
                    {card.tags.map((tag, index) => (
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
                )
              )}
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
                        color="#4F46E5"
                        style={styles.buttonIcon}
                      />
                    }
                    buttonStyle={styles.secondaryButton}
                    containerStyle={[styles.secondaryButtonContainer, { backgroundColor: '#4F46E515' }]}
                    titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
                    onPress={() => setIsEditing(false)}
                  />
                  <Button
                    title="Save Changes"
                    loading={saving}
                    icon={
                      <MaterialIcons
                        name="save"
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
                    title="Edit Card"
                    type="clear"
                    icon={
                      <MaterialIcons
                        name="edit"
                        size={20}
                        color="#4F46E5"
                        style={styles.buttonIcon}
                      />
                    }
                    buttonStyle={styles.secondaryButton}
                    containerStyle={[styles.secondaryButtonContainer, { backgroundColor: '#4F46E515' }]}
                    titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
                    onPress={() => setIsEditing(true)}
                  />
                  <Button
                    title="Delete Card"
                    loading={deleting}
                    icon={
                      <MaterialIcons
                        name="delete"
                        size={20}
                        color="white"
                        style={styles.buttonIcon}
                      />
                    }
                    type="clear"
                    buttonStyle={styles.primaryButton}
                    containerStyle={[styles.primaryButtonContainer, { backgroundColor: '#DC2626' }]}
                    titleStyle={styles.primaryButtonText}
                    onPress={handleDelete}
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
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  content: {
    fontSize: 16,
    lineHeight: 24,
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
}); 