import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Platform, Pressable, TextInput, RefreshControl } from 'react-native';
import { Text, useTheme, Button } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';
import { LinearGradient } from 'expo-linear-gradient';
import { Waveform } from '../../../components/audio/Waveform';
import { UploadAudioModal } from '../../../components/audio/UploadAudioModal';
import type { AudioTrack, AudioPlaylist } from '../../../types/audio-player';
import type { AudioFile } from '../../../types/audio';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { getAudioFileUrl, deleteTrack, validateTrackFile } from '../../../lib/api/audio';
import Toast from 'react-native-toast-message';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '@rneui/base';
import { Overlay } from '@rneui/base';
import { BlurView } from 'expo-blur';

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
  const [recentTracks, setRecentTracks] = useState<AudioTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAllTracksModalVisible, setIsAllTracksModalVisible] = useState(false);
  const [allTracks, setAllTracks] = useState<AudioTrack[]>([]);
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>([]);
  const [isPlaylistModalVisible, setIsPlaylistModalVisible] = useState(false);
  const [isCreatePlaylistModalVisible, setIsCreatePlaylistModalVisible] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<AudioPlaylist | null>(null);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, AudioTrack[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [showRename, setShowRename] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [showPlaylistRename, setShowPlaylistRename] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

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

  // Fetch recent tracks
  const fetchRecentTracks = async () => {
    try {
      const { data: tracks, error } = await supabase
        .from('audio_tracks')
        .select('*, audio_file:audio_files(*)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentTracks(tracks.map(track => ({
        ...track,
        createdAt: new Date(track.created_at),
        updatedAt: new Date(track.updated_at),
        audioFile: track.audio_file
      })));
    } catch (error) {
      console.error('Error fetching recent tracks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load recent tracks',
      });
    }
  };

  // Load recent tracks on mount
  useEffect(() => {
    fetchRecentTracks();
  }, []);

  // Function to play a specific track
  const playTrack = async (track: AudioTrack) => {
    try {
      // Validate that the file exists before attempting to play
      const isValid = await validateTrackFile(track.id);
      if (!isValid) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Audio file not found',
        });
        // Refresh the track list to remove invalid tracks
        fetchRecentTracks();
        return;
      }

      // Unload current sound if exists
      if (sound.current) {
        await sound.current.unloadAsync();
      }

      setCurrentTrack(track);
      setIsLoading(true);

      const signedUrl = await getAudioFileUrl(track.audioFile!.file_path);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: signedUrl },
        { 
          shouldPlay: true,
          volume,
          isLooping: false,
          progressUpdateIntervalMillis: 100,
        },
        onPlaybackStatusUpdate,
        true
      );

      sound.current = newSound;
      setIsPlaying(true);
      setIsLoading(false);

      // Increment play count
      await supabase.rpc('increment_track_play_count', { p_track_id: track.id });
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to play track',
      });
    }
  };

  // Function to play previous track
  const playPreviousTrack = () => {
    if (!currentTrack || recentTracks.length === 0) return;
    
    const currentIndex = recentTracks.findIndex(track => track.id === currentTrack.id);
    if (currentIndex === -1) return;
    
    const previousIndex = currentIndex === 0 ? recentTracks.length - 1 : currentIndex - 1;
    playTrack(recentTracks[previousIndex]);
  };

  // Function to play next track
  const playNextTrack = () => {
    if (!currentTrack || recentTracks.length === 0) return;
    
    const currentIndex = recentTracks.findIndex(track => track.id === currentTrack.id);
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex === recentTracks.length - 1 ? 0 : currentIndex + 1;
    playTrack(recentTracks[nextIndex]);
  };

  // Fetch all tracks
  const fetchAllTracks = async () => {
    try {
      const { data: tracks, error } = await supabase
        .from('audio_tracks')
        .select('*, audio_file:audio_files(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllTracks(tracks.map(track => ({
        ...track,
        createdAt: new Date(track.created_at),
        updatedAt: new Date(track.updated_at),
        audioFile: track.audio_file
      })));
    } catch (error) {
      console.error('Error fetching all tracks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load tracks',
      });
    }
  };

  // Fetch user's playlists
  const fetchPlaylists = async () => {
    try {
      const { data: playlistsData, error: playlistsError } = await supabase
        .from('audio_playlists')
        .select('*')
        .order('created_at', { ascending: false });

      if (playlistsError) throw playlistsError;

      setPlaylists(playlistsData.map(playlist => ({
        ...playlist,
        createdAt: new Date(playlist.created_at),
        updatedAt: new Date(playlist.updated_at),
      })));
    } catch (error) {
      console.error('Error fetching playlists:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load playlists',
      });
    }
  };

  // Create a new playlist
  const createPlaylist = async (title: string, description: string = '') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: playlist, error } = await supabase
        .from('audio_playlists')
        .insert({
          title,
          description,
          user_id: user.id,
          visibility: 'private',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchPlaylists();
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Playlist created successfully',
      });
    } catch (error) {
      console.error('Error creating playlist:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create playlist',
      });
    }
  };

  // Load playlists on mount
  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylistTracks = async (playlistId: string) => {
    try {
      const { data: tracks, error } = await supabase
        .from('audio_playlist_tracks')
        .select(`
          *,
          track:audio_tracks(
            *,
            audio_file:audio_files(*)
          )
        `)
        .eq('playlist_id', playlistId)
        .order('position');

      if (error) throw error;

      const formattedTracks = tracks.map(item => ({
        ...item.track,
        createdAt: new Date(item.track.created_at),
        updatedAt: new Date(item.track.updated_at),
        audioFile: item.track.audio_file
      }));

      setPlaylistTracks(prev => ({
        ...prev,
        [playlistId]: formattedTracks
      }));
    } catch (error) {
      console.error('Error fetching playlist tracks:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load playlist tracks',
      });
    }
  };

  const handlePlaylistSelect = (playlist: AudioPlaylist) => {
    setSelectedPlaylist(playlist);
    setIsPlaylistModalVisible(true);
    fetchPlaylistTracks(playlist.id);
  };

  // Add handleDeleteTrack function
  const handleDeleteTrack = async (track: AudioTrack) => {
    try {
      await deleteTrack(track.id);
      
      // If this was the current track, stop playback
      if (currentTrack?.id === track.id) {
        if (sound.current) {
          await sound.current.unloadAsync();
        }
        setCurrentTrack(null);
        setIsPlaying(false);
      }
      
      // Refresh the track lists
      fetchRecentTracks();
      if (allTracks.length > 0) {
        fetchAllTracks();
      }
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Track deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting track:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete track',
      });
    }
  };

  // Add refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchRecentTracks();
      if (allTracks.length > 0) {
        await fetchAllTracks();
      }
      await fetchPlaylists();
    } catch (error) {
      console.error('Error refreshing data:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to refresh data',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [allTracks.length]);

  const handleLongPressTrack = (track: AudioTrack, event: any) => {
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
    setEditingTrackId(track.id);
  };

  const handleMenuOptionPress = (option: 'delete' | 'rename' | 'addToPlaylist') => {
    if (!editingTrackId) return;

    const track = recentTracks.find(t => t.id === editingTrackId);
    if (!track) return;

    if (option === 'delete') {
      handleDeleteTrack(track);
    } else if (option === 'rename') {
      setNewTrackName(track.title);
      setShowRename(true);
    }
  };

  const handleRenameTrack = async () => {
    if (!editingTrackId || !newTrackName.trim()) return;

    try {
      const track = recentTracks.find(t => t.id === editingTrackId);
      if (!track) return;

      // Update track in database
      const { error } = await supabase
        .from('audio_tracks')
        .update({ title: newTrackName.trim() })
        .eq('id', editingTrackId);

      if (error) throw error;

      // Update local state
      setRecentTracks(prevTracks =>
        prevTracks.map(t =>
          t.id === editingTrackId ? { ...t, title: newTrackName.trim() } : t
        )
      );

      // Update all tracks if they're loaded
      if (allTracks.length > 0) {
        setAllTracks(prevTracks =>
          prevTracks.map(t =>
            t.id === editingTrackId ? { ...t, title: newTrackName.trim() } : t
          )
        );
      }

      // Update current track if it's the one being renamed
      if (currentTrack?.id === editingTrackId) {
        setCurrentTrack(prev => prev ? { ...prev, title: newTrackName.trim() } : null);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Track renamed successfully',
      });
    } catch (error) {
      console.error('Error renaming track:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to rename track',
      });
    } finally {
      setShowRename(false);
      setEditingTrackId(null);
    }
  };

  const handleCloseMenu = () => {
    setEditingTrackId(null);
  };

  const handleLongPressPlaylist = (playlist: AudioPlaylist, event: any) => {
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
    setEditingPlaylistId(playlist.id);
  };

  const handlePlaylistMenuOptionPress = (option: 'delete' | 'rename') => {
    if (!editingPlaylistId) return;

    const playlist = playlists.find(p => p.id === editingPlaylistId);
    if (!playlist) return;

    if (option === 'delete') {
      handleDeletePlaylist(playlist);
    } else if (option === 'rename') {
      setNewPlaylistName(playlist.title);
      setShowPlaylistRename(true);
    }
  };

  const handleDeletePlaylist = async (playlist: AudioPlaylist) => {
    try {
      const { error } = await supabase
        .from('audio_playlists')
        .delete()
        .eq('id', playlist.id);

      if (error) throw error;

      // Update local state
      setPlaylists(prevPlaylists => prevPlaylists.filter(p => p.id !== playlist.id));

      // If this was the current playlist, clear it
      if (currentPlaylist?.id === playlist.id) {
        setCurrentPlaylist(null);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Playlist deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting playlist:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete playlist',
      });
    } finally {
      setEditingPlaylistId(null);
    }
  };

  const handleRenamePlaylist = async () => {
    if (!editingPlaylistId || !newPlaylistName.trim()) return;

    try {
      const playlist = playlists.find(p => p.id === editingPlaylistId);
      if (!playlist) return;

      const { error } = await supabase
        .from('audio_playlists')
        .update({ title: newPlaylistName.trim() })
        .eq('id', editingPlaylistId);

      if (error) throw error;

      // Update local state
      setPlaylists(prevPlaylists =>
        prevPlaylists.map(p =>
          p.id === editingPlaylistId ? { ...p, title: newPlaylistName.trim() } : p
        )
      );

      // Update current playlist if it's the one being renamed
      if (currentPlaylist?.id === editingPlaylistId) {
        setCurrentPlaylist(prev => prev ? { ...prev, title: newPlaylistName.trim() } : null);
      }

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Playlist renamed successfully',
      });
    } catch (error) {
      console.error('Error renaming playlist:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to rename playlist',
      });
    } finally {
      setShowPlaylistRename(false);
      setEditingPlaylistId(null);
    }
  };

  const handleClosePlaylistMenu = () => {
    setEditingPlaylistId(null);
    setShowPlaylistRename(false);
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]} // Android
              progressBackgroundColor={theme.colors.grey0} // Android
              progressViewOffset={20} // Android
            />
          }
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
                <Pressable 
                  style={styles.controlButton}
                  onPress={playPreviousTrack}
                >
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
                <Pressable 
                  style={styles.controlButton}
                  onPress={playNextTrack}
                >
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
              <Pressable onPress={() => {
                setIsAllTracksModalVisible(true);
                fetchAllTracks();
              }}>
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
              {recentTracks.map((track) => (
                <React.Fragment key={track.id}>
                  <Pressable
                    key={track.id}
                    style={[
                      styles.recentTrackCard,
                      { backgroundColor: theme.colors.grey0 }
                    ]}
                  >
                    <Pressable
                      style={styles.recentTrackContent}
                      onPress={() => playTrack(track)}
                      onLongPress={(event) => handleLongPressTrack(track, event)}
                    >
                      <View style={[styles.recentTrackArt, { backgroundColor: theme.colors.grey1 }]}>
                        <MaterialIcons name="music-note" size={24} color={theme.colors.grey3} />
                      </View>
                      <Text 
                        style={[styles.recentTrackTitle, { color: theme.colors.grey5 }]}
                        numberOfLines={1}
                      >
                        {track.title}
                      </Text>
                      <Text 
                        style={[styles.recentTrackDuration, { color: theme.colors.grey3 }]}
                      >
                        {track.duration ? formatTime(track.duration * 1000) : '--:--'}
                      </Text>
                    </Pressable>
                  </Pressable>

                  {editingTrackId === track.id && (
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
                            backgroundColor: Platform.OS === 'ios' 
                              ? 'rgba(250, 250, 250, 0.8)' 
                              : theme.mode === 'dark' 
                                ? 'rgba(30, 30, 30, 0.95)'
                                : 'rgba(255, 255, 255, 0.95)',
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
                        ]}
                      >
                        <Pressable onPress={(e) => e.stopPropagation()}>
                          {!showRename ? (
                            <>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.menuOption,
                                  pressed && styles.menuOptionPressed,
                                ]}
                                onPress={() => handleMenuOptionPress('rename')}
                              >
                                <MaterialIcons 
                                  name="edit" 
                                  size={20} 
                                  color={theme.colors.grey4}
                                />
                                <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                                  Rename Track
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
                                  Delete Track
                                </Text>
                              </Pressable>
                            </>
                          ) : (
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
                                  Rename Track
                                </Text>
                              </View>
                              <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                              <View style={styles.renameContainer}>
                                <TextInput
                                  value={newTrackName}
                                  onChangeText={setNewTrackName}
                                  placeholder="Enter track name"
                                  autoFocus
                                  returnKeyType="done"
                                  onSubmitEditing={handleRenameTrack}
                                  style={[
                                    styles.renameInput,
                                    { 
                                      color: theme.colors.grey4,
                                      backgroundColor: theme.colors.grey0,
                                      borderColor: theme.colors.grey2
                                    }
                                  ]}
                                  placeholderTextColor={theme.colors.grey3}
                                />
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.renameButton,
                                    pressed && styles.renameButtonPressed,
                                  ]}
                                  onPress={handleRenameTrack}
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
                </React.Fragment>
              ))}
            </ScrollView>
          </View>

          {/* Playlists Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.grey5 }]}>
                Your Playlists
              </Text>
              <View style={styles.playlistActions}>
                <Pressable onPress={() => setIsCreatePlaylistModalVisible(true)}>
                  <MaterialIcons 
                    name="add" 
                    size={24} 
                    color={theme.colors.primary}
                    style={styles.addPlaylistButton} 
                  />
                </Pressable>
                <Pressable onPress={() => setIsPlaylistModalVisible(true)}>
                  <Text style={[styles.seeAllButton, { color: theme.colors.primary }]}>
                    See All
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.playlistsGrid}>
              {playlists.slice(0, 4).map((playlist) => (
                <React.Fragment key={playlist.id}>
                  <Pressable
                    key={playlist.id}
                    style={[
                      styles.playlistCard,
                      { backgroundColor: theme.colors.grey0 }
                    ]}
                    onPress={() => handlePlaylistSelect(playlist)}
                    onLongPress={(event) => handleLongPressPlaylist(playlist, event)}
                  >
                    <View style={[styles.playlistArt, { backgroundColor: theme.colors.grey1 }]}>
                      <MaterialIcons name="queue-music" size={32} color={theme.colors.grey3} />
                    </View>
                    <View style={styles.playlistInfo}>
                      <Text 
                        style={[styles.playlistTitle, { color: theme.colors.grey5 }]}
                        numberOfLines={1}
                      >
                        {playlist.title}
                      </Text>
                      <Text 
                        style={[styles.playlistStats, { color: theme.colors.grey3 }]}
                      >
                        {playlist.trackCount} tracks • {formatTime(playlist.totalDuration * 1000)}
                      </Text>
                    </View>
                  </Pressable>

                  {editingPlaylistId === playlist.id && (
                    <Overlay
                      isVisible={true}
                      onBackdropPress={handleClosePlaylistMenu}
                      overlayStyle={styles.overlayContainer}
                      backdropStyle={styles.backdrop}
                      animationType="fade"
                    >
                      <Pressable 
                        style={StyleSheet.absoluteFill}
                        onPress={handleClosePlaylistMenu}
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
                            backgroundColor: Platform.OS === 'ios' 
                              ? 'rgba(250, 250, 250, 0.8)' 
                              : theme.mode === 'dark' 
                                ? 'rgba(30, 30, 30, 0.95)'
                                : 'rgba(255, 255, 255, 0.95)',
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
                        ]}
                      >
                        <Pressable onPress={(e) => e.stopPropagation()}>
                          {!showPlaylistRename ? (
                            <>
                              <Pressable
                                style={({ pressed }) => [
                                  styles.menuOption,
                                  pressed && styles.menuOptionPressed,
                                ]}
                                onPress={() => handlePlaylistMenuOptionPress('rename')}
                              >
                                <MaterialIcons 
                                  name="edit" 
                                  size={20} 
                                  color={theme.colors.grey4}
                                />
                                <Text style={[styles.menuOptionText, { color: theme.colors.grey4 }]}>
                                  Rename Playlist
                                </Text>
                              </Pressable>
                              <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                              <Pressable
                                style={({ pressed }) => [
                                  styles.menuOption,
                                  pressed && styles.menuOptionPressed,
                                ]}
                                onPress={() => handlePlaylistMenuOptionPress('delete')}
                              >
                                <MaterialIcons 
                                  name="delete-outline" 
                                  size={20} 
                                  color="#DC2626" 
                                />
                                <Text style={[styles.menuOptionText, { color: "#DC2626" }]}>
                                  Delete Playlist
                                </Text>
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <View style={styles.colorPickerHeader}>
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.backButton,
                                    pressed && styles.backButtonPressed,
                                  ]}
                                  onPress={() => setShowPlaylistRename(false)}
                                >
                                  <MaterialIcons 
                                    name="arrow-back" 
                                    size={20} 
                                    color={theme.colors.grey4} 
                                  />
                                </Pressable>
                                <Text style={[styles.colorPickerTitle, { color: theme.colors.grey4 }]}>
                                  Rename Playlist
                                </Text>
                              </View>
                              <View style={[styles.menuDivider, { backgroundColor: theme.colors.grey2 }]} />
                              <View style={styles.renameContainer}>
                                <TextInput
                                  value={newPlaylistName}
                                  onChangeText={setNewPlaylistName}
                                  placeholder="Enter playlist name"
                                  autoFocus
                                  returnKeyType="done"
                                  onSubmitEditing={handleRenamePlaylist}
                                  style={[
                                    styles.renameInput,
                                    { 
                                      color: theme.colors.grey4,
                                      backgroundColor: theme.colors.grey0,
                                      borderColor: theme.colors.grey2
                                    }
                                  ]}
                                  placeholderTextColor={theme.colors.grey3}
                                />
                                <Pressable
                                  style={({ pressed }) => [
                                    styles.renameButton,
                                    pressed && styles.renameButtonPressed,
                                  ]}
                                  onPress={handleRenamePlaylist}
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
                </React.Fragment>
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

      {/* All Tracks Modal */}
      <Dialog
        isVisible={isAllTracksModalVisible}
        onBackdropPress={() => setIsAllTracksModalVisible(false)}
        overlayStyle={[
          styles.allTracksModal,
          { backgroundColor: theme.colors.background }
        ]}
      >
        <View style={styles.modalHeader}>
          <Text h4 style={[styles.modalTitle, { color: theme.colors.grey5 }]}>
            All Tracks
          </Text>
          <Pressable
            onPress={() => setIsAllTracksModalVisible(false)}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <MaterialIcons name="close" size={24} color={theme.colors.grey3} />
          </Pressable>
        </View>

        <ScrollView style={styles.allTracksContainer}>
          {allTracks.map((track) => (
            <Pressable
              key={track.id}
              style={({ pressed }) => [
                styles.allTrackItem,
                { 
                  backgroundColor: theme.colors.grey0,
                  opacity: pressed ? 0.7 : 1,
                }
              ]}
            >
              <Pressable
                style={styles.allTrackContent}
                onPress={() => {
                  playTrack(track);
                  setIsAllTracksModalVisible(false);
                }}
              >
                <View style={[styles.allTrackArt, { backgroundColor: theme.colors.grey1 }]}>
                  <MaterialIcons name="music-note" size={24} color={theme.colors.grey3} />
                </View>
                <View style={styles.allTrackInfo}>
                  <Text 
                    style={[styles.allTrackTitle, { color: theme.colors.grey5 }]}
                    numberOfLines={1}
                  >
                    {track.title}
                  </Text>
                  <Text 
                    style={[styles.allTrackDate, { color: theme.colors.grey3 }]}
                  >
                    {track.createdAt.toLocaleDateString()}
                  </Text>
                </View>
                <Text 
                  style={[styles.allTrackDuration, { color: theme.colors.grey3 }]}
                >
                  {track.duration ? formatTime(track.duration * 1000) : '--:--'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  { opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => handleDeleteTrack(track)}
              >
                <MaterialIcons name="delete" size={20} color={theme.colors.error} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
      </Dialog>

      {/* Playlist Modal */}
      <Dialog
        isVisible={isPlaylistModalVisible}
        onBackdropPress={() => setIsPlaylistModalVisible(false)}
        overlayStyle={[
          styles.playlistModal,
          { backgroundColor: theme.colors.background }
        ]}
      >
        <View style={styles.modalHeader}>
          <Text h4 style={[styles.modalTitle, { color: theme.colors.grey5 }]}>
            Playlist: {selectedPlaylist?.title}
          </Text>
          <Pressable
            onPress={() => setIsPlaylistModalVisible(false)}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <MaterialIcons name="close" size={24} color={theme.colors.grey3} />
          </Pressable>
        </View>

        <ScrollView style={styles.playlistTracksContainer}>
          {playlistTracks[selectedPlaylist?.id || '']?.map((track) => (
            <Pressable
              key={track.id}
              style={({ pressed }) => [
                styles.playlistTrackItem,
                { 
                  backgroundColor: theme.colors.grey0,
                  opacity: pressed ? 0.7 : 1,
                }
              ]}
              onPress={() => {
                playTrack(track);
                setIsPlaylistModalVisible(false);
              }}
            >
              <View style={styles.playlistTrackContent}>
                <View style={[styles.playlistTrackArt, { backgroundColor: theme.colors.grey1 }]}>
                  <MaterialIcons name="music-note" size={20} color={theme.colors.grey3} />
                </View>
                <View style={styles.playlistTrackInfo}>
                  <Text 
                    style={[styles.playlistTrackTitle, { color: theme.colors.grey5 }]}
                    numberOfLines={1}
                  >
                    {track.title}
                  </Text>
                  <Text 
                    style={[styles.playlistTrackDuration, { color: theme.colors.grey3 }]}
                  >
                    {track.duration ? formatTime(track.duration * 1000) : '--:--'}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
          {(!playlistTracks[selectedPlaylist?.id || ''] || 
            playlistTracks[selectedPlaylist?.id || ''].length === 0) && (
            <View style={styles.emptyPlaylistMessage}>
              <Text style={[styles.emptyPlaylistText, { color: theme.colors.grey3 }]}>
                No tracks in this playlist yet
              </Text>
            </View>
          )}
        </ScrollView>
      </Dialog>

      {/* Create Playlist Modal */}
      <Dialog
        isVisible={isCreatePlaylistModalVisible}
        onBackdropPress={() => setIsCreatePlaylistModalVisible(false)}
        overlayStyle={[
          styles.createPlaylistModal,
          { backgroundColor: theme.colors.background }
        ]}
      >
        <View style={styles.modalHeader}>
          <Text h4 style={[styles.modalTitle, { color: theme.colors.grey5 }]}>
            Create Playlist
          </Text>
          <Pressable
            onPress={() => setIsCreatePlaylistModalVisible(false)}
            style={({ pressed }) => [
              styles.closeButton,
              { opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <MaterialIcons name="close" size={24} color={theme.colors.grey3} />
          </Pressable>
        </View>

        <View style={styles.createPlaylistForm}>
          <TextInput
            placeholder="Playlist Name"
            style={[
              styles.input,
              { 
                color: theme.colors.grey5,
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey2
              }
            ]}
            placeholderTextColor={theme.colors.grey3}
            onChangeText={(text) => setNewPlaylistTitle(text)}
          />
          <TextInput
            placeholder="Description (optional)"
            style={[
              styles.input,
              styles.textArea,
              { 
                color: theme.colors.grey5,
                backgroundColor: theme.colors.grey0,
                borderColor: theme.colors.grey2
              }
            ]}
            placeholderTextColor={theme.colors.grey3}
            multiline
            numberOfLines={3}
            onChangeText={(text) => setNewPlaylistDescription(text)}
          />
          <Button
            title="Create Playlist"
            onPress={() => {
              createPlaylist(newPlaylistTitle, newPlaylistDescription);
              setIsCreatePlaylistModalVisible(false);
            }}
            disabled={!newPlaylistTitle.trim()}
            buttonStyle={{
              backgroundColor: theme.colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
            }}
          />
        </View>
      </Dialog>
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
  recentTrackContent: {
    flex: 1,
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
  allTracksModal: {
    width: Platform.OS === 'web' ? 480 : '90%',
    maxWidth: 480,
    maxHeight: '80%',
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 50,
  },
  allTracksContainer: {
    padding: 16,
  },
  allTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  allTrackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  allTrackArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  allTrackInfo: {
    flex: 1,
    marginRight: 12,
  },
  allTrackTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  allTrackDate: {
    fontSize: 14,
  },
  allTrackDuration: {
    fontSize: 14,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  playlistActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  addPlaylistButton: {
    padding: 4,
  },
  playlistModal: {
    width: Platform.OS === 'web' ? 480 : '90%',
    maxWidth: 480,
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  playlistTracksContainer: {
    padding: 16,
  },
  playlistTrackItem: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  playlistTrackContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistTrackArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playlistTrackInfo: {
    flex: 1,
  },
  playlistTrackTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  playlistTrackDuration: {
    fontSize: 14,
  },
  emptyPlaylistMessage: {
    padding: 24,
    alignItems: 'center',
  },
  emptyPlaylistText: {
    fontSize: 16,
  },
  createPlaylistModal: {
    width: Platform.OS === 'web' ? 480 : '90%',
    maxWidth: 480,
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  createPlaylistForm: {
    padding: 16,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  renameContainer: {
    padding: 12,
    gap: 12,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
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
}); 