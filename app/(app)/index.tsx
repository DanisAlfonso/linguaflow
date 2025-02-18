import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Platform, Pressable, RefreshControl } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container } from '../../components/layout/Container';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { getUserStatistics, getRecentActivity } from '../../lib/api/flashcards';
import type { UserStatistics, RecentActivity } from '../../lib/api/flashcards';

export default function HomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, activityData] = await Promise.all([
        getUserStatistics(),
        getRecentActivity(5),
      ]);
      setStats(statsData);
      setRecentActivity(activityData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  function formatStudyTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  function formatTimeAgo(date: string): string {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return 'yesterday';
    }
    
    return `${diffInDays}d ago`;
  }

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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]} // Android
              tintColor={theme.colors.primary} // iOS
              progressBackgroundColor={theme.colors.grey0} // Android
            />
          }
        >
          <View style={styles.welcomeSection}>
            <View style={styles.welcomeHeader}>
              <View>
                <Text style={[styles.greeting, { color: theme.colors.grey5 }]}>
                  Welcome back
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.grey4 }]}>
                  {user?.email}
                </Text>
              </View>
              {stats && (
                <View 
                  style={[
                    styles.streakContainer,
                    { backgroundColor: theme.colors.warning + '20' }
                  ]}
                >
                  <MaterialIcons 
                    name="local-fire-department" 
                    size={20} 
                    color={theme.colors.warning}
                  />
                  <Text style={[styles.streakText, { color: theme.colors.warning }]}>
                    {stats.day_streak} Day Streak
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View 
            style={[
              styles.statsSection,
              { 
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey1,
              }
            ]}
          >
            <View style={styles.statsSectionHeader}>
              <View style={styles.statsTitleContainer}>
                <MaterialIcons
                  name="analytics"
                  size={24}
                  color={theme.colors.grey5}
                />
                <Text style={[styles.statsTitle, { color: theme.colors.grey5 }]}>
                  Your Progress
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.viewAllButton,
                  pressed && { opacity: 0.7 }
                ]}
                onPress={() => router.push('/statistics')}
              >
                <Text style={[styles.viewAllText, { color: theme.colors.primary }]}>
                  View All
                </Text>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.primary}
                />
              </Pressable>
            </View>

            <View style={styles.statsGrid}>
              <View 
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.primary + '10' }
                ]}
              >
                <MaterialIcons
                  name="school"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {stats?.total_cards_learned ?? 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                  Cards Learned
                </Text>
              </View>

              <View 
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.success + '10' }
                ]}
              >
                <MaterialIcons
                  name="schedule"
                  size={24}
                  color={theme.colors.success}
                />
                <Text style={[styles.statValue, { color: theme.colors.success }]}>
                  {stats ? formatStudyTime(stats.study_time_minutes) : '0m'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                  Study Time
                </Text>
              </View>

              <View 
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.warning + '10' }
                ]}
              >
                <MaterialIcons
                  name="trending-up"
                  size={24}
                  color={theme.colors.warning}
                />
                <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                  {stats?.accuracy ?? 0}%
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                  Accuracy
                </Text>
              </View>
            </View>
          </View>

          {/* Daily Overview Card */}
          <View 
            style={[
              styles.section, 
              { 
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey1,
                borderWidth: 1,
              }
            ]}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <MaterialIcons
                  name="today"
                  size={24}
                  color={theme.colors.grey5}
                />
                <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                  Today's Overview
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View 
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.primary + '10' }
                ]}
              >
                <MaterialIcons
                  name="schedule"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {cardsToReview}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                  Cards Due
                </Text>
              </View>

              <View 
                style={[
                  styles.statCard,
                  { backgroundColor: theme.colors.success + '10' }
                ]}
              >
                <MaterialIcons
                  name="trending-up"
                  size={24}
                  color={theme.colors.success}
                />
                <Text style={[styles.statValue, { color: theme.colors.success }]}>
                  {stats?.accuracy ?? 0}%
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                  Today's Accuracy
                </Text>
              </View>
            </View>

            {stats && stats.total_cards_learned > 0 ? (
              <Text style={[styles.overviewMessage, { color: theme.colors.grey4 }]}>
                {stats.day_streak > 0
                  ? `Keep up your ${stats.day_streak} day streak! You're making great progress.`
                  : "Start reviewing to build your streak!"}
              </Text>
            ) : (
              <Text style={[styles.overviewMessage, { color: theme.colors.grey4 }]}>
                Welcome to LinguaFlow! Start by creating your first deck or reviewing cards.
              </Text>
            )}
          </View>

          {/* Quick Actions */}
          <View 
            style={[
              styles.section, 
              { 
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey1,
                borderWidth: 1,
              }
            ]}
          >
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
          <View 
            style={[
              styles.section, 
              { 
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey1,
                borderWidth: 1,
              }
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
              Recent Activity
            </Text>
            <View style={styles.recentDecks}>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <Pressable
                    key={activity.id}
                    style={({ pressed }) => [
                      styles.recentDeck,
                      {
                        backgroundColor: theme.colors.grey1,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                    onPress={() => router.push(`/flashcards/${activity.deck_id}`)}
                  >
                    <View style={styles.recentDeckInfo}>
                      <Text style={[styles.recentDeckName, { color: theme.colors.grey5 }]}>
                        {activity.deck_name}
                      </Text>
                      <Text style={[styles.recentDeckTime, { color: theme.colors.grey3 }]}>
                        {formatTimeAgo(activity.created_at)}
                      </Text>
                    </View>
                    <View style={styles.activityStats}>
                      <View style={styles.activityStat}>
                        <MaterialIcons name="school" size={16} color={theme.colors.primary} />
                        <Text style={[styles.activityStatText, { color: theme.colors.grey4 }]}>
                          {activity.cards_reviewed} cards
                        </Text>
                      </View>
                      <View style={styles.activityStat}>
                        <MaterialIcons name="schedule" size={16} color={theme.colors.success} />
                        <Text style={[styles.activityStatText, { color: theme.colors.grey4 }]}>
                          {formatStudyTime(activity.study_minutes)}
                        </Text>
                      </View>
                      <View style={styles.activityStat}>
                        <MaterialIcons name="trending-up" size={16} color={theme.colors.warning} />
                        <Text style={[styles.activityStatText, { color: theme.colors.grey4 }]}>
                          {activity.accuracy}% accuracy
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              ) : (
                <View 
                  style={[
                    styles.emptyStateContainer,
                    { backgroundColor: theme.colors.grey1 }
                  ]}
                >
                  <MaterialIcons
                    name="history"
                    size={24}
                    color={theme.colors.grey3}
                  />
                  <Text style={[styles.emptyStateText, { color: theme.colors.grey4 }]}>
                    No recent activity yet
                  </Text>
                </View>
              )}
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
    paddingBottom: Platform.OS === 'web' ? 24 : 100,
  },
  welcomeSection: {
    marginBottom: 8,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  statsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  section: {
    borderRadius: 16,
    padding: 24,
    gap: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
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
  activityStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  activityStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityStatText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyStateContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '500',
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overviewMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
}); 