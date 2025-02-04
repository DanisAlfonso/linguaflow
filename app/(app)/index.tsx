import React from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container } from '../../components/layout/Container';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  // Placeholder data (replace with real data later)
  const studyStreak = 5;
  const dailyGoal = 70; // percentage
  const cardsToReview = 12;
  const recentDecks = [
    { id: '1', name: 'Basic Phrases', progress: 65, lastStudied: '2h ago' },
    { id: '2', name: 'Common Verbs', progress: 40, lastStudied: '1d ago' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Daily Overview Card */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <View style={styles.welcomeHeader}>
              <View>
                <Text style={[styles.greeting, { color: theme.colors.grey5 }]}>
                  Good morning
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.grey3 }]}>
                  Keep up the great work!
                </Text>
              </View>
              <View style={styles.streakContainer}>
                <MaterialIcons name="local-fire-department" size={24} color="#EA580C" />
                <Text style={[styles.streakText, { color: theme.colors.grey5 }]}>
                  {studyStreak} day streak
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.grey1 }]}>
                <MaterialIcons name="trending-up" size={24} color="#4F46E5" />
                <Text style={[styles.statValue, { color: theme.colors.grey5 }]}>{dailyGoal}%</Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>Daily Goal</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.grey1 }]}>
                <MaterialIcons name="schedule" size={24} color="#059669" />
                <Text style={[styles.statValue, { color: theme.colors.grey5 }]}>{cardsToReview}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey3 }]}>Cards Due</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
              Quick Actions
            </Text>
            <View style={styles.quickActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { opacity: pressed ? 0.8 : 1 }
                ]}
                onPress={() => router.push('/flashcards')}
              >
                <LinearGradient
                  colors={['#4F46E5', '#818CF8']}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="play-arrow" size={24} color="white" />
                  <Text style={styles.actionText}>Start Review</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { opacity: pressed ? 0.8 : 1 }
                ]}
                onPress={() => router.push('/flashcards/create')}
              >
                <LinearGradient
                  colors={['#059669', '#34D399']}
                  style={styles.actionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <MaterialIcons name="add" size={24} color="white" />
                  <Text style={styles.actionText}>New Deck</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
              Recent Activity
            </Text>
            <View style={styles.recentDecks}>
              {recentDecks.map((deck) => (
                <Pressable
                  key={deck.id}
                  style={({ pressed }) => [
                    styles.recentDeck,
                    {
                      backgroundColor: theme.colors.grey1,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  onPress={() => router.push(`/flashcards/${deck.id}`)}
                >
                  <View style={styles.recentDeckInfo}>
                    <Text style={[styles.recentDeckName, { color: theme.colors.grey5 }]}>
                      {deck.name}
                    </Text>
                    <Text style={[styles.recentDeckTime, { color: theme.colors.grey3 }]}>
                      {deck.lastStudied}
                    </Text>
                  </View>
                  <View style={styles.recentDeckProgress}>
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
                            width: `${deck.progress}%`,
                            backgroundColor: '#4F46E5',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.progressText, { color: theme.colors.grey4 }]}>
                      {deck.progress}%
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Study Recommendations */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
              Recommended
            </Text>
            <View style={[styles.recommendationCard, { backgroundColor: theme.colors.grey1 }]}>
              <MaterialIcons name="lightbulb" size={24} color="#B45309" />
              <Text style={[styles.recommendationText, { color: theme.colors.grey5 }]}>
                Practice speaking with audio cards to improve pronunciation
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.recommendationButton,
                  { opacity: pressed ? 0.8 : 1 }
                ]}
                onPress={() => router.push('/audio')}
              >
                <Text style={styles.recommendationButtonText}>Try Now</Text>
              </Pressable>
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
  scrollContent: {
    gap: 24,
    paddingVertical: 24,
  },
  section: {
    borderRadius: 20,
    padding: 24,
    gap: 20,
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
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
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EA580C20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  recentDecks: {
    gap: 12,
  },
  recentDeck: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  recentDeckInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentDeckName: {
    fontSize: 16,
    fontWeight: '600',
  },
  recentDeckTime: {
    fontSize: 14,
  },
  recentDeckProgress: {
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
    minWidth: 40,
  },
  recommendationCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },
  recommendationText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  recommendationButton: {
    backgroundColor: '#B45309',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  recommendationButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
}); 