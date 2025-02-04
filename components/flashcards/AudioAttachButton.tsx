import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAudioFile, createAudioFile, createAudioSegment } from '../../lib/api/audio';
import Toast from 'react-native-toast-message';

interface AudioAttachButtonProps {
  cardId: string;
  side: 'front' | 'back';
  onAudioAttached?: () => void;
}

export function AudioAttachButton({ cardId, side, onAudioAttached }: AudioAttachButtonProps) {
  const handlePress = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Upload the audio file
      const uploadResponse = await uploadAudioFile({
        uri: file.uri,
        type: file.mimeType || 'audio/mpeg',
        name: file.name,
      });

      // Create audio file record
      const audioFile = await createAudioFile(
        uploadResponse.path,
        file.name,
        file.mimeType || 'audio/mpeg'
      );

      // Create audio segment
      await createAudioSegment(
        cardId,
        audioFile.id,
        0,
        1,
        side
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio attached successfully',
      });

      onAudioAttached?.();
    } catch (error) {
      console.error('Error attaching audio:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to attach audio',
      });
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
    >
      <MaterialIcons
        name="mic"
        size={Platform.select({
          web: 24,
          default: 18,
        })}
        color="#4F46E5"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
}); 