import React from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, Avatar } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Container } from '../components/layout/Container';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const sections = [
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Personal Information', onPress: () => {} },
        { icon: 'notifications-none', label: 'Notifications', onPress: () => {} },
        { icon: 'language', label: 'Language Preferences', onPress: () => {} },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        { icon: 'lock-outline', label: 'Security Settings', onPress: () => {} },
        { icon: 'privacy-tip', label: 'Privacy Policy', onPress: () => {} },
        { icon: 'help-outline', label: 'Help & Support', onPress: () => {} },
      ],
    },
  ];

  return (
    <Container>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <MaterialIcons 
              name="arrow-back" 
              size={24} 
              color={theme.colors.grey5}
              style={[
                styles.backButton,
                Platform.OS === 'web' && { cursor: 'pointer' }
              ]}
              onPress={() => router.back()}
            />
            <Text style={[styles.title, { color: theme.colors.grey5 }]}>
              Profile
            </Text>
          </View>
        </View>

        <View 
          style={[
            styles.profileCard,
            { 
              backgroundColor: theme.colors.grey0,
              borderColor: theme.colors.grey1,
            }
          ]}
        >
          <View style={styles.avatarContainer}>
            <View 
              style={[
                styles.avatarWrapper,
                {
                  backgroundColor: theme.colors.primary + '15',
                  borderColor: theme.colors.primary + '30',
                }
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: theme.colors.primary }
                ]}
              >
                {user?.email?.[0].toUpperCase()}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.editAvatarButton,
                {
                  backgroundColor: theme.colors.grey0,
                  borderColor: theme.colors.grey2,
                  opacity: pressed ? 0.8 : 1,
                }
              ]}
            >
              <MaterialIcons
                name="photo-camera"
                size={16}
                color={theme.colors.grey5}
              />
            </Pressable>
          </View>
          <Text
            style={[
              styles.userName,
              { color: theme.colors.grey5 }
            ]}
          >
            {user?.email}
          </Text>
          <Text
            style={[
              styles.userStatus,
              { color: theme.colors.grey4 }
            ]}
          >
            Active Member
          </Text>
        </View>

        {sections.map((section, sectionIndex) => (
          <View 
            key={section.title}
            style={[
              styles.section,
              { 
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey1,
              },
              sectionIndex > 0 && styles.sectionMargin
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.grey4 }
              ]}
            >
              {section.title}
            </Text>
            {section.items.map((item, index) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { backgroundColor: theme.colors.grey1 },
                  index < section.items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.grey1,
                  }
                ]}
                onPress={item.onPress}
              >
                <View style={styles.menuItemContent}>
                  <MaterialIcons
                    name={item.icon as keyof typeof MaterialIcons.glyphMap}
                    size={22}
                    color={theme.colors.grey5}
                    style={styles.menuItemIcon}
                  />
                  <Text
                    style={[
                      styles.menuItemLabel,
                      { color: theme.colors.grey5 }
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={theme.colors.grey4}
                />
              </Pressable>
            ))}
          </View>
        ))}

        <Text
          style={[
            styles.version,
            { color: theme.colors.grey3 }
          ]}
        >
          Version 1.0.0
        </Text>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    borderRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      },
    }),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionMargin: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemIcon: {
    width: 22,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  version: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 24,
  },
}); 