import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable, Animated } from 'react-native';
import { Text, Button, Input, useTheme, Overlay } from '@rneui/themed';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Container } from '../../../components/layout/Container';
import { getDeck, getCards, deleteCard } from '../../../lib/services/flashcards';
import type { Card, Deck } from '../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function DeckScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddCardHovered, setIsAddCardHovered] = useState(false);
  const [isEditDeckHovered, setIsEditDeckHovered] = useState(false);
  const [tooltipOpacity] = useState(new Animated.Value(0));
  const [editTooltipOpacity] = useState(new Animated.Value(0));
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const loadDeckAndCards = useCallback(async () => {
    try {
      // First try to get the deck
      const deckData = await getDeck(id as string);
      
      if (!deckData) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Deck not found',
        });
        router.back();
        return;
      }
      
      setDeck(deckData);
      
      // Then try to get the cards
      try {
        const cardsData = await getCards(id as string);
        setCards(cardsData);
      } catch (cardsError) {
        console.error('Error loading cards:', cardsError);
        // If we're offline, we might not be able to get cards from the API
        // but we still want to show the deck
        Toast.show({
          type: 'warning',
          text1: 'Limited functionality',
          text2: 'Cards could not be loaded. Some features may be unavailable.',
        });
        setCards([]);
      }
    } catch (error) {
      console.error('Error loading deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load deck',
      });
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // Initial load
  useEffect(() => {
    loadDeckAndCards();
  }, [loadDeckAndCards]);

  // Refresh data when returning to the screen
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadDeckAndCards();
      }
    }, [loading, loadDeckAndCards])
  );

  const handleStartStudy = () => {
    if (!hasCardsToStudy) {
      Toast.show({
        type: 'info',
        text1: 'No cards to study',
        text2: 'All caught up! Come back later.',
      });
      return;
    }
    router.push(`/flashcards/${id}/study`);
  };

  const handleAddCard = () => {
    if (!deck) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please wait for deck to load',
      });
      return;
    }
    router.push(`/flashcards/${id}/cards/create`);
  };

  // Add keyboard shortcut for Add Card
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

      // Add Card shortcut (a)
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleAddCard();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isWeb, handleAddCard]);

  // Animate tooltip opacity
  useEffect(() => {
    Animated.timing(tooltipOpacity, {
      toValue: isAddCardHovered ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isAddCardHovered]);

  const handleEditDeck = () => {
    if (!deck) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please wait for deck to load',
      });
      return;
    }
    router.push(`/flashcards/${id}/edit`);
  };

  const handleCardPress = (cardId: string) => {
    router.push(`/flashcards/${id}/cards/${cardId}`);
  };

  const handleLongPressCard = (cardId: string, event: any) => {
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
    setEditingCardId(cardId);
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await deleteCard(cardId);
      
      // Update local state
      setCards(prevCards => prevCards.filter(c => c.id !== cardId));

      Toast.show({
        type: 'success',
        text1: 'Card deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting card:', error);
      
      // Check if it's an offline error
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete card';
      const isOfflineError = errorMessage.includes('offline');
      
      Toast.show({
        type: 'error',
        text1: isOfflineError ? 'Offline Mode' : 'Error',
        text2: errorMessage,
      });
    } finally {
      setEditingCardId(null);
    }
  };

  const handleCloseCardMenu = () => {
    setEditingCardId(null);
  };

  // Animate tooltip opacity for Edit Deck
  useEffect(() => {
    Animated.timing(editTooltipOpacity, {
      toValue: isEditDeckHovered ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isEditDeckHovered]);

  // Add keyboard shortcut for Edit Deck
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

      // Add Card shortcut (a)
      if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleAddCard();
      }

      // Edit Deck shortcut (e)
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleEditDeck();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isWeb, handleAddCard, handleEditDeck]);

  const filteredCards = cards.filter(
    (card) =>
      card.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const hasCards = (deck?.total_cards ?? 0) > 0;
  const hasCardsToStudy = hasCards && ((deck?.new_cards ?? 0) + (deck?.cards_to_review ?? 0) > 0);

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
            {deck.name}
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.overview}>
            <Text style={[styles.description, { color: theme.colors.grey3 }]}>
              {deck?.description}
            </Text>

            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.colors.grey5 }]}>
                  {deck?.total_cards ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>
                  Total Cards
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#059669' }]}>
                  {deck?.new_cards ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>
                  New
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: '#4F46E5' }]}>
                  {deck?.cards_to_review ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>
                  To Review
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Button
                title={hasCards ? (hasCardsToStudy ? "Study Now" : "Nothing to Study") : "Add Cards to Start"}
                icon={
                  hasCards && hasCardsToStudy ? (
                    <MaterialIcons
                      name="play-arrow"
                      size={20}
                      color="white"
                      style={styles.buttonIcon}
                    />
                  ) : (
                    <MaterialIcons
                      name="info-outline"
                      size={20}
                      color={hasCards ? theme.colors.grey3 : "white"}
                      style={styles.buttonIcon}
                    />
                  )
                }
                type="clear"
                disabled={!hasCardsToStudy}
                buttonStyle={[
                  styles.studyButton,
                  !hasCardsToStudy && { opacity: 0.7 }
                ]}
                containerStyle={[
                  styles.studyButtonContainer,
                  { 
                    backgroundColor: hasCards 
                      ? (hasCardsToStudy ? '#4F46E5' : theme.colors.grey1)
                      : '#4F46E5'
                  }
                ]}
                titleStyle={[
                  styles.studyButtonText,
                  !hasCardsToStudy && hasCards && { color: theme.colors.grey3 }
                ]}
                onPress={hasCards ? handleStartStudy : handleAddCard}
              />
              <View style={styles.secondaryActions}>
                <View style={[styles.secondaryButtonContainer, { backgroundColor: '#4F46E515' }]}>
                  <Pressable
                    onHoverIn={() => isWeb && setIsAddCardHovered(true)}
                    onHoverOut={() => isWeb && setIsAddCardHovered(false)}
                    onPress={handleAddCard}
                    style={[styles.secondaryButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                  >
                    <MaterialIcons
                      name="add"
                      size={20}
                      color="#4F46E5"
                      style={styles.buttonIcon}
                    />
                    <Text style={{ color: '#4F46E5', fontWeight: '600', fontSize: 16 }}>
                      Add Card
                    </Text>
                    {isWeb && (
                      <Animated.View
                        style={[
                          styles.tooltip,
                          { opacity: tooltipOpacity }
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
                            Press <Text style={styles.tooltipShortcut}>A</Text>
                          </Text>
                        </View>
                        <View style={styles.tooltipArrow} />
                      </Animated.View>
                    )}
                  </Pressable>
                </View>
                <View style={[styles.secondaryButtonContainer, { backgroundColor: '#4F46E515' }]}>
                  <Pressable
                    onHoverIn={() => isWeb && setIsEditDeckHovered(true)}
                    onHoverOut={() => isWeb && setIsEditDeckHovered(false)}
                    onPress={handleEditDeck}
                    style={[styles.secondaryButton, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                  >
                    <MaterialIcons
                      name="edit"
                      size={20}
                      color="#4F46E5"
                      style={styles.buttonIcon}
                    />
                    <Text style={{ color: '#4F46E5', fontWeight: '600', fontSize: 16 }}>
                      Edit Deck
                    </Text>
                    {isWeb && (
                      <Animated.View
                        style={[
                          styles.tooltip,
                          { opacity: editTooltipOpacity }
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
                            Press <Text style={styles.tooltipShortcut}>E</Text>
                          </Text>
                        </View>
                        <View style={styles.tooltipArrow} />
                      </Animated.View>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
              Cards
            </Text>
            {hasCards ? (
              <>
                <Input
                  placeholder="Search cards..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  leftIcon={
                    <MaterialIcons
                      name="search"
                      size={20}
                      color={theme.colors.grey3}
                    />
                  }
                  containerStyle={styles.searchContainer}
                  inputContainerStyle={[
                    styles.searchInput,
                    {
                      borderColor: theme.colors.grey2,
                      backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey0,
                    },
                  ]}
                  inputStyle={[
                    styles.searchText,
                    { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.black },
                  ]}
                  placeholderTextColor={theme.colors.grey3}
                />

                <View style={styles.cardList}>
                  {filteredCards.map((card) => (
                    <React.Fragment key={card.id}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.cardItem,
                          {
                            backgroundColor: theme.colors.grey0,
                            borderColor: theme.colors.grey2,
                            transform: [
                              { scale: pressed ? 0.98 : 1 },
                              { translateY: pressed ? 0 : isWeb ? -2 : 0 },
                            ],
                          },
                        ]}
                        onPress={() => handleCardPress(card.id)}
                        onLongPress={(event) => handleLongPressCard(card.id, event)}
                      >
                        <View style={styles.cardContent}>
                          <View style={styles.cardTexts}>
                            <Text style={[styles.cardFront, { color: theme.colors.grey5 }]}>
                              {card.front}
                            </Text>
                            <Text style={[styles.cardBack, { color: theme.colors.grey3 }]}>
                              {card.back}
                            </Text>
                          </View>
                          <MaterialIcons
                            name="chevron-right"
                            size={24}
                            color={theme.colors.grey3}
                          />
                        </View>

                        {card.tags && card.tags.length > 0 && (
                          <View style={styles.cardTags}>
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
                        )}
                      </Pressable>

                      {editingCardId === card.id && (
                        <Overlay
                          isVisible={true}
                          onBackdropPress={handleCloseCardMenu}
                          overlayStyle={styles.overlayContainer}
                          backdropStyle={styles.backdrop}
                          animationType="fade"
                        >
                          <Pressable 
                            style={StyleSheet.absoluteFill}
                            onPress={handleCloseCardMenu}
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
                              styles.menuContainer,
                              {
                                position: 'absolute',
                                left: menuPosition.x,
                                top: menuPosition.y,
                                width: menuPosition.width,
                                backgroundColor: Platform.OS === 'ios' 
                                  ? 'rgba(250, 250, 250, 0.8)' 
                                  : theme.mode === 'dark' 
                                    ? 'rgba(30, 30, 30, 0.95)'
                                    : 'rgba(255, 255, 255, 0.95)',
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
                            ]}
                          >
                            <Pressable
                              style={({ pressed }) => [
                                styles.menuOption,
                                pressed && styles.menuOptionPressed,
                              ]}
                              onPress={() => handleDeleteCard(card.id)}
                            >
                              <MaterialIcons 
                                name="delete-outline" 
                                size={20} 
                                color={theme.mode === 'dark' ? '#EF4444' : '#DC2626'} 
                              />
                              <Text style={[
                                styles.menuOptionText, 
                                { color: theme.mode === 'dark' ? '#EF4444' : '#DC2626' }
                              ]}>
                                Delete Card
                              </Text>
                            </Pressable>
                          </View>
                        </Overlay>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons
                  name="school"
                  size={48}
                  color={theme.colors.grey2}
                  style={styles.emptyIcon}
                />
                <Text style={[styles.emptyTitle, { color: theme.colors.grey4 }]}>
                  No Cards Yet
                </Text>
                <Text style={[styles.emptyText, { color: theme.colors.grey3 }]}>
                  Start by adding some cards to your deck
                </Text>
              </View>
            )}
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
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scrollContent: {
    gap: 32,
    paddingBottom: Platform.OS === 'web' ? 32 : 100,
  },
  overview: {
    gap: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  actions: {
    gap: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  studyButton: {
    height: 56,
    borderWidth: 0,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  studyButtonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  studyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    height: 48,
    borderWidth: 0,
  },
  secondaryButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
  },
  cardsSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 0,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: -8,
  },
  searchText: {
    fontSize: 16,
  },
  cardList: {
    gap: 12,
  },
  cardItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
    }),
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTexts: {
    flex: 1,
    marginRight: 16,
  },
  cardFront: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  cardBack: {
    fontSize: 14,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 240,
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
  menuContainer: {
    borderRadius: 14,
    overflow: 'hidden',
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
  },
}); 