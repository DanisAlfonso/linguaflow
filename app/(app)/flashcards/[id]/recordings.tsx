import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, FlatList, Modal, Pressable, Platform } from 'react-native';
import { Text, Button, useTheme, Input, Overlay } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Container } from '../../../../components/layout/Container';
import { deleteRecording } from '../../../../lib/api/audio';
import { getCardRecordings, syncAudioRecordings } from '../../../../lib/services/audio';
import { isOnline } from '../../../../lib/services/flashcards';
import type { Recording } from '../../../../types/audio';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../../lib/supabase';
import NetInfo from '@react-native-community/netinfo';

export default function RecordingsScreen() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isOffline, setIsOffline] = useState(false);
  const sound = useRef<Audio.Sound>();
  
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useTheme();
  const isWeb = Platform.OS === 'web';

  // Check network status
  useEffect(() => {
    const checkNetworkStatus = async () => {
      const networkStatus = await NetInfo.fetch();
      setIsOffline(!(networkStatus.isConnected && networkStatus.isInternetReachable));
    };
    
    checkNetworkStatus();
    
    // Subscribe to network status updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected && state.isInternetReachable));
    });
    
    return () => unsubscribe();
  }, []);

  // Load recordings when screen comes into focus and try to sync if online
  useFocusEffect(
    useCallback(() => {
      loadRecordings();
      
      // Try to sync recordings if we're online
      const syncRecordings = async () => {
        const networkStatus = await isOnline();
        if (networkStatus) {
          try {
            await syncAudioRecordings();
            // Reload recordings after sync
            loadRecordings();
          } catch (error) {
            console.error('Error syncing recordings:', error);
          }
        }
      };
      
      syncRecordings();
      
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
      setRefreshing(false);
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

  const handleLongPressRecording = (recording: Recording, event: any) => {
    // Get the position of the pressed element for menu placement
    if (event?.nativeEvent) {
      const { pageX, pageY, locationX, locationY } = event.nativeEvent;
      setMenuPosition({
        x: pageX - locationX,
        y: pageY - locationY,
        width: 220, // Fixed menu width
        height: 0,
      });
    }
    setSelectedRecording(recording);
  };

  const handleDeleteRecording = async () => {
    if (!selectedRecording) return;

    try {
      await deleteRecording(selectedRecording.id);
      setRecordings(prev => prev.filter(r => r.id !== selectedRecording.id));
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
    } finally {
      setSelectedRecording(null);
    }
  };

  const handleCloseMenu = () => {
    setSelectedRecording(null);
  };

  const renderItem = ({ item }: { item: Recording }) => {
    const isPlaying = currentlyPlaying === item.id;

    return (
      <Pressable
        onPress={() => isPlaying ? stopPlayback() : playRecording(item)}
        onLongPress={(event) => handleLongPressRecording(item, event)}
        style={[
          styles.recordingItem,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.mode === 'dark' 
              ? 'rgba(255, 255, 255, 0.1)'  // Subtle white border for dark mode
              : 'rgba(0, 0, 0, 0.1)',       // Subtle black border for light mode
          }
        ]}
      >
        <View style={styles.recordingInfo}>
          <Text 
            style={[
              styles.recordingName,
              { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.black }
            ]}
          >
            {item.name || formatDate(item.created_at)}
          </Text>
          <Text 
            style={[
              styles.recordingDuration,
              { color: theme.mode === 'dark' ? theme.colors.grey3 : theme.colors.grey2 }
            ]}
          >
            Duration: {formatDuration(item.duration)}
          </Text>
        </View>
        <MaterialIcons
          name={isPlaying ? 'stop' : 'play-arrow'}
          size={24}
          color={theme.colors.primary}
        />
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
            style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={() => setIsRenameModalVisible(false)}
          >
            {Platform.OS === 'ios' ? (
              <BlurView 
                intensity={80} 
                tint={theme.mode === 'dark' ? 'dark' : 'light'} 
                style={[styles.modalContent, styles.blurContainer]}
              >
                <ModalContent />
              </BlurView>
            ) : (
              <View style={[
                styles.modalContent,
                { backgroundColor: theme.colors.background }
              ]}>
                <ModalContent />
              </View>
            )}
          </Pressable>
        </Modal>

        {/* Context Menu Overlay */}
        <Overlay
          isVisible={!!selectedRecording}
          onBackdropPress={handleCloseMenu}
          overlayStyle={[
            styles.menuOverlay,
            {
              backgroundColor: isWeb 
                ? theme.colors.background 
                : 'transparent',
              top: menuPosition.y,
              left: menuPosition.x,
              width: menuPosition.width,
            }
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView 
              intensity={80} 
              tint={theme.mode === 'dark' ? 'dark' : 'light'} 
              style={[
                styles.blurContainer,
                {
                  backgroundColor: theme.mode === 'dark'
                    ? 'rgba(0, 0, 0, 0.5)'
                    : 'rgba(255, 255, 255, 0.5)',
                }
              ]}
            >
              <MenuContent />
            </BlurView>
          ) : (
            <View style={[
              styles.menuContent,
              {
                backgroundColor: theme.mode === 'dark'
                  ? 'rgba(30, 30, 30, 0.95)'
                  : 'rgba(255, 255, 255, 0.95)',
              }
            ]}>
              <MenuContent />
            </View>
          )}
        </Overlay>
      </Container>
    </SafeAreaView>
  );

  function ModalContent() {
    return (
      <>
        <Text style={[styles.modalTitle, { color: theme.colors.grey0 }]}>
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
              borderColor: theme.colors.grey4,
              backgroundColor: theme.mode === 'dark' 
                ? theme.colors.grey5 
                : theme.colors.grey1,
            },
          ]}
          inputStyle={[
            styles.inputText,
            { color: theme.colors.grey0 }
          ]}
          placeholderTextColor={theme.colors.grey3}
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
            titleStyle={{ 
              color: newName.trim() ? theme.colors.primary : theme.colors.grey3 
            }}
          />
        </View>
      </>
    );
  }

  function MenuContent() {
    return (
      <View>
        <Pressable
          onPress={() => {
            handleCloseMenu();
            setIsRenameModalVisible(true);
            if (selectedRecording) {
              setNewName(selectedRecording.name || formatDate(selectedRecording.created_at));
            }
          }}
          style={({ pressed }) => [
            styles.menuItem,
            pressed && { backgroundColor: theme.colors.grey5 }
          ]}
        >
          <MaterialIcons 
            name="edit" 
            size={20} 
            color={theme.mode === 'dark' ? theme.colors.white : theme.colors.black} 
          />
          <Text style={[
            styles.menuText, 
            { color: theme.mode === 'dark' ? theme.colors.white : theme.colors.black }
          ]}>
            Rename
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDeleteRecording}
          style={({ pressed }) => [
            styles.menuItem,
            pressed && { backgroundColor: theme.colors.grey5 }
          ]}
        >
          <MaterialIcons name="delete" size={20} color={theme.colors.error} />
          <Text style={[styles.menuText, { color: theme.colors.error }]}>Delete Recording</Text>
        </Pressable>
      </View>
    );
  }
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
    padding: 16,
    gap: 12,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  recordingInfo: {
    flex: 1,
    marginRight: 16,
    gap: 4,
  },
  recordingName: {
    fontSize: 16,
    fontWeight: '500',
  },
  recordingDuration: {
    fontSize: 14,
  },
  menuOverlay: {
    position: 'absolute',
    padding: 0,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  blurContainer: {
    overflow: 'hidden',
    borderRadius: 14,
  },
  menuContent: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
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