import React, { useState } from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAudioFile, createAudioFile, createAudioSegment } from '../../lib/api/audio';
import { saveAudioFileOffline } from '../../lib/api/offline-audio';
import { saveAudioRecording } from '../../lib/services/audio';
import { isOnline as checkNetworkStatus } from '../../lib/services/flashcards';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';

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
  const [isAttaching, setIsAttaching] = useState(false);

  const handlePress = async () => {
    if (isAttaching) return;
    
    setIsAttaching(true);
    try {
      // Check network connectivity
      const isNetworkAvailable = await checkNetworkStatus();
      
      console.log('🔄 [AUDIO ATTACH] Button pressed', { 
        cardId, 
        side,
        hasCardId: Boolean(cardId),
        hasCreateCardFunction: Boolean(onCreateCard),
        networkStatus: isNetworkAvailable ? 'online' : 'offline'
      });
      
      // If no cardId and onCreateCard is provided, create the card first
      let currentCardId = cardId;
      if (!currentCardId && onCreateCard) {
        console.log('🔄 [AUDIO ATTACH] No cardId, creating card first');
        currentCardId = await onCreateCard();
        if (!currentCardId) {
          // Card creation failed or was cancelled
          console.log('❌ [AUDIO ATTACH] Card creation failed or was cancelled');
          setIsAttaching(false);
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
        setIsAttaching(false);
        return;
      }

      const file = result.assets[0];
      console.log('🔄 [AUDIO ATTACH] File selected', { 
        name: file.name, 
        uri: file.uri,
        mimeType: file.mimeType,
        size: file.size,
        platform: Platform.OS,
        attachToSide: side
      });
      
      // Use the unified audio service regardless of network status
      // This will save locally first and then upload if online
      const savedFile = await saveAudioFileOffline({
        uri: file.uri,
        mimeType: file.mimeType || 'audio/mpeg',
        name: file.name,
        size: file.size || 0,
        cardId: currentCardId,
        side: side
      });
      
      console.log('✅ [AUDIO ATTACH] Audio file saved', { 
        id: savedFile.id,
        filePath: savedFile.filePath,
        side: savedFile.side,
        networkStatus: isNetworkAvailable ? 'online' : 'offline'
      });
      
      // If online, also create the Supabase record
      if (isNetworkAvailable) {
        try {
          // Use the saved file path instead of the original URI for uploading
          // This ensures the file still exists when we try to upload it
          await handleOnlineAudioAttachment(file, savedFile.filePath, currentCardId);
        } catch (onlineError) {
          console.error('❌ [AUDIO ATTACH] Error uploading to Supabase, but local file saved:', onlineError);
          // Continue since we've saved locally already
        }
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: isNetworkAvailable ? 'Audio attached successfully' : 'Audio saved locally for sync later',
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
    } finally {
      setIsAttaching(false);
    }
  };

  const handleOnlineAudioAttachment = async (
    file: DocumentPicker.DocumentPickerAsset, 
    savedFilePath: string, 
    currentCardId: string
  ) => {
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
    
    // Verify the file exists at the saved path
    const fileInfo = await FileSystem.getInfoAsync(savedFilePath);
    console.log('🔍 [AUDIO ATTACH] Checking saved file', { 
      exists: fileInfo.exists, 
      uri: fileInfo.uri,
      ...(fileInfo.exists ? { size: fileInfo.size } : {})
    });
    
    if (!fileInfo.exists) {
      throw new Error('Saved file does not exist at path: ' + savedFilePath);
    }
    
    // Upload the audio file using the saved file path instead of the original URI
    console.log('🔄 [AUDIO ATTACH] Uploading audio file to Supabase from saved path');
    const uploadResponse = await uploadAudioFile({
      uri: fileInfo.uri,
      type: file.mimeType || 'audio/mpeg',
      name: file.name,
      file: fileToUpload,
    });
    console.log('✅ [AUDIO ATTACH] Audio file uploaded', { path: uploadResponse.path });

    // Create audio file record
    console.log('🔄 [AUDIO ATTACH] Creating audio file record in Supabase');
    const audioFile = await createAudioFile(
      uploadResponse.path,
      file.name,
      file.mimeType || 'audio/mpeg'
    );
    console.log('✅ [AUDIO ATTACH] Audio file record created', { id: audioFile.id });

    // Create audio segment
    console.log('🔄 [AUDIO ATTACH] Creating audio segment in Supabase', { 
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
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
        isAttaching && styles.disabled,
      ]}
      disabled={disabled || isAttaching}
    >
      <MaterialIcons
        name="mic"
        size={Platform.select({
          web: 24,
          default: 18,
        })}
        color={disabled || isAttaching ? "#A1A1AA" : "#4F46E5"}
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