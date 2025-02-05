import React, { useState, useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { ThemeProvider, useTheme } from '@rneui/themed';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from '../contexts/AuthContext';
import { lightTheme, darkTheme } from '../theme';

function AppContent() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [initialPathname] = useState(pathname);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AuthProvider initialPathname={initialPathname}>
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
        </Stack>
        <Toast />
      </AuthProvider>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [currentTheme, setCurrentTheme] = useState(colorScheme === 'dark' ? darkTheme : lightTheme);

  useEffect(() => {
    setCurrentTheme(colorScheme === 'dark' ? darkTheme : lightTheme);
  }, [colorScheme]);

  return (
    <ThemeProvider theme={currentTheme}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
