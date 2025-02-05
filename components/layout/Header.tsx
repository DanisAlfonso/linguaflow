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
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            },
            android: {
              elevation: 4,
            },
            web: {
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            },
          }),
        },
      ]}
    >
      <View style={[styles.content, isWeb && styles.webContent]}>
        <Text
          style={[styles.logo, { color: theme.colors.primary }]}
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
                    size={22}
                    color={theme.colors.primary}
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={() => router.push('/')}
                containerStyle={styles.buttonContainer}
              />
              <Button
                type="clear"
                title="Flashcards"
                icon={
                  <MaterialIcons
                    name="class"
                    size={22}
                    color={theme.colors.success}
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey4 }]}
                onPress={() => router.push('/flashcards')}
                containerStyle={styles.buttonContainer}
              />
              <Button
                type="clear"
                title="Audio"
                icon={
                  <MaterialIcons
                    name="headset"
                    size={22}
                    color={theme.colors.warning}
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey4 }]}
                onPress={() => router.push('/audio')}
                containerStyle={styles.buttonContainer}
              />
              <Button
                type="clear"
                title="Notes"
                icon={
                  <MaterialIcons
                    name="edit"
                    size={22}
                    color={theme.colors.success}
                    style={styles.buttonIcon}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey4 }]}
                onPress={() => router.push('/notes')}
                containerStyle={styles.buttonContainer}
              />
            </View>
          )}

          <View style={styles.userMenu}>
            <Pressable
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && { opacity: 0.8 }
              ]}
              onPress={() => setMenuVisible(!menuVisible)}
            >
              <View
                style={[
                  styles.avatar,
                  { 
                    backgroundColor: theme.colors.primary + '15',
                    borderWidth: 2,
                    borderColor: theme.colors.primary + '30',
                  },
                ]}
              >
                <Text
                  style={[styles.avatarText, { color: theme.colors.primary }]}
                >
                  {user?.email?.[0].toUpperCase()}
                </Text>
              </View>
              {isWeb && (
                <MaterialIcons
                  name={menuVisible ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={theme.colors.grey4}
                  style={{ marginLeft: 4 }}
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
                    ...Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                      },
                      android: {
                        elevation: 8,
                      },
                      web: {
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                      },
                    }),
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
                      name={item.icon as keyof typeof MaterialIcons.glyphMap}
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
            { opacity: pressed ? 0.7 : 1 },
            { backgroundColor: theme.colors.primary + '10', }
          ]}
          onPress={handleChatPress}
        >
          <MaterialIcons 
            name="chat" 
            size={24} 
            color={theme.colors.primary}
          />
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
    height: 72,
  },
  webContent: {
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 26,
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: -0.5,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webNav: {
    flexDirection: 'row',
    marginRight: 24,
    gap: 8,
  },
  buttonContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  userMenu: {
    position: 'relative',
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 20,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    minWidth: 220,
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
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  iconButton: {
    padding: 10,
    borderRadius: 12,
  },
}); 