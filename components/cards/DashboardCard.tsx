import React from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';

type DashboardCardProps = {
  title: string;
  subtitle?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  progress?: number;
  style?: any;
  cardType?: 'learning' | 'goals' | 'practice' | 'achievements';
};

export function DashboardCard({
  title,
  subtitle,
  icon,
  onPress,
  progress,
  style,
  cardType = 'learning',
}: DashboardCardProps) {
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const getCardColor = () => {
    switch (cardType) {
      case 'learning':
        return '#4F46E5';
      case 'goals':
        return '#059669';
      case 'practice':
        return '#B45309';
      case 'achievements':
        return '#9333EA';
      default:
        return theme.colors.primary;
    }
  };

  const cardColor = getCardColor();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          borderColor: theme.colors.grey2,
          transform: [
            { scale: pressed ? 0.98 : 1 },
            { translateY: 0 }
          ],
          backgroundColor: theme.colors.grey0,
        },
        isWeb && {
          cursor: 'pointer',
          transform: [
            { scale: pressed ? 0.98 : 1 },
            { translateY: pressed ? 0 : -4 }
          ],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.cardContent,
          { backgroundColor: theme.colors.grey0 },
        ]}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: cardColor + '20' },
            ]}
          >
            <MaterialIcons
              name={icon}
              size={28}
              color={cardColor}
            />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: theme.colors.grey5 }]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: theme.colors.grey3 }]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        {progress !== undefined && (
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.colors.grey1,
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: cardColor,
                    width: `${progress}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.grey3 }]}>
              {progress}%
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  cardContent: {
    padding: 24,
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  progressContainer: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '500',
    minWidth: 45,
  },
}); 