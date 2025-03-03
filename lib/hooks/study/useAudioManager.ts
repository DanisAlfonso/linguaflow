import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { uploadRecording } from '../../api/audio';
import { saveAudioRecording, syncAudioRecordings } from '../../services/audio';
import { isOnline } from '../../services/flashcards';
import type { Recording } from '../../../types/audio';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system';

async function configureAudioSession() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.error('Error configuring audio session:', error);
  }
}

interface UseAudioManagerProps {
  cardId: string;
  onClose?: () => void;
}

interface UseAudioManagerReturn {
  // Recording states
  isRecording: boolean;
  recordingDuration: number;
  meterLevel: number;
  hasRecording: boolean;
  uploadedRecording: Recording | null;
  
  // Playback states
  isPlaying: boolean;
  playbackProgress: number;
  
  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  deleteRecording: () => void;
  startPlayback: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  handleSeek: (progress: number) => Promise<void>;

  // State setters
  setIsPlaying: (playing: boolean) => void;
  setPlaybackProgress: (progress: number) => void;
  setHasRecording: (hasRecording: boolean) => void;
  setUploadedRecording: React.Dispatch<React.SetStateAction<Recording | null>>;
}

export function useAudioManager({
  cardId,
  onClose,
}: UseAudioManagerProps): UseAudioManagerReturn {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [uploadedRecording, setUploadedRecording] = useState<Recording | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout>();
  const recording = useRef<Audio.Recording | null>(null);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const playbackTimer = useRef<NodeJS.Timeout>();

  // Permission handling
  const [permissionResponse, requestPermission] = Audio.usePermissions();

  // Clean up timers and audio resources
  useEffect(() => {
    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Handle recording permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (!permissionResponse) return;
      
      if (permissionResponse.status !== 'granted') {
        console.log('Requesting recording permission..');
        const permission = await requestPermission();
        if (!permission.granted) {
          Toast.show({
            type: 'error',
            text1: 'Permission Required',
            text2: 'Microphone access is needed for recording',
          });
          onClose?.();
        }
      }
    };

    checkPermissions();
  }, [permissionResponse, requestPermission, onClose]);

  const startRecording = async () => {
    try {
      if (!permissionResponse || permissionResponse.status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Required',
          text2: 'Microphone access is needed for recording',
        });
        return;
      }

      // Clean up any existing recording
      if (recording.current) {
        console.log('Cleaning up previous recording');
        await recording.current.stopAndUnloadAsync();
        recording.current = null;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: 'audio/mp4',
            bitsPerSecond: 128000,
          },
        },
        (status) => {
          // Update meter level from recording status
          if (status.isRecording && status.metering !== undefined) {
            // Convert dB meter level to a value between 0 and 1
            // Typical values are between -160 and 0 dB
            const db = status.metering;
            const normalized = (db + 160) / 160; // Convert to 0-1 range
            const clamped = Math.max(0, Math.min(1, normalized)); // Ensure between 0 and 1
            setMeterLevel(clamped);
          }
        },
        1000 // Update metering every 1000ms
      );

      recording.current = newRecording;
      // Remove setRecording(newRecording) since we're using a ref now
      setIsRecording(true);
      setRecordingDuration(0);
      setMeterLevel(0);

      // Start duration timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1000);
      }, 1000);

      console.log('Recording started');
    } catch (err) {
      console.error('Failed to start recording', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to start recording',
      });
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !recording.current) return;

    try {
      console.log('Stopping recording...');
      setIsRecording(false);
      await recording.current.stopAndUnloadAsync();
      const status = await recording.current.getStatusAsync();
      
      // Check if a valid recording was made
      if (status.isDoneRecording) {
        const { sound: recordedSound, status: audioStatus } = await recording.current.createNewLoadedSoundAsync();
        
        setSound(recordedSound);
        setHasRecording(true);

        // Get the URI of the recording
        const uri = recording.current.getURI() || '';
        const info = await FileSystem.getInfoAsync(uri);
        const fileSize = info.exists ? info.size : 0;
        const fileName = `recording_${Date.now()}.m4a`;
        
        // Get network status
        const networkStatus = await isOnline();
        console.log(`Network status for audio upload: ${networkStatus ? 'Online' : 'Offline'}`);
        
        // Extract duration from audioStatus
        const duration = audioStatus.isLoaded ? (audioStatus.durationMillis || 0) / 1000 : recordingDuration;
        
        try {
          // Use the service function that supports offline mode
          const result = await saveAudioRecording({
            uri,
            cardId,
            side: 'front', // Default to front side
            name: fileName,
            size: fileSize,
            duration: duration,
          });
          
          console.log('Recording saved:', result);
          
          // Create a recording object that matches what the component expects
          const newRecording: Recording = {
            id: result.segmentId,
            card_id: cardId,
            user_id: 'offline_user', // Will be replaced with real user ID when synced
            audio_url: result.audioUrl,
            created_at: new Date().toISOString(),
            duration: duration,
            name: fileName,
          };
          
          setUploadedRecording(newRecording);
          
          Toast.show({
            type: 'success',
            text1: networkStatus ? 'Recording saved' : 'Recording saved locally',
            text2: networkStatus ? 'Audio uploaded successfully' : 'Will sync when online',
          });
          
          // If we're online, sync any pending recordings
          if (networkStatus) {
            try {
              await syncAudioRecordings();
            } catch (syncError) {
              console.error('Error syncing recordings:', syncError);
            }
          }
        } catch (uploadError) {
          console.error('Error saving recording:', uploadError);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to save recording',
          });
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to process recording',
      });
    }
    
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch (error) {
      console.log('Error setting audio mode:', error);
    }
  };

  const deleteRecording = useCallback(() => {
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setUploadedRecording(null);
    setHasRecording(false);
    setRecordingDuration(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
  }, []);

  const startPlayback = async () => {
    try {
      if (!uploadedRecording) {
        console.error('No uploaded recording available');
        return;
      }

      // Unload any existing sound first
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Configure audio session for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Ensure the URL is properly formatted
      const audioUrl = uploadedRecording.audio_url.startsWith('http') 
        ? uploadedRecording.audio_url 
        : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${uploadedRecording.audio_url}`;
      
      console.log('Playing audio from URL:', audioUrl);

      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          progressUpdateIntervalMillis: 100,
          shouldPlay: true,
          volume: 1.0,
          androidImplementation: 'MediaPlayer',
        },
        (status) => {
          if (status.isLoaded) {
            const durationMillis = status.durationMillis ?? 1;
            setPlaybackProgress(status.positionMillis / durationMillis);
            
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackProgress(0);
              if (playbackTimer.current) {
                clearInterval(playbackTimer.current);
              }
            }
          }
        }
      );

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing recording:', error);
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      setIsPlaying(false);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to play recording',
      });
    }
  };

  const stopPlayback = async () => {
    try {
      if (!sound) return;

      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setIsPlaying(false);
      setPlaybackProgress(0);

      if (playbackTimer.current) {
        clearInterval(playbackTimer.current);
      }
    } catch (error) {
      console.error('Error stopping playback:', error);
    }
  };

  const handleSeek = async (progress: number) => {
    try {
      if (!sound) return;

      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      const durationMillis = status.durationMillis ?? 0;
      if (durationMillis === 0) return;

      const position = progress * durationMillis;
      await sound.setPositionAsync(position);
      setPlaybackProgress(progress);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  return {
    // Recording states
    isRecording,
    recordingDuration,
    meterLevel,
    hasRecording,
    uploadedRecording,
    
    // Playback states
    isPlaying,
    playbackProgress,
    
    // Controls
    startRecording,
    stopRecording,
    deleteRecording,
    startPlayback,
    stopPlayback,
    handleSeek,

    // State setters
    setIsPlaying,
    setPlaybackProgress,
    setHasRecording,
    setUploadedRecording,
  };
} 