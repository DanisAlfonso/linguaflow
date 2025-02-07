import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, Modal, Pressable } from 'react-native';
import { Text, Button, useTheme, Input } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Container } from '../../../../components/layout/Container';
import { getCardRecordings, deleteRecording } from '../../../../lib/api/audio';
import type { Recording } from '../../../../types/audio';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../../lib/supabase';

export default function RecordingsScreen() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const sound = useRef<Audio.Sound>();
  
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();

  // Load recordings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRecordings();
      return () => {
        if (sound.current) {
          sound.current.unloadAsync();
        }
      };
    }, [id])
  );

  const loadRecordings = async () => {
    try {
      console.log('Loading recordings for card:', id);
      setLoading(true);
      const data = await getCardRecordings(id as string);
      console.log('Loaded recordings:', data);
      setRecordings(data);
    } catch (error) {
      console.error('Error loading recordings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load recordings',
      });
    } finally {
      setLoading(false);
    }
  };

  const playRecording = async (recording: Recording) => {
    try {
      // Stop current playback if any
      if (sound.current) {
        await sound.current.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recording.audio_url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setCurrentlyPlaying(null);
          }
        }
      );

      sound.current = newSound;
      setCurrentlyPlaying(recording.id);
    } catch (error) {
      console.error('Error playing recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to play recording',
      });
    }
  };

  const stopPlayback = async () => {
    try {
      if (sound.current) {
        await sound.current.stopAsync();
        setCurrentlyPlaying(null);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const handleDelete = async (recordingId: string) => {
    try {
      await deleteRecording(recordingId);
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recording deleted',
      });
    } catch (error) {
      console.error('Error deleting recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete recording',
      });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const onRefresh = useCallback(async () => {
    console.log('Refreshing recordings for card:', id);
    setRefreshing(true);
    try {
      const data = await getCardRecordings(id as string);
      console.log('Refreshed recordings:', data);
      setRecordings(data);
    } catch (error) {
      console.error('Error refreshing recordings:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to refresh recordings',
      });
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  const handleLongPress = (recording: Recording) => {
    setSelectedRecording(recording);
    setNewName(recording.name || formatDate(recording.created_at));
    setIsRenameModalVisible(true);
  };

  const handleRename = async () => {
    if (!selectedRecording || !newName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('recordings')
        .update({ name: newName.trim() })
        .eq('id', selectedRecording.id)
        .select()
        .single();

      if (error) throw error;

      setRecordings(prev => 
        prev.map(r => 
          r.id === selectedRecording.id 
            ? { ...r, name: newName.trim() } 
            : r
        )
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recording renamed',
      });
    } catch (error) {
      console.error('Error renaming recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to rename recording',
      });
    } finally {
      setIsRenameModalVisible(false);
      setSelectedRecording(null);
      setNewName('');
    }
  };

  const renderItem = ({ item }: { item: Recording }) => {
    const isPlaying = currentlyPlaying === item.id;

    return (
      <Pressable 
        onLongPress={() => handleLongPress(item)}
        style={[
          styles.recordingItem,
          { backgroundColor: theme.colors.grey0 }
        ]}
      >
        <View style={styles.recordingInfo}>
          <Text style={[styles.date, { color: theme.colors.grey3 }]}>
            {item.name || formatDate(item.created_at)}
          </Text>
          <Text style={[styles.duration, { color: theme.colors.grey2 }]}>
            {formatDuration(item.duration)}
          </Text>
        </View>
        <View style={styles.recordingControls}>
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name={isPlaying ? "stop" : "play-arrow"}
                size={24}
                color={theme.colors.primary}
              />
            }
            onPress={() => isPlaying ? stopPlayback() : playRecording(item)}
          />
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name="delete"
                size={24}
                color={theme.colors.error}
              />
            }
            onPress={() => handleDelete(item.id)}
          />
        </View>
      </Pressable>
    );
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
          />
          <Text style={[styles.title, { color: theme.colors.grey5 }]}>
            Recordings
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.grey5 }]}>
              Loading recordings...
            </Text>
          </View>
        ) : recordings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.grey4 }]}>
              No recordings yet
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.grey3 }]}>
              Record your practice attempts to track your progress
            </Text>
          </View>
        ) : (
          <FlatList
            data={recordings}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}

        <Modal
          visible={isRenameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsRenameModalVisible(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setIsRenameModalVisible(false)}
          >
            <Pressable 
              style={[
                styles.modalContent,
                { backgroundColor: theme.colors.background }
              ]}
              onPress={e => e.stopPropagation()}
            >
              <Text style={[styles.modalTitle, { color: theme.colors.grey5 }]}>
                Rename Recording
              </Text>
              <Input
                value={newName}
                onChangeText={setNewName}
                autoFocus
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
              />
              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  type="clear"
                  onPress={() => setIsRenameModalVisible(false)}
                  titleStyle={{ color: theme.colors.grey3 }}
                />
                <Button
                  title="Rename"
                  type="clear"
                  onPress={handleRename}
                  disabled={!newName.trim()}
                  titleStyle={{ color: theme.colors.primary }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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
    gap: 16,
    marginBottom: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
  list: {
    gap: 16,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
  },
  recordingInfo: {
    gap: 4,
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
  },
  duration: {
    fontSize: 12,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    paddingHorizontal: 0,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  inputText: {
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
}); 