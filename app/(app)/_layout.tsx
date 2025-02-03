import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { useTheme } from '@rneui/themed';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from '../../components/layout/Header';
import { BottomNav } from '../../components/navigation/BottomNav';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();

  console.log('AppLayout - Current pathname:', pathname);
  console.log('AppLayout - Auth state:', { user: !!user, loading });

  // You can show a loading screen while checking authentication
  if (loading) {
    console.log('AppLayout - Still loading auth state');
    return null;
  }

  // If user is not authenticated, redirect to sign in
  if (!user) {
    console.log('AppLayout - User not authenticated, redirecting to /sign-in');
    return <Redirect href="/sign-in" />;
  }

  console.log('AppLayout - Rendering app layout');
  return (
    <LinearGradient
      colors={[
        (theme.colors as any).backgroundGradientStart,
        (theme.colors as any).backgroundGradientEnd
      ]}
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