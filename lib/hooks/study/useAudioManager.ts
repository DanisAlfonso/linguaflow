import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { uploadRecording } from '../../api/audio';
import type { Recording } from '../../../types/audio';
import Toast from 'react-native-toast-message';

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [meterLevel, setMeterLevel] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [uploadedRecording, setUploadedRecording] = useState<Recording | null>(null);
  const recordingTimer = useRef<NodeJS.Timeout>();

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const sound = useRef<Audio.Sound>();
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
      if (sound.current) {
        sound.current.unloadAsync();
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

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
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

      setRecording(recording);
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
    try {
      if (!recording) return;

      console.log('Stopping recording..');
      await recording.stopAndUnloadAsync();
      
      // Stop and clear duration timer
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('No recording URI available');
      }

      console.log('Recording stopped and stored at', uri);

      // Upload the recording
      const uploaded = await uploadRecording(cardId, {
        uri,
        duration: recordingDuration,
      });

      // Store the uploaded recording
      setUploadedRecording(uploaded);

      // Reset states but keep duration for display
      setRecording(null);
      setIsRecording(false);
      setMeterLevel(0);
      setHasRecording(true);

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Recording saved',
      });
    } catch (err) {
      console.error('Failed to stop recording', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save recording',
      });
    }
  };

  const deleteRecording = useCallback(() => {
    if (sound.current) {
      sound.current.unloadAsync();
      sound.current = undefined;
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
      if (sound.current) {
        await sound.current.unloadAsync();
        sound.current = undefined;
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

      sound.current = newSound;
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing recording:', error);
      if (sound.current) {
        await sound.current.unloadAsync();
        sound.current = undefined;
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
      if (!sound.current) return;

      await sound.current.stopAsync();
      await sound.current.setPositionAsync(0);
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
      if (!sound.current) return;

      const status = await sound.current.getStatusAsync();
      if (!status.isLoaded) return;

      const durationMillis = status.durationMillis ?? 0;
      if (durationMillis === 0) return;

      const position = progress * durationMillis;
      await sound.current.setPositionAsync(position);
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