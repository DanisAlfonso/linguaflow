import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable, RefreshControl, Switch } from 'react-native';
import { Text, Button, useTheme, Overlay, Input } from '@rneui/themed';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Container } from '../../../components/layout/Container';
import { getDecks, updateDeck, deleteDeck } from '../../../lib/services/flashcards';
import type { Deck } from '../../../types/flashcards';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import { useDatabase } from '../../../contexts/DatabaseContext';
import { useAuth } from '../../../contexts/AuthContext';

// Add gradient presets with names
type GradientPreset = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

const GRADIENT_PRESETS: Record<GradientPreset, { colors: [string, string], name: string }> = {
  blue: { colors: ['#4F46E5', '#818CF8'], name: 'Blue' },
  purple: { colors: ['#7C3AED', '#A78BFA'], name: 'Purple' },
  green: { colors: ['#059669', '#34D399'], name: 'Green' },
  orange: { colors: ['#EA580C', '#FB923C'], name: 'Orange' },
  pink: { colors: ['#DB2777', '#F472B6'], name: 'Pink' },
} as const;

const GRADIENT_KEYS = Object.keys(GRADIENT_PRESETS) as GradientPreset[];

const getColorPreset = (deck: Deck, index: number): GradientPreset => {
  if (deck.color_preset && GRADIENT_KEYS.includes(deck.color_preset)) {
    return deck.color_preset;
  }
  return GRADIENT_KEYS[index % GRADIENT_KEYS.length];
};

