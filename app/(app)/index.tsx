import React from 'react';
import { ScrollView, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Container } from '../../components/layout/Container';
import { Grid } from '../../components/layout/Grid';
import { DashboardCard } from '../../components/cards/DashboardCard';

export default function Home() {
  const { signOut, user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = width > 768;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Container>
          <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
            Welcome back, {user?.email?.split('@')[0]}!
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.grey3 }]}>
            Continue your language learning journey
          </Text>

          <Grid columns={isWeb ? (isWideScreen ? 3 : 2) : 1} spacing={20}>
            <DashboardCard
              title="Continue Learning"
              subtitle="Spanish - Intermediate"
              icon="play-circle"
              progress={45}
              cardType="learning"
              onPress={() => {}}
            />
            <DashboardCard
              title="Daily Goals"
              subtitle="3/5 completed"
              icon="star"
              progress={60}
              cardType="goals"
              onPress={() => {}}
            />
            <DashboardCard
              title="Vocabulary"
              subtitle="250 words learned"
              icon="book"
              progress={30}
              cardType="learning"
              onPress={() => {}}
            />
            <DashboardCard
              title="Practice Speaking"
              subtitle="Improve pronunciation"
              icon="mic"
              cardType="practice"
              onPress={() => {}}
            />
            <DashboardCard
              title="Grammar Lessons"
              subtitle="12 lessons available"
              icon="school"
              cardType="practice"
              onPress={() => {}}
            />
            <DashboardCard
              title="Community"
              subtitle="Connect with learners"
              icon="groups"
              cardType="achievements"
              onPress={() => {}}
            />
          </Grid>
        </Container>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  card: {
    height: '100%',
  },
}); 