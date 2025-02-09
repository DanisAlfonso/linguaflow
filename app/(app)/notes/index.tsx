import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions, ViewStyle } from 'react-native';
import { Text, Button, FAB, useTheme, Overlay, Input } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { useAuth } from '../../../contexts/AuthContext';
import { getNotes, updateNote, deleteNote } from '../../../lib/db/notes';
import { NoteWithAttachments, ColorPreset } from '../../../types/notes';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function NotesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteWithAttachments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [newNoteName, setNewNoteName] = useState('');
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const { width: windowWidth } = useWindowDimensions();

  // Color presets with names
  const COLOR_PRESETS: Record<ColorPreset, { colors: string, name: string }> = {
    blue: { colors: theme.colors.primary, name: 'Blue' },
    purple: { colors: '#8B5CF6', name: 'Purple' },
    green: { colors: '#10B981', name: 'Green' },
    orange: { colors: '#F97316', name: 'Orange' },
    pink: { colors: '#EC4899', name: 'Pink' },
  } as const;

  // Memoize the card width calculation to avoid recalculation on every render
  const getCardWidth = useMemo(() => {
    const isWeb = Platform.OS === 'web';
    const maxWidth = isWeb ? Math.min(windowWidth, 1200) : windowWidth;
    const containerPadding = isWeb ? 40 : 12;
    const gap = 24;
    const numColumns = isWeb ? 3 : 2;
    
    console.log('=== Layout Debug ===');
    console.log('Window Width:', windowWidth);
    console.log('Container Padding:', containerPadding);
    console.log('Gap:', gap);
    console.log('Platform:', Platform.OS);
    
    if (isWeb) {
      const webWidth = (maxWidth - (containerPadding * 2) - (gap * (numColumns - 1))) / numColumns;
      console.log('Web Card Width:', webWidth);
      return webWidth;
    } else {
      const availableWidth = windowWidth - (containerPadding * 2);
      const cardWidth = (availableWidth * 0.45);
      console.log('Available Width:', availableWidth);
      console.log('Mobile Card Width:', cardWidth);
      return cardWidth;
    }
  }, [windowWidth]);

  useEffect(() => {
    if (user) {
      loadNotes();
    }
  }, [user]);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const fetchedNotes = await getNotes(user!.id);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const fetchedNotes = await getNotes(user.id);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Error refreshing notes:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getColorStyle = (colorPreset: ColorPreset | null | undefined) => {
    switch (colorPreset) {
      case 'blue':
        return { backgroundColor: theme.colors.primary };
      case 'purple':
        return { backgroundColor: '#8B5CF6' };
      case 'green':
        return { backgroundColor: '#10B981' };
      case 'orange':
        return { backgroundColor: '#F97316' };
      case 'pink':
        return { backgroundColor: '#EC4899' };
      default:
        return { backgroundColor: theme.colors.grey5 };
    }
  };

  const animateLayoutChange = () => {
    // Configure spring animation
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.spring,
        property: LayoutAnimation.Properties.scaleXY,
        springDamping: 0.7,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.7,
      },
    });

    // Animate scale and opacity
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 10,
          mass: 0.9,
          stiffness: 100,
          useNativeDriver: true,
        }),
        Animated.spring(opacityAnim, {
          toValue: 1,
          damping: 10,
          mass: 0.9,
          stiffness: 100,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const toggleView = () => {
    animateLayoutChange();
    setView(view === 'grid' ? 'list' : 'grid');
  };

  const gridContainer: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: Platform.OS === 'web' ? 40 : 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  };

  const handleLongPressNote = (noteId: string, event: any) => {
    if (event?.nativeEvent) {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      setMenuPosition({
        x: pageX - locationX,
        y: pageY - locationY,
        width: 220, // Fixed menu width
        height: 0,
      });
    }
    setEditingNoteId(noteId);
  };

  const handleMenuOptionPress = (option: 'color' | 'edit' | 'rename' | 'delete') => {
    if (!editingNoteId) return;

    if (option === 'color') {
      setShowColorPicker(true);
    } else if (option === 'edit') {
      router.push(`/notes/${editingNoteId}`);
      setEditingNoteId(null);
    } else if (option === 'rename') {
      const note = notes.find(n => n.id === editingNoteId);
      if (note) {
        setNewNoteName(note.title);
        setShowRename(true);
      }
    } else if (option === 'delete') {
      handleDeleteNote(editingNoteId);
    }
  };

  const handleCloseMenu = () => {
    setEditingNoteId(null);
    setShowColorPicker(false);
    setShowRename(false);
  };

  const handleChangeColor = async (noteId: string, colorKey: ColorPreset) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      // Only include the color_preset field for update
      await updateNote(noteId, {
        color_preset: colorKey
      });

      // Update local state
      setNotes(prevNotes => 
        prevNotes.map(n => 
          n.id === noteId ? { ...n, color_preset: colorKey } : n
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Color updated successfully',
      });
    } catch (error) {
      console.error('Error updating color:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to update color',
      });
    } finally {
      setShowColorPicker(false);
      setEditingNoteId(null);
    }
  };

  const handleRenameNote = async () => {
    if (!editingNoteId || !newNoteName.trim()) return;

    try {
      const note = notes.find(n => n.id === editingNoteId);
      if (!note) return;

      // Only include the title field for update
      await updateNote(editingNoteId, {
        title: newNoteName.trim()
      });

      // Update local state
      setNotes(prevNotes => 
        prevNotes.map(n => 
          n.id === editingNoteId ? { ...n, title: newNoteName.trim() } : n
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Note renamed successfully',
      });
    } catch (error) {
      console.error('Error renaming note:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to rename note',
      });
    } finally {
      setShowRename(false);
      setEditingNoteId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      // Delete note from the database
      await deleteNote(noteId);
      
      // Update local state
      setNotes(prevNotes => prevNotes.filter(n => n.id !== noteId));

      Toast.show({
        type: 'success',
        text1: 'Note deleted successfully',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to delete note',
      });
    } finally {
      setEditingNoteId(null);
    }
  };

  const renderNoteCard = (note: NoteWithAttachments) => {
    const isWeb = Platform.OS === 'web';
    const colorStyle = getColorStyle(note.color_preset);
    const isHovered = hoveredNoteId === note.id;

    const cardStyle = {
      backgroundColor: theme.mode === 'dark' ? '#1F1F1F' : theme.colors.grey0,
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    };

    console.log('=== Card Debug ===');
    console.log('Note ID:', note.id);
    console.log('Window Width:', windowWidth);
    console.log('View Mode:', view);

    return (
      <Animated.View 
        key={note.id} 
        style={[
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          view === 'grid' && { width: '46%' }  // Increase width to 48%
        ]}
      >
        <Pressable
          style={[
            styles.noteCard,
            view === 'grid' ? styles.gridCard : styles.listCard,
            cardStyle,
            isWeb && isHovered && {
              transform: [{ translateY: -4 }],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
          onPress={() => router.push(`/notes/${note.id}`)}
          onLongPress={(event) => handleLongPressNote(note.id, event)}
          onHoverIn={() => isWeb && setHoveredNoteId(note.id)}
          onHoverOut={() => isWeb && setHoveredNoteId(null)}
        >
          <View style={[styles.colorStrip, colorStyle]}/>
          <View style={styles.noteContent}>
            <View style={styles.noteHeader}>
              <Text style={[styles.noteTitle, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]} numberOfLines={2}>{note.title}</Text>
              {note.is_pinned && <MaterialIcons name="push-pin" size={16} color={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}/>}
            </View>
            {note.content && (
              <Text style={[styles.notePreview, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]} numberOfLines={3}>{note.content}</Text>
            )}
            <View style={styles.noteFooter}>
              <Text style={[styles.noteDate, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>{format(new Date(note.updated_at), 'MMM d, yyyy')}</Text>
              {note.attachments.length > 0 && <MaterialIcons name="attachment" size={16} color={theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3}/>}
            </View>
          </View>
        </Pressable>

        {editingNoteId === note.id && (
          <Overlay
            isVisible={true}
            onBackdropPress={handleCloseMenu}
            overlayStyle={styles.overlayContainer}
            backdropStyle={styles.backdrop}
            animationType="fade"
          >
            <Pressable 
              style={StyleSheet.absoluteFill}
              onPress={handleCloseMenu}
            >
              <View style={StyleSheet.absoluteFill}>
                <BlurView 
                  intensity={30} 
                  style={StyleSheet.absoluteFill}
                  tint={theme.mode === 'dark' ? 'dark' : 'light'}
                />
              </View>
            </Pressable>
            <View 
              style={[
                styles.contextMenu,
                {
                  position: 'absolute',
                  left: menuPosition.x,
                  top: menuPosition.y,
                  width: menuPosition.width,
                  opacity: 1,
                  backgroundColor: Platform.OS === 'ios' 
                    ? 'rgba(250, 250, 250, 0.8)' 
                    : theme.mode === 'dark' 
                      ? 'rgba(30, 30, 30, 0.95)'
                      : 'rgba(255, 255, 255, 0.95)',
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                {!showColorPicker && !showRename ? (
                  // Main Menu
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('color')}
                    >
                      <MaterialIcons 
                        name="palette" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Choose Color
                      </Text>
                      <MaterialIcons 
                        name="chevron-right" 
                        size={20} 
                        color={theme.colors.grey4}
                        style={styles.menuOptionIcon} 
                      />
                    </Pressable>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('edit')}
                    >
                      <MaterialIcons 
                        name="edit" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Edit Note
                      </Text>
                    </Pressable>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('rename')}
                    >
                      <MaterialIcons 
                        name="drive-file-rename-outline" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Rename
                      </Text>
                    </Pressable>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('delete')}
                    >
                      <MaterialIcons 
                        name="delete-outline" 
                        size={20} 
                        color="#DC2626" 
                      />
                      <Text style={[styles.menuOptionText, { color: "#DC2626" }]}>
                        Delete Note
                      </Text>
                    </Pressable>
                  </>
                ) : showRename ? (
                  // Rename Interface
                  <>
                    <View style={styles.colorPickerHeader}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.backButton,
                          pressed && styles.backButtonPressed,
                        ]}
                        onPress={() => setShowRename(false)}
                      >
                        <MaterialIcons 
                          name="arrow-back" 
                          size={20} 
                          color={theme.colors.grey4} 
                        />
                      </Pressable>
                      <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
                        Rename Note
                      </Text>
                    </View>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <View style={styles.renameContainer}>
                      <Input
                        value={newNoteName}
                        onChangeText={setNewNoteName}
                        placeholder="Enter note title"
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={handleRenameNote}
                        containerStyle={styles.renameInput}
                        inputContainerStyle={[
                          styles.renameInputContainer,
                          { borderColor: theme.colors.grey2 }
                        ]}
                        inputStyle={[
                          styles.renameInputText,
                          { color: theme.colors.grey4 }
                        ]}
                      />
                      <Pressable
                        style={({ pressed }) => [
                          styles.renameButton,
                          pressed && styles.renameButtonPressed,
                        ]}
                        onPress={handleRenameNote}
                      >
                        <Text style={styles.renameButtonText}>
                          Save
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  // Color Picker
                  <>
                    <View style={styles.colorPickerHeader}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.backButton,
                          pressed && styles.backButtonPressed,
                        ]}
                        onPress={() => setShowColorPicker(false)}
                      >
                        <MaterialIcons 
                          name="arrow-back" 
                          size={20} 
                          color={theme.colors.grey4} 
                        />
                      </Pressable>
                      <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
                        Choose Color
                      </Text>
                    </View>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    {Object.keys(COLOR_PRESETS).map((colorKey) => {
                      const isSelected = notes.find(n => n.id === editingNoteId)?.color_preset === colorKey;
                      return (
                        <Pressable
                          key={colorKey}
                          style={({ pressed }) => [
                            styles.colorOption,
                            pressed && styles.colorOptionPressed,
                          ]}
                          onPress={() => handleChangeColor(editingNoteId, colorKey as ColorPreset)}
                        >
                          <View style={styles.colorPreviewContainer}>
                            <View style={[styles.colorPreview, getColorStyle(colorKey as ColorPreset)]} />
                          </View>
                          <Text style={[
                            styles.colorName,
                            { color: theme.colors.grey4 },
                            isSelected && styles.colorNameSelected
                          ]}>
                            {COLOR_PRESETS[colorKey as ColorPreset].name}
                          </Text>
                          {isSelected && (
                            <MaterialIcons 
                              name="check" 
                              size={20} 
                              color={theme.colors.grey4}
                              style={styles.checkIcon} 
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </>
                )}
              </Pressable>
            </View>
          </Overlay>
        )}
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Container>
          <View style={styles.loadingContainer}>
            <Text>Loading notes...</Text>
          </View>
        </Container>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container noPadding>
        <View style={[styles.content, { paddingHorizontal: 12 }]}>
          <View style={styles.header}>
            <Text h1 style={[styles.title, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]}>Notes</Text>
            <View style={styles.headerActions}>
              <Button
                type="clear"
                icon={<MaterialIcons name={view === 'grid' ? 'grid-view' : 'view-list'} size={24} color={theme.colors.primary}/>}
                onPress={toggleView}
              />
            </View>
          </View>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.mode === 'dark' ? 'white' : theme.colors.primary}
                colors={[theme.colors.primary]}
                progressBackgroundColor={theme.mode === 'dark' ? '#1F1F1F' : theme.colors.grey0}
              />
            }
          >
            <View style={[styles.notesContainer, view === 'grid' && gridContainer]}>
              {notes.length > 0 ? (
                notes.map(renderNoteCard)
              ) : (
                <View style={styles.emptyState}>
                  <MaterialIcons name="note" size={64} color={theme.colors.grey3}/>
                  <Text h4 style={[styles.emptyStateTitle, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]}>No notes yet</Text>
                  <Text style={[styles.emptyStateText, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>Create your first note to get started</Text>
                </View>
              )}
            </View>
          </ScrollView>
          <View style={styles.fabWrapper}>
            <LinearGradient
              colors={['#4F46E5', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.fabPressable,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
                onPress={() => router.push('/notes/new')}
              >
                <MaterialIcons name="add" size={32} color="white" style={styles.fabIcon}/>
              </Pressable>
            </LinearGradient>
          </View>
        </View>
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 1200 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  title: {
    fontSize: 32,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  notesContainer: {
    paddingBottom: 80,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    paddingHorizontal: Platform.OS === 'web' ? 40 : 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  noteCard: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  gridCard: {
    aspectRatio: 0.85,
    marginBottom: 0,
  },
  listCard: {
    marginVertical: 8,
    marginHorizontal: 0,
  },
  colorStrip: {
    height: 4,
  },
  noteContent: {
    padding: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    lineHeight: 24,
  },
  notePreview: {
    fontSize: 14,
    marginTop: 12,
    flex: 1,
    lineHeight: 20,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  noteDate: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    marginTop: 16,
  },
  emptyStateText: {
    marginTop: 8,
    textAlign: 'center',
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 34,
    overflow: 'hidden',
    zIndex: 1000,
    elevation: Platform.OS === 'android' ? 12 : undefined,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPressable: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out',
      },
    }),
  },
  fabIcon: {
    textAlign: 'center',
    lineHeight: 32,
    height: 32,
  },
  overlayContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    padding: 0,
  },
  backdrop: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)',
  },
  contextMenu: {
    borderRadius: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuOptionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  menuOptionIcon: {
    marginLeft: 'auto',
  },
  menuDivider: {
    height: 1,
    width: '100%',
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
    borderRadius: 12,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  colorOptionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  colorPreviewContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  colorPreview: {
    width: '100%',
    height: '100%',
  },
  colorName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  colorNameSelected: {
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  renameContainer: {
    padding: 12,
    gap: 12,
  },
  renameInput: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  renameInputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  renameInputText: {
    fontSize: 16,
  },
  renameButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  renameButtonPressed: {
    opacity: 0.8,
  },
  renameButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 