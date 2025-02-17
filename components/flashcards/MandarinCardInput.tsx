import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Input, useTheme } from '@rneui/themed';
import { MandarinText } from './MandarinText';
import type { MandarinCardData } from '../../types/flashcards';
import type { IconNode } from '@rneui/base';

interface MandarinCardInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onMandarinDataChange: (data: MandarinCardData) => void;
  placeholder?: string;
  label?: string;
  characterSize?: number;
  showPreview?: boolean;
  audioButton?: IconNode;
  isMandarin?: boolean;
}

// Function to detect if a string contains Chinese characters
function containsChineseCharacters(text: string): boolean {
  // Updated regex to include more Chinese character ranges
  return /[\u3400-\u4DBF\u4E00-\u9FFF\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}]/u.test(text);
}

export function MandarinCardInput({
  value,
  onChangeText,
  onMandarinDataChange,
  placeholder = '',
  label,
  characterSize = 24,
  showPreview = true,
  audioButton,
  isMandarin = false,
}: MandarinCardInputProps) {
  const [pinyin, setPinyin] = useState('');
  const { theme } = useTheme();
  const hasChineseCharacters = containsChineseCharacters(value);

  useEffect(() => {
    // Update the Mandarin data whenever either characters or pinyin changes
    const characters = value.trim() ? value.split('') : [];
    // Keep all pinyin values, even empty ones, to maintain alignment
    const pinyinArray = hasChineseCharacters ? pinyin.split(' ') : [];
    
    // Make sure we have the same number of pinyin as characters
    while (pinyinArray.length < characters.length) {
      pinyinArray.push('');
    }
    while (pinyinArray.length > characters.length) {
      pinyinArray.pop();
    }

    onMandarinDataChange({
      characters,
      pinyin: pinyinArray,
    });

    // Log the data for debugging
    console.log('MandarinCardInput data:', {
      value,
      hasChineseCharacters,
      isMandarin,
      characters,
      pinyin: pinyinArray,
    });
  }, [value, pinyin, hasChineseCharacters, isMandarin, onMandarinDataChange]);

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3 }]}>
          {label}
        </Text>
      ) : null}
      <View style={styles.inputContainer}>
        <Input
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          multiline
          numberOfLines={3}
          containerStyle={styles.input}
          inputContainerStyle={[
            styles.inputField,
            styles.textArea,
            {
              borderColor: theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey2,
              backgroundColor: theme.mode === 'dark' ? theme.colors.grey0 : '#FFFFFF',
            },
          ]}
          inputStyle={[
            styles.inputText,
            { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.black },
          ]}
          placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey4}
          rightIcon={audioButton}
        />
      </View>
      {hasChineseCharacters ? (
        <View style={styles.pinyinContainer}>
          <Text style={[styles.pinyinLabel, { color: theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3 }]}>
            Pinyin
          </Text>
          <Input
            placeholder="Enter pinyin (space-separated)"
            value={pinyin}
            onChangeText={setPinyin}
            containerStyle={styles.input}
            inputContainerStyle={[
              styles.inputField,
              {
                borderColor: theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey2,
                backgroundColor: theme.mode === 'dark' ? theme.colors.grey0 : '#FFFFFF',
              },
            ]}
            inputStyle={[
              styles.inputText,
              { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.black },
            ]}
            placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey4}
          />
        </View>
      ) : null}
      {showPreview && value ? (
        <View style={styles.preview}>
          <Text style={[styles.previewLabel, { color: theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3 }]}>
            Preview
          </Text>
          <View style={[
            styles.previewContent,
            {
              backgroundColor: theme.mode === 'dark' ? theme.colors.grey0 : '#F8F9FA',
              borderColor: theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey2,
              borderWidth: 1,
            }
          ]}>
            <MandarinText
              data={{
                characters: value.trim() ? value.split('') : [],
                pinyin: hasChineseCharacters ? pinyin.split(' ').filter(p => p.length > 0) : [],
              }}
              characterSize={characterSize}
              color={theme.mode === 'dark' ? theme.colors.white : theme.colors.black}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 4,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    paddingHorizontal: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 56,
    marginBottom: -8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputText: {
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
    paddingBottom: 16,
  },
  pinyinContainer: {
    gap: 8,
    marginTop: 8,
  },
  pinyinLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: -0.4,
  },
  preview: {
    marginTop: 16,
    gap: 8,
  },
  previewLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: -0.4,
  },
  previewContent: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});