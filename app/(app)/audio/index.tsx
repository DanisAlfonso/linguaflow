import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Platform, Pressable } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { LinearGradient } from 'expo-linear-gradient';
import { Waveform } from '../../../components/audio/Waveform';
import { UploadAudioModal } from '../../../components/audio/UploadAudioModal';
import type { AudioTrack, AudioPlaylist } from '../../../types/audio-player';
import type { AudioFile } from '../../../types/audio';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { getAudioFileUrl } from '../../../lib/api/audio';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../lib/supabase';

export default function AudioScreen() {
  const { theme } = useTheme();
  const sound = useRef<Audio.Sound>();
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<AudioPlaylist | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);

  // Placeholder waveform data for testing
  const mockWaveformData = Array.from({ length: 200 }, () => Math.random());

  // Initialize audio session
  useEffect(() => {
    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    initAudio();

    // Cleanup
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  // Handle playback status updates
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setCurrentTime(status.positionMillis);
    setDuration(status.durationMillis || 0);
    
    if (!isSeeking && status.durationMillis) {
      setPlaybackProgress(status.positionMillis / status.durationMillis);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPlaybackProgress(0);
      sound.current?.setPositionAsync(0);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = async () => {
    try {
      if (!sound.current) {
        if (!currentTrack?.audioFile?.file_path) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'No audio file selected',
          });
          return;
        }

        console.log('Attempting to play file with path:', currentTrack.audioFile.file_path);

        // Get a signed URL for the audio file
        const signedUrl = await getAudioFileUrl(currentTrack.audioFile.file_path);
        console.log('Got signed URL:', signedUrl);

        try {
          // Create and load the sound with optimized configuration
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: signedUrl },
            { 
              shouldPlay: true,
              volume: 1.0,
              isLooping: false,
              progressUpdateIntervalMillis: 100,
            },
            onPlaybackStatusUpdate,
            true // Download first before playing
          );

          sound.current = newSound;
          setIsPlaying(true);
          console.log('Audio loaded and playing successfully');
        } catch (audioError) {
          console.error('Error creating audio:', audioError);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load audio file',
          });
        }
      } else {
        const status = await sound.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.current.pauseAsync();
          } else {
            await sound.current.playAsync();
          }
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error instanceof Error ? error.message : 'Failed to play audio',
      });
    }
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeek = (progress: number) => {
    setPlaybackProgress(progress);
  };

  const handleSeekEnd = async (progress: number) => {
    setIsSeeking(false);
    if (sound.current) {
      const status = await sound.current.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const newPosition = progress * status.durationMillis;
        await sound.current.setPositionAsync(newPosition);
      }
    }
  };

  const handleUploadComplete = async (audioFile: any) => {
    try {
      // Get the current user's ID
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'User not authenticated',
        });
        return;
      }

      // Create an audio track record
      const { data: trackData, error: trackError } = await supabase
        .from('audio_tracks')
        .insert({
          title: audioFile.original_filename.replace(/\.[^/.]+$/, ''),
          description: '',
          audio_file_id: audioFile.id,
          track_type: 'upload',
          user_id: user.id
        })
        .select()
        .single();

      if (trackError) {
        console.error('Error creating audio track:', trackError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to create audio track',
        });
        return;
      }

      // Create a new track from the uploaded file
      const newTrack: AudioTrack = {
        id: trackData.id,
        userId: trackData.user_id,
        title: trackData.title,
        description: trackData.description || '',
        audioFileId: audioFile.id,
        audioFile: {
          ...audioFile,
          // Ensure we're using the correct file path format
          file_path: audioFile.file_path.startsWith('/') 
            ? audioFile.file_path.slice(1) 
            : audioFile.file_path
        } as AudioFile,
        trackType: trackData.track_type,
        createdAt: new Date(trackData.created_at),
        updatedAt: new Date(trackData.updated_at),
      };

      console.log('Setting current track with file path:', newTrack.audioFile?.file_path);
      setCurrentTrack(newTrack);
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Audio file uploaded and ready to play',
      });
    } catch (error) {
      console.error('Error in handleUploadComplete:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process uploaded file',
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Container>
        <View style={styles.headerSection}>
          <Text h1 style={[styles.title, { color: theme.colors.grey5 }]}>
            Audio Player
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.grey3 }]}>
            Create and manage your audio tracks
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Upload Section */}
          <View style={styles.uploadSection}>
            <LinearGradient
              colors={['rgba(79, 70, 229, 0.1)', 'rgba(99, 102, 241, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.uploadCard}
            >
              <View style={styles.uploadCardContent}>
                <View style={styles.uploadInfo}>
                  <Text style={[styles.uploadTitle, { color: theme.colors.grey5 }]}>
                    Ready to add new content?
                  </Text>
                  <Text style={[styles.uploadDescription, { color: theme.colors.grey3 }]}>
                    Upload your audio tracks and start creating your library
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.uploadButton,
                    { 
                      transform: [{ scale: pressed ? 0.98 : 1 }]
                    }
                  ]}
                  onPress={() => setIsUploadModalVisible(true)}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#6366F1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.uploadButtonGradient}
                  >
                    <MaterialIcons name="add" size={24} color="white" style={styles.buttonIcon} />
                    <Text style={styles.buttonText}>New Track</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          {/* Now Playing Section */}
          <View style={styles.nowPlayingSection}>
            <LinearGradient
              colors={['#4F46E5', '#818CF8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nowPlayingCard}
            >
              <View style={styles.albumArtPlaceholder}>
                <MaterialIcons name="music-note" size={48} color="rgba(255, 255, 255, 0.9)" />
              </View>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle}>
                  {currentTrack?.title || 'No track playing'}
                </Text>
                <Text style={styles.trackDescription}>
                  {currentTrack?.description || 'Select a track to start playing'}
                </Text>
              </View>
              
              {/* Waveform */}
              <View style={styles.waveformContainer}>
                <Waveform
                  data={mockWaveformData}
                  progress={playbackProgress}
                  isPlaying={isPlaying}
                  isSeeking={isSeeking}
                  onSeekStart={handleSeekStart}
                  onSeek={handleSeek}
                  onSeekEnd={handleSeekEnd}
                  height={48}
                  barWidth={3}
                  barGap={2}
                  activeColor="rgba(255, 255, 255, 0.9)"
                  inactiveColor="rgba(255, 255, 255, 0.2)"
                  style={styles.waveform}
                />
                <View style={styles.timeIndicators}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </View>

              <View style={styles.playbackControls}>
                <Pressable style={styles.controlButton}>
                  <MaterialIcons name="skip-previous" size={32} color="white" />
                </Pressable>
                <Pressable 
                  style={[styles.controlButton, styles.playButton]}
                  onPress={togglePlayPause}
                >
                  <MaterialIcons 
                    name={isPlaying ? "pause" : "play-arrow"} 
                    size={40} 
                    color="white" 
                  />
                </Pressable>
                <Pressable style={styles.controlButton}>
                  <MaterialIcons name="skip-next" size={32} color="white" />
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          {/* Recent Tracks Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                Recent Tracks
              </Text>
              <Pressable>
                <Text style={[styles.seeAllButton, { color: theme.colors.primary }]}>
                  See All
                </Text>
              </Pressable>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentTracksContainer}
            >
              {/* Placeholder for recent tracks */}
              {[1, 2, 3].map((_, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.recentTrackCard,
                    { backgroundColor: theme.colors.grey0 }
                  ]}
                >
                  <View style={[styles.recentTrackArt, { backgroundColor: theme.colors.grey1 }]}>
                    <MaterialIcons name="music-note" size={24} color={theme.colors.grey3} />
                  </View>
                  <Text 
                    style={[styles.recentTrackTitle, { color: theme.colors.grey5 }]}
                    numberOfLines={1}
                  >
                    Track {index + 1}
                  </Text>
                  <Text 
                    style={[styles.recentTrackDuration, { color: theme.colors.grey3 }]}
                  >
                    3:45
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Playlists Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                Your Playlists
              </Text>
              <Pressable>
                <Text style={[styles.seeAllButton, { color: theme.colors.primary }]}>
                  See All
                </Text>
              </Pressable>
            </View>
            <View style={styles.playlistsGrid}>
              {/* Placeholder for playlists */}
              {[1, 2, 3, 4].map((_, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.playlistCard,
                    { backgroundColor: theme.colors.grey0 }
                  ]}
                >
                  <View style={[styles.playlistArt, { backgroundColor: theme.colors.grey1 }]}>
                    <MaterialIcons name="queue-music" size={32} color={theme.colors.grey3} />
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text 
                      style={[styles.playlistTitle, { color: theme.colors.grey5 }]}
                      numberOfLines={1}
                    >
                      Playlist {index + 1}
                    </Text>
                    <Text 
                      style={[styles.playlistStats, { color: theme.colors.grey3 }]}
                    >
                      12 tracks • 45:30
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </Container>

      <UploadAudioModal
        isVisible={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        onUploadComplete={handleUploadComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    letterSpacing: 0.1,
  },
  uploadSection: {
    marginBottom: 32,
  },
  uploadCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    overflow: 'hidden',
  },
  uploadCardContent: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  uploadInfo: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  uploadDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  uploadButton: {
    overflow: 'hidden',
    borderRadius: 16,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {
        elevation: 4,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  nowPlayingSection: {
    marginBottom: 32,
  },
  nowPlayingCard: {
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  albumArtPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  trackInfo: {
    marginBottom: 24,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  trackDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  waveformContainer: {
    marginBottom: 24,
    marginHorizontal: -8,
  },
  waveform: {
    marginHorizontal: 8,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  controlButton: {
    padding: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  playButton: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  seeAllButton: {
    fontSize: 16,
    fontWeight: '500',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  recentTracksContainer: {
    gap: 16,
    paddingRight: 16,
  },
  recentTrackCard: {
    width: 180,
    padding: 12,
    borderRadius: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  recentTrackArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentTrackTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  recentTrackDuration: {
    fontSize: 14,
  },
  playlistsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  playlistCard: {
    flex: 1,
    minWidth: 200,
    maxWidth: 300,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  playlistArt: {
    width: 64,
    height: 64,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  playlistStats: {
    fontSize: 14,
  },
  timeIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
}); 