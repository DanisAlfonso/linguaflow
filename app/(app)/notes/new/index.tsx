import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Platform } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { useAuth } from '../../../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { createNote } from '../../../../lib/db/notes';
import { ColorPreset } from '../../../../types/notes';
import { LinearGradient } from 'expo-linear-gradient';

export default function NewNoteScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<ColorPreset>('blue');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;

    try {
      setIsCreating(true);
      await createNote(
        {
          title: title.trim(),
          content: content.trim(),
          color_preset: selectedColor,
        },
        user.id
      );
      router.back();
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const renderColorButton = (color: ColorPreset) => {
    const isSelected = selectedColor === color;
    const colorMap = {
      blue: theme.colors.primary,
      purple: '#8B5CF6',
      green: '#10B981',
      orange: '#F97316',
      pink: '#EC4899',
    };

    return (
      <Button
        key={color}
        type="clear"
        containerStyle={[
          styles.colorButton,
          { backgroundColor: colorMap[color] },
          isSelected && styles.selectedColorButton,
        ]}
        onPress={() => setSelectedColor(color)}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <View style={styles.header}>
          <Button
            type="clear"
            icon={<MaterialIcons name="close" size={24} color={theme.colors.primary} />}
            onPress={() => router.back()}
          />
          <View style={styles.headerActions}>
            <LinearGradient
              colors={['#4F46E5', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.createButtonGradient}
            >
              <Button
                title="Create"
                disabled={!title.trim()}
                loading={isCreating}
                loadingProps={{ color: 'white' }}
                onPress={handleCreate}
                type="clear"
                titleStyle={[
                  styles.createButtonText,
                  { opacity: isCreating ? 0.7 : 1 }
                ]}
                buttonStyle={styles.createButton}
              />
            </LinearGradient>
          </View>
        </View>

        <View style={styles.content}>
          <TextInput
            style={[
              styles.titleInput, 
              { color: theme.mode === 'dark' ? 'white' : theme.colors.black }
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}
            maxLength={100}
            autoFocus
          />

          <View style={styles.colorPicker}>
            {(['blue', 'purple', 'green', 'orange', 'pink'] as ColorPreset[]).map(renderColorButton)}
          </View>

          <TextInput
            style={[
              styles.contentInput,
              { color: theme.mode === 'dark' ? 'white' : theme.colors.black },
              Platform.OS === 'web' && styles.contentInputWeb,
            ]}
            value={content}
            onChangeText={setContent}
            placeholder="Start writing..."
            placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}
            multiline
            textAlignVertical="top"
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '600',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    padding: 0,
    minWidth: 0,
    minHeight: 0,
  },
  selectedColorButton: {
    borderWidth: 2,
    borderColor: 'white',
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    paddingHorizontal: 4,
    minHeight: 200,
  },
  contentInputWeb: {
    height: '100%',
    minHeight: 400,
  },
  createButtonGradient: {
    borderRadius: 8,
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderRadius: 8,
    minHeight: 0,
    height: 36,
  },
  createButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 0,
    marginVertical: 0,
  },
}); 