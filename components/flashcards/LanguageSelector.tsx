import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, ButtonGroup } from '@rneui/themed';
import type { Language } from '../../types/flashcards';

interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
  color?: string;
}

const LANGUAGES: Language[] = [
  'General',
  'Mandarin',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Korean',
  'Italian',
  'Portuguese',
  'Russian',
];

export function LanguageSelector({ value, onChange, color = '#000' }: LanguageSelectorProps) {
  const selectedIndex = LANGUAGES.indexOf(value);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color }]}>Language</Text>
      <ButtonGroup
        buttons={LANGUAGES}
        selectedIndex={selectedIndex}
        onPress={(index) => onChange(LANGUAGES[index])}
        containerStyle={styles.buttonGroup}
        selectedButtonStyle={{ backgroundColor: '#4F46E5' }}
        textStyle={styles.buttonText}
        selectedTextStyle={styles.selectedButtonText}
        buttonContainerStyle={styles.button}
        innerBorderStyle={{ width: 0 }}
        vertical={Platform.OS !== 'web'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  buttonGroup: {
    marginHorizontal: 0,
    borderWidth: 0,
    gap: 8,
    backgroundColor: 'transparent',
  },
  button: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  selectedButtonText: {
    color: 'white',
    fontWeight: '600',
  },
}); 