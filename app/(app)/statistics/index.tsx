import React from 'react';
import { View, ScrollView, StyleSheet, Platform } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Container } from '../../../components/layout/Container';
import { MaterialIcons } from '@expo/vector-icons';

export default function StatisticsScreen() {
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <View style={styles.header}>
          <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
            Statistics
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Placeholder for Statistics Overview */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="timeline" size={24} color={theme.colors.grey5} />
              <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                Learning Overview
              </Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.colors.grey1 }]}>
              <Text style={[styles.placeholder, { color: theme.colors.grey4 }]}>
                Learning statistics will be displayed here
              </Text>
            </View>
          </View>

          {/* Placeholder for Flashcard Stats */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="class" size={24} color={theme.colors.grey5} />
              <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                Flashcard Progress
              </Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.colors.grey1 }]}>
              <Text style={[styles.placeholder, { color: theme.colors.grey4 }]}>
                Flashcard statistics will be displayed here
              </Text>
            </View>
          </View>

          {/* Placeholder for Study Time Stats */}
          <View style={[styles.section, { backgroundColor: theme.colors.grey0 }]}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="schedule" size={24} color={theme.colors.grey5} />
              <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                Study Time
              </Text>
            </View>
            <View style={[styles.card, { backgroundColor: theme.colors.grey1 }]}>
              <Text style={[styles.placeholder, { color: theme.colors.grey4 }]}>
                Study time statistics will be displayed here
              </Text>
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
  scrollContent: {
    gap: 24,
    paddingVertical: 16,
  },
  section: {
    borderRadius: 20,
    padding: 24,
    gap: 16,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
}); 