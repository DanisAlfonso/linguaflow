import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, Animated } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDeck, updateDeck, deleteDeck } from '../../../../lib/api/flashcards';
import type { Deck } from '../../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function EditDeckScreen() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isSaveHovered, setIsSaveHovered] = useState(false);
  const [deleteTooltipOpacity] = useState(new Animated.Value(0));
  const [saveTooltipOpacity] = useState(new Animated.Value(0));

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const loadDeck = useCallback(async () => {
    try {
      const data = await getDeck(id as string);
      if (!data) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Deck not found',
        });
        router.back();
        return;
      }

      setDeck(data);
      setName(data.name);
      setDescription(data.description || '');
      setTags(data.tags?.join(', ') || '');
    } catch (error) {
      console.error('Error loading deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load deck',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Deck name is required',
      });
      return;
    }

    setSaving(true);
    try {
      await updateDeck(id as string, {
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Deck updated successfully',
      });

      router.back();
    } catch (error) {
      console.error('Error updating deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update deck',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDeck(id as string);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Deck deleted successfully',
      });

      router.replace('/(app)/flashcards/');
    } catch (error) {
      console.error('Error deleting deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete deck',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Animate tooltip opacity for Delete
  useEffect(() => {
    Animated.timing(deleteTooltipOpacity, {
      toValue: isDeleteHovered ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isDeleteHovered]);

  // Animate tooltip opacity for Save
  useEffect(() => {
    Animated.timing(saveTooltipOpacity, {
      toValue: isSaveHovered ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isSaveHovered]);

  // Add keyboard shortcuts
  useEffect(() => {
    if (!isWeb) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Save Changes shortcut (Cmd/Ctrl + S)
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        if (!saving) {
          handleSave();
        }
      }

      // Delete shortcut (Cmd/Ctrl + D)
      if (e.key === 'd' && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        if (!deleting) {
          handleDelete();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isWeb, handleSave, handleDelete, saving, deleting]);

  if (loading || !deck) {
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
            Edit Deck
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Deck Name
              </Text>
              <Input
                placeholder="Enter deck name"
                value={name}
                onChangeText={setName}
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

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Description
              </Text>
              <Input
                placeholder="Enter deck description"
                value={description}
                onChangeText={setDescription}
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

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Tags
              </Text>
              <Input
                placeholder="Enter tags (comma separated)"
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

            <View style={styles.actions}>
              <View style={[styles.deleteButtonContainer, { backgroundColor: '#DC2626' }]}>
                <Pressable
                  onHoverIn={() => isWeb && setIsDeleteHovered(true)}
                  onHoverOut={() => isWeb && setIsDeleteHovered(false)}
                  onPress={handleDelete}
                  disabled={deleting}
                  style={[styles.deleteButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                >
                  <MaterialIcons
                    name="delete"
                    size={20}
                    color="white"
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.buttonText, { color: 'white' }]}>
                    Delete Deck
                  </Text>
                  {isWeb && (
                    <Animated.View
                      style={[
                        styles.tooltip,
                        { opacity: deleteTooltipOpacity }
                      ]}
                    >
                      <View style={styles.tooltipContent}>
                        <View style={styles.tooltipIconContainer}>
                          <MaterialIcons
                            name="keyboard"
                            size={16}
                            color="#A5B4FC"
                          />
                        </View>
                        <Text style={styles.tooltipText}>
                          Press <Text style={styles.tooltipShortcut}>{Platform.OS === 'macos' ? '⌘D' : 'Ctrl+D'}</Text>
                        </Text>
                      </View>
                      <View style={styles.tooltipArrow} />
                    </Animated.View>
                  )}
                </Pressable>
              </View>
              <View style={[styles.saveButtonContainer, { backgroundColor: '#4F46E5' }]}>
                <Pressable
                  onHoverIn={() => isWeb && setIsSaveHovered(true)}
                  onHoverOut={() => isWeb && setIsSaveHovered(false)}
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.saveButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                >
                  <MaterialIcons
                    name="save"
                    size={20}
                    color="white"
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.buttonText, { color: 'white' }]}>
                    Save Changes
                  </Text>
                  {isWeb && (
                    <Animated.View
                      style={[
                        styles.tooltip,
                        { opacity: saveTooltipOpacity }
                      ]}
                    >
                      <View style={styles.tooltipContent}>
                        <View style={styles.tooltipIconContainer}>
                          <MaterialIcons
                            name="keyboard"
                            size={16}
                            color="#A5B4FC"
                          />
                        </View>
                        <Text style={styles.tooltipText}>
                          Press <Text style={styles.tooltipShortcut}>{Platform.OS === 'macos' ? '⌘S' : 'Ctrl+S'}</Text>
                        </Text>
                      </View>
                      <View style={styles.tooltipArrow} />
                    </Animated.View>
                  )}
                </Pressable>
              </View>
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
    gap: 40,
  },
  inputContainer: {
    gap: 12,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    position: 'relative',
    zIndex: 2,
  },
  buttonIcon: {
    marginRight: 8,
  },
  deleteButton: {
    height: 48,
    borderWidth: 0,
  },
  deleteButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
  },
  saveButton: {
    height: 48,
    borderWidth: 0,
  },
  saveButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  tooltip: {
    position: 'absolute',
    top: -48,
    left: '50%',
    transform: [{ translateX: -75 }],
    width: 150,
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    zIndex: 1000,
    pointerEvents: 'none',
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  tooltipIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(165, 180, 252, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '500',
  },
  tooltipShortcut: {
    color: '#A5B4FC',
    fontWeight: '600',
    padding: 2,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(165, 180, 252, 0.1)',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 0,
    borderLeftWidth: 8,
    borderTopColor: 'rgba(30, 41, 59, 0.95)',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
}); 