import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Button, useTheme, Badge } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface StudyHeaderProps {
  currentIndex: number;
  totalCards: number;
  isRecordingEnabled: boolean;
  onRecordingToggle: () => void;
  currentCardId: string;
  isOffline?: boolean;
}

export function StudyHeader({
  currentIndex,
  totalCards,
  isRecordingEnabled,
  onRecordingToggle,
  currentCardId,
  isOffline = false,
}: StudyHeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const progress = totalCards > 0 ? ((currentIndex) / totalCards) * 100 : 0;

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Button
          type="clear"
          icon={
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={theme.colors.grey5}
            />
          }
          onPress={() => router.back()}
          containerStyle={styles.backButton}
        />
      </View>

      <View style={styles.headerCenter}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.colors.grey5 }]}>
            {currentIndex + 1} / {totalCards}
          </Text>
          
          {isOffline && (
            <Badge
              value="OFFLINE"
              status="warning"
              containerStyle={styles.offlineBadge}
            />
          )}
        </View>
        
        <View
          style={[
            styles.progressBar,
            { backgroundColor: theme.colors.grey3 },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.headerRight}>
        {!isOffline && (
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name="headset"
                size={24}
                color={theme.colors.grey5}
              />
            }
            onPress={() => router.push(`/flashcards/${currentCardId}/recordings`)}
            containerStyle={styles.iconButton}
          />
        )}
        <Button
          type="clear"
          icon={
            <MaterialIcons
              name={isRecordingEnabled ? 'mic' : 'mic-none'}
              size={24}
              color={
                isRecordingEnabled ? theme.colors.primary : theme.colors.grey5
              }
            />
          }
          onPress={onRecordingToggle}
          containerStyle={styles.iconButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 16,
    gap: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  backButton: {
    marginRight: 16,
  },
  offlineBadge: {
    marginLeft: 8,
  },
  iconButton: {
    marginLeft: 16,
  },
}); 