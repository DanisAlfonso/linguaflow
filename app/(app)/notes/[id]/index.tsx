import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Platform, ActivityIndicator } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../../components/layout/Container';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getNoteById, updateNote, deleteNote } from '../../../../lib/db/notes';
import { NoteWithAttachments, ColorPreset } from '../../../../types/notes';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

export default function NoteScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState<NoteWithAttachments | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState('');
  const [lastSavedTitle, setLastSavedTitle] = useState('');

  useEffect(() => {
    if (user && id) {
      loadNote();
    }
  }, [user, id]);

  const loadNote = async () => {
    try {
      setIsLoading(true);
      const fetchedNote = await getNoteById(id);
      if (fetchedNote) {
        setNote(fetchedNote);
        setTitle(fetchedNote.title);
        setContent(fetchedNote.content || '');
        setLastSavedTitle(fetchedNote.title);
        setLastSavedContent(fetchedNote.content || '');
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced auto-save
  const autoSave = useCallback(async () => {
    if (!note) return;
    if (title === lastSavedTitle && content === lastSavedContent) return;

    try {
      setIsSaving(true);
      await updateNote(note.id, {
        title,
        content,
        color_preset: note.color_preset || undefined,
      });
      setLastSavedTitle(title);
      setLastSavedContent(content);
      Toast.show({
        type: 'success',
        text1: 'Changes saved',
        position: 'bottom',
        visibilityTime: 1000,
      });
    } catch (error) {
      console.error('Error auto-saving note:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to save changes',
        position: 'bottom',
      });
    } finally {
      setIsSaving(false);
    }
  }, [note, title, content, lastSavedTitle, lastSavedContent]);

  // Set up auto-save timer
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSave();
    }, 1000); // Auto-save 1 second after last change

    return () => clearTimeout(timer);
  }, [title, content, autoSave]);

  const handleDelete = async () => {
    if (!note) return;

    try {
      await deleteNote(note.id);
      router.back();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const renderColorButton = (color: ColorPreset) => {
    const isSelected = note?.color_preset === color;
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
        onPress={async () => {
          if (!note) return;
          try {
            await updateNote(note.id, { color_preset: color });
            setNote({ ...note, color_preset: color });
          } catch (error) {
            console.error('Error updating color:', error);
          }
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Container>
          <View style={styles.loadingContainer}>
            <Text style={{ color: theme.mode === 'dark' ? 'white' : theme.colors.black }}>
              Loading note...
            </Text>
          </View>
        </Container>
      </SafeAreaView>
    );
  }

  if (!note) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Container>
          <View style={styles.errorContainer}>
            <Text style={{ color: theme.mode === 'dark' ? 'white' : theme.colors.black }}>
              Note not found
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
            icon={<MaterialIcons name="arrow-back" size={24} color={theme.mode === 'dark' ? 'white' : theme.colors.primary} />}
            onPress={() => {
              if (isSaving) {
                Toast.show({
                  type: 'info',
                  text1: 'Saving changes...',
                  position: 'bottom',
                });
                return;
              }
              router.back();
            }}
          />
          <View style={styles.headerActions}>
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name={note?.is_pinned ? 'push-pin' : 'push-pin'}
                  size={24}
                  color={theme.mode === 'dark' ? 'white' : theme.colors.primary}
                />
              }
              onPress={async () => {
                if (!note) return;
                try {
                  await updateNote(note.id, { is_pinned: !note.is_pinned });
                  setNote({ ...note, is_pinned: !note.is_pinned });
                } catch (error) {
                  console.error('Error updating pin status:', error);
                }
              }}
            />
            {isSaving && (
              <View style={styles.saveIndicator}>
                <ActivityIndicator 
                  size="small" 
                  color={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3} 
                />
              </View>
            )}
          </View>
        </View>

        <ScrollView style={styles.content}>
          <TextInput
            style={[
              styles.titleInput,
              { 
                color: theme.mode === 'dark' ? 'white' : theme.colors.black,
                backgroundColor: 'transparent',
              }
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}
            maxLength={100}
          />

          <View style={styles.metadata}>
            <Text style={[styles.date, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>
              Last updated {format(new Date(note.updated_at), 'MMM d, yyyy')}
            </Text>
            <View style={styles.colorPicker}>
              {(['blue', 'purple', 'green', 'orange', 'pink'] as ColorPreset[]).map(renderColorButton)}
            </View>
          </View>

          <TextInput
            style={[
              styles.contentInput,
              { 
                color: theme.mode === 'dark' ? 'white' : theme.colors.black,
                backgroundColor: 'transparent',
              },
              Platform.OS === 'web' && styles.contentInputWeb,
            ]}
            value={content}
            onChangeText={setContent}
            placeholder="Start writing..."
            placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}
            multiline
            textAlignVertical="top"
          />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  date: {
    fontSize: 12,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveIndicator: {
    marginLeft: 8,
    opacity: 0.6,
  },
}); 