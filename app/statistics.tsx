import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Container } from '../components/layout/Container';
import { getUserStatistics, getHourlyActivity, getResponseDistribution } from '../lib/api/flashcards';
import type { UserStatistics, HourlyActivity, ResponseDistribution } from '../lib/api/flashcards';
import Toast from 'react-native-toast-message';

export default function StatisticsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [hourlyActivity, setHourlyActivity] = useState<HourlyActivity[]>([]);
  const [responseDistribution, setResponseDistribution] = useState<ResponseDistribution[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const [statsData, hourlyData, responseData] = await Promise.all([
        getUserStatistics(),
        getHourlyActivity(),
        getResponseDistribution(),
      ]);
      setStats(statsData);
      setHourlyActivity(hourlyData);
      setResponseDistribution(responseData);
    } catch (error) {
      console.error('Error loading statistics:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load statistics',
      });
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  useEffect(() => {
    async function initialLoad() {
      try {
        await loadStats();
      } finally {
        setLoading(false);
      }
    }
    initialLoad();
  }, [loadStats]);

  function formatStudyTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return (
    <Container>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <MaterialIcons 
              name="arrow-back" 
              size={24} 
              color={theme.colors.grey5}
              style={[
                styles.backButton,
                Platform.OS === 'web' && { cursor: 'pointer' }
              ]}
              onPress={() => router.back()}
            />
            <Text style={[styles.title, { color: theme.colors.grey5 }]}>
              Statistics
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : stats ? (
          <>
            <View 
              style={[
                styles.section,
                { 
                  backgroundColor: theme.colors.grey0,
                  borderColor: theme.colors.grey1,
                }
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <MaterialIcons
                    name="trending-up"
                    size={24}
                    color={theme.colors.grey5}
                  />
                  <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                    Learning Overview
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
                    name="school"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                    {stats.total_cards_learned.toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Total Cards Learned
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
                    {formatStudyTime(stats.study_time_minutes)}
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
                    name="local-fire-department"
                    size={24}
                    color={theme.colors.warning}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                    {stats.day_streak}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Day Streak
                  </Text>
                </View>
              </View>
            </View>

            <View 
              style={[
                styles.section,
                { 
                  backgroundColor: theme.colors.grey0,
                  borderColor: theme.colors.grey1,
                }
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <MaterialIcons
                    name="insights"
                    size={24}
                    color={theme.colors.grey5}
                  />
                  <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                    Performance
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View 
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.colors.success + '10' }
                  ]}
                >
                  <MaterialIcons
                    name="check-circle"
                    size={24}
                    color={theme.colors.success}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.success }]}>
                    {stats.accuracy}%
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Accuracy
                  </Text>
                </View>

                <View 
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.colors.primary + '10' }
                  ]}
                >
                  <MaterialIcons
                    name="speed"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                    {stats.avg_response_time}s
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Avg. Response Time
                  </Text>
                </View>

                <View 
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.colors.warning + '10' }
                  ]}
                >
                  <MaterialIcons
                    name="replay"
                    size={24}
                    color={theme.colors.warning}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                    {stats.review_rate}%
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Review Rate
                  </Text>
                </View>
              </View>
            </View>

            <View 
              style={[
                styles.section,
                { 
                  backgroundColor: theme.colors.grey0,
                  borderColor: theme.colors.grey1,
                }
              ]}
            >
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleContainer}>
                  <MaterialIcons
                    name="schedule"
                    size={24}
                    color={theme.colors.grey5}
                  />
                  <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                    Study Patterns
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View 
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.colors.success + '10' }
                  ]}
                >
                  <MaterialIcons
                    name="access-time"
                    size={24}
                    color={theme.colors.success}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.success }]}>
                    {hourlyActivity.length > 0 
                      ? hourlyActivity.reduce((max, curr) => 
                          curr.cards_reviewed > max.cards_reviewed ? curr : max
                        ).hour_of_day + ':00'
                      : '--:--'}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Peak Study Hour
                  </Text>
                </View>

                <View 
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.colors.primary + '10' }
                  ]}
                >
                  <MaterialIcons
                    name="bolt"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                    {responseDistribution.length > 0
                      ? responseDistribution.reduce((max, curr) => 
                          curr.count > max.count ? curr : max
                        ).response_bucket
                      : '--'}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Most Common Response Time
                  </Text>
                </View>

                <View 
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.colors.warning + '10' }
                  ]}
                >
                  <MaterialIcons
                    name="auto-graph"
                    size={24}
                    color={theme.colors.warning}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                    {hourlyActivity.reduce((sum, curr) => sum + curr.cards_reviewed, 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                    Cards Last 30 Days
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              Failed to load statistics
            </Text>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    gap: 24,
  },
  header: {
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    borderRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  section: {
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
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 