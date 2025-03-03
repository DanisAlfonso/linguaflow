import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, Animated } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDeck, updateDeck, deleteDeck } from '../../../../lib/services/flashcards';
import { checkNetworkStatus } from '../../../../lib/utils/network';
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
  const [isOnline, setIsOnline] = useState(true);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  // Check network status on mount and when component updates
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkNetworkStatus();
      setIsOnline(online);
    };
    
    checkNetwork();
    
    // Set up interval to check network status
    const interval = setInterval(checkNetwork, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDeck = useCallback(async () => {
    try {
      const online = await checkNetworkStatus();
      setIsOnline(online);
      
      const deckId = id as string;
      console.log(`📊 [EDIT DECK] Loading deck ${deckId} in ${online ? 'online' : 'offline'} mode`);
      console.log(`📊 [EDIT DECK] Deck ID details:`, {
        id: deckId,
        isRemoteId: deckId.includes('-') && deckId.length > 30,
        length: deckId.length
      });
      
      const data = await getDeck(deckId);
      if (!data) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Deck not found',
        });
        router.back();
        return;
      }

      console.log(`📊 [EDIT DECK] Successfully loaded deck`, { 
        id: data.id,
        remoteId: (data as any).remote_id,
        name: data.name, 
        tags: data.tags
      });
      
      setDeck(data);
      setName(data.name);
      setDescription(data.description || '');
      setTags(data.tags?.join(', ') || '');
    } catch (error) {
      console.error('❌ [EDIT DECK] Error loading deck:', error);
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
      // Check network status before saving
      const online = await checkNetworkStatus();
      setIsOnline(online);
      
      const deckId = id as string;
      console.log(`📊 [EDIT DECK] Saving deck ${deckId} in ${online ? 'online' : 'offline'} mode`);
      console.log(`📊 [EDIT DECK] Saving with ID details:`, {
        id: deckId,
        isRemoteId: deckId.includes('-') && deckId.length > 30,
        length: deckId.length,
        originalDeckId: deck?.id
      });
      
      const updatedData = {
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
      };
      
      // Use the deck's ID from state if available, otherwise use the route param
      const idToUse = deck?.id || deckId;
      console.log(`📊 [EDIT DECK] Using ID for update:`, idToUse);
      
      const updatedDeck = await updateDeck(idToUse, updatedData);
      
      console.log(`✅ [EDIT DECK] Successfully saved deck`, { 
        id: updatedDeck.id,
        name: updatedDeck.name,
        online
      });

      Toast.show({
        type: 'success',
        text1: online ? 'Success' : 'Saved Offline',
        text2: online 
          ? 'Deck updated successfully' 
          : 'Deck updated locally. Changes will sync when you go back online.',
      });

      router.back();
    } catch (error) {
      console.error('❌ [EDIT DECK] Error updating deck:', error);
      
      // Determine if it's an offline error
      const errorMessage = error instanceof Error ? error.message : 'Failed to update deck';
      const isOfflineError = errorMessage.includes('offline');
      
      Toast.show({
        type: 'error',
        text1: isOfflineError ? 'Offline' : 'Error',
        text2: errorMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deck) return;

    // Confirm before deleting
    if (!confirm(`Are you sure you want to delete "${deck.name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      // Check network status before deletion
      const online = await checkNetworkStatus();
      setIsOnline(online);
      
      console.log(`📊 [EDIT DECK] Deleting deck ${id as string} in ${online ? 'online' : 'offline'} mode`);
      
      await deleteDeck(id as string);
      
      console.log(`✅ [EDIT DECK] Successfully deleted deck`, { 
        id: id as string,
        name: deck.name,
        online
      });

      Toast.show({
        type: 'success',
        text1: online ? 'Deck Deleted' : 'Deck Marked for Deletion',
        text2: online 
          ? 'Deck has been deleted' 
          : 'Deck marked for deletion. It will be removed from the server when you go back online.',
      });

      router.push('/flashcards');
    } catch (error) {
      console.error('❌ [EDIT DECK] Error deleting deck:', error);
      
      // Determine if it's an offline error
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete deck';
      const isOfflineError = errorMessage.includes('offline');
      
      Toast.show({
        type: 'error',
        text1: isOfflineError ? 'Offline' : 'Error',
        text2: errorMessage,
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
          
          {/* Network status indicator */}
          <View style={styles.networkIndicator}>
            <View 
              style={[
                styles.statusDot, 
                { backgroundColor: isOnline ? '#4ade80' : '#f87171' }
              ]} 
            />
            <Text style={[styles.networkStatus, { color: theme.colors.grey4 }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
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
              <View style={[styles.deleteButtonContainer, { backgroundColor: '#DC262615' }]}>
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
                    color="#DC2626"
                    style={styles.buttonIcon}
                  />
                  <Text style={[styles.buttonText, { color: '#DC2626' }]}>
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
  },
  buttonIcon: {
    marginRight: 8,
  },
  deleteButton: {
    height: 56,
    borderWidth: 0,
  },
  deleteButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButton: {
    height: 56,
    borderWidth: 0,
  },
  saveButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
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
  networkIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    top: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 