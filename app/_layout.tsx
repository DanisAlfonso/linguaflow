import React, { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { ThemeProvider } from '@rneui/themed';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from '../contexts/AuthContext';
import { lightTheme, darkTheme } from '../theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const [initialPathname] = useState(pathname);

  console.log('RootLayout - Initial pathname:', initialPathname);
  console.log('RootLayout - Current pathname:', pathname);

  return (
    <ThemeProvider theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <SafeAreaProvider>
        <AuthProvider initialPathname={initialPathname}>
          <Stack screenOptions={{
            headerShown: false,
            animation: 'fade',
          }} />
          <Toast />
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
