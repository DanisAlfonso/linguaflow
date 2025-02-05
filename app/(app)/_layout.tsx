import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Redirect, Tabs, Slot } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Header } from '../../components/layout/Header';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const isWeb = Platform.OS === 'web';

  if (loading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (isWeb) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.content}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: '#4F46E5',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: {
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="home" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="flashcards"
            options={{
              title: 'Flashcards',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="class" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="audio/index"
            options={{
              title: 'Audio',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="headset" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="statistics/index"
            options={{
              title: 'Statistics',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="analytics" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="notes/index"
            options={{
              title: 'Notes',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="edit" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
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