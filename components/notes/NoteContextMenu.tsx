import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { Text, useTheme, Overlay, Input } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { NoteWithAttachments, ColorPreset } from '../../types/notes';

// Props for the NoteContextMenu component
interface NoteContextMenuProps {
  isVisible: boolean;
  noteId: string | null;
  itemType: 'note' | 'folder' | null;
  position: { x: number; y: number; width: number; height: number };
  item: NoteWithAttachments | FolderItem | null;
  colorPresets: Record<ColorPreset, { colors: string; name: string }>;
  folders: FolderItem[];
  onClose: () => void;
  onColorChange: (noteId: string, colorKey: ColorPreset) => void;
  onMenuOptionPress: (option: 'color' | 'edit' | 'rename' | 'delete' | 'move' | 'share' | 'duplicate' | 'info') => void;
  onRename: (noteId: string, newName: string) => void;
  onMoveToFolder: (noteId: string, targetFolderPath: string) => void;
}

// Interface for folder items
interface FolderItem {
  id: string;
  name: string;
  path: string;
  color?: ColorPreset | null;
  itemCount: number;
  lastModified: string;
}

export const NoteContextMenu: React.FC<NoteContextMenuProps> = ({
  isVisible,
  noteId,
  itemType,
  position,
  item,
  colorPresets,
  folders,
  onClose,
  onColorChange,
  onMenuOptionPress,
  onRename,
  onMoveToFolder,
}) => {
  const { theme } = useTheme();
  const [currentView, setCurrentView] = useState<'main' | 'color' | 'rename' | 'move'>('main');
  const [newItemName, setNewItemName] = useState('');

  // Reset state when the menu opens or closing
  useEffect(() => {
    if (isVisible) {
      setCurrentView('main');
      if (item) {
        if (itemType === 'folder') {
          setNewItemName((item as FolderItem).name);
        } else {
          setNewItemName((item as NoteWithAttachments).title);
        }
      }
    }
  }, [isVisible, item, itemType]);

  // Handle submitting the rename
  const handleRenameSubmit = () => {
    if (noteId && newItemName.trim()) {
      onRename(noteId, newItemName.trim());
      onClose(); // Close the menu after renaming
    }
  };

  // Get color style for a given preset
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

  // Get current color of the item
  const getCurrentColor = () => {
    if (!item) return null;
    
    if (itemType === 'folder') {
      return (item as FolderItem).color;
    } else {
      return (item as NoteWithAttachments).color_preset;
    }
  };

  // Render the main menu view
  const renderMainMenu = () => {
    return (
      <>
        {itemType === 'folder' ? (
          // Folder Menu Options
          <>
            <Pressable
              style={({ pressed }) => [
                styles.menuOption,
                pressed && styles.menuOptionPressed,
              ]}
              onPress={() => {
                onMenuOptionPress('color');
                setCurrentView('color');
              }}
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
              onPress={() => {
                setCurrentView('rename');
              }}
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
              onPress={() => onMenuOptionPress('duplicate')}
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
              onPress={() => onMenuOptionPress('share')}
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
              onPress={() => onMenuOptionPress('info')}
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
              onPress={() => onMenuOptionPress('delete')}
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
          // Note Menu Options
          <>
            <Pressable
              style={({ pressed }) => [
                styles.menuOption,
                pressed && styles.menuOptionPressed,
              ]}
              onPress={() => {
                onMenuOptionPress('color');
                setCurrentView('color');
              }}
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
              onPress={() => onMenuOptionPress('edit')}
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
              onPress={() => {
                setCurrentView('rename');
              }}
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
              onPress={() => {
                onMenuOptionPress('move');
                setCurrentView('move');
              }}
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
              onPress={() => onMenuOptionPress('delete')}
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
    );
  };

  // Render the color picker view
  const renderColorPicker = () => {
    const currentColor = getCurrentColor();
    
    return (
      <>
        <View style={styles.colorPickerHeader}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => setCurrentView('main')}
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
        {Object.keys(colorPresets).map((colorKey) => {
          const isSelected = currentColor === colorKey;
          return (
            <Pressable
              key={colorKey}
              style={({ pressed }) => [
                styles.colorOption,
                pressed && styles.colorOptionPressed,
              ]}
              onPress={() => {
                if (noteId) {
                  onColorChange(noteId, colorKey as ColorPreset);
                }
              }}
            >
              <View style={styles.colorPreviewContainer}>
                <View style={[styles.colorPreview, getColorStyle(colorKey as ColorPreset)]} />
              </View>
              <Text style={[
                styles.colorName,
                { color: theme.colors.grey4 },
                isSelected && styles.colorNameSelected
              ]}>
                {colorPresets[colorKey as ColorPreset].name}
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
    );
  };

  // Render rename interface
  const renderRenameInterface = () => {
    return (
      <>
        <View style={styles.colorPickerHeader}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => setCurrentView('main')}
          >
            <MaterialIcons 
              name="arrow-back" 
              size={20} 
              color={theme.colors.grey4} 
            />
          </Pressable>
          <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
            Rename {itemType === 'folder' ? 'Folder' : 'Note'}
          </Text>
        </View>
        <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
        <View style={styles.renameContainer}>
          <Input
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder={`Enter ${itemType === 'folder' ? 'folder' : 'note'} name`}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleRenameSubmit}
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
            onPress={handleRenameSubmit}
          >
            <Text style={styles.renameButtonText}>
              Save
            </Text>
          </Pressable>
        </View>
      </>
    );
  };

  // Render move to folder interface
  const renderMoveToFolder = () => {
    return (
      <>
        <View style={styles.colorPickerHeader}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={() => setCurrentView('main')}
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
            onPress={() => {
              if (noteId) {
                onMoveToFolder(noteId, '/');
              }
            }}
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
              onPress={() => {
                if (noteId) {
                  onMoveToFolder(noteId, folder.path);
                }
              }}
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
    );
  };

  return (
    <Overlay
      isVisible={isVisible}
      onBackdropPress={onClose}
      overlayStyle={styles.overlayContainer}
      backdropStyle={styles.backdrop}
      animationType="fade"
    >
      <Pressable 
        style={StyleSheet.absoluteFill}
        onPress={onClose}
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
            left: position.x,
            top: position.y,
            width: position.width,
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
          {currentView === 'main' && renderMainMenu()}
          {currentView === 'color' && renderColorPicker()}
          {currentView === 'rename' && renderRenameInterface()}
          {currentView === 'move' && renderMoveToFolder()}
        </Pressable>
      </View>
    </Overlay>
  );
};

const styles = StyleSheet.create({
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
}); 