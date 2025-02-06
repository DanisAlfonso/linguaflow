import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { Text, Button, useTheme } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { WaveformVisualizer } from './WaveformVisualizer';

interface RecordingInterfaceProps {
  isVisible: boolean;
  isRecording: boolean;
  isPlaying?: boolean;
  recordingDuration: number;
  playbackProgress?: number;
  meterLevel: number;
  hasRecording: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onStartPlayback?: () => Promise<void>;
  onStopPlayback?: () => Promise<void>;
  onDeleteRecording?: () => void;
  onClose: () => void;
}

export function RecordingInterface({
  isVisible,
  isRecording,
  isPlaying = false,
  recordingDuration,
  playbackProgress = 0,
  meterLevel,
  hasRecording,
  onStartRecording,
  onStopRecording,
  onStartPlayback,
  onStopPlayback,
  onDeleteRecording,
  onClose,
}: RecordingInterfaceProps) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 1 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slideAnim]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.grey2,
          transform: [{ translateY }],
          opacity: slideAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.grey0 }]}>
            {isRecording ? 'Recording...' : (hasRecording ? formatDuration(recordingDuration) : 'Record Practice')}
          </Text>
          <Button
            type="clear"
            icon={
              <MaterialIcons
                name="close"
                size={24}
                color={theme.colors.grey3}
              />
            }
            onPress={onClose}
          />
        </View>

        <View style={styles.waveformContainer}>
          <WaveformVisualizer 
            isRecording={isRecording}
            isPlaying={isPlaying}
            meterLevel={meterLevel}
            playbackProgress={playbackProgress}
          />
        </View>

        <View style={styles.controls}>
          {hasRecording ? (
            <>
              <Button
                type="clear"
                icon={
                  <MaterialIcons
                    name="delete"
                    size={24}
                    color={theme.colors.error}
                  />
                }
                buttonStyle={styles.secondaryButton}
                onPress={onDeleteRecording}
              />
              <Button
                type="clear"
                icon={
                  <MaterialIcons
                    name={isPlaying ? "stop" : "play-arrow"}
                    size={32}
                    color={theme.colors.primary}
                  />
                }
                buttonStyle={[
                  styles.mainButton,
                  {
                    backgroundColor: `${theme.colors.primary}15`,
                  },
                ]}
                onPress={isPlaying ? onStopPlayback : onStartPlayback}
              />
              <Button
                type="clear"
                icon={
                  <MaterialIcons
                    name="mic"
                    size={24}
                    color={theme.colors.primary}
                  />
                }
                buttonStyle={styles.secondaryButton}
                onPress={onStartRecording}
              />
            </>
          ) : (
            <Button
              type="clear"
              icon={
                <MaterialIcons
                  name={isRecording ? "stop" : "mic"}
                  size={32}
                  color={isRecording ? theme.colors.error : theme.colors.primary}
                />
              }
              buttonStyle={[
                styles.mainButton,
                {
                  backgroundColor: isRecording 
                    ? `${theme.colors.error}15`
                    : `${theme.colors.primary}15`,
                },
              ]}
              onPress={isRecording ? onStopRecording : onStartRecording}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 16,
    height: 230, // Increased from 180 to 220 to ensure buttons are visible above navbar
    paddingBottom: 32, // Added extra padding at the bottom to lift content above navbar
    ...Platform.select({
      web: {
        boxShadow: '0 -2px 4px -1px rgba(65, 57, 57, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: -1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 3,
      },
    }),
  },
  content: {
    flex: 1,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  waveformContainer: {
    width: '100%',
    height: 30,
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  mainButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  secondaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
}); 