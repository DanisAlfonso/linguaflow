import React from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Container } from '../components/layout/Container';

export default function StatisticsScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <Container>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
                1,234
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
                48h
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
                7
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
                92%
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
                2.5s
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
                15%
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.grey4 }]}>
                Review Rate
              </Text>
            </View>
          </View>
        </View>
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
}); 