import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@rneui/themed';
import { CharacterSizeControl } from '../CharacterSizeControl';

interface StudyCharacterControlProps {
  size: number;
  onSizeChange: (size: number) => void;
}

export function StudyCharacterControl({
  size,
  onSizeChange,
}: StudyCharacterControlProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.characterSizeControl}>
      <CharacterSizeControl
        size={size}
        onSizeChange={onSizeChange}
        color={theme.colors.grey4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  characterSizeControl: {
    marginBottom: 24,
  },
}); 