import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform, Pressable, Animated } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import type { Card, ReviewResponse } from '../../../../types/flashcards';

// Temporary mock data - we'll replace this with real data later
const mockCards: Card[] = [
  {
    id: '1',
    deckId: '1',
    front: 'Hello',
    back: 'Hola',
    notes: 'Basic greeting',
    tags: ['greetings'],
    createdAt: new Date(),
    consecutiveCorrect: 0,
  },
  {
    id: '2',
    deckId: '1',
    front: 'Good morning',
    back: 'Buenos días',
    notes: 'Morning greeting',
    tags: ['greetings', 'time'],
    createdAt: new Date(),
    consecutiveCorrect: 2,
  },
  {
    id: '3',
    deckId: '1',
    front: 'Thank you',
    back: 'Gracias',
    notes: 'Basic courtesy',
    tags: ['courtesy'],
    createdAt: new Date(),
    consecutiveCorrect: 1,
  },
];

export default function StudyScreen() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipAnim] = useState(new Animated.Value(0));
  const [cardsStudied, setCardsStudied] = useState(0);
  const [correctResponses, setCorrectResponses] = useState(0);
  const [startTime] = useState(new Date());

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const currentCard = mockCards[currentCardIndex];
  const progress = ((currentCardIndex) / mockCards.length) * 100;

  const flipCard = () => {
    setIsFlipped(!isFlipped);
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  const handleResponse = (response: ReviewResponse) => {
    // Update statistics
    setCardsStudied(prev => prev + 1);
    if (response === 'good' || response === 'easy') {
      setCorrectResponses(prev => prev + 1);
    }

    // Move to next card
    if (currentCardIndex < mockCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      // Reset flip state for next card
      setIsFlipped(false);
      flipAnim.setValue(0);
    } else {
      // End of deck
      const endTime = new Date();
      const timeSpent = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      
      // TODO: Save study session
      console.log({
        deckId: id,
        startedAt: startTime,
        cardsStudied,
        correctResponses,
        timeSpent,
      });

      // Navigate back to deck view
      router.back();
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
              {currentCardIndex + 1} / {mockCards.length}
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
                {currentCard.tags && (
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
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#DC262615' }]}
              titleStyle={{ color: '#DC2626', fontWeight: '600' }}
              onPress={() => handleResponse('again')}
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
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#D9770615' }]}
              titleStyle={{ color: '#D97706', fontWeight: '600' }}
              onPress={() => handleResponse('hard')}
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
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#05966915' }]}
              titleStyle={{ color: '#059669', fontWeight: '600' }}
              onPress={() => handleResponse('good')}
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
              buttonStyle={[styles.responseButton]}
              containerStyle={[styles.responseButtonContainer, { backgroundColor: '#4F46E515' }]}
              titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
              onPress={() => handleResponse('easy')}
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
    gap: 16,
    marginBottom: 32,
  },
  progress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
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
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
  },
  cardWrapper: {
    height: 400,
    ...Platform.select({
      web: {
        perspective: 1000,
      },
      default: {},
    }),
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    backfaceVisibility: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  cardBack: {
    transform: [{ rotateY: '180deg' }],
  },
  cardText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  notes: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  cardTags: {
    position: 'absolute',
    bottom: 24,
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
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  responseButton: {
    borderWidth: 0,
    height: 48,
  },
  responseButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
}); 