import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useTheme } from '@rneui/themed';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from '../../components/layout/Header';
import { BottomNav } from '../../components/navigation/BottomNav';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  // You can show a loading screen while checking authentication
  if (loading) {
    return null;
  }

  // If user is not authenticated, redirect to sign in
  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <LinearGradient
      colors={[theme.colors.backgroundGradientStart, theme.colors.backgroundGradientEnd]}
      style={styles.container}
    >
      <Header />
      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        />
      </View>
      <BottomNav />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
}); 