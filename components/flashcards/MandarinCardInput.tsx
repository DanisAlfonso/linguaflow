import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Input, useTheme } from '@rneui/themed';
import { MandarinText } from './MandarinText';
import type { MandarinCardData } from '../../types/flashcards';

interface MandarinCardInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onMandarinDataChange: (data: MandarinCardData) => void;
  placeholder?: string;
  label?: string;
  characterSize?: number;
  showPreview?: boolean;
}

// Function to detect if a string contains Chinese characters
function containsChineseCharacters(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export function MandarinCardInput({
  value,
  onChangeText,
  onMandarinDataChange,
  placeholder = '',
  label,
  characterSize = 24,
  showPreview = true,
}: MandarinCardInputProps) {
  const [pinyin, setPinyin] = useState('');
  const { theme } = useTheme();
  const hasChineseCharacters = containsChineseCharacters(value);

  useEffect(() => {
    // Update the Mandarin data whenever either characters or pinyin changes
    const characters = value.split('');
    const pinyinArray = hasChineseCharacters ? pinyin.split(' ').filter(p => p.length > 0) : [];
    
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
  }, [value, pinyin, onMandarinDataChange, hasChineseCharacters]);

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.colors.grey4 }]}>
          {label}
        </Text>
      )}
      
      <View style={styles.inputContainer}>
        <Input
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          containerStyle={styles.input}
          inputContainerStyle={[
            styles.inputField,
            {
              borderColor: theme.colors.grey2,
              backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey0,
            },
          ]}
          inputStyle={[
            styles.inputText,
            { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.black },
          ]}
          placeholderTextColor={theme.colors.grey3}
        />

        {hasChineseCharacters && (
          <Input
            placeholder="Enter pinyin (space-separated)"
            value={pinyin}
            onChangeText={setPinyin}
            containerStyle={styles.input}
            inputContainerStyle={[
              styles.inputField,
              {
                borderColor: theme.colors.grey2,
                backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey0,
              },
            ]}
            inputStyle={[
              styles.inputText,
              { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.black },
            ]}
            placeholderTextColor={theme.colors.grey3}
          />
        )}
      </View>

      {showPreview && value && hasChineseCharacters && pinyin && (
        <View style={styles.preview}>
          <Text style={[styles.previewLabel, { color: theme.colors.grey4 }]}>
            Preview
          </Text>
          <View style={[styles.previewCard, { 
            backgroundColor: theme.colors.grey0,
            borderColor: theme.colors.grey2,
          }]}>
            <MandarinText
              data={{
                characters: value.split(''),
                pinyin: pinyin.split(' ').filter(p => p.length > 0),
              }}
              characterSize={characterSize}
              color={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.black}
            />
          </View>
        </View>
      )}
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
  inputContainer: {
    gap: 8,
  },
  input: {
    paddingHorizontal: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: -8,
  },
  inputText: {
    fontSize: 16,
  },
  preview: {
    gap: 8,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  previewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
}); 