import React from 'react';
import { Animated, ViewStyle, Pressable, View, StyleSheet, Platform } from 'react-native';
import { CardAnimationType } from '../../contexts/StudySettingsContext';

type AnimatedCardProps = {
  front: React.ReactNode;
  back: React.ReactNode;
  isFlipped: boolean;
  onPress: () => void;
  animationType: CardAnimationType;
  cardStyle?: ViewStyle;
};

export function AnimatedCard({
  front,
  back,
  isFlipped,
  onPress,
  animationType,
  cardStyle,
}: AnimatedCardProps) {
  const [animation] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.spring(animation, {
      toValue: isFlipped ? 1 : 0,
      friction: 18,
      tension: 35,
      useNativeDriver: true,
    }).start();
  }, [isFlipped, animation]);

  if (animationType === 'flip') {
    const frontInterpolate = animation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const backInterpolate = animation.interpolate({
      inputRange: [0, 1],
      outputRange: ['180deg', '360deg'],
    });

    const frontAnimatedStyle = {
      transform: [{ rotateY: frontInterpolate }],
    };

    const backAnimatedStyle = {
      transform: [{ rotateY: backInterpolate }],
    };

    return (
      <Pressable onPress={onPress}>
        <View style={styles.cardWrapper}>
          <Animated.View
            style={[
              styles.card,
              cardStyle,
              frontAnimatedStyle,
            ]}
          >
            {front}
          </Animated.View>
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              cardStyle,
              backAnimatedStyle,
            ]}
          >
            {back}
          </Animated.View>
        </View>
      </Pressable>
    );
  }

  // Vertical flip animation
  const frontInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // Add a slight scaling effect to enhance the 3D feel
  const scale = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.98, 1],
  });

  const frontAnimatedStyle = {
    transform: [
      { rotateX: frontInterpolate },
      { scale },
    ],
  };

  const backAnimatedStyle = {
    transform: [
      { rotateX: backInterpolate },
      { scale },
    ],
  };

  return (
    <Pressable onPress={onPress}>
      <View style={styles.cardWrapper}>
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            frontAnimatedStyle,
            {
              zIndex: isFlipped ? 0 : 1,
            },
          ]}
        >
          {front}
        </Animated.View>
        <Animated.View
          style={[
            styles.card,
            styles.cardBack,
            cardStyle,
            backAnimatedStyle,
            {
              zIndex: isFlipped ? 1 : 0,
            },
          ]}
        >
          {back}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrapper: Platform.OS === 'web' 
    ? {
        // @ts-ignore - React Native Web supports perspective
        perspective: 1200, // Increased perspective for better 3D effect
        position: 'relative',
      } 
    : {
        position: 'relative',
      } as ViewStyle,
  card: {
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
}); 