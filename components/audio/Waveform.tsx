import React, { useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { useTheme } from '@rneui/themed';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';

interface WaveformProps {
  /**
   * Array of normalized waveform data points (values between 0 and 1)
   */
  data: number[];
  /**
   * Current playback progress (0 to 1)
   */
  progress: number;
  /**
   * Whether the audio is currently playing
   */
  isPlaying?: boolean;
  /**
   * Whether the waveform is being dragged
   */
  isSeeking?: boolean;
  /**
   * Called when the user starts seeking
   */
  onSeekStart?: () => void;
  /**
   * Called when the user is seeking
   */
  onSeek?: (progress: number) => void;
  /**
   * Called when the user finishes seeking
   */
  onSeekEnd?: (progress: number) => void;
  /**
   * Height of the waveform in pixels
   */
  height?: number;
  /**
   * Width of each bar in pixels
   */
  barWidth?: number;
  /**
   * Gap between bars in pixels
   */
  barGap?: number;
  /**
   * Color of the played portion of the waveform
   */
  activeColor?: string;
  /**
   * Color of the unplayed portion of the waveform
   */
  inactiveColor?: string;
  /**
   * Style object for the container
   */
  style?: any;
}

export function Waveform({
  data,
  progress,
  isPlaying,
  isSeeking,
  onSeekStart,
  onSeek,
  onSeekEnd,
  height = 64,
  barWidth = 3,
  barGap = 2,
  activeColor,
  inactiveColor,
  style,
}: WaveformProps) {
  const { theme } = useTheme();
  const animation = useSharedValue(0);

  // Default colors based on theme
  const defaultActiveColor = theme.colors.primary;
  const defaultInactiveColor = theme.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.2)' 
    : 'rgba(0, 0, 0, 0.1)';

  // Use provided colors or defaults
  const finalActiveColor = activeColor || defaultActiveColor;
  const finalInactiveColor = inactiveColor || defaultInactiveColor;

  // Calculate dimensions
  const totalBarWidth = barWidth + barGap;
  const maxBars = Math.floor(Platform.OS === 'web' ? 200 : 100);
  const sampleStep = Math.ceil(data.length / maxBars);
  
  // Sample the waveform data to fit the available width
  const sampledData = useMemo(() => {
    const sampled = [];
    for (let i = 0; i < data.length; i += sampleStep) {
      // Take the maximum value in the sample window for better visual representation
      const sampleMax = Math.max(...data.slice(i, i + sampleStep));
      sampled.push(sampleMax);
    }
    return sampled;
  }, [data, sampleStep]);

  // Handle seeking
  const handleSeek = useCallback((event: any) => {
    if (!onSeek) return;

    const { locationX, target } = event.nativeEvent;
    target.measure((_x: number, _y: number, width: number) => {
      const progress = Math.max(0, Math.min(1, locationX / width));
      onSeek(progress);
    });
  }, [onSeek]);

  // Animate progress changes
  useEffect(() => {
    if (!isSeeking) {
      animation.value = withTiming(progress, { duration: 100 });
    }
  }, [progress, isSeeking, animation]);

  // Animated style for progress indicator
  const progressStyle = useAnimatedStyle(() => ({
    width: `${animation.value * 100}%`,
  }));

  return (
    <Pressable
      onPressIn={(e) => {
        onSeekStart?.();
        handleSeek(e);
      }}
      onTouchMove={handleSeek}
      onTouchEnd={(e) => {
        handleSeek(e);
        onSeekEnd?.(progress);
      }}
      style={[styles.container, { height }, style]}
    >
      <View style={styles.barsContainer}>
        <Animated.View style={[styles.progressOverlay, progressStyle]} />
        {sampledData.map((value, index) => {
          const barHeight = Math.max(4, value * height);
          const verticalMargin = (height - barHeight) / 2;

          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  width: barWidth,
                  height: barHeight,
                  marginHorizontal: barGap / 2,
                  marginVertical: verticalMargin,
                  backgroundColor: finalInactiveColor,
                },
              ]}
            />
          );
        })}
        {sampledData.map((value, index) => {
          const barHeight = Math.max(4, value * height);
          const verticalMargin = (height - barHeight) / 2;

          return (
            <View
              key={`active-${index}`}
              style={[
                styles.bar,
                styles.activeBar,
                {
                  width: barWidth,
                  height: barHeight,
                  marginHorizontal: barGap / 2,
                  marginVertical: verticalMargin,
                  backgroundColor: finalActiveColor,
                  left: index * totalBarWidth,
                },
              ]}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  bar: {
    borderRadius: 2,
  },
  activeBar: {
    position: 'absolute',
    zIndex: 2,
  },
}); 