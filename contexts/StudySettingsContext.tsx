import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CardAnimationType = 'flip' | 'flip-vertical';

type StudySettingsContextType = {
  hideNavigationBar: boolean;
  setHideNavigationBar: (value: boolean) => Promise<void>;
  cardAnimationType: CardAnimationType;
  setCardAnimationType: (value: CardAnimationType) => Promise<void>;
  moveControlsToBottom: boolean;
  setMoveControlsToBottom: (value: boolean) => Promise<void>;
  autoPlay: boolean;
  setAutoPlay: (value: boolean) => Promise<void>;
};

const StudySettingsContext = createContext<StudySettingsContextType | undefined>(undefined);

export function StudySettingsProvider({ children }: { children: React.ReactNode }) {
  const [hideNavigationBar, setHideNavigationBarState] = useState(false);
  const [cardAnimationType, setCardAnimationTypeState] = useState<CardAnimationType>('flip');
  const [moveControlsToBottom, setMoveControlsToBottomState] = useState(false);
  const [autoPlay, setAutoPlayState] = useState(false);

  useEffect(() => {
    // Load settings on mount
    const loadSettings = async () => {
      try {
        console.log('StudySettingsContext - Loading settings');
        const [hideNavBar, animationType, moveControls, autoPlayValue] = await Promise.all([
          AsyncStorage.getItem('hideNavigationBar'),
          AsyncStorage.getItem('cardAnimationType'),
          AsyncStorage.getItem('moveControlsToBottom'),
          AsyncStorage.getItem('autoPlay'),
        ]);
        
        console.log('StudySettingsContext - Loaded settings:', {
          hideNavBar,
          animationType,
          moveControls,
          autoPlayValue
        });
        
        setHideNavigationBarState(hideNavBar === 'true');
        setCardAnimationTypeState((animationType as CardAnimationType) || 'flip');
        setMoveControlsToBottomState(moveControls === 'true');
        setAutoPlayState(autoPlayValue === 'true');
      } catch (error) {
        console.error('Error loading study settings:', error);
      }
    };
    loadSettings();
  }, []);

  const setHideNavigationBar = async (value: boolean) => {
    try {
      console.log('StudySettingsContext - Setting hideNavigationBar:', value);
      await AsyncStorage.setItem('hideNavigationBar', value.toString());
      setHideNavigationBarState(value);
    } catch (error) {
      console.error('Error saving hide navigation bar setting:', error);
    }
  };

  const setCardAnimationType = async (value: CardAnimationType) => {
    try {
      console.log('StudySettingsContext - Setting cardAnimationType:', value);
      await AsyncStorage.setItem('cardAnimationType', value);
      setCardAnimationTypeState(value);
    } catch (error) {
      console.error('Error saving card animation type setting:', error);
    }
  };

  const setMoveControlsToBottom = async (value: boolean) => {
    try {
      console.log('StudySettingsContext - Setting moveControlsToBottom:', value);
      await AsyncStorage.setItem('moveControlsToBottom', value.toString());
      setMoveControlsToBottomState(value);
    } catch (error) {
      console.error('Error saving move controls to bottom setting:', error);
    }
  };

  const setAutoPlay = async (value: boolean) => {
    try {
      console.log('StudySettingsContext - Setting autoPlay:', value);
      await AsyncStorage.setItem('autoPlay', value.toString());
      setAutoPlayState(value);
    } catch (error) {
      console.error('Error saving autoPlay setting:', error);
    }
  };

  return (
    <StudySettingsContext.Provider
      value={{
        hideNavigationBar,
        setHideNavigationBar,
        cardAnimationType,
        setCardAnimationType,
        moveControlsToBottom,
        setMoveControlsToBottom,
        autoPlay,
        setAutoPlay,
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