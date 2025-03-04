import React, { useState, useRef } from 'react';
import { View, StyleSheet, Platform, Pressable, Animated } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const sidebarWidth = useRef(new Animated.Value(240)).current;
  const { theme } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isWeb = Platform.OS === 'web';

  const toggleMenu = (visible: boolean) => {
    console.log('Toggling menu:', visible);
    setMenuVisible(visible);
  };

  const handleOverlayPress = (event: any) => {
    console.log('Overlay pressed');
    console.log('Event target:', event.target);
    console.log('Current menu state:', menuVisible);
    toggleMenu(false);
  };

  const handleAvatarPress = () => {
    console.log('Avatar pressed');
    toggleMenu(!menuVisible);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  const handleChatPress = () => {
    router.push('/chat');
  };

  const toggleSidebar = () => {
    const toValue = sidebarExpanded ? 72 : 240;
    Animated.timing(sidebarWidth, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
    setSidebarExpanded(!sidebarExpanded);
  };

  const handleHeaderPress = (event: any) => {
    if (menuVisible) {
      const target = event.target as HTMLElement;
      const isAvatarClick = target.closest('[data-avatar-button="true"]');
      const isMenuClick = target.closest('[data-menu="true"]');
      
      if (!isAvatarClick && !isMenuClick) {
        toggleMenu(false);
      }
    }
  };

  const menuItems = [
    { label: 'Profile', icon: 'person', onPress: () => router.push('/profile') },
    { label: 'Messages', icon: 'chat', onPress: () => router.push('/chat') },
    { label: 'Settings', icon: 'settings', onPress: () => router.push('/settings') },
    { label: 'Sign Out', icon: 'logout', onPress: handleSignOut },
  ];

  return (
    <>
      {menuVisible && (
        <Pressable
          style={[
            styles.overlay,
            { backgroundColor: theme.colors.grey0 + '80' }
          ]}
          onPress={handleOverlayPress}
        />
      )}
      
      {isWeb ? (
        <Animated.View
          style={[
            styles.webSidebar,
            {
              backgroundColor: theme.colors.grey0,
              borderRightColor: theme.colors.grey1,
              borderRightWidth: 1,
              width: sidebarWidth,
              top: 0,
              ...Platform.select({
                web: {
                  boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)',
                },
              }),
            },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleHeaderPress}
        >
          <View style={styles.sidebarContent}>
            <View style={styles.webNavVertical}>
              <Button
                type="clear"
                title={sidebarExpanded ? (
                  <View style={styles.emailContainer}>
                    <Text 
                      numberOfLines={1} 
                      ellipsizeMode="middle"
                      style={[styles.buttonText, { color: theme.colors.grey5 }]}
                    >
                      {user?.email}
                    </Text>
                  </View>
                ) : ""}
                icon={
                  <View
                    style={[
                      styles.avatar,
                      { 
                        backgroundColor: theme.colors.primary + '15',
                        borderWidth: 2,
                        borderColor: theme.colors.primary + '30',
                        width: sidebarExpanded ? 24 : 32,
                        height: sidebarExpanded ? 24 : 32,
                        borderRadius: sidebarExpanded ? 12 : 16,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText, 
                        { 
                          color: theme.colors.primary, 
                          fontSize: sidebarExpanded ? 12 : 14,
                        }
                      ]}
                    >
                      {user?.email?.[0].toUpperCase()}
                    </Text>
                  </View>
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={handleAvatarPress}
                containerStyle={[styles.buttonContainerVertical, { zIndex: 2 }]}
                buttonStyle={[
                  styles.buttonBase,
                  { 
                    justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                    paddingHorizontal: sidebarExpanded ? 16 : 0,
                  }
                ]}
                {...Platform.select({
                  web: { 'data-avatar-button': 'true' }
                })}
              />

              <Button
                type="clear"
                title={sidebarExpanded ? "Dashboard" : ""}
                icon={
                  <MaterialIcons
                    name="dashboard"
                    size={24}
                    color={theme.colors.primary}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={() => router.push('/')}
                containerStyle={styles.buttonContainerVertical}
                buttonStyle={[
                  styles.buttonBase,
                  { 
                    justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                    paddingHorizontal: sidebarExpanded ? 16 : 0,
                  }
                ]}
              />

              <Button
                type="clear"
                title={sidebarExpanded ? "Flashcards" : ""}
                icon={
                  <MaterialIcons
                    name="class"
                    size={24}
                    color={theme.colors.success}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={() => router.push('/flashcards')}
                containerStyle={styles.buttonContainerVertical}
                buttonStyle={[
                  styles.buttonBase,
                  { 
                    justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                    paddingHorizontal: sidebarExpanded ? 16 : 0,
                  }
                ]}
              />

              <Button
                type="clear"
                title={sidebarExpanded ? "Audio" : ""}
                icon={
                  <MaterialIcons
                    name="headset"
                    size={24}
                    color={theme.colors.warning}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={() => router.push('/audio')}
                containerStyle={styles.buttonContainerVertical}
                buttonStyle={[
                  styles.buttonBase,
                  { 
                    justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                    paddingHorizontal: sidebarExpanded ? 16 : 0,
                  }
                ]}
              />

              <Button
                type="clear"
                title={sidebarExpanded ? "Notes" : ""}
                icon={
                  <MaterialIcons
                    name="edit"
                    size={24}
                    color={theme.colors.success}
                  />
                }
                titleStyle={[styles.buttonText, { color: theme.colors.grey5 }]}
                onPress={() => router.push('/notes')}
                containerStyle={styles.buttonContainerVertical}
                buttonStyle={[
                  styles.buttonBase,
                  { 
                    justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                    paddingHorizontal: sidebarExpanded ? 16 : 0,
                  }
                ]}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.toggleButton,
                { backgroundColor: theme.colors.grey1 + '20' },
                pressed && { opacity: 0.8 }
              ]}
              onPress={toggleSidebar}
            >
              <MaterialIcons
                name={sidebarExpanded ? 'menu-open' : 'menu'}
                size={24}
                color={theme.colors.grey4}
              />
            </Pressable>
          </View>
        </Animated.View>
      ) : (
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
              }),
            },
          ]}
        >
          <View 
            style={[
              styles.content,
              { justifyContent: 'flex-start' }
            ]}
          >
            <View style={styles.userMenu}>
              <Pressable
                style={({ pressed }) => [
                  styles.avatarButton,
                  pressed && { opacity: 0.8 }
                ]}
                onPress={handleAvatarPress}
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
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {menuVisible && (
        <View
          {...Platform.select({
            web: { 'data-menu': 'true' }
          })}
          style={[
            styles.menu,
            {
              backgroundColor: Platform.select({
                ios: theme.colors.grey0 + '95',
                android: theme.colors.grey0 + 'F0',
                web: theme.colors.grey0,
              }),
              borderColor: theme.colors.grey1,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  backgroundColor: theme.colors.grey0 + '95',
                },
                android: {
                  elevation: 8,
                  backgroundColor: theme.colors.grey0 + 'F0',
                },
                web: {
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                  backgroundColor: theme.colors.grey0,
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
                pressed && { backgroundColor: theme.colors.grey1 + '80' },
              ]}
              onPress={() => {
                item.onPress();
                toggleMenu(false);
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 100,
  },
  webSidebar: {
    position: Platform.select({ web: 'fixed', default: 'absolute' }) as 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
    zIndex: 100,
  },
  sidebarContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    height: '100%',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 72,
  },
  webNavVertical: {
    marginTop: 32,
    gap: 8,
    flex: 1,
  },
  buttonContainerVertical: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonBase: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    marginLeft: 12,
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 99,
  },
  menu: {
    position: 'absolute',
    top: Platform.select({ web: 80, default: 72 }),
    left: Platform.select({ web: 24, default: 16 }),
    minWidth: 220,
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
    zIndex: 101,
    ...Platform.select({
      ios: {
        backdropFilter: 'blur(20px)',
      },
      android: {
        elevation: 8,
      },
      web: {
        backdropFilter: 'blur(20px)',
      },
    }),
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
  toggleButton: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginTop: 'auto',
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonIconOnly: {
    marginRight: 0,
    width: 24,
    height: 24,
    textAlign: 'center',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 160,
  },
}); 