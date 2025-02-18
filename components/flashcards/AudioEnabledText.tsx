import React from 'react';
import { View, StyleSheet, Text, TextStyle, StyleProp } from 'react-native';
import { AudioTextSegment } from './AudioTextSegment';
import type { CardAudioSegment } from '../../types/audio';

export interface AudioEnabledTextProps {
  text: string;
  audioSegments: CardAudioSegment[];
  isStudyMode?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function AudioEnabledText({
  text,
  audioSegments,
  isStudyMode = false,
  color,
  style,
}: AudioEnabledTextProps) {
  // Sort segments by start position to ensure correct order
  const sortedSegments = [...audioSegments].sort((a, b) => a.text_start - b.text_start);

  // If in study mode and there are segments, render the entire text as clickable
  if (isStudyMode && sortedSegments.length > 0) {
    const firstSegment = sortedSegments[0];
    return (
      <AudioTextSegment
        text={text}
        audioUrl={firstSegment.audio_file.url}
        isStudyMode={true}
        color={color}
        style={[styles.studyModeText, style]}
      />
    );
  }

  // Build an array of text parts with audio segments for edit mode
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedSegments.forEach((segment, index) => {
    // Add text before this segment if there is any
    if (segment.text_start > lastIndex) {
      parts.push(
        <Text key={`text-${index}`} style={[styles.text, { color }]}>
          {text.slice(lastIndex, segment.text_start)}
        </Text>
      );
    }

    // Add the audio segment
    parts.push(
      <AudioTextSegment
        key={`audio-${segment.id}`}
        text={text.slice(segment.text_start, segment.text_end)}
        audioUrl={segment.audio_file.url}
        isStudyMode={isStudyMode}
        color={color}
      />
    );

    lastIndex = segment.text_end;
  });

  // Add any remaining text after the last segment
  if (lastIndex < text.length) {
    parts.push(
      <Text key="text-end" style={[styles.text, { color }]}>
        {text.slice(lastIndex)}
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      {parts}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
  },
  studyModeText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 