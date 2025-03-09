import React from 'react';
import { View, StyleSheet, Pressable, Platform, Text, Animated } from 'react-native';
import { useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { ColorPreset } from '../../types/notes';

interface FolderCardProps {
  folder: {
    id: string;
    name: string;
    path: string;
    color: ColorPreset | null;
    itemCount: number;
    lastModified: string;
  };
  view: 'grid' | 'list';
  isHovered: boolean;
  onPress: () => void;
  onLongPress: (event: any) => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}

export function FolderCard({
  folder,
  view,
  isHovered,
  onPress,
  onLongPress,
  onHoverIn,
  onHoverOut
}: FolderCardProps) {
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  const cardStyle = {
    backgroundColor: theme.mode === 'dark' ? '#1F1F1F' : theme.colors.grey0,
    borderWidth: 1,
    borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
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

  const colorStyle = getColorStyle(folder.color);

  return (
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
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
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
  );
}

const styles = StyleSheet.create({
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
  folderCard: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
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
}); 