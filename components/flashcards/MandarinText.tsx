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
  const sound = useRef<Audio.Sound>();
  const [fullAudioUrl, setFullAudioUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSoundLoaded, setIsSoundLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  // Get the full audio URL when the component mounts
  useEffect(() => {
    const getAudioUrl = async () => {
      if (!audioUrl) return;
      
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
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
        
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: fullAudioUrl },
          { shouldPlay: false }
        );

        if (!isMounted) {
          audioSound.unloadAsync();
          return;
        }

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
  }, [fullAudioUrl]);

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
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, [isLoading, isSoundLoaded, fullAudioUrl]);

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