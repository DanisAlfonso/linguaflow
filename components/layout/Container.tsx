import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

type ContainerProps = {
  children: React.ReactNode;
  style?: any;
};

export function Container({ children, style }: ContainerProps) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWideScreen = width > 768;

  return (
    <View
      style={[
        styles.container,
        isWeb && isWideScreen && styles.webContainer,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  webContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 40,
  },
}); 