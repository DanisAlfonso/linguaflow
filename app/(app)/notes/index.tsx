import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
import { Text, Button, FAB, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { useAuth } from '../../../contexts/AuthContext';
import { getNotes } from '../../../lib/db/notes';
import { NoteWithAttachments, ColorPreset } from '../../../types/notes';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const { width: windowWidth } = useWindowDimensions();

  // Memoize the card width calculation to avoid recalculation on every render
  const getCardWidth = useMemo(() => {
    const isWeb = Platform.OS === 'web';
    const maxWidth = isWeb ? Math.min(windowWidth, 1200) : windowWidth;
    const containerPadding = isWeb ? 40 : 12;
    const gap = 24;
    const numColumns = isWeb ? 3 : 2;
    return isWeb 
      ? (maxWidth - (containerPadding * 2) - (gap * (numColumns - 1))) / numColumns 
      : (windowWidth - (containerPadding * 2) - gap) / 2;
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

  const renderNoteCard = (note: NoteWithAttachments) => {
    const isWeb = Platform.OS === 'web';
    const colorStyle = getColorStyle(note.color_preset);
    const isHovered = hoveredNoteId === note.id;

    return (
      <Animated.View key={note.id} style={[{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <Pressable
          style={[
            styles.noteCard,
            view === 'grid' ? [styles.gridCard, { width: getCardWidth }] : styles.listCard,
            { backgroundColor: theme.mode === 'dark' ? '#1F1F1F' : theme.colors.grey0 },
            isWeb && isHovered && {
              transform: [{ translateY: -4 }],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
            },
          ]}
          onPress={() => router.push(`/notes/${note.id}`)}
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
            <View style={[styles.notesContainer, view === 'grid' && styles.gridContainer]}>
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
    ...(Platform.OS === 'web' && {
      justifyContent: 'center',
      alignItems: 'flex-start',
      maxWidth: 1200,
      alignSelf: 'center',
      width: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
    }),
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
}); 