import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useTheme } from '@rneui/themed';
import { MandarinText } from '../MandarinText';
import { AudioEnabledText } from '../AudioEnabledText';
import type { Card } from '../../../types/flashcards';
import type { CardAudioSegment } from '../../../types/audio';

interface StudyCardBackProps {
  card: Card;
  isMandarin: boolean;
  characterSize: number;
  backAudioSegments: CardAudioSegment[];
}

export function StudyCardBack({
  card,
  isMandarin,
  characterSize,
  backAudioSegments,
}: StudyCardBackProps) {
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.cardContent}>
      {isMandarin && card.language_specific_data?.mandarin ? (
        <View style={styles.mandarinContainer}>
          <MandarinText
            data={card.language_specific_data.mandarin.back}
            characterSize={characterSize}
            color={theme.colors.grey5}
            audioUrl={backAudioSegments.length > 0 ? backAudioSegments[0].audio_file_path : undefined}
            isStudyMode={true}
          />
          {backAudioSegments.length > 0 && (
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
            text={card.back}
            audioSegments={backAudioSegments}
            isStudyMode={true}
            color={theme.colors.primary}
            style={styles.audioEnabledText}
          />
          {backAudioSegments.length > 0 && (
            <Text style={[styles.audioHint, { color: theme.colors.grey3 }]}>
              {isWeb 
                ? "Click text or press Ctrl+Space to play audio"
                : "Tap text to play audio"}
            </Text>
          )}
        </View>
      )}
      {card.notes && (
        <Text style={[styles.notes, { color: theme.colors.grey3 }]}>
          {card.notes}
        </Text>
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
  notes: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 