import { Stack } from 'expo-router';

export default function FlashcardsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/study" />
      <Stack.Screen name="[id]/edit" />
      <Stack.Screen name="[id]/cards/create" />
      <Stack.Screen name="[id]/recordings" />
    </Stack>
  );
} 