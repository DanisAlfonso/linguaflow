import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, Button } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashcardAudioPlayer } from './FlashcardAudioPlayer';
import { AudioAttachButton } from '../AudioAttachButton';
import type { CardAudioSegment } from '../../../types/audio';
import { deleteAudioSegment } from '../../../lib/api/audio';
import { deleteOfflineAudioSegment } from '../../../lib/api/offline-audio';
import { Pressable } from 'react-native';
import Toast from 'react-native-toast-message';
import { isOnline } from '../../../lib/services/flashcards';
import NetInfo from '@react-native-community/netinfo';

interface FlashcardAudioSectionProps {
  label: string;
  audioSegments: CardAudioSegment[];
  cardId: string;
  side: 'front' | 'back';
  isEditing: boolean;
  onAudioChange: () => void;
}

export function FlashcardAudioSection({
  label,
  audioSegments,
  cardId,
  side,
  isEditing,
  onAudioChange,
}: FlashcardAudioSectionProps) {
  const { theme } = useTheme();
  const [offlineStatus, setOfflineStatus] = useState(false);
  
  // Check network status
  useEffect(() => {
    const checkNetwork = async () => {
      const networkAvailable = await isOnline();
      setOfflineStatus(!networkAvailable);
    };
    
    checkNetwork();
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setOfflineStatus(!(state.isConnected && state.isInternetReachable));
    });
    
    return () => unsubscribe();
  }, []);

  const handleDeleteAudio = async (segmentId: string) => {
    try {
      // Check if this is an offline segment
      const isOfflineSegment = segmentId.startsWith('offline_segment_');
      
      if (isOfflineSegment) {
        console.log('🔄 [AUDIO SECTION] Deleting offline audio segment:', segmentId);
        await deleteOfflineAudioSegment(segmentId);
      } else if (!offlineStatus) {
        console.log('🔄 [AUDIO SECTION] Deleting online audio segment:', segmentId);
        await deleteAudioSegment(segmentId);
      } else {
        // Online segment but offline mode
        Toast.show({
          type: 'info',
          text1: 'Offline Mode',
          text2: 'Cannot delete server audio while offline',
        });
        return;
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio file deleted successfully',
      });
      onAudioChange();
    } catch (error) {
      console.error('Error deleting audio segment:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete audio file',
      });
    }
  };

  // Don't show empty section if not editing
  if (audioSegments.length === 0 && !isEditing) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: theme.colors.grey4 }]}>
          {label}
        </Text>
        
        {isEditing && (
          <AudioAttachButton
            cardId={cardId}
            side={side}
            onAudioAttached={onAudioChange}
          />
        )}
      </View>

      <View style={styles.audioList}>
        {audioSegments.length > 0 ? (
          audioSegments.map((segment) => {
            const isOfflineSegment = segment.id.startsWith('offline_segment_');
            
            return (
              <View 
                key={segment.id}
                style={[
                  styles.audioItem,
                  { 
                    borderColor: theme.colors.grey2,
                    backgroundColor: theme.colors.grey0,
                  }
                ]}
              >
                <View style={styles.audioPlayerContainer}>
                  <FlashcardAudioPlayer
                    audioUrl={segment.audio_file.url}
                    fileName={segment.audio_file.name}
                  />
                  
                  {isOfflineSegment && (
                    <Text style={styles.offlineIndicator}>
                      Saved locally
                    </Text>
                  )}
                </View>
                
                {isEditing && (
                  <Pressable
                    onPress={() => handleDeleteAudio(segment.id)}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && { opacity: 0.7 },
                      { backgroundColor: '#DC262615' }
                    ]}
                    disabled={!isOfflineSegment && offlineStatus}
                  >
                    <MaterialIcons
                      name="delete"
                      size={20}
                      color={!isOfflineSegment && offlineStatus ? "#A1A1AA" : "#DC2626"}
                    />
                  </Pressable>
                )}
              </View>
            );
          })
        ) : isEditing ? (
          <Text style={styles.emptyText}>
            No audio attached. Use the microphone icon to add audio.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  audioList: {
    gap: 8,
  },
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  audioPlayerContainer: {
    flex: 1,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  offlineIndicator: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginLeft: 8,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginLeft: 8,
  },
}); 