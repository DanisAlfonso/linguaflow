import React, { useState } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Text, Input, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';

export default function EditDeckScreen() {
  const [name, setName] = useState('Spanish Vocabulary');
  const [description, setDescription] = useState('Essential Spanish words and phrases');
  const [tags, setTags] = useState('spanish,beginner');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();

  const handleSave = async () => {
    if (!name.trim()) {
      // Show error
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement save logic
      router.back();
    } catch (error) {
      // Show error
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

            <Button
              title="Save Changes"
              loading={loading}
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
              titleStyle={styles.saveButtonText}
              onPress={handleSave}
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
  buttonIcon: {
    marginRight: 8,
  },
  saveButton: {
    height: 48,
    borderWidth: 0,
  },
  saveButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
}); 