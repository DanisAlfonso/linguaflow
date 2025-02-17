import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useTheme } from '@rneui/themed';
import { MandarinText } from '../MandarinText';
import { AudioEnabledText } from '../AudioEnabledText';
import type { Card } from '../../../types/flashcards';
import type { CardAudioSegment } from '../../../types/audio';

interface StudyCardFrontProps {
  card: Card;
  isMandarin: boolean;
  characterSize: number;
  frontAudioSegments: CardAudioSegment[];
}

export function StudyCardFront({
  card,
  isMandarin,
  characterSize,
  frontAudioSegments,
}: StudyCardFrontProps) {
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.cardContent}>
      {isMandarin && card.language_specific_data?.mandarin ? (
        <View style={styles.mandarinContainer}>
          <MandarinText
            data={card.language_specific_data.mandarin.front}
            characterSize={characterSize}
            color={theme.colors.grey5}
            audioUrl={frontAudioSegments.length > 0 ? frontAudioSegments[0].audio_file_path : undefined}
            isStudyMode={true}
          />
          {frontAudioSegments.length > 0 && (
            <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
              {isWeb 
                ? "Click text or press Ctrl+Space to play audio"
                : "Tap text to play audio"}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.textContainer}>
          <AudioEnabledText
            text={card.front}
            audioSegments={frontAudioSegments}
            isStudyMode={true}
            color={theme.colors.primary}
            style={styles.audioEnabledText}
          />
          {frontAudioSegments.length > 0 && (
            <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
              {isWeb 
                ? "Click text or press Ctrl+Space to play audio"
                : "Tap text to play audio"}
            </Text>
          )}
        </View>
      )}
      {card.tags && card.tags.length > 0 && (
        <View style={styles.cardTags}>
          {card.tags.map((tag, index) => (
            <View
              key={index}
              style={[styles.tag, { backgroundColor: theme.colors.grey1 }]}
            >
              <Text style={[styles.tagText, { color: theme.colors.grey4 }]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mandarinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  textContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  audioEnabledText: {
    textDecorationLine: 'underline',
  },
  audioHint: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
}); 