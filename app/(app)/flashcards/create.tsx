import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Input, Button, Switch, useTheme } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { createDeck } from '../../../lib/api/flashcards';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../../contexts/AuthContext';

export default function CreateDeckScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isMandarin, setIsMandarin] = useState(false);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();

  const handleCreateDeck = async () => {
    if (!name.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Deck name is required',
      });
      return;
    }

    if (!user) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: 'Please sign in again',
      });
      router.replace('/sign-in');
      return;
    }

    setLoading(true);
    try {
      console.log('Creating deck with data:', {
        name: name.trim(),
        description: description.trim() || undefined,
        language: isMandarin ? 'Mandarin' : 'General',
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
        userId: user.id,
      });

      await createDeck({
        name: name.trim(),
        description: description.trim() || undefined,
        language: isMandarin ? 'Mandarin' : 'General',
        tags: tags.trim() ? tags.split(',').map(tag => tag.trim()) : undefined,
        userId: user.id,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Deck created successfully',
      });

      router.replace('/flashcards');
    } catch (error) {
      console.error('Error creating deck:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Handle specific error cases
      if (error instanceof Error) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.message,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to create deck. Please try again.',
        });
      }
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
              Language
            </Text>
            <View style={styles.languageToggle}>
              <Text style={[styles.toggleLabel, { color: theme.colors.grey4 }]}>
                Mandarin Mode
              </Text>
              <Switch
                value={isMandarin}
                onValueChange={setIsMandarin}
                color={theme.colors.primary}
              />
            </View>
            {isMandarin && (
              <Text style={[styles.helperText, { color: theme.colors.grey3 }]}>
                Enables pinyin input and character size control
              </Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.colors.grey4 }]}>
              Tags (Optional)
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
            icon={
              <MaterialIcons
                name="add"
                size={20}
                color="white"
                style={styles.buttonIcon}
              />
            }
            type="clear"
            buttonStyle={styles.button}
            containerStyle={[styles.buttonContainer, { backgroundColor: '#4F46E5' }]}
            titleStyle={styles.buttonText}
            onPress={handleCreateDeck}
          />
        </View>
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
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Platform.select({
      ios: 'rgba(0, 0, 0, 0.02)',
      android: 'rgba(0, 0, 0, 0.04)',
      default: 'rgba(0, 0, 0, 0.02)',
    }),
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginLeft: 4,
  },
  buttonIcon: {
    marginRight: 8,
  },
  button: {
    height: 48,
    borderWidth: 0,
  },
  buttonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 