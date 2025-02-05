import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Redirect, Tabs, Slot } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Header } from '../../components/layout/Header';
import { useTheme } from '@rneui/themed';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
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
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.grey4,
            tabBarStyle: {
              backgroundColor: theme.colors.grey0,
              borderTopWidth: 1,
              borderTopColor: theme.colors.grey1,
              elevation: Platform.OS === 'android' ? 8 : 0,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: -4,
              },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              height: 64,
              paddingBottom: 8,
              paddingTop: 8,
              ...Platform.select({
                ios: {
                  borderTopWidth: 0.5,
                  borderTopColor: theme.colors.grey2,
                },
                android: {
                  borderTopWidth: 0,
                },
              }),
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
              marginTop: 2,
            },
            tabBarIconStyle: {
              marginBottom: -4,
            },
            tabBarItemStyle: {
              paddingVertical: 4,
            },
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="home" 
                  size={focused ? size + 2 : size} 
                  color={color}
                  style={focused ? styles.activeIcon : null}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="flashcards"
            options={{
              title: 'Flashcards',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="class" 
                  size={focused ? size + 2 : size} 
                  color={color}
                  style={focused ? styles.activeIcon : null}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="audio/index"
            options={{
              title: 'Audio',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="headset" 
                  size={focused ? size + 2 : size} 
                  color={color}
                  style={focused ? styles.activeIcon : null}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="statistics/index"
            options={{
              title: 'Statistics',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="analytics" 
                  size={focused ? size + 2 : size} 
                  color={color}
                  style={focused ? styles.activeIcon : null}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="notes/index"
            options={{
              title: 'Notes',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="edit" 
                  size={focused ? size + 2 : size} 
                  color={color}
                  style={focused ? styles.activeIcon : null}
                />
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
  activeIcon: {
    transform: [{translateY: -2}],
  },
}); 