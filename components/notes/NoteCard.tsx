import React from 'react';
import { View, StyleSheet, Pressable, Platform, Text, Animated } from 'react-native';
import { useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { NoteWithAttachments, ColorPreset } from '../../types/notes';

interface NoteCardProps {
  note: NoteWithAttachments;
  view: 'grid' | 'list';
  isHovered: boolean;
  onPress: () => void;
  onLongPress: (event: any) => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}

export function NoteCard({
  note,
  view,
  isHovered,
  onPress,
  onLongPress,
  onHoverIn,
  onHoverOut
}: NoteCardProps) {
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

  const colorStyle = getColorStyle(note.color_preset);

  return (
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
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
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
}); 