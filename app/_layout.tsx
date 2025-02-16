import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { ThemeProvider as RNEThemeProvider, useTheme } from '@rneui/themed';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider, useAppTheme } from '../contexts/ThemeContext';
import { useBackgroundSync } from '../hooks/useBackgroundSync';
import { StudySettingsProvider } from '../contexts/StudySettingsContext';
import { TabBarProvider } from '../contexts/TabBarContext';

function AppContent() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [initialPathname] = useState(pathname);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AuthProvider initialPathname={initialPathname}>
        <StudySettingsProvider>
          <TabBarProvider>
            <Stack 
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
              <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
              <Stack.Screen 
                name="profile" 
                options={{
                  animation: 'slide_from_right',
                  presentation: 'card',
                }} 
              />
              <Stack.Screen 
                name="settings" 
                options={{
                  animation: 'slide_from_right',
                  presentation: 'card',
                }} 
              />
              <Stack.Screen 
                name="chat" 
                options={{
                  animation: 'slide_from_right',
                  presentation: 'card',
                }} 
              />
              <Stack.Screen 
                name="statistics" 
                options={{
                  animation: 'slide_from_right',
                  presentation: 'card',
                }} 
              />
            </Stack>
          </TabBarProvider>
        </StudySettingsProvider>
        <Toast />
      </AuthProvider>
    </View>
  );
}

function ThemedApp() {
  const { theme } = useAppTheme();
  
  return (
    <RNEThemeProvider theme={theme}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </RNEThemeProvider>
  );
}

export default function RootLayout() {
  // Initialize background sync
  useBackgroundSync();

  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
