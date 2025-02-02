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

export function MandarinText({ data, showPinyin = true, characterSize = 24, color = '#000' }: MandarinTextProps) {
  return (
    <View style={styles.container}>
      {data.characters.map((char, index) => (
        <View key={index} style={styles.characterContainer}>
          {showPinyin && (
            <Text style={[styles.pinyin, { color, fontSize: characterSize * 0.5 }]}>
              {data.pinyin[index]}
            </Text>
          )}
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