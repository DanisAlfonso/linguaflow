import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Header } from '../../components/layout/Header';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
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
            name="chat/index"
            options={{
              title: 'Chat',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="chat" size={size} color={color} />
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
          <Tabs.Screen
            name="practice/index"
            options={{
              title: 'Audio',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="headset" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="flashcards"
            options={{
              title: 'flashcards',
              tabBarIcon: ({ color, size }) => (
                <MaterialIcons name="class" size={size} color={color} />
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