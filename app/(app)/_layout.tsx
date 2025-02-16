import { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Keyboard, Animated } from 'react-native';
import { Redirect, Tabs, Slot } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Header } from '../../components/layout/Header';
import { useTheme } from '@rneui/themed';

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const translateY = useRef(new Animated.Value(0)).current;

  const BASE_ICON_SIZE = 28; // Increased from default 24

  useEffect(() => {
    if (isWeb) return;

    const showSubscription = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', () => {
          Animated.timing(translateY, {
            toValue: 100,
            duration: 250,
            useNativeDriver: true,
          }).start();
        })
      : Keyboard.addListener('keyboardDidShow', () => {
          Animated.timing(translateY, {
            toValue: 100,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });

    const hideSubscription = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', () => {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        })
      : Keyboard.addListener('keyboardDidHide', () => {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
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
              height: 76,
              paddingBottom: 12,
              paddingTop: 12,
              transform: [{
                translateY: translateY
              }],
              zIndex: 1,
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
              fontSize: 13, // Increased from 12
              fontWeight: '500',
              marginTop: 4,
            },
            tabBarIconStyle: {
              marginBottom: -2,
            },
            tabBarItemStyle: {
              paddingVertical: 6, // Increased from 4
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
                  size={focused ? BASE_ICON_SIZE + 2 : BASE_ICON_SIZE} 
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
                  size={focused ? BASE_ICON_SIZE + 2 : BASE_ICON_SIZE} 
                  color={color}
                  style={focused ? styles.activeIcon : null}
                />
              ),
            }}
          />
          <Tabs.Screen
            name="notes"
            options={{
              title: 'Notes',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="edit" 
                  size={focused ? BASE_ICON_SIZE + 2 : BASE_ICON_SIZE} 
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
              href: '/audio',
              tabBarIcon: ({ color, size, focused }) => (
                <MaterialIcons 
                  name="headset" 
                  size={focused ? BASE_ICON_SIZE + 2 : BASE_ICON_SIZE} 
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
    transform: [{ scale: 1.1 }],
  },
}); 