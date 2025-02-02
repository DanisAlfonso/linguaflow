import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from '@rneui/themed';
import type { MandarinCardData } from '../../types/flashcards';

interface MandarinTextProps {
  data: MandarinCardData;
  showPinyin?: boolean;
  characterSize?: number;
  color?: string;
}

// Function to detect if a string contains Chinese characters
function containsChineseCharacters(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function MandarinText({ data, showPinyin = true, characterSize = 24, color = '#000' }: MandarinTextProps) {
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
    return (
      <View style={styles.regularTextContainer}>
        <Text style={[styles.regularText, { color, fontSize: characterSize }]}>
          {text}
        </Text>
      </View>
    );
  }

  // For Chinese text, filter out empty characters and spaces
  const characters = data.characters.filter(char => char.trim().length > 0);
  const pinyin = data.pinyin.filter(p => p.trim().length > 0);

  // Otherwise, render character by character with pinyin
  return (
    <View style={styles.container}>
      {characters.map((char, index) => (
        <View key={index} style={styles.characterContainer}>
          {showPinyin && pinyin[index] ? (
            <Text style={[styles.pinyin, { color, fontSize: characterSize * 0.5 }]}>
              {pinyin[index]}
            </Text>
          ) : null}
          <Text style={[styles.character, { color, fontSize: characterSize }]}>
            {char}
          </Text>
        </View>
      ))}
    </View>
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
    alignItems: 'flex-start',
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