import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Rating } from '../../spaced-repetition/fsrs';
import type { CardAudioSegment } from '../../../types/audio';

export const KEYBOARD_SHORTCUTS = {
  '1': Rating.Again,
  '2': Rating.Hard,
  '3': Rating.Good,
  '4': Rating.Easy,
  ' ': 'flip', // Space bar to flip card
  'Control+ ': 'playAudio', // Ctrl+Space to play audio
} as const;

interface UseKeyboardShortcutsProps {
  isFlipped: boolean;
  reviewing: boolean;
  frontAudioSegments: CardAudioSegment[];
  backAudioSegments: CardAudioSegment[];
  onFlip: () => void;
  onResponse: (rating: Rating) => void;
  onPlayAudio?: (audioPath: string) => void;
}

export function useKeyboardShortcuts({
  isFlipped,
  reviewing,
  frontAudioSegments,
  backAudioSegments,
  onFlip,
  onResponse,
  onPlayAudio,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const key = event.key;
      const ctrlKey = event.ctrlKey;
      
      // Handle Ctrl+Space for audio playback
      if (ctrlKey && key === ' ') {
        event.preventDefault();
        const currentSegments = isFlipped ? backAudioSegments : frontAudioSegments;
        if (currentSegments.length > 0 && onPlayAudio) {
          onPlayAudio(currentSegments[0].audio_file_path);
        }
        return;
      }

      // Handle other shortcuts
      if (key in KEYBOARD_SHORTCUTS) {
        event.preventDefault();
        const action = KEYBOARD_SHORTCUTS[key as keyof typeof KEYBOARD_SHORTCUTS];
        
        if (action === 'flip') {
          onFlip();
        } else if (isFlipped && !reviewing) {
          onResponse(action as Rating);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    isFlipped,
    reviewing,
    frontAudioSegments,
    backAudioSegments,
    onFlip,
    onResponse,
    onPlayAudio,
  ]);
} 