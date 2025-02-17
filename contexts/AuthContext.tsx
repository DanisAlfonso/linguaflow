import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '../lib/supabase';
import type { User, AuthResponse } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: React.ReactNode;
  initialPathname?: string;
};

// List of routes that require authentication but are not in the (app) group
const PROTECTED_ROUTES = ['profile', 'settings'];

export function AuthProvider({ children, initialPathname }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Handle navigation based on auth state
  useEffect(() => {
    console.log('AuthContext - Navigation Effect:', {
      loading,
      user: !!user,
      segments,
      initialPathname
    });

    if (loading) {
      console.log('AuthContext - Still loading, skipping navigation');
      return;
    }

    const inProtectedRoute = segments[0] === '(app)' || PROTECTED_ROUTES.includes(segments[0] || '');
    const inAuthRoute = segments[0] === '(auth)';
    const isRootPath = segments.length === 0 || (segments.length === 1 && segments[0] === '');

    console.log('AuthContext - Route analysis:', {
      inProtectedRoute,
      inAuthRoute,
      isRootPath,
      currentSegments: segments
    });

    if (user) {
      console.log('AuthContext - User is authenticated');
      if (inAuthRoute) {
        console.log('AuthContext - Redirecting from auth route to app home');
        router.replace('/(app)');
      } else if (isRootPath) {
        console.log('AuthContext - Redirecting from root to app home');
        router.replace('/(app)');
      }
    } else {
      console.log('AuthContext - User is not authenticated');
      if (inProtectedRoute) {
        console.log('AuthContext - Redirecting to sign in');
        router.replace('/sign-in');
      }
    }
  }, [user, loading, segments, initialPathname]);

  // Handle auth state changes
  useEffect(() => {
    console.log('AuthContext - Setting up auth listeners');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('AuthContext - Initial session:', { hasSession: !!session });
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthContext - Auth state changed:', { 
        event: _event, 
        hasUser: !!session?.user 
      });
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    signIn: async (email: string, password: string) => {
      console.log('AuthContext - Attempting sign in');
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error('AuthContext - Sign in error:', error);
        throw error;
      }
      console.log('AuthContext - Sign in successful');
      return data;
    },
    signUp: async (email: string, password: string) => {
      console.log('AuthContext - Attempting sign up');
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        console.error('AuthContext - Sign up error:', error);
        throw error;
      }
      console.log('AuthContext - Sign up successful');
      return data;
    },
    signOut: async () => {
      console.log('AuthContext - Attempting sign out');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthContext - Sign out error:', error);
        throw error;
      }
      console.log('AuthContext - Sign out successful');
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