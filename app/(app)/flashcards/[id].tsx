import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, Button, Input, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { getDeck, getCards } from '../../../lib/api/flashcards';
import type { Card, Deck } from '../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function DeckScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const loadDeckAndCards = useCallback(async () => {
    try {
      const [deckData, cardsData] = await Promise.all([
        getDeck(id as string),
        getCards(id as string),
      ]);

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
      setCards(cardsData);
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
    router.push(`/flashcards/${id}/study`);
  };

  const handleAddCard = () => {
    router.push(`/flashcards/${id}/cards/create`);
  };

  const handleEditDeck = () => {
    router.push(`/flashcards/${id}/edit`);
  };

  const handleCardPress = (cardId: string) => {
    router.push(`/flashcards/${id}/cards/${cardId}`);
  };

  const filteredCards = cards.filter(
    (card) =>
      card.front.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.back.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const hasCards = (deck?.total_cards ?? 0) > 0;
  const hasCardsToStudy = (deck?.new_cards ?? 0) + (deck?.cards_to_review ?? 0) > 0;

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
                <Button
                  title="Add Card"
                  type="clear"
                  icon={
                    <MaterialIcons
                      name="add"
                      size={20}
                      color="#4F46E5"
                      style={styles.buttonIcon}
                    />
                  }
                  buttonStyle={styles.secondaryButton}
                  containerStyle={[styles.secondaryButtonContainer, { backgroundColor: '#4F46E515' }]}
                  titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
                  onPress={handleAddCard}
                />
                <Button
                  title="Edit Deck"
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
                  onPress={handleEditDeck}
                />
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
                    <Pressable
                      key={card.id}
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
    overflow: 'hidden',
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
}); 