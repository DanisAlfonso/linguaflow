import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Container } from '../../../components/layout/Container';
import { getDecks, updateDeck } from '../../../lib/api/flashcards';
import type { Deck } from '../../../types/flashcards';
import Toast from 'react-native-toast-message';

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
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  
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

  const handleLongPressDeck = (deckId: string) => {
    setEditingDeckId(deckId);
  };

  const handleChangeColor = async (deckId: string, colorKey: GradientPreset) => {
    try {
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return;

      await updateDeck(deckId, {
        ...deck,
        color_preset: colorKey
      });

      // Update local state
      setDecks(prevDecks => 
        prevDecks.map(d => 
          d.id === deckId ? { ...d, color_preset: colorKey } : d
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Color updated successfully',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to update color',
      });
    } finally {
      setEditingDeckId(null);
    }
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
                color="white"
                style={styles.buttonIcon}
              />
            }
            buttonStyle={styles.createButton}
            titleStyle={styles.buttonText}
            onPress={handleCreateDeck}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
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
                  onLongPress={() => handleLongPressDeck(deck.id)}
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
                  <View style={styles.colorPicker}>
                    {GRADIENT_KEYS.map((colorKey) => (
                      <Pressable
                        key={colorKey}
                        onPress={() => handleChangeColor(deck.id, colorKey)}
                        style={({ pressed }) => [
                          styles.colorOption,
                          pressed && styles.colorOptionPressed,
                        ]}
                      >
                        <LinearGradient
                          colors={GRADIENT_PRESETS[colorKey].colors}
                          style={styles.colorPreview}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                        <Text style={styles.colorName}>
                          {GRADIENT_PRESETS[colorKey].name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
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
    color: 'white',
  },
  createButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  scrollContent: {
    gap: 24,
    paddingTop: 16,
    paddingBottom: 24,
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
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    marginTop: -12,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  colorOption: {
    alignItems: 'center',
    gap: 8,
    opacity: 1,
  },
  colorOptionPressed: {
    opacity: 0.7,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  colorName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
}); 