export default function FlashcardsScreen() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const router = useRouter();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const { isOnline, syncData } = useDatabase();
  const { user } = useAuth();

  const loadDecks = async () => {
    try {
      if (!user) {
        console.error('Cannot load decks: user is not authenticated');
        Toast.show({
          type: 'error',
          text1: 'Authentication Error',
          text2: 'Please sign in again',
        });
        router.replace('/sign-in');
        return;
      }
      
      // If we're online, try to sync offline changes first
      if (isOnline && Platform.OS !== 'web') {
        try {
          await syncData();
        } catch (syncError) {
          console.error('Error syncing offline data:', syncError);
          // Continue loading decks even if sync fails
        }
      }
      
      const data = await getDecks(user.id);
      setDecks(data);
    } catch (error) {
      console.error('Error loading decks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load decks',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadDecks();
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDecks();
  }, []);

  const handleCreateDeck = () => {
    router.push('/flashcards/create');
  };

  const handleDeckPress = (deckId: string) => {
    router.push(`/flashcards/${deckId}`);
  };

  const handleLongPressDeck = (deckId: string, event: any) => {
    // Get the position of the pressed element for menu placement
    if (event?.nativeEvent) {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      setMenuPosition({
        x: pageX - locationX,
        y: pageY - locationY,
        width: 220, // Fixed menu width
        height: 0,
      });
    }
    setEditingDeckId(deckId);
  };

  const handleMenuOptionPress = (option: 'color' | 'addCards' | 'rename' | 'delete') => {
    if (!editingDeckId) return;

    if (option === 'color') {
      setShowColorPicker(true);
    } else if (option === 'addCards') {
      router.push(`/flashcards/${editingDeckId}/cards/create`);
      setEditingDeckId(null);
    } else if (option === 'rename') {
      const deck = decks.find(d => d.id === editingDeckId);
      if (deck) {
        setNewDeckName(deck.name);
        setShowRename(true);
      }
    } else if (option === 'delete') {
      handleDeleteDeck(editingDeckId);
    }
  };

  const handleChangeColor = async (deckId: string, colorKey: GradientPreset) => {
    try {
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return;

      await updateDeck(deckId, {
        ...deck,
        color_preset: colorKey
      });

      setDecks(prevDecks => 
        prevDecks.map(d => 
          d.id === deckId ? { ...d, color_preset: colorKey } : d
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: isOnline ? 'Color updated successfully' : 'Color updated successfully (offline). Will sync when online.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update color',
      });
    } finally {
      setShowColorPicker(false);
      setEditingDeckId(null);
    }
  };

  const handleRenameDeck = async () => {
    if (!editingDeckId || !newDeckName.trim()) return;

    try {
      const deck = decks.find(d => d.id === editingDeckId);
      if (!deck) return;

      await updateDeck(editingDeckId, {
        ...deck,
        name: newDeckName.trim()
      });

      setDecks(prevDecks => 
        prevDecks.map(d => 
          d.id === editingDeckId ? { ...d, name: newDeckName.trim() } : d
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: isOnline ? 'Deck renamed successfully' : 'Deck renamed successfully (offline). Will sync when online.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to rename deck',
      });
    } finally {
      setShowRename(false);
      setEditingDeckId(null);
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    try {
      await deleteDeck(deckId);
      
      // Update local state
      setDecks(prevDecks => prevDecks.filter(d => d.id !== deckId));

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: isOnline ? 'Deck deleted successfully' : 'Deck deleted successfully (offline). Will sync when online.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete deck',
      });
    } finally {
      setEditingDeckId(null);
    }
  };

  const handleCloseMenu = () => {
    setEditingDeckId(null);
    setShowColorPicker(false);
    setShowRename(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Container>
          <View style={styles.header}>
            <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
              Flashcards
            </Text>
          </View>
          <Text style={[styles.loadingText, { color: theme.colors.grey3 }]}>
            Loading decks...
          </Text>
        </Container>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <View style={styles.header}>
          <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
            Flashcards
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.createButton,
              { opacity: pressed ? 0.9 : 1 }
            ]}
            onPress={handleCreateDeck}
          >
            <Text style={styles.buttonText}>Create Deck</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.grey4}
              colors={['#4F46E5']} // Android
              progressBackgroundColor={theme.mode === 'dark' ? '#1F2937' : '#F3F4F6'} // Android
              progressViewOffset={8} // Android
              style={{ backgroundColor: 'transparent' }}
            />
          }
        >
          {decks.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="library-books"
                size={48}
                color={theme.colors.grey3}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyTitle, { color: theme.colors.grey4 }]}>
                No Decks Yet
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.grey3 }]}>
                Create your first deck to get started!
              </Text>
            </View>
          ) : (
            decks.map((deck, index) => (
              <React.Fragment key={deck.id}>
                <Pressable
                  style={({ pressed }) => [
                    styles.deckCard,
                    {
                      transform: [
                        { scale: pressed ? 0.98 : 1 },
                        { translateY: pressed ? 0 : isWeb ? -4 : 0 },
                      ],
                    },
                  ]}
                  onPress={() => handleDeckPress(deck.id)}
                  onLongPress={(event) => handleLongPressDeck(deck.id, event)}
                >
                  <LinearGradient
                    colors={GRADIENT_PRESETS[getColorPreset(deck, index)].colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.deckGradient}
                  >
                    <View style={styles.deckInfo}>
                      <Text style={styles.deckName}>
                        {deck.name}
                      </Text>
                      {deck.description && (
                        <Text style={styles.deckDescription}>
                          {deck.description}
                        </Text>
                      )}
                    </View>

                    <View style={styles.deckStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statNumber}>
                          {deck.total_cards}
                        </Text>
                        <Text style={styles.statLabel}>
                          Total Cards
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={[styles.statNumber, styles.statNew]}>
                          {deck.new_cards}
                        </Text>
                        <Text style={styles.statLabel}>
                          New
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={[styles.statNumber, styles.statReview]}>
                          {deck.cards_to_review}
                        </Text>
                        <Text style={styles.statLabel}>
                          To Review
                        </Text>
                      </View>
                    </View>

                    {deck.tags && deck.tags.length > 0 && (
                      <View style={styles.deckTags}>
                        {deck.tags.map((tag, index) => (
                          <View
                            key={index}
                            style={styles.tag}
                          >
                            <Text style={styles.tagText}>
                              {tag}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
                
                {editingDeckId === deck.id && (
                  <Overlay
                    isVisible={true}
                    onBackdropPress={handleCloseMenu}
                    overlayStyle={styles.overlayContainer}
                    backdropStyle={styles.backdrop}
                    animationType="fade"
                  >
                    <Pressable 
                      style={StyleSheet.absoluteFill}
                      onPress={handleCloseMenu}
                    >
                      <View style={StyleSheet.absoluteFill}>
                        <BlurView 
                          intensity={30} 
                          style={StyleSheet.absoluteFill}
                          tint={theme.mode === 'dark' ? 'dark' : 'light'}
                        />
                      </View>
                    </Pressable>
                    <View 
                      style={[
                        styles.contextMenu,
                        {
                          position: 'absolute',
                          left: menuPosition.x,
                          top: menuPosition.y,
                          width: menuPosition.width,
                          opacity: 1,
                          backgroundColor: Platform.OS === 'ios' 
                            ? 'rgba(250, 250, 250, 0.8)' 
                            : theme.mode === 'dark' 
                              ? 'rgba(30, 30, 30, 0.95)'
                              : 'rgba(255, 255, 255, 0.95)',
                        },
                      ]}
                    >
                      <Pressable onPress={(e) => e.stopPropagation()}>
                        {!showColorPicker && !showRename ? (
                          // Main Menu
                          <>
                            <Pressable
                              style={({ pressed }) => [
                                styles.menuOption,
                                pressed && styles.menuOptionPressed,
                              ]}
                              onPress={() => handleMenuOptionPress('color')}
                            >
                              <MaterialIcons 
                                name="palette" 
                                size={20} 
                                color={theme.colors.grey4}
                              />
                              <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                                Choose Color
                              </Text>
                              <MaterialIcons 
                                name="chevron-right" 
                                size={20} 
                                color={theme.colors.grey4}
                                style={styles.menuOptionIcon} 
                              />
                            </Pressable>
                            <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                            <Pressable
                              style={({ pressed }) => [
                                styles.menuOption,
                                pressed && styles.menuOptionPressed,
                              ]}
                              onPress={() => handleMenuOptionPress('addCards')}
                            >
                              <MaterialIcons 
                                name="add-circle-outline" 
                                size={20} 
                                color={theme.colors.grey4}
                              />
                              <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                                Add Cards
                              </Text>
                            </Pressable>
                            <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                            <Pressable
                              style={({ pressed }) => [
                                styles.menuOption,
                                pressed && styles.menuOptionPressed,
                              ]}
                              onPress={() => handleMenuOptionPress('rename')}
                            >
                              <MaterialIcons 
                                name="edit" 
                                size={20} 
                                color={theme.colors.grey4}
                              />
                              <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                                Rename
                              </Text>
                            </Pressable>
                            <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                            <Pressable
                              style={({ pressed }) => [
                                styles.menuOption,
                                pressed && styles.menuOptionPressed,
                              ]}
                              onPress={() => handleMenuOptionPress('delete')}
                            >
                              <MaterialIcons 
                                name="delete-outline" 
                                size={20} 
                                color="#DC2626" 
                              />
                              <Text style={[styles.menuOptionText, { color: "#DC2626" }]}>
                                Delete Deck
                              </Text>
                            </Pressable>
                          </>
                        ) : showRename ? (
                          // Rename Interface
                          <>
                            <View style={styles.colorPickerHeader}>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.backButton,
                                  pressed && styles.backButtonPressed,
                                ]}
                                onPress={() => setShowRename(false)}
                              >
                                <MaterialIcons 
                                  name="arrow-back" 
                                  size={20} 
                                  color={theme.colors.grey4} 
                                />
                              </Pressable>
                              <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
                                Rename Deck
                              </Text>
                            </View>
                            <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                            <View style={styles.renameContainer}>
                              <Input
                                value={newDeckName}
                                onChangeText={setNewDeckName}
                                placeholder="Enter deck name"
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleRenameDeck}
                                containerStyle={styles.renameInput}
                                inputContainerStyle={[
                                  styles.renameInputContainer,
                                  { borderColor: theme.colors.grey2 }
                                ]}
                                inputStyle={[
                                  styles.renameInputText,
                                  { color: theme.colors.grey4 }
                                ]}
                              />
                              <Pressable
                                style={({ pressed }) => [
                                  styles.renameButton,
                                  pressed && styles.renameButtonPressed,
                                ]}
                                onPress={handleRenameDeck}
                              >
                                <Text style={styles.renameButtonText}>
                                  Save
                                </Text>
                              </Pressable>
                            </View>
                          </>
                        ) : (
                          // Color Picker (existing code)
                          <>
                            <View style={styles.colorPickerHeader}>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.backButton,
                                  pressed && styles.backButtonPressed,
                                ]}
                                onPress={() => setShowColorPicker(false)}
                              >
                                <MaterialIcons 
                                  name="arrow-back" 
                                  size={20} 
                                  color={theme.colors.grey4} 
                                />
                              </Pressable>
                              <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
                                Choose Color
                              </Text>
                            </View>
                            <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                            {GRADIENT_KEYS.map((colorKey) => {
                              const isSelected = decks.find(d => d.id === editingDeckId)?.color_preset === colorKey;
                              return (
                                <Pressable
                                  key={colorKey}
                                  style={({ pressed }) => [
                                    styles.colorOption,
                                    pressed && styles.colorOptionPressed,
                                  ]}
                                  onPress={() => handleChangeColor(editingDeckId, colorKey)}
                                >
                                  <View style={styles.colorPreviewContainer}>
                                    <LinearGradient
                                      colors={GRADIENT_PRESETS[colorKey].colors}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 1 }}
                                      style={styles.colorPreview}
                                    />
                                  </View>
                                  <Text style={[
                                    styles.colorName,
                                    { color: theme.colors.grey4 },
                                    isSelected && styles.colorNameSelected
                                  ]}>
                                    {GRADIENT_PRESETS[colorKey].name}
                                  </Text>
                                  {isSelected && (
                                    <MaterialIcons 
                                      name="check" 
                                      size={20} 
                                      color={theme.colors.grey4}
                                      style={styles.checkIcon} 
                                    />
                                  )}
                                </Pressable>
                              );
                            })}
                          </>
                        )}
                      </Pressable>
                    </View>
                  </Overlay>
                )}
              </React.Fragment>
            ))
          )}
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
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingTop: 8,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },
  createButton: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    gap: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'web' ? 24 : 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 32,
  },
  deckCard: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
    }),
  },
  deckGradient: {
    padding: 24,
    gap: 20,
  },
  deckInfo: {
    gap: 8,
  },
  deckName: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  deckDescription: {
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  deckStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statNew: {
    color: '#4ADE80',
  },
  statReview: {
    color: '#818CF8',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  deckTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlayContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    padding: 0,
  },
  backdrop: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)',
  },
  contextMenu: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuOptionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  menuOptionIcon: {
    marginLeft: 'auto',
  },
  menuDivider: {
    height: 1,
    width: '100%',
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
    borderRadius: 12,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  colorOptionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  colorPreviewContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  colorPreview: {
    width: '100%',
    height: '100%',
  },
  colorName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  colorNameSelected: {
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  renameContainer: {
    padding: 12,
    gap: 12,
  },
  renameInput: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  renameInputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  renameInputText: {
    fontSize: 16,
  },
  renameButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  renameButtonPressed: {
    opacity: 0.8,
  },
  renameButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 