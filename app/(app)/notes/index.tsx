import { View, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Container } from '../../../components/layout/Container';

export default function NotesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Container>
        <View style={styles.content}>
          <MaterialIcons name="note" size={64} color="#9CA3AF" />
          <Text h1 style={styles.title}>Notes</Text>
          <Text style={styles.description}>
            Coming soon! Take notes, create to-do lists, and organize your study materials.
          </Text>
        </View>
      </Container>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 32,
    color: '#374151',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: '80%',
  },
}); 