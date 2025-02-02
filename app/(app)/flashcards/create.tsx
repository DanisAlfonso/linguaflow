import React, { useState } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Container } from '../../../components/layout/Container';
import { createDeck } from '../../../lib/api/flashcards';
import { LanguageSelector } from '../../../components/flashcards/LanguageSelector';
import type { Language } from '../../../types/flashcards';

export default function CreateDeckScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<Language>('General');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const handleCreateDeck = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Deck name is required',
      });
      return;
    }

    setLoading(true);
    try {
      const deck = await createDeck({
        name: name.trim(),
        description: description.trim() || undefined,
        language,
        settings: language === 'Mandarin' ? {
          showPinyin: true,
          defaultCharacterSize: 24,
        } : {},
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Deck created successfully',
      });

      router.push(`/flashcards/${deck.id}`);
    } catch (error) {
      console.error('Error creating deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create deck. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <View style={styles.header}>
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={theme.colors.grey5}
              />
            }
            onPress={() => router.back()}
            containerStyle={styles.backButton}
          />
          <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
            Create Deck
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Deck Name
              </Text>
              <Input
                placeholder="Enter deck name"
                value={name}
                onChangeText={setName}
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
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Description
              </Text>
              <Input
                placeholder="Enter deck description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                containerStyle={styles.input}
                inputContainerStyle={[
                  styles.inputField,
                  styles.textArea,
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
            </View>

            <LanguageSelector
              value={language}
              onChange={setLanguage}
              color={theme.colors.grey4}
            />

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.colors.grey4 }]}>
                Tags
              </Text>
              <Input
                placeholder="Enter tags (comma separated)"
                value={tags}
                onChangeText={setTags}
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
            </View>

            <Button
              title="Create Deck"
              loading={loading}
              onPress={handleCreateDeck}
              type="clear"
              buttonStyle={styles.createButton}
              containerStyle={[styles.createButtonContainer, { backgroundColor: '#4F46E5' }]}
              titleStyle={styles.buttonText}
            />
          </View>
        </ScrollView>
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  createButton: {
    height: 48,
    borderWidth: 0,
  },
  createButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 