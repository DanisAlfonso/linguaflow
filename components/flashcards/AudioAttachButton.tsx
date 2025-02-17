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
  onCreateCard?: () => Promise<string>;
  disabled?: boolean;
}

export function AudioAttachButton({ 
  cardId, 
  side, 
  onAudioAttached,
  onCreateCard,
  disabled = false 
}: AudioAttachButtonProps) {
  const handlePress = async () => {
    try {
      // If no cardId and onCreateCard is provided, create the card first
      let currentCardId = cardId;
      if (!currentCardId && onCreateCard) {
        currentCardId = await onCreateCard();
        if (!currentCardId) {
          // Card creation failed or was cancelled
          return;
        }
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      
      // Get the actual File object on web platform
      let fileToUpload: File | undefined;
      if (Platform.OS === 'web') {
        // On web, we need to fetch the file to get its content
        const response = await fetch(file.uri);
        const blob = await response.blob();
        fileToUpload = new File([blob], file.name, {
          type: file.mimeType || 'audio/mpeg'
        });
      }
      
      // Upload the audio file
      const uploadResponse = await uploadAudioFile({
        uri: file.uri,
        type: file.mimeType || 'audio/mpeg',
        name: file.name,
        file: fileToUpload,
      });

      // Create audio file record
      const audioFile = await createAudioFile(
        uploadResponse.path,
        file.name,
        file.mimeType || 'audio/mpeg'
      );

      // Create audio segment
      await createAudioSegment(
        currentCardId,
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
        disabled && styles.disabled,
      ]}
      disabled={disabled}
    >
      <MaterialIcons
        name="mic"
        size={Platform.select({
          web: 24,
          default: 18,
        })}
        color={disabled ? "#A1A1AA" : "#4F46E5"}
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
  disabled: {
    opacity: 0.5,
  },
}); 