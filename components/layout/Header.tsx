import React, { useState } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const [menuVisible, setMenuVisible] = useState(false);
  const { theme } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isWeb = Platform.OS === 'web';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  const handleChatPress = () => {
    router.push('/chat');
  };

  const menuItems = [
    { label: 'Profile', icon: 'person', onPress: () => router.push('/profile') },
    { label: 'Settings', icon: 'settings', onPress: () => router.push('/settings') },
    { label: 'Sign Out', icon: 'logout', onPress: handleSignOut },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.grey0,
          borderBottomColor: theme.colors.grey1,
          borderBottomWidth: 1,
        },
      ]}
    >
      <View style={[styles.content, isWeb && styles.webContent]}>
        <Text
          style={[styles.logo, { color: theme.colors.grey5 }]}
          onPress={() => router.push('/')}
        >
          Linguaflow
        </Text>

        <View style={styles.nav}>
          {isWeb && (
            <View style={styles.webNav}>
              <Button
                type="clear"
                title="Dashboard"
                icon={
                  <MaterialIcons
                    name="dashboard"
                    size={20}
                    color="#4F46E5"
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={() => router.push('/')}
              />
              <Button
                type="clear"
                title="Flashcards"
                icon={
                  <MaterialIcons
                    name="library-books"
                    size={20}
                    color="#059669"
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey4 }]}
                onPress={() => {
                  console.log('Navigating to /flashcards from Header');
                  router.push('/flashcards');
                }}
              />
              <Button
                type="clear"
                title="Progress"
                icon={
                  <MaterialIcons
                    name="trending-up"
                    size={20}
                    color="#059669"
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey4 }]}
                onPress={() => router.push('/progress')}
              />
              <Button
                type="clear"
                title="Audio"
                icon={
                  <MaterialIcons
                    name="headset"
                    size={20}
                    color="#B45309"
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey4 }]}
                onPress={() => router.push('/audio')}
              />
            </View>
          )}

          <View style={styles.userMenu}>
            <Pressable
              style={styles.avatarButton}
              onPress={() => setMenuVisible(!menuVisible)}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: '#4F46E5' + '20' },
                ]}
              >
                <Text
                  style={[styles.avatarText, { color: '#4F46E5' }]}
                >
                  {user?.email?.[0].toUpperCase()}
                </Text>
              </View>
              {isWeb && (
                <MaterialIcons
                  name={menuVisible ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={theme.colors.grey4}
                />
              )}
            </Pressable>

            {menuVisible && (
              <View
                style={[
                  styles.menu,
                  {
                    backgroundColor: theme.colors.grey0,
                    borderColor: theme.colors.grey1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 4,
                  },
                ]}
              >
                {menuItems.map((item, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [
                      styles.menuItem,
                      pressed && { backgroundColor: theme.colors.grey1 },
                    ]}
                    onPress={() => {
                      item.onPress();
                      setMenuVisible(false);
                    }}
                  >
                    <MaterialIcons
                      name={item.icon}
                      size={20}
                      color={theme.colors.grey5}
                      style={styles.menuIcon}
                    />
                    <Text
                      style={[styles.menuText, { color: theme.colors.grey5 }]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={handleChatPress}
        >
          <MaterialIcons name="chat" size={24} color={theme.colors.grey5} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
  },
  webContent: {
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 24,
    fontWeight: '600',
    cursor: 'pointer',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webNav: {
    flexDirection: 'row',
    marginRight: 24,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  userMenu: {
    position: 'relative',
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    cursor: 'pointer',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
}); 