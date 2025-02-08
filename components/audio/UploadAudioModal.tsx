import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  TextInput,
  Animated,
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
  const animatedProgress = React.useRef(new Animated.Value(0)).current;
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Update animated progress when uploadProgress changes
  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: uploadProgress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

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

        // For web platform, we need to get the actual File object
        if (Platform.OS === 'web') {
          // The file object is already available in the result for web
          const response = await fetch(file.uri);
          const blob = await response.blob();
          const webFile = new File([blob], file.name, { type: file.mimeType });
          result.assets[0].file = webFile;
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

  const simulateProgress = useCallback(() => {
    // Reset progress
    setUploadProgress(0);
    animatedProgress.setValue(0);

    // Simulate progress in steps
    const steps = [
      { value: 30, duration: 500 },
      { value: 50, duration: 800 },
      { value: 70, duration: 1000 },
      { value: 85, duration: 1200 },
    ];

    // Chain the animations
    const animations = steps.map((step, index) =>
      Animated.timing(animatedProgress, {
        toValue: step.value,
        duration: step.duration,
        useNativeDriver: false,
      })
    );

    Animated.sequence(animations).start();
  }, [animatedProgress]);

  const handleUpload = async () => {
    if (!selectedFile || selectedFile.canceled) return;

    try {
      setIsUploading(true);
      simulateProgress();
      
      const file = selectedFile.assets[0];

      // Upload the audio file
      const uploadResponse = await uploadAudioFile({
        uri: file.uri,
        type: file.mimeType || 'audio/mpeg',
        name: file.name,
        file: Platform.OS === 'web' ? file.file : undefined,
      });

      // Once upload is complete, animate to 100%
      Animated.timing(animatedProgress, {
        toValue: 100,
        duration: 500,
        useNativeDriver: false,
      }).start();

      setUploadProgress(100);

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

      // Wait for the final animation to complete
      setTimeout(() => {
        onUploadComplete(audioFile);
        onClose();
      }, 500);

    } catch (error) {
      console.error('Error uploading audio:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to upload audio',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Update progress text based on animated value
  const [displayProgress, setDisplayProgress] = useState(0);
  
  useEffect(() => {
    const listener = animatedProgress.addListener(({ value }) => {
      setDisplayProgress(Math.round(value));
    });
    return () => animatedProgress.removeListener(listener);
  }, [animatedProgress]);

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

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

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
          Add Audio
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
        <View style={styles.progressSection}>
          <View style={styles.progressContainer}>
            <Animated.View 
              style={[
                styles.progressBackground,
                {
                  width: animatedProgress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }
              ]}
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressBar}
              />
            </Animated.View>
          </View>
          <Text style={[styles.progressText, { color: theme.colors.grey3 }]}>
            {isUploading ? 'Uploading...' : 'Adding...'} {displayProgress}%
          </Text>
        </View>
      )}

      <View style={styles.dialogActions}>
        <Pressable
          onPress={onClose}
          disabled={isUploading}
          style={({ pressed }) => [
            styles.cancelButton,
            { 
              backgroundColor: theme.mode === 'dark' 
                ? pressed 
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(255, 255, 255, 0.1)'
                : pressed
                  ? theme.colors.grey1
                  : theme.colors.grey0,
              opacity: isUploading ? 0.5 : 1
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
        <View style={styles.addButton}>
          <LinearGradient
            colors={['#4F46E5', '#6366F1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addButtonGradient}
          >
            <Pressable
              onPress={handleUpload}
              disabled={!selectedFile || isUploading || !title.trim()}
              style={({ pressed }) => [
                styles.buttonContent,
                { opacity: (!selectedFile || isUploading || !title.trim()) ? 0.5 : pressed ? 0.9 : 1 }
              ]}
            >
              {isUploading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.addButtonText}>Add to Library</Text>
              )}
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
  progressSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  progressBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
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
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
}); 