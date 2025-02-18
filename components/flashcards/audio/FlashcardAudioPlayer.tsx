import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Pressable } from 'react-native';
import Toast from 'react-native-toast-message';

interface FlashcardAudioPlayerProps {
  audioUrl: string;
  fileName: string;
}

interface AudioError extends Error {
  code?: string;
  status?: number;
}

export function FlashcardAudioPlayer({ audioUrl, fileName }: FlashcardAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingError, setIsLoadingError] = useState(false);
  const sound = useRef<Audio.Sound | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    return () => {
      if (sound.current) {
        console.log('Cleaning up audio player');
        sound.current.unloadAsync();
        sound.current = null;
      }
    };
  }, []);

  const loadSound = async () => {
    try {
      setIsLoading(true);
      setIsLoadingError(false);
      
      if (sound.current) {
        console.log('Unloading previous sound');
        await sound.current.unloadAsync();
        sound.current = null;
      }

      console.log('Loading audio from URL:', audioUrl);
      
      // Configure audio mode first
      console.log('Configuring audio mode');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and load the sound with headers
      console.log('Creating sound object');
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { 
          uri: audioUrl,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        },
        { 
          shouldPlay: false,
          progressUpdateIntervalMillis: 100,
        },
        onPlaybackStatusUpdate,
        true // Enable debug logging
      );

      console.log('Audio loaded successfully:', {
        durationMillis: status.isLoaded ? status.durationMillis : null,
        isLoaded: status.isLoaded,
        uri: audioUrl,
        status: JSON.stringify(status)
      });

      sound.current = newSound;

      if (status.isLoaded) {
        setDuration(status.durationMillis || 0);
      } else {
        console.warn('Sound loaded but status is not "loaded":', status);
        throw new Error('Sound loaded but not ready to play');
      }
    } catch (error) {
      const audioError = error as AudioError;
      console.error('Error loading sound:', {
        message: audioError.message,
        code: audioError.code,
        url: audioUrl,
        stack: audioError.stack
      });
      setIsLoadingError(true);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to load audio: ${audioError.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('Audio URL changed, loading sound:', audioUrl);
    loadSound();
  }, [audioUrl]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      console.log('Playback status update - not loaded:', status);
      return;
    }

    console.log('Playback status update:', {
      isPlaying: status.isPlaying,
      positionMillis: status.positionMillis,
      durationMillis: status.durationMillis,
      didJustFinish: status.didJustFinish
    });

    setIsPlaying(status.isPlaying);
    setProgress(status.positionMillis / (status.durationMillis || 1));
    setCurrentTime(status.positionMillis);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  };

  const handlePlayPause = async () => {
    try {
      if (isLoading) {
        console.log('Cannot play/pause while loading');
        return;
      }

      if (isLoadingError) {
        console.log('Attempting to reload sound after error');
        await loadSound();
        return;
      }

      if (!sound.current) {
        console.log('No sound loaded, attempting to load');
        await loadSound();
        return;
      }

      const status = await sound.current.getStatusAsync();
      console.log('Current sound status:', status);

      if (!status.isLoaded) {
        console.log('Sound not properly loaded, attempting to reload');
        await loadSound();
        return;
      }

      if (isPlaying) {
        console.log('Pausing audio');
        await sound.current.pauseAsync();
      } else {
        if (status.positionMillis === status.durationMillis) {
          console.log('Resetting audio position to start');
          await sound.current.setPositionAsync(0);
        }
        console.log('Playing audio');
        const playResult = await sound.current.playAsync();
        console.log('Play result:', playResult);
      }
    } catch (error) {
      const audioError = error as AudioError;
      console.error('Error playing/pausing:', {
        message: audioError.message,
        code: audioError.code
      });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: `Failed to play audio: ${audioError.message}`,
      });
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handlePlayPause}
        style={({ pressed }) => [
          styles.playButton,
          pressed && { opacity: 0.7 },
          { backgroundColor: theme.colors.grey1 }
        ]}
        disabled={isLoading}
      >
        <MaterialIcons
          name={isLoading ? 'hourglass-empty' : isPlaying ? 'pause' : 'play-arrow'}
          size={20}
          color={theme.colors.grey5}
        />
      </Pressable>

      <View style={styles.infoContainer}>
        <Text style={[styles.fileName, { color: theme.colors.grey5 }]} numberOfLines={1}>
          {fileName}
        </Text>
        <View style={styles.progressContainer}>
          <View 
            style={[
              styles.progressBar,
              { backgroundColor: theme.colors.grey2 }
            ]}
          >
            <View
              style={[
                styles.progressFill,
                { 
                  backgroundColor: theme.colors.primary,
                  width: `${progress * 100}%`
                }
              ]}
            />
          </View>
          <Text style={[styles.time, { color: theme.colors.grey4 }]}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    gap: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    gap: 4,
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
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
}); 