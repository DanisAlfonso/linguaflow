import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions, ViewStyle, TextInput } from 'react-native';
import { Text, Button, FAB, useTheme, Overlay, Input, Dialog } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { useAuth } from '../../../contexts/AuthContext';
import { getNotes, updateNote, deleteNote, createNote } from '../../../lib/db/notes';
import { NoteWithAttachments, ColorPreset } from '../../../types/notes';
import { format } from 'date-fns';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import { FolderNavigation } from '../../../components/notes/FolderNavigation';
import { CreateFolderModal } from '../../../components/notes/CreateFolderModal';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function NotesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { refresh } = useLocalSearchParams<{ refresh: string }>();
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
  const [currentFolder, setCurrentFolder] = useState('/');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showMoveToFolder, setShowMoveToFolder] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<'note' | 'folder' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<(typeof folders)[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'created' | 'updated' | 'accessed' | 'title'>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Separate folders and notes
  const { folders, notes: filteredNotes } = useMemo(() => {
    // For folders, we want:
    // - In root: show folders where the parent is root (only one '/' in the path)
    // - In subfolder: show folders where the parent is the current folder
    const folderNotes = notes.filter(note => {
      if (note.title !== '.folder') return false;
      
      if (currentFolder === '/') {
        // In root, show folders that are direct children of root
        // i.e., paths like "/FolderName" (only one slash)
        return note.folder_path.split('/').filter(Boolean).length === 1;
      } else {
        // In a subfolder, show only direct children
        return note.folder_path.startsWith(currentFolder + '/') &&
               note.folder_path.split('/').length === currentFolder.split('/').length + 1;
      }
    });
    
    // For notes, show only those in the current folder
    const regularNotes = notes.filter(note => 
      note.folder_path === currentFolder && 
      note.title !== '.folder'
    );

    // Convert folder marker notes to folder objects
    const folders = folderNotes.map(note => {
      const folderPath = note.folder_path;
      const folderName = folderPath.split('/').pop() || '';
      const itemCount = notes.filter(n => 
        n.folder_path.startsWith(folderPath + '/') || // Items in subfolders
        (n.folder_path === folderPath && n.title !== '.folder') // Direct items
      ).length;
      
      return {
        id: note.id,
        name: folderName,
        path: folderPath,
        color: note.color_preset,
        itemCount,
        lastModified: note.updated_at
      };
    });

    return {
      folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
      notes: regularNotes
    };
  }, [notes, currentFolder]);

  // Add this after the folders/notes separation
  const sortedAndFilteredNotes = useMemo(() => {
    let result = [...filteredNotes];
    
    // Apply search filter
    if (searchQuery) {
      result = result.filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'updated':
          comparison = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          break;
        case 'created':
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case 'accessed':
          comparison = new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime();
          break;
      }
      
      return sortDirection === 'asc' ? -comparison : comparison;
    });
    
    return result;
  }, [filteredNotes, searchQuery, sortBy, sortDirection]);

  const sortedFolders = useMemo(() => {
    let result = [...folders];
    
    // Apply search filter to folders
    if (searchQuery) {
      result = result.filter(folder => 
        folder.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Always sort folders alphabetically, but respect sort direction
    result.sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [folders, searchQuery, sortDirection]);

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
  }, [user, refresh]);

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

  const handleLongPressNote = (noteId: string, event: any, type: 'note' | 'folder' = 'note') => {
    if (event?.nativeEvent) {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      setMenuPosition({
        x: pageX - locationX,
        y: pageY - locationY,
        width: 220,
        height: 0,
      });
    }
    setEditingNoteId(noteId);
    setSelectedItemType(type);
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    // If folder has items, show confirmation dialog
    if (folder.itemCount > 0) {
      setFolderToDelete(folder);
      setShowDeleteConfirm(true);
      return;
    }

    // If folder is empty, delete it directly
    await deleteFolderAndContents(folder);
  };

  const deleteFolderAndContents = async (folder: typeof folderToDelete) => {
    if (!folder) return;
    
    try {
      // Get all notes in the folder and subfolders
      const notesToDelete = notes.filter(note => 
        note.folder_path.startsWith(folder.path + '/') || 
        note.folder_path === folder.path
      );

      // Delete notes one by one
      for (const note of notesToDelete) {
        await deleteNote(note.id);
      }

      // Update local state immediately
      setNotes(prevNotes => 
        prevNotes.filter(n => 
          !n.folder_path.startsWith(folder.path + '/') && 
          n.folder_path !== folder.path
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Folder deleted successfully',
      });

      // If we're inside the deleted folder, navigate to parent
      if (currentFolder.startsWith(folder.path)) {
        const parentPath = folder.path.split('/').slice(0, -1).join('/') || '/';
        setCurrentFolder(parentPath);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to delete folder',
      });
    } finally {
      setEditingNoteId(null);
      setFolderToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleMoveToFolder = async (noteId: string, targetFolderPath: string) => {
    try {
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      // Update the note's folder path
      await updateNote(noteId, {
        folder_path: targetFolderPath
      });

      // Update local state
      setNotes(prevNotes => 
        prevNotes.map(n => 
          n.id === noteId ? { ...n, folder_path: targetFolderPath } : n
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Note moved successfully',
      });
    } catch (error) {
      console.error('Error moving note:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to move note',
      });
    } finally {
      setShowMoveToFolder(false);
      setEditingNoteId(null);
    }
  };

  const handleMenuOptionPress = (option: 'color' | 'edit' | 'rename' | 'delete' | 'move' | 'share' | 'duplicate' | 'info') => {
    if (!editingNoteId) return;

    if (option === 'color') {
      setShowColorPicker(true);
    } else if (option === 'edit') {
      if (selectedItemType === 'note') {
        router.push(`/notes/${editingNoteId}`);
      }
      setEditingNoteId(null);
    } else if (option === 'rename') {
      if (selectedItemType === 'folder') {
        const folder = folders.find(f => f.id === editingNoteId);
        if (folder) {
          setNewNoteName(folder.name);
          setShowRename(true);
        }
      } else {
        const note = notes.find(n => n.id === editingNoteId);
        if (note) {
          setNewNoteName(note.title);
          setShowRename(true);
        }
      }
    } else if (option === 'delete') {
      if (selectedItemType === 'folder') {
        handleDeleteFolder(editingNoteId);
      } else {
        handleDeleteNote(editingNoteId);
      }
    } else if (option === 'move') {
      setShowMoveToFolder(true);
    } else if (option === 'share') {
      // TODO: Implement share functionality
      Toast.show({
        type: 'info',
        text1: 'Share functionality coming soon',
      });
    } else if (option === 'duplicate') {
      if (selectedItemType === 'folder') {
        handleDuplicateFolder(editingNoteId);
      }
    } else if (option === 'info') {
      if (selectedItemType === 'folder') {
        handleShowFolderInfo(editingNoteId);
      }
    }
  };

  const handleCloseMenu = () => {
    setEditingNoteId(null);
    setShowColorPicker(false);
    setShowRename(false);
    setShowMoveToFolder(false);
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

      if (selectedItemType === 'folder') {
        // For folders, we need to:
        // 1. Keep the .folder title
        // 2. Update the folder_path to the new name
        const currentPathParts = note.folder_path.split('/');
        const newPath = [...currentPathParts.slice(0, -1), newNoteName.trim()].join('/');
        
        await updateNote(editingNoteId, {
          title: '.folder',
          folder_path: newPath
        });

        // Update local state
        setNotes(prevNotes => 
          prevNotes.map(n => {
            // Update the folder note itself
            if (n.id === editingNoteId) {
              return { ...n, folder_path: newPath };
            }
            // Update paths of all notes inside this folder
            if (n.folder_path.startsWith(note.folder_path + '/')) {
              const newNotePath = newPath + n.folder_path.substring(note.folder_path.length);
              return { ...n, folder_path: newNotePath };
            }
            return n;
          })
        );
      } else {
        // For regular notes, just update the title
        await updateNote(editingNoteId, {
          title: newNoteName.trim()
        });

        // Update local state
        setNotes(prevNotes => 
          prevNotes.map(n => 
            n.id === editingNoteId ? { ...n, title: newNoteName.trim() } : n
          )
        );
      }

      Toast.show({
        type: 'success',
        text1: `${selectedItemType === 'folder' ? 'Folder' : 'Note'} renamed successfully`,
      });
    } catch (error) {
      console.error('Error renaming:', error);
      Toast.show({
        type: 'error',
        text1: `Failed to rename ${selectedItemType === 'folder' ? 'folder' : 'note'}`,
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

  const handleCreateFolder = async (folderName: string) => {
    const newPath = currentFolder === '/' ? `/${folderName}` : `${currentFolder}/${folderName}`;
    
    // Create a new note that acts as a folder marker
    try {
      await createNote(
        {
          title: '.folder',
          content: '',
          folder_path: newPath,
        },
        user!.id
      );
      
      // Refresh notes list
      handleRefresh();
      
      // Navigate to the new folder
      setCurrentFolder(newPath);
      
      Toast.show({
        type: 'success',
        text1: 'Folder created successfully',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to create folder',
        position: 'bottom',
      });
    }
  };

  const handleDuplicateFolder = async (folderId: string) => {
    try {
      const sourceFolder = folders.find(f => f.id === folderId);
      if (!sourceFolder) return;

      // Create a new folder with "(Copy)" appended to the name
      const newName = `${sourceFolder.name} (Copy)`;
      const newPath = currentFolder === '/' ? `/${newName}` : `${currentFolder}/${newName}`;

      await createNote(
        {
          title: '.folder',
          content: '',
          folder_path: newPath,
          color_preset: sourceFolder.color || undefined,
        },
        user!.id
      );

      // Refresh notes list
      handleRefresh();

      Toast.show({
        type: 'success',
        text1: 'Folder duplicated successfully',
      });
    } catch (error) {
      console.error('Error duplicating folder:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to duplicate folder',
      });
    } finally {
      setEditingNoteId(null);
    }
  };

  const handleShowFolderInfo = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    // Calculate total items including items in subfolders
    const totalItems = notes.filter(note => 
      note.folder_path.startsWith(folder.path + '/') || 
      (note.folder_path === folder.path && note.title !== '.folder')
    ).length;

    // Calculate subfolder count
    const subfolders = notes.filter(note => 
      note.title === '.folder' && 
      note.folder_path.startsWith(folder.path + '/') &&
      note.folder_path !== folder.path
    ).length;

    Toast.show({
      type: 'info',
      text1: folder.name,
      text2: `${totalItems} items • ${subfolders} subfolders • Created ${format(new Date(folder.lastModified), 'MMM d, yyyy')}`,
      visibilityTime: 4000,
    });
  };

  const renderFolderCard = (folder: typeof folders[0]) => {
    const isWeb = Platform.OS === 'web';
    const colorStyle = getColorStyle(folder.color);
    const isHovered = hoveredNoteId === folder.id;

    const cardStyle = {
      backgroundColor: theme.mode === 'dark' ? '#1F1F1F' : theme.colors.grey0,
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    };

    return (
      <Animated.View 
        key={folder.id} 
        style={[
          { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          view === 'grid' && { width: '46%' }
        ]}
      >
        <Pressable
          style={[
            styles.noteCard,
            styles.folderCard,
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
          onPress={() => setCurrentFolder(folder.path)}
          onLongPress={(event) => handleLongPressNote(folder.id, event, 'folder')}
          onHoverIn={() => isWeb && setHoveredNoteId(folder.id)}
          onHoverOut={() => isWeb && setHoveredNoteId(null)}
        >
          <LinearGradient
            colors={[
              theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
              'transparent'
            ]}
            style={styles.folderGradient}
          />
          <View style={[styles.colorStrip, colorStyle]}/>
          <View style={styles.folderTab}>
            <View style={[styles.folderTabInner, { backgroundColor: colorStyle.backgroundColor }]} />
          </View>
          <View style={styles.noteContent}>
            <View style={styles.noteHeader}>
              <View style={styles.folderIconContainer}>
                <MaterialIcons 
                  name="folder" 
                  size={28}
                  color={colorStyle.backgroundColor || (theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3)}
                  style={styles.folderIcon}
                />
              </View>
              <Text style={[styles.noteTitle, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]} numberOfLines={2}>
                {folder.name}
              </Text>
            </View>
            <Text style={[styles.notePreview, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>
              {folder.itemCount} {folder.itemCount === 1 ? 'item' : 'items'}
            </Text>
            <View style={styles.noteFooter}>
              <Text style={[styles.noteDate, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>
                {format(new Date(folder.lastModified), 'MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </Pressable>

        {editingNoteId === folder.id && (
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
                      onPress={() => handleMenuOptionPress('rename')}
                    >
                      <MaterialIcons 
                        name="drive-file-rename-outline" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Rename Folder
                      </Text>
                    </Pressable>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('duplicate')}
                    >
                      <MaterialIcons 
                        name="file-copy" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Duplicate Folder
                      </Text>
                    </Pressable>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('share')}
                    >
                      <MaterialIcons 
                        name="share" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Share Folder
                      </Text>
                    </Pressable>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <Pressable
                      style={({ pressed }) => [
                        styles.menuOption,
                        pressed && styles.menuOptionPressed,
                      ]}
                      onPress={() => handleMenuOptionPress('info')}
                    >
                      <MaterialIcons 
                        name="info-outline" 
                        size={20} 
                        color={theme.colors.grey4}
                      />
                      <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                        Folder Info
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
                        Delete Folder
                      </Text>
                    </Pressable>
                  </>
                ) : showColorPicker ? (
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
                      const isSelected = folder.color === colorKey;
                      return (
                        <Pressable
                          key={colorKey}
                          style={({ pressed }) => [
                            styles.colorOption,
                            pressed && styles.colorOptionPressed,
                          ]}
                          onPress={() => handleChangeColor(folder.id, colorKey as ColorPreset)}
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
                ) : (
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
                        Rename Folder
                      </Text>
                    </View>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <View style={styles.renameContainer}>
                      <Input
                        value={newNoteName}
                        onChangeText={setNewNoteName}
                        placeholder="Enter folder name"
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
                )}
              </Pressable>
            </View>
          </Overlay>
        )}
      </Animated.View>
    );
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
          onLongPress={(event) => handleLongPressNote(note.id, event, 'note')}
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
                {!showColorPicker && !showRename && !showMoveToFolder ? (
                  // Main Menu
                  <>
                    {selectedItemType === 'folder' ? (
                      // Folder Menu Options
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
                          onPress={() => handleMenuOptionPress('rename')}
                        >
                          <MaterialIcons 
                            name="drive-file-rename-outline" 
                            size={20} 
                            color={theme.colors.grey4}
                          />
                          <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                            Rename Folder
                          </Text>
                        </Pressable>
                        <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                        <Pressable
                          style={({ pressed }) => [
                            styles.menuOption,
                            pressed && styles.menuOptionPressed,
                          ]}
                          onPress={() => handleMenuOptionPress('duplicate')}
                        >
                          <MaterialIcons 
                            name="file-copy" 
                            size={20} 
                            color={theme.colors.grey4}
                          />
                          <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                            Duplicate Folder
                          </Text>
                        </Pressable>
                        <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                        <Pressable
                          style={({ pressed }) => [
                            styles.menuOption,
                            pressed && styles.menuOptionPressed,
                          ]}
                          onPress={() => handleMenuOptionPress('share')}
                        >
                          <MaterialIcons 
                            name="share" 
                            size={20} 
                            color={theme.colors.grey4}
                          />
                          <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                            Share Folder
                          </Text>
                        </Pressable>
                        <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                        <Pressable
                          style={({ pressed }) => [
                            styles.menuOption,
                            pressed && styles.menuOptionPressed,
                          ]}
                          onPress={() => handleMenuOptionPress('info')}
                        >
                          <MaterialIcons 
                            name="info-outline" 
                            size={20} 
                            color={theme.colors.grey4}
                          />
                          <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                            Folder Info
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
                            Delete Folder
                          </Text>
                        </Pressable>
                      </>
                    ) : (
                      // Note Menu Options (existing code)
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
                            Rename Note
                          </Text>
                        </Pressable>
                        <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                        <Pressable
                          style={({ pressed }) => [
                            styles.menuOption,
                            pressed && styles.menuOptionPressed,
                          ]}
                          onPress={() => handleMenuOptionPress('move')}
                        >
                          <MaterialIcons 
                            name="drive-file-move" 
                            size={20} 
                            color={theme.colors.grey4}
                          />
                          <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                            Move to Folder
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
                    )}
                  </>
                ) : showMoveToFolder ? (
                  // Move to Folder Interface
                  <>
                    <View style={styles.colorPickerHeader}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.backButton,
                          pressed && styles.backButtonPressed,
                        ]}
                        onPress={() => setShowMoveToFolder(false)}
                      >
                        <MaterialIcons 
                          name="arrow-back" 
                          size={20} 
                          color={theme.colors.grey4} 
                        />
                      </Pressable>
                      <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
                        Move to Folder
                      </Text>
                    </View>
                    <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                    <ScrollView style={styles.folderList}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.folderOption,
                          pressed && styles.folderOptionPressed,
                        ]}
                        onPress={() => handleMoveToFolder(editingNoteId, '/')}
                      >
                        <MaterialIcons 
                          name="folder" 
                          size={20} 
                          color={theme.colors.grey4}
                        />
                        <Text style={[styles.folderOptionText, { color: theme.colors.grey4 }]}>
                          Root
                        </Text>
                      </Pressable>
                      {folders.map(folder => (
                        <Pressable
                          key={folder.id}
                          style={({ pressed }) => [
                            styles.folderOption,
                            pressed && styles.folderOptionPressed,
                          ]}
                          onPress={() => handleMoveToFolder(editingNoteId, folder.path)}
                        >
                          <MaterialIcons 
                            name="folder" 
                            size={20} 
                            color={theme.colors.grey4}
                          />
                          <Text style={[styles.folderOptionText, { color: theme.colors.grey4 }]}>
                            {folder.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
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
            <View style={styles.headerTop}>
              <Text h1 style={[styles.title, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]}>Notes</Text>
              <View style={styles.headerActions}>
                <Button
                  type="clear"
                  icon={<MaterialIcons name={view === 'grid' ? 'grid-view' : 'view-list'} size={24} color={theme.colors.primary}/>}
                  onPress={toggleView}
                />
                <Button
                  type="clear"
                  icon={<MaterialIcons name="create-new-folder" size={24} color={theme.colors.primary}/>}
                  onPress={() => setShowCreateFolder(true)}
                />
              </View>
            </View>

            <View style={styles.searchContainer}>
              <View style={[
                styles.searchInputContainer,
                { 
                  backgroundColor: theme.mode === 'dark' ? theme.colors.grey1 : theme.colors.grey5,
                  borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }
              ]}>
                <MaterialIcons 
                  name="search" 
                  size={20} 
                  color={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
                />
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: theme.mode === 'dark' ? 'white' : theme.colors.black }
                  ]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search notes and folders..."
                  placeholderTextColor={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
                />
                {searchQuery ? (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    style={({ pressed }) => [
                      styles.clearButton,
                      pressed && styles.clearButtonPressed
                    ]}
                  >
                    <MaterialIcons 
                      name="close" 
                      size={20} 
                      color={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
                    />
                  </Pressable>
                ) : null}
              </View>
              <Button
                type="clear"
                icon={
                  <MaterialIcons 
                    name="sort" 
                    size={24} 
                    color={theme.colors.primary}
                  />
                }
                onPress={() => setShowSortMenu(true)}
              />
            </View>
          </View>

          <FolderNavigation
            currentPath={currentFolder}
            onNavigate={setCurrentFolder}
          />

          <Overlay
            isVisible={showSortMenu}
            onBackdropPress={() => setShowSortMenu(false)}
            overlayStyle={[
              styles.sortMenu,
              { 
                backgroundColor: theme.mode === 'dark' 
                  ? theme.colors.grey0 
                  : 'white' 
              }
            ]}
          >
            <View style={styles.sortMenuHeader}>
              <Text style={[
                styles.sortMenuTitle,
                { color: theme.mode === 'dark' ? 'white' : theme.colors.black }
              ]}>
                Sort by
              </Text>
              <Pressable
                onPress={() => setShowSortMenu(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.closeButtonPressed
                ]}
              >
                <MaterialIcons 
                  name="close" 
                  size={20} 
                  color={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
                />
              </Pressable>
            </View>
            {[
              { value: 'title', label: 'Title', icon: 'sort-by-alpha' },
              { value: 'updated', label: 'Last updated', icon: 'update' },
              { value: 'created', label: 'Date created', icon: 'event' },
              { value: 'accessed', label: 'Last accessed', icon: 'visibility' },
            ].map(option => (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.sortOption,
                  pressed && styles.sortOptionPressed,
                  sortBy === option.value && styles.sortOptionSelected
                ]}
                onPress={() => {
                  if (sortBy === option.value) {
                    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy(option.value as typeof sortBy);
                    setSortDirection('desc');
                  }
                }}
              >
                <View style={styles.sortOptionContent}>
                  <MaterialIcons 
                    name={option.icon as any}
                    size={20}
                    color={theme.mode === 'dark' ? theme.colors.grey4 : theme.colors.grey3}
                  />
                  <Text style={[
                    styles.sortOptionText,
                    { color: theme.mode === 'dark' ? 'white' : theme.colors.black }
                  ]}>
                    {option.label}
                  </Text>
                </View>
                {sortBy === option.value && (
                  <MaterialIcons 
                    name={sortDirection === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                    size={20}
                    color={theme.colors.primary}
                  />
                )}
              </Pressable>
            ))}
          </Overlay>

          <CreateFolderModal
            isVisible={showCreateFolder}
            onClose={() => setShowCreateFolder(false)}
            onCreateFolder={handleCreateFolder}
            currentPath={currentFolder}
          />

          <Dialog
            isVisible={showDeleteConfirm}
            onBackdropPress={() => {
              setShowDeleteConfirm(false);
              setFolderToDelete(null);
            }}
          >
            <Dialog.Title title="Delete Folder" />
            <Text style={{ marginBottom: 16 }}>
              Are you sure you want to delete "{folderToDelete?.name}" and all its contents? This action cannot be undone.
            </Text>
            <Dialog.Actions>
              <Button
                type="clear"
                title="Cancel"
                containerStyle={{ marginRight: 8 }}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setFolderToDelete(null);
                }}
              />
              <Button
                type="solid"
                title="Delete"
                buttonStyle={{ backgroundColor: '#DC2626' }}
                onPress={() => deleteFolderAndContents(folderToDelete)}
              />
            </Dialog.Actions>
          </Dialog>

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
              {sortedFolders.length === 0 && sortedAndFilteredNotes.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="folder-open" size={64} color={theme.colors.grey3}/>
                  <Text h4 style={[styles.emptyStateTitle, { color: theme.mode === 'dark' ? 'white' : theme.colors.black }]}>
                    {searchQuery 
                      ? 'No matching notes or folders' 
                      : currentFolder === '/' 
                        ? 'No notes yet' 
                        : 'This folder is empty'
                    }
                  </Text>
                  <Text style={[styles.emptyStateText, { color: theme.mode === 'dark' ? theme.colors.grey5 : theme.colors.grey3 }]}>
                    {searchQuery 
                      ? 'Try a different search term'
                      : currentFolder === '/' 
                        ? 'Create your first note to get started' 
                        : 'Create a note in this folder'
                    }
                  </Text>
                </View>
              ) : (
                <>
                  {sortedFolders.map(renderFolderCard)}
                  {sortedAndFilteredNotes.map(renderNoteCard)}
                </>
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
                onPress={() => router.push({
                  pathname: '/notes/new',
                  params: { folder: currentFolder }
                })}
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
    paddingVertical: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    bottom: 100,
    right: 24,
    borderRadius: 34,
    overflow: 'hidden',
    zIndex: 2,
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
  folderCard: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  folderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    zIndex: 0,
  },
  folderTab: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 40,
    height: 14,
    zIndex: 1,
  },
  folderTabInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  folderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  folderIcon: {
    marginRight: 8,
  },
  folderList: {
    maxHeight: 300,
  },
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  folderOptionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  folderOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    height: 44,
    padding: 0,
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
  },
  clearButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  sortMenu: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 0,
  },
  sortMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  sortMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    borderRadius: 12,
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sortOptionPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  sortOptionSelected: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sortOptionText: {
    fontSize: 16,
  },
}); 