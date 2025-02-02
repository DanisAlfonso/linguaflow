import React from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';

export function BottomNav() {
  const { theme } = useTheme();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';

  if (isWeb) return null;

  const navItems = [
    {
      label: 'Home',
      icon: 'home',
      route: '/',
    },
    {
      label: 'Flashcards',
      icon: 'library-books',
      route: '/flashcards',
    },
    {
      label: 'Progress',
      icon: 'trending-up',
      route: '/progress',
    },
    {
      label: 'Practice',
      icon: 'school',
      route: '/practice',
    },
    {
      label: 'Profile',
      icon: 'person',
      route: '/profile',
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.grey0,
          borderTopColor: theme.colors.grey2,
        },
      ]}
    >
      {navItems.map((item, index) => (
        <Pressable
          key={index}
          style={styles.navItem}
          onPress={() => router.push(item.route)}
        >
          <MaterialIcons
            name={item.icon as keyof typeof MaterialIcons.glyphMap}
            size={24}
            color={theme.colors.grey5}
          />
          <Text
            style={[
              styles.navLabel,
              { color: theme.colors.grey5 },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    borderTopWidth: 1,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
  },
}); 