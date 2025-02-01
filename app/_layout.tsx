import React from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider } from '@rneui/themed';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { lightTheme, darkTheme } from '../theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack screenOptions={{
            headerShown: false,
            animation: 'fade',
          }} />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
