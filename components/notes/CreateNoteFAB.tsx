import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

interface CreateNoteFABProps {
  onPress: () => void;
}

export function CreateNoteFAB({ onPress }: CreateNoteFABProps) {
  return (
    <View style={styles.fabWrapper}>
      <LinearGradient
        colors={['#4F46E5', '#818CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabGradient}
      >
        <Pressable
          style={({ pressed }) => [
            styles.fabPressable,
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          onPress={onPress}
        >
          <MaterialIcons name="add" size={32} color="white" style={styles.fabIcon}/>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    borderRadius: 34,
    overflow: 'hidden',
    zIndex: 2,
    elevation: Platform.OS === 'android' ? 12 : undefined,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPressable: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'transform 0.2s ease-in-out',
      },
    }),
  },
  fabIcon: {
    textAlign: 'center',
    lineHeight: 32,
    height: 32,
  },
}); 