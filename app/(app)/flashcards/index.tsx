import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { getDecks } from '../../../lib/api/flashcards';
import type { Deck } from '../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function FlashcardsScreen() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  useFocusEffect(
    React.useCallback(() => {
      const loadDecks = async () => {
        try {
          const data = await getDecks();
          setDecks(data);
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load decks',
          });
        } finally {
          setLoading(false);
        }
      };

      loadDecks();
    }, [])
  );

  const handleCreateDeck = () => {
    router.push('/flashcards/create');
  };

  const handleDeckPress = (deckId: string) => {
    router.push(`/flashcards/${deckId}`);
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
          <Button
            title="Create Deck"
            icon={
              <MaterialIcons
                name="add"
                size={20}
                color="#4F46E5"
                style={styles.buttonIcon}
              />
            }
            type="clear"
            titleStyle={[styles.buttonText, { color: '#4F46E5' }]}
            buttonStyle={styles.createButton}
            onPress={handleCreateDeck}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {decks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: theme.colors.grey3 }]}>
                No decks yet. Create your first deck to get started!
              </Text>
            </View>
          ) : (
            decks.map((deck) => (
              <Pressable
                key={deck.id}
                style={({ pressed }) => [
                  styles.deckCard,
                  {
                    backgroundColor: theme.colors.grey0,
                    borderColor: theme.colors.grey2,
                    transform: [
                      { scale: pressed ? 0.98 : 1 },
                      { translateY: pressed ? 0 : isWeb ? -4 : 0 },
                    ],
                  },
                ]}
                onPress={() => handleDeckPress(deck.id)}
              >
                <View style={styles.deckInfo}>
                  <Text style={[styles.deckName, { color: theme.colors.grey5 }]}>
                    {deck.name}
                  </Text>
                  <Text style={[styles.deckDescription, { color: theme.colors.grey3 }]}>
                    {deck.description}
                  </Text>
                </View>

                <View style={styles.deckStats}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: theme.colors.grey5 }]}>
                      {deck.total_cards}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>
                      Total Cards
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#059669' }]}>
                      {deck.new_cards}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>
                      New
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, { color: '#4F46E5' }]}>
                      {deck.cards_to_review}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>
                      To Review
                    </Text>
                  </View>
                </View>

                {deck.tags && deck.tags.length > 0 && (
                  <View style={styles.deckTags}>
                    {deck.tags.map((tag, index) => (
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
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    height: 40,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },
  deckInfo: {
    gap: 4,
  },
  deckName: {
    fontSize: 20,
    fontWeight: '600',
  },
  deckDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  deckStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  deckTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
}); 