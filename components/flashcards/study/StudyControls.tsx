import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Button } from '@rneui/themed';
import { MaterialIcons } from '@expo/vector-icons';
import { Rating } from '../../../lib/spaced-repetition/fsrs';

interface StudyControlsProps {
  onResponse: (rating: Rating) => void;
  reviewing: boolean;
}

export function StudyControls({
  onResponse,
  reviewing,
}: StudyControlsProps) {
  const isWeb = Platform.OS === 'web';

  return (
    <View style={styles.controls}>
      <Button
        title={isWeb ? "Again (1)" : "Again"}
        icon={
          <MaterialIcons
            name="refresh"
            size={20}
            color="#DC2626"
            style={styles.buttonIcon}
          />
        }
        type="clear"
        loading={reviewing}
        buttonStyle={[styles.responseButton]}
        containerStyle={[styles.responseButtonContainer, { backgroundColor: '#DC262615' }]}
        titleStyle={{ color: '#DC2626', fontWeight: '600' }}
        onPress={() => onResponse(Rating.Again)}
      />
      <Button
        title={isWeb ? "Hard (2)" : "Hard"}
        icon={
          <MaterialIcons
            name="trending-down"
            size={20}
            color="#D97706"
            style={styles.buttonIcon}
          />
        }
        type="clear"
        loading={reviewing}
        buttonStyle={[styles.responseButton]}
        containerStyle={[styles.responseButtonContainer, { backgroundColor: '#D9770615' }]}
        titleStyle={{ color: '#D97706', fontWeight: '600' }}
        onPress={() => onResponse(Rating.Hard)}
      />
      <Button
        title={isWeb ? "Good (3)" : "Good"}
        icon={
          <MaterialIcons
            name="check"
            size={20}
            color="#059669"
            style={styles.buttonIcon}
          />
        }
        type="clear"
        loading={reviewing}
        buttonStyle={[styles.responseButton]}
        containerStyle={[styles.responseButtonContainer, { backgroundColor: '#05966915' }]}
        titleStyle={{ color: '#059669', fontWeight: '600' }}
        onPress={() => onResponse(Rating.Good)}
      />
      <Button
        title={isWeb ? "Easy (4)" : "Easy"}
        icon={
          <MaterialIcons
            name="trending-up"
            size={20}
            color="#4F46E5"
            style={styles.buttonIcon}
          />
        }
        type="clear"
        loading={reviewing}
        buttonStyle={[styles.responseButton]}
        containerStyle={[styles.responseButtonContainer, { backgroundColor: '#4F46E515' }]}
        titleStyle={{ color: '#4F46E5', fontWeight: '600' }}
        onPress={() => onResponse(Rating.Easy)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  responseButton: {
    height: 48,
    borderWidth: 0,
  },
  responseButtonContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
}); 