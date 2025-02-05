import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Text, useTheme, Button, Dialog } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAudioFile, createAudioFile } from '../../lib/api/audio';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';

interface UploadAudioModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUploadComplete: (audioFile: any) => void;
}

export function UploadAudioModal({
  isVisible,
  onClose,
  onUploadComplete,
}: UploadAudioModalProps) {
  const { theme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleFilePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const file = result.assets[0];
        // Validate file size (max 10MB)
        if (file.size && file.size > 10 * 1024 * 1024) {
          Toast.show({
            type: 'error',
            text1: 'File too large',
            text2: 'Please select an audio file under 10MB',
          });
          return;
        }
        setSelectedFile(result);
        // Use filename (without extension) as default title
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to select audio file',
      });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || selectedFile.canceled) return;

    try {
      setIsUploading(true);
      const file = selectedFile.assets[0];

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

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio uploaded successfully',
      });

      onUploadComplete(audioFile);
      onClose();
    } catch (error) {
      console.error('Error uploading audio:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload audio',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const renderUploadArea = () => (
    <Pressable
      onPress={handleFilePick}
      style={({ pressed }) => [
        styles.uploadArea,
        { 
          borderColor: theme.colors.grey3,
          backgroundColor: theme.colors.grey0,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }]
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(79, 70, 229, 0.1)', 'rgba(99, 102, 241, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.uploadAreaGradient}
      >
        <MaterialIcons
          name="cloud-upload"
          size={48}
          color={theme.colors.primary}
        />
        <Text style={[styles.uploadText, { color: theme.colors.grey5 }]}>
          {selectedFile?.assets?.[0]?.name || 'Click or drag audio file here'}
        </Text>
        <Text style={[styles.uploadSubtext, { color: theme.colors.grey3 }]}>
          Supports MP3, WAV, M4A • Max 10MB
        </Text>
      </LinearGradient>
    </Pressable>
  );

  return (
    <Dialog
      isVisible={isVisible}
      onBackdropPress={onClose}
      overlayStyle={[
        styles.dialog,
        { backgroundColor: theme.colors.background }
      ]}
    >
      <View style={styles.modalHeader}>
        <Text h4 style={[styles.modalTitle, { color: theme.colors.grey5 }]}>
          Upload Audio
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 0.7 : 1 }
          ]}
        >
          <MaterialIcons name="close" size={24} color={theme.colors.grey3} />
        </Pressable>
      </View>
      
      {renderUploadArea()}

      <View style={styles.form}>
        <TextInput
          placeholder="Title"
          value={title}
          onChangeText={setTitle}
          autoCapitalize="sentences"
          style={[
            styles.input,
            { 
              color: theme.colors.grey5,
              backgroundColor: theme.colors.grey0,
              borderColor: theme.colors.grey2
            }
          ]}
          placeholderTextColor={theme.colors.grey3}
        />
        
        <TextInput
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={[
            styles.input,
            styles.textArea,
            { 
              color: theme.colors.grey5,
              backgroundColor: theme.colors.grey0,
              borderColor: theme.colors.grey2
            }
          ]}
          placeholderTextColor={theme.colors.grey3}
        />
      </View>

      {isUploading && (
        <View style={styles.progressContainer}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBar, { width: `${uploadProgress}%` }]}
          />
        </View>
      )}

      <Dialog.Actions>
        <Button
          type="clear"
          title="Cancel"
          onPress={onClose}
          disabled={isUploading}
          titleStyle={{ color: theme.colors.grey3 }}
        />
        <Button
          title={isUploading ? 'Uploading...' : 'Upload'}
          onPress={handleUpload}
          disabled={!selectedFile || isUploading || !title.trim()}
          loading={isUploading}
          buttonStyle={{
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 10,
          }}
        />
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: {
    width: Platform.OS === 'web' ? 480 : '90%',
    maxWidth: 480,
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    margin: 20,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  uploadAreaGradient: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    padding: 20,
  },
  input: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
}); 