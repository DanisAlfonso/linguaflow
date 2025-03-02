import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { initializeDatabase, syncOfflineDecks } from '../lib/services/flashcards';
import { useAuth } from './AuthContext';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

interface DatabaseContextType {
  isInitialized: boolean;
  isOnline: boolean;
  syncData: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isInitialized: false,
  isOnline: true,
  syncData: async () => {},
});

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [initializationError, setInitializationError] = useState<Error | null>(null);
  const { user } = useAuth();

  // Function to sync offline data to the server
  const syncData = async () => {
    if (!user || !isInitialized || initializationError) return;
    
    try {
      await syncOfflineDecks(user.id);
      Toast.show({
        type: 'success',
        text1: 'Sync Complete',
        text2: 'Your offline changes have been synced to the server',
        position: 'bottom',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Error syncing offline data:', error);
      Toast.show({
        type: 'error',
        text1: 'Sync Error',
        text2: 'Failed to sync some offline changes',
        position: 'bottom',
        visibilityTime: 3000,
      });
    }
  };

  // Initialize the database
  useEffect(() => {
    const init = async () => {
      if (Platform.OS !== 'web') {
        try {
          await initializeDatabase();
          setIsInitialized(true);
          setInitializationError(null);
        } catch (error) {
          console.error('Error initializing database:', error);
          setInitializationError(error instanceof Error ? error : new Error('Unknown database error'));
          
          // Show a toast notification about the error
          Toast.show({
            type: 'error',
            text1: 'Database Error',
            text2: 'There was an issue initializing the database. Some offline features may not work.',
            position: 'bottom',
            visibilityTime: 4000,
          });
          
          // Still set initialized to true so the app can function in online mode
          setIsInitialized(true);
        }
      } else {
        // On web, we don't need to initialize SQLite
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  // Monitor network connectivity
  useEffect(() => {
    let previousOnlineState = isOnline;
    
    if (Platform.OS === 'web') {
      // For web, use the browser's online/offline events
      const handleOnline = () => {
        setIsOnline(true);
        if (!previousOnlineState && user) {
          // If we were offline and now we're online, sync data
          previousOnlineState = true;
          syncData();
        }
      };
      
      const handleOffline = () => {
        setIsOnline(false);
        previousOnlineState = false;
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Set initial state
      setIsOnline(navigator.onLine);
      previousOnlineState = navigator.onLine;
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // For mobile, use NetInfo
      const unsubscribe = NetInfo.addEventListener(state => {
        const newOnlineState = state.isConnected ?? false;
        setIsOnline(newOnlineState);
        
        // If we were offline and now we're online, sync data
        if (!previousOnlineState && newOnlineState && user) {
          syncData();
        }
        
        previousOnlineState = newOnlineState;
      });
      
      // Get initial state
      NetInfo.fetch().then(state => {
        setIsOnline(state.isConnected ?? false);
        previousOnlineState = state.isConnected ?? false;
      });
      
      return () => unsubscribe();
    }
  }, [user]);

  return (
    <DatabaseContext.Provider value={{ isInitialized, isOnline, syncData }}>
      {children}
    </DatabaseContext.Provider>
  );
}; 