import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Button, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface StudyHeaderProps {
  currentIndex: number;
  totalCards: number;
  isRecordingEnabled: boolean;
  onRecordingToggle: () => void;
  currentCardId: string;
}

export function StudyHeader({
  currentIndex,
  totalCards,
  isRecordingEnabled,
  onRecordingToggle,
  currentCardId,
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
              name="close"
              size={24}
              color={theme.colors.grey5}
            />
          }
          onPress={() => router.back()}
        />
      </View>
      <View style={styles.progress}>
        <View 
          style={[
            styles.progressBar, 
            { backgroundColor: theme.colors.grey2 }
          ]}
        >
          <View 
            style={[
              styles.progressFill,
              { 
                backgroundColor: '#4F46E5',
                width: `${progress}%`,
              },
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: theme.colors.grey4 }]}>
          {currentIndex + 1} / {totalCards}
        </Text>
      </View>
      <View style={styles.headerRight}>
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
        />
        <Button
          type="clear"
          icon={
            <MaterialIcons
              name={isRecordingEnabled ? "mic" : "mic-none"}
              size={24}
              color={isRecordingEnabled ? theme.colors.primary : theme.colors.grey5}
            />
          }
          onPress={onRecordingToggle}
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
  progress: {
    flex: 1,
    marginHorizontal: 16,
    gap: 8,
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
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 