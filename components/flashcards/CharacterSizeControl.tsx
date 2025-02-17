import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Slider } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';

interface CharacterSizeControlProps {
  size: number;
  onSizeChange: (size: number) => void;
  color?: string;
}

export function CharacterSizeControl({ size, onSizeChange, color = '#000' }: CharacterSizeControlProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name="format-size" size={20} color={color} />
      <Slider
        value={size}
        onValueChange={onSizeChange}
        minimumValue={24}
        maximumValue={72}
        step={4}
        allowTouchTrack
        trackStyle={styles.track}
        thumbStyle={[styles.thumb, { backgroundColor: '#4F46E5' }]}
        style={styles.slider}
        minimumTrackTintColor="#4F46E5"
        maximumTrackTintColor="#E5E7EB"
        thumbTouchSize={{ width: 40, height: 40 }}
        orientation="horizontal"
        disabled={false}
        thumbProps={{
          children: (
            <View style={{ backgroundColor: 'transparent' }} />
          ),
        }}
      />
      <Text style={[styles.sizeText, { color }]}>
        {size}px
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  slider: {
    flex: 1,
  },
  track: {
    height: 4,
  },
  thumb: {
    height: 20,
    width: 20,
    borderRadius: 10,
  },
  sizeText: {
    fontSize: 14,
    fontWeight: '500',
    width: 48,
  },
}); 