import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Platform, StyleSheet, Animated, Text, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@rneui/themed';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Toast from 'react-native-toast-message';

interface AudioTextSegmentProps {
  text: string;
  audioUrl: string;
  isStudyMode?: boolean;
  onAudioComplete?: () => void;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AudioTextSegment({
  text,
  audioUrl,
  isStudyMode = false,
  onAudioComplete,
  color,
  style,
}: AudioTextSegmentProps) {
  const sound = useRef<Audio.Sound>();
  const webAudio = useRef<HTMLAudioElement>();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const [isLoading, setIsLoading] = useState(true);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);

  // Load and unload sound
  useEffect(() => {
    let isMounted = true;

    const loadSound = async () => {
      try {
        if (!audioUrl) {
          console.log('No audio URL provided');
          return;
        }

        setIsLoading(true);
        // Check if this is a local file path
        const isLocalFile = audioUrl.startsWith('file://') || (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob'));
        console.log('Loading audio from:', audioUrl, isLocalFile ? '(local file)' : '(remote URL)');

        if (isWeb) {
          // Web implementation using HTML5 Audio
          // Local files won't work on web due to security restrictions,
          // but we'll handle the error gracefully
          const audio = new window.Audio(audioUrl);
          audio.preload = 'auto';
          
          audio.addEventListener('canplaythrough', () => {
            if (isMounted) {
              console.log('Web audio loaded successfully');
              setIsSoundLoaded(true);
              setIsLoading(false);
            }
          });

          audio.addEventListener('ended', () => {
            console.log('Web audio playback completed');
            onAudioComplete?.();
          });

          audio.addEventListener('error', (error: ErrorEvent) => {
            console.error('Web audio loading error:', error);
            if (isMounted) {
              setIsSoundLoaded(false);
              setIsLoading(false);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load audio file',
              });
            }
          });

          webAudio.current = audio;
          await audio.load();
        } else {
          // Mobile implementation using Expo Audio
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            allowsRecordingIOS: false,
            interruptionModeIOS: 2,
            interruptionModeAndroid: 2,
          });

          try {
            console.log('Creating audio object for:', audioUrl);
            
            // For both remote and local files, we use the same approach
            // but with better error handling for local files
            const { sound: audioSound } = await Audio.Sound.createAsync(
              { uri: audioUrl },
              { 
                shouldPlay: false,
                volume: 1.0,
                isLooping: false,
                rate: 1.0,
                isMuted: false,
                progressUpdateIntervalMillis: 100,
                positionMillis: 0,
                androidImplementation: 'MediaPlayer',
                shouldCorrectPitch: true,
              },
              (status) => {
                if (status.isLoaded && status.didJustFinish) {
                  console.log('Audio playback completed');
                  onAudioComplete?.();
                }
              },
              true
            );

            if (!isMounted) {
              audioSound.unloadAsync();
              return;
            }

            console.log('Sound loaded successfully');
            sound.current = audioSound;
            setIsSoundLoaded(true);
          } catch (error) {
            console.error('Error loading sound:', error);
            if (isMounted) {
              setIsSoundLoaded(false);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Failed to load audio file${isLocalFile ? ' (local)' : ' (remote)'}`,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading sound:', error);
        if (isMounted) {
          setIsSoundLoaded(false);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load audio file',
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSound();

    return () => {
      isMounted = false;
      if (isWeb) {
        if (webAudio.current) {
          webAudio.current.pause();
          webAudio.current.src = '';
          webAudio.current = undefined;
        }
      } else {
        if (sound.current) {
          sound.current.unloadAsync();
        }
      }
      setIsSoundLoaded(false);
    };
  }, [audioUrl, onAudioComplete, isWeb]);

  const playSound = useCallback(async () => {
    try {
      if (isLoading) {
        console.log('Audio is still loading...');
        Toast.show({
          type: 'info',
          text1: 'Loading',
          text2: 'Please wait while the audio loads...',
        });
        return;
      }

      if (!isSoundLoaded) {
        console.log('Sound is not loaded, attempting to reload...');
        setIsLoading(true);
        
        // Check if this is a local file path
        const isLocalFile = audioUrl.startsWith('file://') || (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob'));
        console.log('Reloading audio from:', audioUrl, isLocalFile ? '(local file)' : '(remote URL)');
        
        if (isWeb) {
          if (webAudio.current) {
            await webAudio.current.load();
          }
        } else {
          if (sound.current) {
            try {
              await sound.current.loadAsync({ uri: audioUrl });
              console.log('Successfully reloaded audio');
            } catch (error) {
              console.error('Error reloading audio:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Failed to reload audio${isLocalFile ? ' (local)' : ' (remote)'}`,
              });
              setIsLoading(false);
              return;
            }
          }
        }
        setIsSoundLoaded(true);
        setIsLoading(false);
        return;
      }

      if (isWeb) {
        if (webAudio.current) {
          console.log('Playing web audio...');
          webAudio.current.currentTime = 0;
          await webAudio.current.play();
        }
      } else {
        if (sound.current) {
          console.log('Playing mobile audio...');
          const status = await sound.current.getStatusAsync();
          
          if (!status.isLoaded) {
            console.log('Reloading sound...');
            try {
              await sound.current.loadAsync({ uri: audioUrl });
              console.log('Successfully reloaded audio before playing');
            } catch (error) {
              console.error('Error reloading audio before playing:', error);
              const isLocalFile = audioUrl.startsWith('file://') || (!audioUrl.startsWith('http') && !audioUrl.startsWith('blob'));
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: `Failed to reload audio${isLocalFile ? ' (local)' : ' (remote)'}`,
              });
              return;
            }
          }
          
          await sound.current.setPositionAsync(0);
          await sound.current.playAsync();
          console.log('Audio playback started');
        }
      }

      // Animate the text
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Error playing sound:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to play audio',
      });
    }
  }, [isLoading, isSoundLoaded, scaleAnim, audioUrl, isWeb]);

  // Handle keyboard shortcut on web
  useEffect(() => {
    if (!isWeb || !isStudyMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        playSound();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWeb, isStudyMode, playSound]);

  if (!isStudyMode) {
    return (
      <Text
        onPress={playSound}
        style={[
          {
            color: color || '#000',
            textDecorationLine: 'underline',
            fontSize: 16,
          },
          style,
        ]}
      >
        {text}
      </Text>
    );
  }

  return (
    <Pressable
      onPress={playSound}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Play audio for ${text}`}
      accessibilityHint="Double tap to play the audio"
    >
      <Animated.Text
        style={[
          styles.text,
          {
            color: color || theme.colors.primary,
            transform: [{ scale: scaleAnim }],
            textDecorationLine: 'underline',
          },
          style,
        ]}
      >
        {text}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
    paddingHorizontal: 2,
    marginHorizontal: -2,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontSize: 16,
  },
}); 