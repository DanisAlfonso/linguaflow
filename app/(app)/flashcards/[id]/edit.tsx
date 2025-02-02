import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { getDeck, updateDeck, deleteDeck } from '../../../../lib/api/flashcards';
import type { Deck } from '../../../../types/flashcards';
import Toast from 'react-native-toast-message';

export default function EditDeckScreen() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();

  const loadDeck = useCallback(async () => {
    try {
      const data = await getDeck(id as string);
      if (!data) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Deck not found',
        });
        router.back();
        return;
      }

      setDeck(data);
      setName(data.name);
      setDescription(data.description || '');
      setTags(data.tags?.join(', ') || '');
    } catch (error) {
      console.error('Error loading deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load deck',
      });
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Deck name is required',
      });
      return;
    }

    setSaving(true);
    try {
      await updateDeck(id as string, {
        name: name.trim(),
        description: description.trim() || undefined,
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Deck updated successfully',
      });

      router.back();
    } catch (error) {
      console.error('Error updating deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update deck',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDeck(id as string);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Deck deleted successfully',
      });

      router.replace('/(app)/flashcards/');
    } catch (error) {
      console.error('Error deleting deck:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete deck',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !deck) {
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
              Loading...
            </Text>
          </View>
        </Container>
      </SafeAreaView>
    );
  }

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
            Edit Deck
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

            <View style={styles.actions}>
              <Button
                title="Delete Deck"
                loading={deleting}
                icon={
                  <MaterialIcons
                    name="delete"
                    size={20}
                    color="white"
                    style={styles.buttonIcon}
                  />
                }
                type="clear"
                buttonStyle={styles.deleteButton}
                containerStyle={[styles.deleteButtonContainer, { backgroundColor: '#DC2626' }]}
                titleStyle={styles.buttonText}
                onPress={handleDelete}
              />
              <Button
                title="Save Changes"
                loading={saving}
                icon={
                  <MaterialIcons
                    name="save"
                    size={20}
                    color="white"
                    style={styles.buttonIcon}
                  />
                }
                type="clear"
                buttonStyle={styles.saveButton}
                containerStyle={[styles.saveButtonContainer, { backgroundColor: '#4F46E5' }]}
                titleStyle={styles.buttonText}
                onPress={handleSave}
              />
            </View>
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  deleteButton: {
    height: 48,
    borderWidth: 0,
  },
  deleteButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButton: {
    height: 48,
    borderWidth: 0,
  },
  saveButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 