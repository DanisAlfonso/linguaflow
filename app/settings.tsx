import React from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, Switch } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Container } from '../components/layout/Container';
import { useAppTheme } from '../contexts/ThemeContext';

type SwitchMenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  type: 'switch';
  value: boolean;
  onChange: (value: boolean) => void;
};

type NavigateMenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  type: 'navigate';
  onPress: () => void;
};

type MenuItem = SwitchMenuItem | NavigateMenuItem;

type Section = {
  title: string;
  items: MenuItem[];
};

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { themeMode, setThemeMode } = useAppTheme();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(true);
  const [autoPlay, setAutoPlay] = React.useState(true);

  const sections: Section[] = [
    {
      title: 'App Preferences',
      items: [
        {
          icon: 'dark-mode',
          label: 'Dark Mode',
          type: 'switch',
          value: themeMode === 'dark',
          onChange: (value) => setThemeMode(value ? 'dark' : 'system'),
        },
        {
          icon: 'notifications',
          label: 'Push Notifications',
          type: 'switch',
          value: notifications,
          onChange: setNotifications,
        },
        {
          icon: 'play-circle-outline',
          label: 'Auto-play Audio',
          type: 'switch',
          value: autoPlay,
          onChange: setAutoPlay,
        },
      ],
    },
    {
      title: 'Learning Settings',
      items: [
        {
          icon: 'school',
          label: 'Study Reminders',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'timer',
          label: 'Session Duration',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'translate',
          label: 'Language Pairs',
          type: 'navigate',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Data & Storage',
      items: [
        {
          icon: 'cloud-download',
          label: 'Download Settings',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'storage',
          label: 'Storage Usage',
          type: 'navigate',
          onPress: () => {},
        },
        {
          icon: 'backup',
          label: 'Backup & Restore',
          type: 'navigate',
          onPress: () => {},
        },
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
              Settings
            </Text>
          </View>
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
              <View
                key={item.label}
                style={[
                  styles.menuItem,
                  index < section.items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.grey1,
                  }
                ]}
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
                {item.type === 'switch' ? (
                  <Switch
                    value={item.value}
                    onValueChange={item.onChange}
                    trackColor={{
                      false: theme.colors.grey2,
                      true: theme.colors.primary + '80',
                    }}
                    thumbColor={item.value ? theme.colors.primary : theme.colors.grey5}
                    ios_backgroundColor={theme.colors.grey2}
                  />
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.navigateButton,
                      pressed && { opacity: 0.7 }
                    ]}
                    onPress={item.onPress}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={20}
                      color={theme.colors.grey4}
                    />
                  </Pressable>
                )}
              </View>
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
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
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
  navigateButton: {
    padding: 4,
    marginRight: -4,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  version: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 24,
  },
}); 