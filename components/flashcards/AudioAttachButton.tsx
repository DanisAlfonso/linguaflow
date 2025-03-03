import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAudioFile, createAudioFile, createAudioSegment } from '../../lib/api/audio';
import Toast from 'react-native-toast-message';

interface AudioAttachButtonProps {
  cardId: string;
  side: 'front' | 'back';
  onAudioAttached?: (cardId: string) => void;
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
      console.log('🔄 [AUDIO ATTACH] Button pressed', { 
        cardId, 
        side,
        hasCardId: Boolean(cardId),
        hasCreateCardFunction: Boolean(onCreateCard)
      });
      
      // If no cardId and onCreateCard is provided, create the card first
      let currentCardId = cardId;
      if (!currentCardId && onCreateCard) {
        console.log('🔄 [AUDIO ATTACH] No cardId, creating card first');
        currentCardId = await onCreateCard();
        if (!currentCardId) {
          // Card creation failed or was cancelled
          console.log('❌ [AUDIO ATTACH] Card creation failed or was cancelled');
          return;
        }
        console.log('✅ [AUDIO ATTACH] Card created with ID:', currentCardId);
      }

      console.log('🔄 [AUDIO ATTACH] Opening document picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log('🔄 [AUDIO ATTACH] Document picker cancelled');
        return;
      }

      const file = result.assets[0];
      console.log('🔄 [AUDIO ATTACH] File selected', { 
        name: file.name, 
        uri: file.uri,
        mimeType: file.mimeType,
        size: file.size,
        platform: Platform.OS
      });
      
      // Get the actual File object on web platform
      let fileToUpload: File | undefined;
      if (Platform.OS === 'web') {
        // On web, we need to fetch the file to get its content
        console.log('🔄 [AUDIO ATTACH] Web platform - fetching file content');
        const response = await fetch(file.uri);
        const blob = await response.blob();
        fileToUpload = new File([blob], file.name, {
          type: file.mimeType || 'audio/mpeg'
        });
        console.log('✅ [AUDIO ATTACH] Web File object created', { size: fileToUpload.size });
      }
      
      // Upload the audio file
      console.log('🔄 [AUDIO ATTACH] Uploading audio file');
      const uploadResponse = await uploadAudioFile({
        uri: file.uri,
        type: file.mimeType || 'audio/mpeg',
        name: file.name,
        file: fileToUpload,
      });
      console.log('✅ [AUDIO ATTACH] Audio file uploaded', { path: uploadResponse.path });

      // Create audio file record
      console.log('🔄 [AUDIO ATTACH] Creating audio file record');
      const audioFile = await createAudioFile(
        uploadResponse.path,
        file.name,
        file.mimeType || 'audio/mpeg'
      );
      console.log('✅ [AUDIO ATTACH] Audio file record created', { id: audioFile.id });

      // Create audio segment
      console.log('🔄 [AUDIO ATTACH] Creating audio segment', { 
        cardId: currentCardId,
        audioFileId: audioFile.id,
        side
      });
      const segment = await createAudioSegment(
        currentCardId,
        audioFile.id,
        0,
        1,
        side
      );
      console.log('✅ [AUDIO ATTACH] Audio segment created', { id: segment.id });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio attached successfully',
      });

      console.log('🔄 [AUDIO ATTACH] Calling onAudioAttached callback with cardId:', currentCardId);
      // Pass the card ID back to the parent component
      onAudioAttached?.(currentCardId);
      console.log('✅ [AUDIO ATTACH] Audio attachment process completed');
    } catch (error) {
      console.error('❌ [AUDIO ATTACH] Error attaching audio:', error);
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