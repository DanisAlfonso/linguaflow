import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@rneui/themed';

interface WaveformVisualizerProps {
  isRecording: boolean;
  isPlaying?: boolean;
  meterLevel?: number;
  playbackProgress?: number;
}

export function WaveformVisualizer({ 
  isRecording,
  isPlaying = false,
  meterLevel = 0,
  playbackProgress = 0,
}: WaveformVisualizerProps) {
  const { theme } = useTheme();
  const bars = 30; // Number of bars in the waveform
  const barAnimations = useRef<Animated.Value[]>(
    Array.from({ length: bars }, () => new Animated.Value(0.1))
  ).current;
  
  // Keep track of the last meter level for smooth transitions
  const lastMeterLevel = useRef(0);

  useEffect(() => {
    if (isRecording) {
      // Enhanced animation for recording state
      const animations = barAnimations.map((anim, index) => {
        // Create a wave pattern with the meter level
        const baseHeight = meterLevel * 0.6 + 0.2; // Scale meter level to 0.2-0.8 range
        const waveOffset = Math.sin((index / bars) * Math.PI * 2) * 0.2;
        const randomVariation = (Math.random() - 0.5) * 0.1;
        const targetHeight = Math.max(0.2, Math.min(0.8, baseHeight + waveOffset + randomVariation));

        return Animated.timing(anim, {
          toValue: targetHeight,
          duration: 100,
          useNativeDriver: true,
        });
      });

      Animated.parallel(animations).start(() => {
        if (isRecording) {
          animations.forEach(anim => anim.start());
        }
      });
      
      lastMeterLevel.current = meterLevel;
    } else if (isPlaying) {
      // Enhanced animation for playback state
      const animations = barAnimations.map((anim, index) => {
        const position = (index / bars);
        const isActive = position <= playbackProgress;
        const baseHeight = isActive ? 0.6 : 0.3;
        const waveOffset = Math.sin((position - playbackProgress) * Math.PI * 4) * 0.2;
        const targetHeight = isActive ? 
          Math.max(0.3, Math.min(0.8, baseHeight + waveOffset)) :
          0.2;

        return Animated.timing(anim, {
          toValue: targetHeight,
          duration: 100,
          useNativeDriver: true,
        });
      });

      Animated.parallel(animations).start(() => {
        if (isPlaying) {
          animations.forEach(anim => anim.start());
        }
      });
    } else {
      // Reset to minimal height when not active
      const resetAnimations = barAnimations.map((anim) =>
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: true,
        })
      );

      Animated.parallel(resetAnimations).start();
      lastMeterLevel.current = 0;
    }
  }, [isRecording, isPlaying, meterLevel, playbackProgress, barAnimations]);

  const barColor = theme.mode === 'dark' 
    ? theme.colors.grey4  // Lighter color in dark mode
    : theme.colors.grey3; // Darker color in light mode

  return (
    <View style={styles.container}>
      {barAnimations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: barColor,
              transform: [
                {
                  scaleY: anim,
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 16,
  },
  bar: {
    flex: 1,
    height: '100%',
    borderRadius: 1,
    transform: [{ scaleY: 0.2 }],
  },
}); 