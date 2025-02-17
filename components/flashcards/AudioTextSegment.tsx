import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Platform, StyleSheet, Animated, Text, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@rneui/themed';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { supabase } from '../../lib/supabase';

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';
  const [fullAudioUrl, setFullAudioUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);

  // Get the full audio URL when the component mounts
  useEffect(() => {
    const getAudioUrl = async () => {
      try {
        setIsLoading(true);
        setIsSoundLoaded(false);
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('audio')
          .createSignedUrl(audioUrl, 3600);

        if (signedUrlError) {
          throw signedUrlError;
        }

        if (signedUrlData?.signedUrl) {
          console.log('Got signed URL for audio:', signedUrlData.signedUrl);
          setFullAudioUrl(signedUrlData.signedUrl);
        }
      } catch (error) {
        console.error('Error getting audio URL:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (audioUrl) {
      getAudioUrl();
    }

    // Cleanup
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
      setIsSoundLoaded(false);
    };
  }, [audioUrl]);

  // Load and unload sound
  useEffect(() => {
    let isMounted = true;

    const loadSound = async () => {
      try {
        if (!fullAudioUrl) return;

        console.log('Loading audio from:', fullAudioUrl);
        
        // Initialize audio with more permissive settings
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
          interruptionModeIOS: 2, // INTERRUPTION_MODE_IOS_DUCK_OTHERS
          interruptionModeAndroid: 2, // INTERRUPTION_MODE_ANDROID_DUCK_OTHERS
        });

        // Create and load the sound with optimized configuration
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: fullAudioUrl },
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
          true // Download first before playing
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
        }
      }
    };

    loadSound();

    return () => {
      isMounted = false;
      if (sound.current) {
        sound.current.unloadAsync();
      }
      setIsSoundLoaded(false);
    };
  }, [fullAudioUrl, onAudioComplete]);

  const playSound = useCallback(async () => {
    try {
      if (isLoading) {
        console.log('Audio is still loading URL...');
        return;
      }

      if (!isSoundLoaded) {
        console.log('Sound is not loaded yet...');
        return;
      }

      if (sound.current) {
        console.log('Playing audio...');
        await sound.current.setPositionAsync(0);
        const status = await sound.current.getStatusAsync();
        
        if (!status.isLoaded) {
          console.log('Reloading sound...');
          await sound.current.loadAsync({ uri: fullAudioUrl });
        }
        
        await sound.current.playAsync();

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
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [isLoading, isSoundLoaded, scaleAnim, fullAudioUrl]);

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
    fontWeight: '500',
  },
  shortcut: {
    fontSize: 12,
    opacity: 0.7,
  },
}); 