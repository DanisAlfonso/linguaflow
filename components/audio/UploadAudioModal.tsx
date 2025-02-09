import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import { Text, useTheme, Dialog } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { Audio } from 'expo-av';
import { ensureAudioDirectory, generateAudioPath, saveAudioFile as saveAudioFileToStorage } from '../../lib/fs/audio';
import { saveAudioFolder, saveAudioFile } from '../../lib/db';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

interface UploadAudioModalProps {
  isVisible: boolean;
  onClose: () => void;
  onUploadStart: (file: any, metadata: { title: string; description: string }) => void;
}

// Define the DocumentAsset type
type DocumentAsset = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

export function UploadAudioModal({
  isVisible,
  onClose,
}: UploadAudioModalProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [progress, setProgress] = useState(0);

  const handleFilePick = async () => {
    try {
      // Request permissions if needed
      if (Platform.OS !== 'web') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Toast.show({
            type: 'error',
            text1: 'Permission required',
            text2: 'Please grant access to media library',
          });
          return;
        }
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        // Validate each file
        const validFiles = result.assets.filter(file => {
          // Validate file size (max 100MB)
          if (file.size && file.size > 100 * 1024 * 1024) {
            Toast.show({
              type: 'error',
              text1: 'File too large',
              text2: `${file.name} is over 100MB limit`,
            });
            return false;
          }
          return true;
        });

        if (validFiles.length > 0) {
          setSelectedFiles(prev => [...prev, { assets: validFiles, canceled: false }]);
        }
      }
    } catch (error) {
      console.error('Error picking files:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to select audio files',
      });
    }
  };

  const processFile = async (file: DocumentAsset) => {
    try {
      console.log('🎵 Processing file:', {
        name: file.name,
        uri: file.uri,
        mimeType: file.mimeType,
        size: file.size
      });

      setCurrentFile(file.name);

      // Create a unique path for the file
      const filePath = generateAudioPath(file.name);
      console.log('📁 Generated file path:', filePath);

      // Copy file to app's storage
      console.log('📋 Copying file to local storage...');
      await FileSystem.copyAsync({
        from: file.uri,
        to: filePath
      });
      console.log('✅ File copied successfully');

      // Get audio duration
      console.log('⏱️ Getting audio duration...');
      let duration = 0;
      const { sound } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: false }
      );
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        duration = Math.round(status.durationMillis / 1000);
        console.log('⏱️ Duration:', duration, 'seconds');
      } else {
        console.warn('⚠️ Could not get audio duration, using 0');
      }
      await sound.unloadAsync();

      // Verify file exists after copy
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      console.log('📄 File info after copy:', fileInfo);

      // Save to database
      console.log('💾 Saving to database with data:', {
        folder_id: null,
        user_id: user!.id,
        title: file.name.replace(/\.[^/.]+$/, ''),
        duration,
        file_path: filePath,
        original_filename: file.name,
        mime_type: file.mimeType || 'audio/mpeg',
        size: file.size || 0,
      });

      const savedFile = await saveAudioFile({
        folder_id: null, // Root folder
        user_id: user!.id,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        duration,
        file_path: filePath,
        original_filename: file.name,
        mime_type: file.mimeType || 'audio/mpeg',
        size: file.size || 0,
      });

      console.log('✅ File saved to database:', savedFile);
      return true;
    } catch (error) {
      console.error('❌ Error processing file:', {
        file: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        fullError: error
      });
      return false;
    }
  };

  const handleImport = async () => {
    if (!user) {
      console.warn('❌ No user found for import');
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please sign in to import audio files',
      });
      return;
    }

    try {
      console.log('🚀 Starting import process...');
      setIsProcessing(true);
      
      console.log('📁 Ensuring audio directory exists...');
      await ensureAudioDirectory();

      let successCount = 0;
      let failCount = 0;
      const totalFiles = selectedFiles.reduce((acc, result) => 
        acc + (result.assets?.length || 0), 0);
      
      console.log(`📊 Processing ${totalFiles} total files...`);

      for (const result of selectedFiles) {
        if (result.assets) {
          for (const file of result.assets) {
            console.log(`\n🎵 Starting to process file: ${file.name}`);
            const success = await processFile(file);
            if (success) {
              successCount++;
              console.log(`✅ Successfully processed: ${file.name}`);
            } else {
              failCount++;
              console.log(`❌ Failed to process: ${file.name}`);
            }
            setProgress((successCount + failCount) / totalFiles * 100);
          }
        }
      }

      console.log('📊 Import summary:', {
        totalFiles,
        successCount,
        failCount
      });

      Toast.show({
        type: successCount > 0 ? 'success' : 'error',
        text1: 'Import Complete',
        text2: `${successCount} files imported, ${failCount} failed`,
      });

      // Clear selection and close modal
      setSelectedFiles([]);
      onClose();

    } catch (error) {
      console.error('❌ Error during import:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fullError: error
      });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to import files',
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setCurrentFile('');
      console.log('🏁 Import process finished');
    }
  };

  const totalFiles = selectedFiles.reduce((acc, result) => 
    acc + (result.assets?.length || 0), 0);

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
          Import Audio
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
            name="library-music"
            size={48}
            color={theme.colors.primary}
          />
          <Text style={[styles.uploadText, { color: theme.colors.grey5 }]}>
            {totalFiles > 0 
              ? `${totalFiles} file${totalFiles === 1 ? '' : 's'} selected`
              : 'Select audio files or folders'}
          </Text>
          <Text style={[styles.uploadSubtext, { color: theme.colors.grey3 }]}>
            Supports MP3, WAV, M4A • Max 100MB per file
          </Text>
        </LinearGradient>
      </Pressable>

      {isProcessing && (
        <View style={styles.progressContainer}>
          <Text style={[styles.progressText, { color: theme.colors.grey3 }]}>
            Processing: {currentFile}
          </Text>
          <View style={[
            styles.progressBar,
            { backgroundColor: theme.colors.grey1 }
          ]}>
            <View 
              style={[
                styles.progressFill,
                { 
                  backgroundColor: theme.colors.primary,
                  width: `${progress}%`
                }
              ]} 
            />
          </View>
        </View>
      )}

      <View style={styles.dialogActions}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.cancelButton,
            { 
              backgroundColor: theme.mode === 'dark' 
                ? pressed 
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.1)'
                : pressed
                  ? theme.colors.grey1
                  : theme.colors.grey0
            }
          ]}
        >
          <Text style={[
            styles.cancelButtonText,
            { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }
          ]}>
            Cancel
          </Text>
        </Pressable>
        <View style={styles.importButton}>
          <LinearGradient
            colors={['#4F46E5', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.importButtonGradient}
          >
            <Pressable
              onPress={handleImport}
              disabled={totalFiles === 0 || isProcessing}
              style={({ pressed }) => [
                styles.buttonContent,
                { 
                  opacity: (totalFiles === 0 || isProcessing) 
                    ? 0.5 
                    : pressed ? 0.9 : 1 
                }
              ]}
            >
              <Text style={styles.importButtonText}>
                {isProcessing ? 'Processing...' : 'Import Files'}
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
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
  progressContainer: {
    padding: 20,
    paddingTop: 0,
  },
  progressText: {
    fontSize: 14,
    marginBottom: 8,
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
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 20,
    backgroundColor: 'transparent',
    gap: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  importButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  importButtonGradient: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
}); 