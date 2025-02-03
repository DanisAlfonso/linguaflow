import { Redirect, usePathname } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  console.log('Root index.tsx - Current pathname:', pathname);
  console.log('Root index.tsx - Auth state:', { user: !!user, loading });

  // While loading, return nothing to avoid flash
  if (loading) {
    console.log('Root index.tsx - Still loading auth state');
    return null;
  }

  // If we're at the root path and authenticated, go to app home
  if (user && pathname === '/') {
    console.log('Root index.tsx - At root path and authenticated, redirecting to /(app)');
    return <Redirect href="/(app)" />;
  }

  // If not authenticated, redirect to sign in
  if (!user) {
    console.log('Root index.tsx - User not authenticated, redirecting to /sign-in');
    return <Redirect href="/sign-in" />;
  }

  // For any other path, let the AuthContext handle the routing
  return null;
}
