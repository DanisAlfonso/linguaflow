import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationTime = {
  hour: number;
  minute: number;
  enabled: boolean;
};

type NotificationSettings = {
  dailyReminder: NotificationTime;
  weeklyProgress: boolean;
  streakAlerts: boolean;
};

type NotificationsContextType = {
  enabled: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  updateDailyReminderTime: (hour: number, minute: number) => Promise<void>;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  dailyReminder: {
    hour: 20,
    minute: 0,
    enabled: true,
  },
  weeklyProgress: true,
  streakAlerts: true,
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Load notification settings on mount
    const loadSettings = async () => {
      try {
        const [storedEnabled, storedSettings] = await Promise.all([
          AsyncStorage.getItem('notificationsEnabled'),
          AsyncStorage.getItem('notificationSettings'),
        ]);

        setEnabledState(storedEnabled === 'true');
        if (storedSettings) {
          setSettings(JSON.parse(storedSettings));
        }
      } catch (error) {
        console.error('Error loading notification settings:', error);
      }
    };
    loadSettings();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') return true;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  const scheduleDailyReminder = async () => {
    if (Platform.OS === 'web') return;

    // Cancel existing daily reminder
    await Notifications.cancelScheduledNotificationAsync('daily-reminder');

    if (!enabled || !settings.dailyReminder.enabled) return;

    const trigger = {
      hour: settings.dailyReminder.hour,
      minute: settings.dailyReminder.minute,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-reminder',
      content: {
        title: 'Time to Study! 📚',
        body: 'Keep your language skills sharp with a quick study session.',
        sound: true,
      },
      trigger,
    });
  };

  const setEnabled = async (value: boolean) => {
    try {
      if (value) {
        const permitted = await requestPermissions();
        if (!permitted) {
          console.log('Notification permissions denied');
          return;
        }
      }

      await AsyncStorage.setItem('notificationsEnabled', value.toString());
      setEnabledState(value);

      if (value) {
        await scheduleDailyReminder();
      } else {
        // Cancel all scheduled notifications
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch (error) {
      console.error('Error setting notification enabled state:', error);
    }
  };

  const updateSettings = async (newSettings: Partial<NotificationSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(updatedSettings));
      setSettings(updatedSettings);
      
      // Reschedule notifications with new settings
      if (enabled) {
        await scheduleDailyReminder();
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const updateDailyReminderTime = async (hour: number, minute: number) => {
    try {
      const updatedSettings = {
        ...settings,
        dailyReminder: {
          ...settings.dailyReminder,
          hour,
          minute,
        },
      };
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(updatedSettings));
      setSettings(updatedSettings);
      
      // Reschedule daily reminder with new time
      if (enabled && settings.dailyReminder.enabled) {
        await scheduleDailyReminder();
      }
    } catch (error) {
      console.error('Error updating daily reminder time:', error);
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        enabled,
        setEnabled,
        settings,
        updateSettings,
        updateDailyReminderTime,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
} 