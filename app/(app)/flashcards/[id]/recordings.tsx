import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Container } from '../../../../components/layout/Container';
import { getCardRecordings, deleteRecording } from '../../../../lib/api/audio';
import type { Recording } from '../../../../types/audio';
import Toast from 'react-native-toast-message';

export default function RecordingsScreen() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const sound = useRef<Audio.Sound>();
  
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();

  useEffect(() => {
    loadRecordings();
  }, []);

  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  const loadRecordings = async () => {
    try {
      const data = await getCardRecordings(id as string);
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

  const renderItem = ({ item }: { item: Recording }) => {
    const isPlaying = currentlyPlaying === item.id;

    return (
      <View 
        style={[
          styles.recordingItem,
          { backgroundColor: theme.colors.grey0 }
        ]}
      >
        <View style={styles.recordingInfo}>
          <Text style={[styles.date, { color: theme.colors.grey3 }]}>
            {formatDate(item.created_at)}
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
      </View>
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
          />
        )}
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
}); 