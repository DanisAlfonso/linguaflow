import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashcardAudioPlayer } from './FlashcardAudioPlayer';
import { AudioAttachButton } from '../AudioAttachButton';
import type { CardAudioSegment } from '../../../types/audio';
import { deleteAudioSegment } from '../../../lib/api/audio';
import { Pressable } from 'react-native';
import Toast from 'react-native-toast-message';

interface FlashcardAudioSectionProps {
  label: string;
  audioSegments: CardAudioSegment[];
  cardId: string;
  side: 'front' | 'back';
  isEditing: boolean;
  onAudioChange: () => void;
}

export function FlashcardAudioSection({
  label,
  audioSegments,
  cardId,
  side,
  isEditing,
  onAudioChange,
}: FlashcardAudioSectionProps) {
  const { theme } = useTheme();

  const handleDeleteAudio = async (segmentId: string) => {
    try {
      await deleteAudioSegment(segmentId);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio file deleted successfully',
      });
      onAudioChange();
    } catch (error) {
      console.error('Error deleting audio segment:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete audio file',
      });
    }
  };

  if (audioSegments.length === 0 && !isEditing) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.grey4 }]}>
        {label}
      </Text>

      <View style={styles.audioList}>
        {audioSegments.map((segment) => (
          <View 
            key={segment.id}
            style={[
              styles.audioItem,
              { 
                borderColor: theme.colors.grey2,
                backgroundColor: theme.colors.grey0,
              }
            ]}
          >
            <View style={styles.audioPlayerContainer}>
              <FlashcardAudioPlayer
                audioUrl={segment.audio_file.url}
                fileName={segment.audio_file.name}
              />
            </View>
            
            {isEditing && (
              <Pressable
                onPress={() => handleDeleteAudio(segment.id)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && { opacity: 0.7 },
                  { backgroundColor: '#DC262615' }
                ]}
              >
                <MaterialIcons
                  name="delete"
                  size={20}
                  color="#DC2626"
                />
              </Pressable>
            )}
          </View>
        ))}

        {isEditing && (
          <AudioAttachButton
            cardId={cardId}
            side={side}
            onAudioAttached={onAudioChange}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  audioList: {
    gap: 8,
  },
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  audioPlayerContainer: {
    flex: 1,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
}); 