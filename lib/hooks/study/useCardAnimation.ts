import { useState, useCallback } from 'react';
import { Animated } from 'react-native';

interface UseCardAnimationProps {
  onFlip?: () => void;
}

interface UseCardAnimationReturn {
  isFlipped: boolean;
  flipCard: () => void;
  resetCard: () => void;
  frontAnimatedStyle: {
    transform: {
      rotateY: Animated.AnimatedInterpolation<string | number>;
    }[];
  };
  backAnimatedStyle: {
    transform: {
      rotateY: Animated.AnimatedInterpolation<string | number>;
    }[];
  };
}

export function useCardAnimation({
  onFlip,
}: UseCardAnimationProps = {}): UseCardAnimationReturn {
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipAnim] = useState(new Animated.Value(0));

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: false,
    }).start();

    onFlip?.();
  }, [isFlipped, flipAnim, onFlip]);

  const resetCard = useCallback(() => {
    setIsFlipped(false);
    flipAnim.setValue(0);
  }, [flipAnim]);

  return {
    isFlipped,
    flipCard,
    resetCard,
    frontAnimatedStyle,
    backAnimatedStyle,
  };
} 