import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  // While loading, return nothing to avoid flash
  if (loading) {
    return null;
  }

  // If user is authenticated, redirect to home screen
  if (user) {
    return <Redirect href="/(app)" />;
  }

  // If user is not authenticated, redirect to sign in
  return <Redirect href="/sign-in" />;
}
