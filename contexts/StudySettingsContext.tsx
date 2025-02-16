import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CardAnimationType = 'flip' | 'flip-vertical';

type StudySettingsContextType = {
  distractionFreeMode: boolean;
  setDistractionFreeMode: (value: boolean) => Promise<void>;
  cardAnimationType: CardAnimationType;
  setCardAnimationType: (value: CardAnimationType) => Promise<void>;
};

const StudySettingsContext = createContext<StudySettingsContextType | undefined>(undefined);

export function StudySettingsProvider({ children }: { children: React.ReactNode }) {
  const [distractionFreeMode, setDistractionFreeModeState] = useState(false);
  const [cardAnimationType, setCardAnimationTypeState] = useState<CardAnimationType>('flip');

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        const [distractionMode, animationType] = await Promise.all([
          AsyncStorage.getItem('distractionFreeMode'),
          AsyncStorage.getItem('cardAnimationType'),
        ]);
        
        setDistractionFreeModeState(distractionMode === 'true');
        setCardAnimationTypeState((animationType as CardAnimationType) || 'flip');
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

  const setCardAnimationType = async (value: CardAnimationType) => {
    try {
      await AsyncStorage.setItem('cardAnimationType', value);
      setCardAnimationTypeState(value);
    } catch (error) {
      console.error('Error saving card animation type setting:', error);
    }
  };

  return (
    <StudySettingsContext.Provider
      value={{
        distractionFreeMode,
        setDistractionFreeMode,
        cardAnimationType,
        setCardAnimationType,
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