import React, { useState } from 'react';
import { View, StyleSheet, Platform, ScrollView, Pressable, Switch } from 'react-native';
import { Text, useTheme, Button } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Container } from '../components/layout/Container';
import { useAppTheme } from '../contexts/ThemeContext';
import { useStudySettings } from '../contexts/StudySettingsContext';
import { useNotifications } from '../contexts/NotificationsContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SwitchMenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  type: 'switch';
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  description?: string;
};

type NavigateMenuItem = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  type: 'navigate';
  onPress: () => void;
  disabled?: boolean;
  description?: string;
};

type MenuItem = SwitchMenuItem | NavigateMenuItem;

type Section = {
  title: string;
  items: MenuItem[];
};

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { themeMode, setThemeMode } = useAppTheme();
  const { 
    hideNavigationBar, 
    setHideNavigationBar,
    cardAnimationType,
    setCardAnimationType,
    moveControlsToBottom,
    setMoveControlsToBottom,
    autoPlay,
    setAutoPlay
  } = useStudySettings();
  const {
    enabled: notificationsEnabled,
    setEnabled: setNotificationsEnabled,
    settings: notificationSettings,
    updateSettings: updateNotificationSettings,
    updateDailyReminderTime,
  } = useNotifications();
  const router = useRouter();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAnimationModal, setShowAnimationModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Load hide navigation bar setting on component mount
  React.useEffect(() => {
    const loadHideNavigationBar = async () => {
      try {
        const value = await AsyncStorage.getItem('hideNavigationBar');
        setHideNavigationBar(value === 'true');
      } catch (error) {
        console.error('Error loading hide navigation bar setting:', error);
      }
    };
    loadHideNavigationBar();
  }, []);

  // Save hide navigation bar setting when changed
  const handleHideNavigationBarChange = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('hideNavigationBar', value.toString());
      setHideNavigationBar(value);
    } catch (error) {
      console.error('Error saving hide navigation bar setting:', error);
    }
  };

  // Save move controls to bottom setting when changed
  const handleMoveControlsToBottomChange = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('moveControlsToBottom', value.toString());
      setMoveControlsToBottom(value);
    } catch (error) {
      console.error('Error saving move controls to bottom setting:', error);
    }
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      updateDailyReminderTime(selectedDate.getHours(), selectedDate.getMinutes());
    }
  };

  const formatTime = (hour: number, minute: number) => {
    const date = new Date();
    date.setHours(hour, minute);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sections: Section[] = [
    {
      title: 'App Preferences',
      items: [
        {
          icon: 'dark-mode',
          label: 'Theme',
          type: 'navigate',
          onPress: () => setShowThemeModal(true),
          description: `${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} mode`,
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications',
          label: 'Push Notifications',
          type: 'switch',
          value: notificationsEnabled,
          onChange: setNotificationsEnabled,
        },
        {
          icon: 'access-time',
          label: 'Daily Reminder',
          type: 'navigate',
          onPress: () => setShowTimePicker(true),
          description: notificationsEnabled 
            ? `Reminder at ${formatTime(notificationSettings.dailyReminder.hour, notificationSettings.dailyReminder.minute)}`
            : 'Turn on notifications first',
        },
        {
          icon: 'insights',
          label: 'Weekly Progress',
          type: 'switch',
          value: notificationsEnabled && notificationSettings.weeklyProgress,
          onChange: (value) => updateNotificationSettings({ weeklyProgress: value }),
          disabled: !notificationsEnabled,
        },
        {
          icon: 'local-fire-department',
          label: 'Streak Alerts',
          type: 'switch',
          value: notificationsEnabled && notificationSettings.streakAlerts,
          onChange: (value) => updateNotificationSettings({ streakAlerts: value }),
          disabled: !notificationsEnabled,
        },
      ],
    },
    {
      title: 'Study Settings',
      items: [
        {
          icon: 'visibility-off',
          label: 'Hide Navigation Bar',
          type: 'switch',
          value: hideNavigationBar,
          onChange: setHideNavigationBar,
          description: 'Hide bottom bar while studying',
        },
        {
          icon: 'swap-vert',
          label: 'Move Controls to Bottom',
          type: 'switch',
          value: moveControlsToBottom,
          onChange: setMoveControlsToBottom,
          description: 'Rating buttons at bottom',
        },
        {
          icon: 'volume-up',
          label: 'Auto-play Audio',
          type: 'switch',
          value: autoPlay,
          onChange: setAutoPlay,
          description: 'Auto-play when flipped',
        },
        {
          icon: 'flip',
          label: 'Card Animation',
          type: 'navigate',
          onPress: () => setShowAnimationModal(true),
        },
      ],
    },
  ];

  const ThemeModal = () => (
    <View
      style={[
        styles.modalOverlay,
        { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
      ]}
    >
      <View
        style={[
          styles.modalContent,
          {
            backgroundColor: theme.colors.grey0,
            borderColor: theme.colors.grey2,
          }
        ]}
      >
        <Text
          style={[
            styles.modalTitle,
            { color: theme.colors.grey5 }
          ]}
        >
          Theme
        </Text>
        
        <View style={styles.themeOptions}>
          <Pressable
            style={[
              styles.themeOption,
              themeMode === 'system' && styles.selectedOption,
              { borderColor: theme.colors.grey2 }
            ]}
            onPress={() => {
              setThemeMode('system');
              setShowThemeModal(false);
            }}
          >
            <MaterialIcons
              name="settings-brightness"
              size={24}
              color={themeMode === 'system' ? theme.colors.primary : theme.colors.grey4}
            />
            <Text
              style={[
                styles.optionText,
                { color: themeMode === 'system' ? theme.colors.primary : theme.colors.grey4 }
              ]}
            >
              System
            </Text>
            <Text
              style={[
                styles.optionDescription,
                { color: theme.colors.grey3 }
              ]}
            >
              Follow system
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.themeOption,
              themeMode === 'light' && styles.selectedOption,
              { borderColor: theme.colors.grey2 }
            ]}
            onPress={() => {
              setThemeMode('light');
              setShowThemeModal(false);
            }}
          >
            <MaterialIcons
              name="light-mode"
              size={24}
              color={themeMode === 'light' ? theme.colors.primary : theme.colors.grey4}
            />
            <Text
              style={[
                styles.optionText,
                { color: themeMode === 'light' ? theme.colors.primary : theme.colors.grey4 }
              ]}
            >
              Light
            </Text>
            <Text
              style={[
                styles.optionDescription,
                { color: theme.colors.grey3 }
              ]}
            >
              Always light
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.themeOption,
              themeMode === 'dark' && styles.selectedOption,
              { borderColor: theme.colors.grey2 }
            ]}
            onPress={() => {
              setThemeMode('dark');
              setShowThemeModal(false);
            }}
          >
            <MaterialIcons
              name="dark-mode"
              size={24}
              color={themeMode === 'dark' ? theme.colors.primary : theme.colors.grey4}
            />
            <Text
              style={[
                styles.optionText,
                { color: themeMode === 'dark' ? theme.colors.primary : theme.colors.grey4 }
              ]}
            >
              Dark
            </Text>
            <Text
              style={[
                styles.optionDescription,
                { color: theme.colors.grey3 }
              ]}
            >
              Always dark
            </Text>
          </Pressable>
        </View>

        <Button
          title="Close"
          type="clear"
          onPress={() => setShowThemeModal(false)}
          containerStyle={styles.closeButton}
        />
      </View>
    </View>
  );

  const AnimationModal = () => (
    <View
      style={[
        styles.modalOverlay,
        { backgroundColor: 'rgba(0, 0, 0, 0.5)' }
      ]}
    >
      <View
        style={[
          styles.modalContent,
          {
            backgroundColor: theme.colors.grey0,
            borderColor: theme.colors.grey2,
          }
        ]}
      >
        <Text
          style={[
            styles.modalTitle,
            { color: theme.colors.grey5 }
          ]}
        >
          Card Animation
        </Text>
        
        <View style={styles.animationOptions}>
          <Pressable
            style={[
              styles.animationOption,
              cardAnimationType === 'flip' && styles.selectedOption,
              { borderColor: theme.colors.grey2 }
            ]}
            onPress={() => {
              setCardAnimationType('flip');
              setShowAnimationModal(false);
            }}
          >
            <MaterialIcons
              name="flip"
              size={24}
              color={cardAnimationType === 'flip' ? theme.colors.primary : theme.colors.grey4}
            />
            <Text
              style={[
                styles.optionText,
                { color: cardAnimationType === 'flip' ? theme.colors.primary : theme.colors.grey4 }
              ]}
            >
              Horizontal Flip
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.animationOption,
              cardAnimationType === 'flip-vertical' && styles.selectedOption,
              { borderColor: theme.colors.grey2 }
            ]}
            onPress={() => {
              setCardAnimationType('flip-vertical');
              setShowAnimationModal(false);
            }}
          >
            <MaterialIcons
              name="flip-camera-android"
              size={24}
              color={cardAnimationType === 'flip-vertical' ? theme.colors.primary : theme.colors.grey4}
            />
            <Text
              style={[
                styles.optionText,
                { color: cardAnimationType === 'flip-vertical' ? theme.colors.primary : theme.colors.grey4 }
              ]}
            >
              Vertical Flip
            </Text>
          </Pressable>
        </View>

        <Button
          title="Close"
          type="clear"
          onPress={() => setShowAnimationModal(false)}
          containerStyle={styles.closeButton}
        />
      </View>
    </View>
  );

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
                  styles.menuItemContainer,
                  index < section.items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.grey1,
                  }
                ]}
              >
                {item.type === 'switch' ? (
                  <View style={styles.menuItem}>
                    <View style={styles.menuItemContent}>
                      <MaterialIcons
                        name={item.icon}
                        size={22}
                        color={theme.colors.grey5}
                        style={styles.menuItemIcon}
                      />
                      <View>
                        <Text
                          style={[
                            styles.menuItemLabel,
                            { color: theme.colors.grey5 },
                            item.disabled && { color: theme.colors.grey3 }
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text
                            style={[
                              styles.menuItemDescription,
                              { color: theme.colors.grey3 }
                            ]}
                          >
                            {item.description}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Switch
                      value={item.value}
                      onValueChange={item.onChange}
                      trackColor={{
                        false: theme.colors.grey2,
                        true: theme.colors.primary + '80',
                      }}
                      thumbColor={item.value ? theme.colors.primary : theme.colors.grey5}
                      ios_backgroundColor={theme.colors.grey2}
                      disabled={item.disabled}
                    />
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.menuItem,
                      pressed && { opacity: 0.7, backgroundColor: theme.colors.grey1 }
                    ]}
                    onPress={item.onPress}
                    disabled={item.disabled}
                  >
                    <View style={styles.menuItemContent}>
                      <MaterialIcons
                        name={item.icon}
                        size={22}
                        color={theme.colors.grey5}
                        style={styles.menuItemIcon}
                      />
                      <View>
                        <Text
                          style={[
                            styles.menuItemLabel,
                            { color: theme.colors.grey5 },
                            item.disabled && { color: theme.colors.grey3 }
                          ]}
                        >
                          {item.label}
                        </Text>
                        {item.description && (
                          <Text
                            style={[
                              styles.menuItemDescription,
                              { color: theme.colors.grey3 }
                            ]}
                          >
                            {item.description}
                          </Text>
                        )}
                      </View>
                    </View>
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

      {showTimePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={(() => {
            const date = new Date();
            date.setHours(notificationSettings.dailyReminder.hour);
            date.setMinutes(notificationSettings.dailyReminder.minute);
            return date;
          })()}
          mode="time"
          is24Hour={true}
          onChange={handleTimeChange}
        />
      )}

      {showThemeModal && <ThemeModal />}
      {showAnimationModal && <AnimationModal />}
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
    paddingHorizontal: 10,
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
  menuItemContainer: {
    overflow: 'hidden',
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
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    gap: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  animationOptions: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  animationOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    minWidth: 120,
  },
  selectedOption: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E515',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 8,
  },
  menuItemDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  themeOptions: {
    gap: 12,
  },
  themeOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionDescription: {
    fontSize: 13,
    marginLeft: 'auto',
  },
}); 