import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type StudySettingsContextType = {
  distractionFreeMode: boolean;
  setDistractionFreeMode: (value: boolean) => Promise<void>;
};

const StudySettingsContext = createContext<StudySettingsContextType | undefined>(undefined);

export function StudySettingsProvider({ children }: { children: React.ReactNode }) {
  const [distractionFreeMode, setDistractionFreeModeState] = useState(false);

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        const value = await AsyncStorage.getItem('distractionFreeMode');
        setDistractionFreeModeState(value === 'true');
      } catch (error) {
        console.error('Error loading study settings:', error);
      }
    };
    loadSettings();
  }, []);

  const setDistractionFreeMode = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('distractionFreeMode', value.toString());
      setDistractionFreeModeState(value);
    } catch (error) {
      console.error('Error saving distraction-free mode setting:', error);
    }
  };

  return (
    <StudySettingsContext.Provider
      value={{
        distractionFreeMode,
        setDistractionFreeMode,
      }}
    >
      {children}
    </StudySettingsContext.Provider>
  );
}

export function useStudySettings() {
  const context = useContext(StudySettingsContext);
  if (context === undefined) {
    throw new Error('useStudySettings must be used within a StudySettingsProvider');
  }
  return context;
} 