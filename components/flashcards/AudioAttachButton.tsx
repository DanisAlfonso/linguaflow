import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAudioFile, createAudioFile, createAudioSegment } from '../../lib/api/audio';
import Toast from 'react-native-toast-message';

interface AudioFile {
  uri: string;
  type: string;
  name: string;
  size: number;
  file?: File;
  mimeType?: string;
}

interface AudioAttachButtonProps {
  cardId: string;
  side: 'front' | 'back';
  onAudioAttached: () => void;
}

export function AudioAttachButton({ cardId, side, onAudioAttached }: AudioAttachButtonProps) {
  const { theme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const handlePress = async () => {
    if (isUploading) return;

    // Validate card ID
    if (!cardId) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please create the card first before adding audio',
      });
      return;
    }

    let uploadFile: AudioFile | null = null;

    try {
      setIsUploading(true);

      if (isWeb) {
        // For web, use the web file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        const fileSelected = await new Promise<File | null>((resolve) => {
          input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0] || null;
            resolve(file);
          };
          input.click();
        });

        if (!fileSelected) {
          return;
        }

        // For web, we don't need to create a blob URL anymore
        uploadFile = {
          uri: '', // We don't need the URI for web uploads
          type: fileSelected.type,
          name: fileSelected.name,
          size: fileSelected.size,
          file: fileSelected, // This is the important part for web uploads
        };
      } else {
        // For native, use DocumentPicker
        const result = await DocumentPicker.getDocumentAsync({
          type: ['audio/*'],
          copyToCacheDirectory: true,
        });

        if (result.canceled) {
          return;
        }

        const asset = result.assets[0];
        if (!asset.size) {
          throw new Error('Could not determine file size');
        }
        
        uploadFile = {
          uri: asset.uri,
          type: asset.mimeType || 'audio/mpeg',
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType,
        };
      }

      if (!uploadFile) {
        return;
      }

      // Validate file size (max 10MB)
      if (uploadFile.size > 10 * 1024 * 1024) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Audio file must be smaller than 10MB',
        });
        return;
      }

      console.log('Uploading audio file...', { cardId, side, file: uploadFile });

      // Upload the audio file
      const uploadedFile = await uploadAudioFile({
        uri: uploadFile.uri,
        type: uploadFile.type,
        name: uploadFile.name,
        file: uploadFile.file,
      });

      console.log('Audio file uploaded:', uploadedFile);

      // Create audio file record
      const audioFile = await createAudioFile(
        uploadedFile.path,
        uploadFile.name,
        uploadFile.type
      );

      console.log('Audio file record created:', audioFile);

      // Create audio segment
      await createAudioSegment(
        cardId,
        audioFile.id,
        0,
        1,
        side
      );

      console.log('Audio segment created');

      onAudioAttached();

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio attached successfully',
      });
    } catch (error) {
      console.error('Error attaching audio:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to attach audio. Please try again.',
      });
    } finally {
      setIsUploading(false);
      if (isWeb && uploadFile?.file) {
        URL.revokeObjectURL(URL.createObjectURL(uploadFile.file));
      }
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.button, { 
        backgroundColor: theme.colors.grey0,
        borderColor: theme.colors.grey2,
        opacity: isUploading ? 0.5 : 1,
      }]}
      onPress={handlePress}
      disabled={isUploading}
    >
      <MaterialIcons 
        name={isUploading ? "hourglass-empty" : "mic"}
        size={20} 
        color={theme.colors.primary}
        style={styles.icon} 
      />
      <Text style={[styles.text, { color: theme.colors.primary }]}>
        {isUploading ? "Uploading..." : "Add Audio"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 