import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: React.ReactNode;
  initialPathname?: string;
};

export function AuthProvider({ children, initialPathname }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    console.log('AuthContext - Initial pathname:', initialPathname);
    console.log('AuthContext - Current segments:', segments);
    console.log('AuthContext - Auth state:', { user: !!user, loading });

    if (loading) return;

    const inProtectedRoute = segments[0] === '(app)';
    const isRootPath = segments.length === 0 || (segments.length === 1 && segments[0] === '');

    if (!user && inProtectedRoute) {
      // If not authenticated and trying to access protected route, redirect to sign in
      console.log('AuthContext - Not authenticated, redirecting to sign in');
      router.replace('/sign-in');
    } else if (user && !inProtectedRoute && !isRootPath) {
      // If authenticated and accessing non-root public route, redirect to app version
      const targetPath = initialPathname || '/';
      const appPath = targetPath === '/' ? '/(app)' : `/(app)${targetPath}`;
      console.log('AuthContext - Authenticated, redirecting to:', appPath);
      router.replace(appPath);
    } else if (user && isRootPath) {
      // If authenticated and at root, redirect to app home
      console.log('AuthContext - At root, redirecting to app home');
      router.replace('/(app)');
    }
  }, [user, loading, segments, initialPathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    signIn: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    signUp: async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 