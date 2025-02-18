import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { Audio } from 'expo-av';
import { supabase } from '../../lib/supabase';
import type { MandarinCardData } from '../../types/flashcards';

interface MandarinTextProps {
  data: MandarinCardData;
  showPinyin?: boolean;
  characterSize?: number;
  color?: string;
  audioUrl?: string;
  isStudyMode?: boolean;
}

// Function to detect if a string contains Chinese characters
function containsChineseCharacters(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function MandarinText({ 
  data, 
  showPinyin = true, 
  characterSize = 24, 
  color = '#000',
  audioUrl,
  isStudyMode = false,
}: MandarinTextProps) {
  const { theme } = useTheme();
  const sound = useRef<Audio.Sound | HTMLAudioElement>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  console.log('MandarinText - Initializing with props:', {
    hasData: !!data,
    characterCount: data.characters.length,
    pinyinCount: data.pinyin.length,
    audioUrl,
    isStudyMode,
  });

  // Load and unload sound
  useEffect(() => {
    let isMounted = true;

    const loadSound = async () => {
      if (!audioUrl) {
        console.log('MandarinText - No audio URL provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setIsSoundLoaded(false);
        console.log('MandarinText - Loading audio from:', audioUrl);

        if (isWeb) {
          // Web implementation using HTML5 Audio
          console.log('MandarinText - Using web audio implementation');
          const audio = new window.Audio(audioUrl);
          audio.preload = 'auto';
          
          audio.addEventListener('canplaythrough', () => {
            if (isMounted) {
              console.log('MandarinText - Web audio loaded successfully');
              setIsSoundLoaded(true);
              setIsLoading(false);
            }
          });

          audio.addEventListener('ended', () => {
            console.log('MandarinText - Web audio playback completed');
          });

          audio.addEventListener('error', (error: ErrorEvent) => {
            console.error('MandarinText - Web audio loading error:', {
              error,
              audioUrl,
              errorMessage: error.message,
            });
            if (isMounted) {
              setIsSoundLoaded(false);
              setIsLoading(false);
            }
          });

          sound.current = audio;
          await audio.load();
        } else {
          console.log('MandarinText - Using Expo audio implementation');
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            allowsRecordingIOS: false,
            interruptionModeIOS: 2,
            interruptionModeAndroid: 2,
          });
          
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
              console.log('MandarinText - Audio status update:', status);
            }
          );

          if (!isMounted) {
            console.log('MandarinText - Component unmounted during load, cleaning up');
            audioSound.unloadAsync();
            return;
          }

          console.log('MandarinText - Mobile audio loaded successfully');
          sound.current = audioSound;
          setIsSoundLoaded(true);
        }
      } catch (error) {
        console.error('MandarinText - Error loading sound:', {
          error,
          audioUrl,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        if (isMounted) {
          setIsSoundLoaded(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSound();

    return () => {
      console.log('MandarinText - Cleaning up audio');
      isMounted = false;
      if (isWeb) {
        if (sound.current instanceof HTMLAudioElement) {
          sound.current.pause();
          sound.current.src = '';
        }
      } else {
        if (sound.current instanceof Audio.Sound) {
          sound.current.unloadAsync();
        }
      }
      setIsSoundLoaded(false);
    };
  }, [audioUrl, isWeb]);

  const playSound = useCallback(async () => {
    try {
      console.log('MandarinText - Attempting to play sound:', {
        isLoading,
        isSoundLoaded,
        audioUrl,
        soundType: isWeb ? 'web' : 'mobile',
      });

      if (isLoading) {
        console.log('MandarinText - Audio is still loading...');
        return;
      }

      if (!isSoundLoaded) {
        console.log('MandarinText - Sound is not loaded yet...');
        return;
      }

      if (isWeb) {
        const webAudio = sound.current as HTMLAudioElement;
        if (webAudio) {
          console.log('MandarinText - Playing web audio...');
          webAudio.currentTime = 0;
          await webAudio.play();
        }
      } else {
        const mobileSound = sound.current as Audio.Sound;
        if (mobileSound) {
          console.log('MandarinText - Playing mobile audio...');
          const status = await mobileSound.getStatusAsync();
          console.log('MandarinText - Current audio status:', status);
          
          if (!status.isLoaded && audioUrl) {
            console.log('MandarinText - Reloading sound...');
            await mobileSound.loadAsync({ uri: audioUrl });
          }
          
          await mobileSound.setPositionAsync(0);
          await mobileSound.playAsync();
        }
      }
    } catch (error) {
      console.error('MandarinText - Error playing sound:', {
        error,
        audioUrl,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }, [isLoading, isSoundLoaded, audioUrl, isWeb]);

  // Handle keyboard shortcut on web
  useEffect(() => {
    if (!isWeb || !isStudyMode || !audioUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        playSound();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWeb, isStudyMode, audioUrl, playSound]);

  // Get text color based on audio availability and hover state
  const getTextColor = () => {
    if (!audioUrl) return color;
    if (isHovered && isWeb) return theme.colors.primary;
    return theme.colors.primary;
  };

  // Get text style based on audio availability
  const getTextStyle = (baseStyle: any) => {
    if (!audioUrl) return baseStyle;
    return {
      ...baseStyle,
      ...(isWeb && {
        cursor: 'pointer',
        transition: 'color 0.2s ease',
      }),
      textDecorationLine: 'underline',
      textDecorationColor: theme.colors.primary,
    };
  };

  // If there's no data, return null
  if (!data.characters.length) {
    return null;
  }

  // Reconstruct the original text preserving spaces
  const text = data.characters.reduce((acc, char, index) => {
    // If the current character is a space and it's not at the start
    if (char === ' ' && index > 0) {
      // Add a space only if the previous character wasn't a space
      return acc[acc.length - 1] === ' ' ? acc : acc + ' ';
    }
    return acc + char;
  }, '');

  // If the text doesn't contain any Chinese characters, render it as a single block
  if (!containsChineseCharacters(text)) {
    const TextComponent = audioUrl ? Pressable : View;
    return (
      <TextComponent 
        style={styles.regularTextContainer}
        onPress={audioUrl ? playSound : undefined}
        onHoverIn={isWeb ? () => setIsHovered(true) : undefined}
        onHoverOut={isWeb ? () => setIsHovered(false) : undefined}
      >
        <Text 
          style={[
            styles.regularText, 
            { fontSize: characterSize },
            getTextStyle({ color: getTextColor() })
          ]}
        >
          {text}
        </Text>
      </TextComponent>
    );
  }

  // For Chinese text, filter out empty characters and spaces
  const characters = data.characters.filter(char => char.trim().length > 0);
  const pinyin = data.pinyin.filter(p => p.trim().length > 0);

  // Otherwise, render character by character with pinyin
  const Container = audioUrl ? Pressable : View;
  return (
    <Container 
      style={styles.container}
      onPress={audioUrl ? playSound : undefined}
      onHoverIn={isWeb ? () => setIsHovered(true) : undefined}
      onHoverOut={isWeb ? () => setIsHovered(false) : undefined}
    >
      {characters.map((char, index) => (
        <View key={index} style={styles.characterContainer}>
          {showPinyin && pinyin[index] ? (
            <Text 
              style={[
                styles.pinyin, 
                { fontSize: characterSize * 0.5 },
                getTextStyle({ color: getTextColor() })
              ]}
            >
              {pinyin[index]}
            </Text>
          ) : null}
          <Text 
            style={[
              styles.character, 
              { fontSize: characterSize },
              getTextStyle({ color: getTextColor() })
            ]}
          >
            {char}
          </Text>
        </View>
      ))}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  regularTextContainer: {
    width: '100%',
    alignItems: 'center',
  },
  regularText: {
    fontWeight: '400',
    ...Platform.select({
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
    }),
  },
  characterContainer: {
    alignItems: 'center',
    gap: 4,
  },
  pinyin: {
    fontWeight: '500',
    ...Platform.select({
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
    }),
  },
  character: {
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
    }),
  },
}); 