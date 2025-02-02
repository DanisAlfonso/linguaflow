import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Pressable, Animated, ViewStyle } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDueCards, reviewCard } from '../../../../lib/api/flashcards';
import { Rating } from '../../../../lib/spaced-repetition/fsrs';
import type { Card } from '../../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function StudyScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipAnim] = useState(new Animated.Value(0));
  const [cardsStudied, setCardsStudied] = useState(0);
  const [correctResponses, setCorrectResponses] = useState(0);
  const [startTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const loadCards = useCallback(async () => {
    try {
      console.log('Loading cards for deck:', id);
      const dueCards = await getDueCards(id as string);
      console.log('Loaded due cards:', dueCards);
      
      if (!dueCards || dueCards.length === 0) {
        console.log('No cards to review');
        Toast.show({
          type: 'info',
          text1: 'No cards to review',
          text2: 'All caught up! Come back later.',
        });
        router.back();
        return;
      }

      setCards(dueCards);
    } catch (error) {
      console.error('Error in loadCards:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to load cards',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const currentCard = cards[currentCardIndex];
  const progress = cards.length > 0 ? ((currentCardIndex) / cards.length) * 100 : 0;

  const flipCard = () => {
    setIsFlipped(!isFlipped);
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const handleResponse = async (rating: Rating) => {
    if (reviewing) return;
    setReviewing(true);

    try {
      await reviewCard(currentCard.id, rating);

      // Update statistics
      setCardsStudied(prev => prev + 1);
      if (rating === Rating.Good || rating === Rating.Easy) {
        setCorrectResponses(prev => prev + 1);
      }

      if (rating === Rating.Again) {
        // Move current card to the end of the deck
        setCards(prevCards => {
          const newCards = [...prevCards];
          const currentCard = newCards.splice(currentCardIndex, 1)[0];
          return [...newCards, currentCard];
        });
        // Stay on the same index (which will now show the next card)
        setIsFlipped(false);
        flipAnim.setValue(0);
      } else {
        // For other ratings, move to next card
        if (currentCardIndex < cards.length - 1) {
          setCurrentCardIndex(prev => prev + 1);
          setIsFlipped(false);
          flipAnim.setValue(0);
        } else {
          // End of deck
          const endTime = new Date();
          const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          
          Toast.show({
            type: 'success',
            text1: 'Study session complete!',
            text2: `You reviewed ${cardsStudied} cards in ${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`,
          });

          // Navigate back to deck view
          router.back();
        }
      }
    } catch (error) {
      console.error('Error reviewing card:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save review',
      });
    } finally {
      setReviewing(false);
    }
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  if (loading || !currentCard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Container>
          <View style={styles.header}>
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name="close"
                  size={24}
                  color={theme.colors.grey5}
                />
              }
              onPress={() => router.back()}
            />
          </View>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.grey5 }]}>
              Loading cards...
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
                name="close"
                size={24}
                color={theme.colors.grey5}
              />
            }
            onPress={() => router.back()}
          />
          <View style={styles.progress}>
            <View 
              style={[
                styles.progressBar, 
                { backgroundColor: theme.colors.grey2 }
              ]}
            >
              <View 
                style={[
                  styles.progressFill,
                  { 
                    backgroundColor: '#4F46E5',
                    width: `${progress}%`,
                  },
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.grey4 }]}>
              {currentCardIndex + 1} / {cards.length}
            </Text>
          </View>
        </View>

        <View style={styles.cardContainer}>
          <Pressable onPress={flipCard}>
            <View style={styles.cardWrapper}>
              <Animated.View
                style={[
                  styles.card,
                  frontAnimatedStyle,
                  {
                    backgroundColor: theme.colors.grey0,
                    borderColor: theme.colors.grey2,
                  },
                ]}
              >
                <Text style={[styles.cardText, { color: theme.colors.grey5 }]}>
                  {currentCard.front}
                </Text>
                {currentCard.tags && currentCard.tags.length > 0 && (
                  <View style={styles.cardTags}>
                    {currentCard.tags.map((tag, index) => (
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
              </Animated.View>
              <Animated.View
                style={[
                  styles.card,
                  styles.cardBack,
                  backAnimatedStyle,
                  {
                    backgroundColor: theme.colors.grey0,
                    borderColor: theme.colors.grey2,
                  },
                ]}
              >
                <Text style={[styles.cardText, { color: theme.colors.grey5 }]}>
                  {currentCard.back}
                </Text>
                {currentCard.notes && (
                  <Text style={[styles.notes, { color: theme.colors.grey3 }]}>
                    {currentCard.notes}
                  </Text>
                )}
              </Animated.View>
            </View>
          </Pressable>

          <View style={styles.controls}>
            <Button
              title="Again"
              icon={
                <MaterialIcons
                  name="refresh"
                  size={20}
                  color="#DC2626"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#DC262615' }]}
              titleStyle={{ color: '#DC2626', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Again)}
            />
            <Button
              title="Hard"
              icon={
                <MaterialIcons
                  name="trending-down"
                  size={20}
                  color="#D97706"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#D9770615' }]}
              titleStyle={{ color: '#D97706', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Hard)}
            />
            <Button
              title="Good"
              icon={
                <MaterialIcons
                  name="check"
                  size={20}
                  color="#059669"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#05966915' }]}
              titleStyle={{ color: '#059669', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Good)}
            />
            <Button
              title="Easy"
              icon={
                <MaterialIcons
                  name="trending-up"
                  size={20}
                  color="#4F46E5"
                  style={styles.buttonIcon}
                />
              }
              type="clear"
              loading={reviewing}
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#4F46E515' }]}
              titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
              onPress={() => handleResponse(Rating.Easy)}
            />
          </View>
        </View>
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
  progress: {
    flex: 1,
    marginLeft: 16,
    gap: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cardContainer: {
    flex: 1,
    gap: 32,
  },
  cardWrapper: Platform.OS === 'web' 
    ? {
        // @ts-ignore - React Native Web supports perspective
        perspective: 1000,
      } 
    : {} as ViewStyle,
  card: {
    minHeight: 300,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    backfaceVisibility: 'hidden',
    gap: 16,
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  cardText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardTags: {
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
  notes: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  responseButton: {
    height: 48,
    borderWidth: 0,
  },
  responseButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
}); 