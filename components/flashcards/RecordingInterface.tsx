import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../../contexts/AuthContext';
import { generateRecordingPath, saveRecordingFile, getRecordingUri, deleteRecordingFile } from '../../lib/fs/recordings';
import { saveLocalRecording, deleteLocalRecording } from '../../lib/db';
import { syncRecordings } from '../../lib/sync/recordings';
import { getCardRecordings, deleteRecording } from '../../lib/api/audio';
import type { LocalRecording, Recording } from '../../types/audio';
import Toast from 'react-native-toast-message';
import { WaveformVisualizer } from './WaveformVisualizer';

interface Props {
  isVisible: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  recordingDuration: number;
  playbackProgress: number;
  meterLevel: number;
  hasRecording: boolean;
  cardId: string;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onStartPlayback: () => Promise<void>;
  onStopPlayback: () => Promise<void>;
  onDeleteRecording: () => void;
  onClose: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackProgress: (progress: number) => void;
  uploadedRecording?: Recording | null;
  setHasRecording: (hasRecording: boolean) => void;
  setUploadedRecording: React.Dispatch<React.SetStateAction<Recording | null>>;
}

async function configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.error('Error configuring audio session:', error);
  }
}

export function RecordingInterface({
  isVisible,
  isRecording,
  isPlaying,
  recordingDuration,
  playbackProgress,
  meterLevel,
  hasRecording,
  cardId,
  onStartRecording,
  onStopRecording,
  onStartPlayback,
  onStopPlayback,
  onDeleteRecording,
  onClose,
  setIsPlaying,
  setPlaybackProgress,
  uploadedRecording,
  setHasRecording,
  setUploadedRecording,
}: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [currentRecording, setCurrentRecording] = useState<LocalRecording | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const sound = useRef<Audio.Sound>();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isRendered, setIsRendered] = useState(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      if (!user) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'You must be logged in to record',
        });
        return;
      }

      await onStartRecording();
    } catch (error) {
      console.error('Error starting recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start recording',
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      await onStopRecording();

      if (!recording) return;

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('No recording URI available');
      }

      // Generate a path for permanent storage
      const filePath = generateRecordingPath(cardId);

      // Save the recording file
      await saveRecordingFile(uri, filePath);

      // Save to local database
      const savedRecording = await saveLocalRecording({
        card_id: cardId,
        user_id: user!.id,
        file_path: filePath,
        duration: recordingDuration,
      });

      setCurrentRecording(savedRecording);
      setRecording(null);

      // Try to sync immediately if possible
      try {
        setIsSyncing(true);
        await syncRecordings();
        
        // After successful sync, reload the recording from the server
        const recordings = await getCardRecordings(cardId);
        const latestRecording = recordings[0]; // Get the most recent recording
        if (latestRecording) {
          setUploadedRecording(latestRecording);
        }
      } catch (error) {
        console.error('Error syncing after recording:', error);
        // Even if sync fails, we still have the local recording
      } finally {
        setIsSyncing(false);
      }

      setHasRecording(true);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recording saved',
      });
    } catch (error) {
      console.error('Error saving recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save recording',
      });
    }
  };

  const handleStartPlayback = async () => {
    try {
      if (!currentRecording && !uploadedRecording) {
        console.error('No recording available for playback');
        return;
      }

      // Configure audio session
      await configureAudioSession();

      if (!sound.current) {
        // Determine the audio source - prefer uploaded recording URL
        const uri = uploadedRecording?.audio_url || 
                   (currentRecording && await getRecordingUri(currentRecording.file_path));
                   
        if (!uri) {
          throw new Error('No valid audio URI available');
        }

        console.log('Playing audio from:', uri);

        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri },
          { 
            progressUpdateIntervalMillis: 100,
            shouldPlay: true,
            volume: 1.0,
          },
          (status) => {
            if (status.isLoaded) {
              const durationMillis = status.durationMillis ?? 1;
              setPlaybackProgress(status.positionMillis / durationMillis);
              
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackProgress(0);
                if (sound.current) {
                  sound.current.unloadAsync();
                  sound.current = undefined;
                }
              }
            }
          }
        );

        console.log('Sound created with status:', status);
        sound.current = newSound;
      } else {
        await sound.current.playAsync();
      }

      setIsPlaying(true);
      onStartPlayback();
    } catch (error) {
      console.error('Error playing recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to play recording',
      });
    }
  };

  const handleStopPlayback = async () => {
    try {
      if (!sound.current) return;

      await sound.current.stopAsync();
      await sound.current.setPositionAsync(0);
      setIsPlaying(false);
      setPlaybackProgress(0);
      onStopPlayback();
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const handleDeleteRecording = async () => {
    try {
      if (!uploadedRecording) {
        console.error('No recording available to delete');
        return;
      }

      // Delete the recording from Supabase and storage
      await deleteRecording(uploadedRecording.id);

      // Clean up sound
      if (sound.current) {
        await sound.current.unloadAsync();
        sound.current = undefined;
      }
      
      setPlaybackProgress(0);
      setIsPlaying(false);
      setHasRecording(false);
      setUploadedRecording(null);
      onDeleteRecording();

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recording deleted',
      });
    } catch (error) {
      console.error('Error deleting recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete recording',
      });
    }
  };

  const handleNewRecording = () => {
    // Clean up sound
    if (sound.current) {
      sound.current.unloadAsync();
      sound.current = undefined;
    }
    
    // Reset all states to prepare for new recording
    setPlaybackProgress(0);
    setIsPlaying(false);
    setHasRecording(false);
    // Don't reset uploadedRecording as we don't want to delete the file
  };

  useEffect(() => {
    if (isVisible) {
      setIsRendered(true);
    }
    
    Animated.spring(slideAnim, {
      toValue: isVisible ? 1 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start(() => {
      if (!isVisible) {
        setIsRendered(false);
      }
    });
  }, [isVisible, slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!isRendered && !isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.grey2,
          transform: [{ translateY }],
          opacity: slideAnim,
          pointerEvents: isVisible ? 'auto' : 'none',
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isRecording ? theme.colors.error : 
            (hasRecording ? theme.colors.grey0 : theme.colors.primary) }]}>
            {isRecording ? 'Recording...' : (hasRecording ? formatDuration(recordingDuration) : 'Record Practice')}
          </Text>
          <View style={styles.headerRight}>
            {currentRecording && !currentRecording.synced && (
              <Text style={[styles.syncStatus, { color: theme.colors.warning }]}>
                {isSyncing ? 'Syncing...' : 'Not synced'}
              </Text>
            )}
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name="close"
                  size={24}
                  color={theme.colors.grey3}
                />
              }
              onPress={onClose}
            />
          </View>
        </View>

        <View style={styles.waveformContainer}>
          <WaveformVisualizer 
            isRecording={isRecording}
            isPlaying={isPlaying}
            meterLevel={meterLevel}
            playbackProgress={playbackProgress}
          />
        </View>

        <View style={styles.controls}>
          {hasRecording ? (
            <>
              <Button
                type="clear"
                icon={
                  <MaterialIcons
                    name="delete"
                    size={24}
                    color={theme.colors.error}
                  />
                }
                buttonStyle={styles.secondaryButton}
                onPress={handleDeleteRecording}
              />
              <Button
                type="clear"
                icon={
                  <MaterialIcons
                    name={isPlaying ? "stop" : "play-arrow"}
                    size={32}
                    color={theme.colors.primary}
                  />
                }
                buttonStyle={[
                  styles.mainButton,
                  {
                    backgroundColor: `${theme.colors.primary}15`,
                  },
                ]}
                onPress={isPlaying ? handleStopPlayback : handleStartPlayback}
              />
              <Button
                type="clear"
                icon={
                  <MaterialIcons
                    name="mic"
                    size={24}
                    color={theme.colors.primary}
                  />
                }
                buttonStyle={styles.secondaryButton}
                onPress={handleNewRecording}
              />
            </>
          ) : (
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name={isRecording ? "stop" : "mic"}
                  size={32}
                  color={isRecording ? theme.colors.error : theme.colors.primary}
                />
              }
              buttonStyle={[
                styles.mainButton,
                {
                  backgroundColor: isRecording 
                    ? `${theme.colors.error}15`
                    : `${theme.colors.primary}15`,
                },
              ]}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 16,
    height: 230,
    paddingBottom: 32,
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 4px -1px rgba(65, 57, 57, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: -1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 3,
      },
    }),
  },
  content: {
    flex: 1,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  syncStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  waveformContainer: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  mainButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  secondaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
}); 