import { createTheme } from '@rneui/themed';

export const lightTheme = createTheme({
  lightColors: {
    primary: '#1A1A1A',
    secondary: '#2A2A2A',
    background: '#FFFFFF',
    grey0: '#F9FAFB',
    grey1: '#F3F4F6',
    grey2: '#E5E7EB',
    grey3: '#D1D5DB',
    grey4: '#9CA3AF',
    grey5: '#6B7280',
    success: '#059669',
    error: '#DC2626',
    warning: '#D97706',
    divider: '#E5E7EB',
    white: '#FFFFFF',
    black: '#000000',
  },
  mode: 'light',
  components: {
    Button: {
      raised: true,
      radius: 8,
      containerStyle: {
        paddingVertical: 8,
      },
    },
    Input: {
      containerStyle: {
        paddingHorizontal: 0,
      },
      inputContainerStyle: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
      },
      inputStyle: {
        minHeight: 44,
      },
    },
  },
});

export const darkTheme = createTheme({
  darkColors: {
    primary: '#F5F5F5',
    secondary: '#E5E5E5',
    background: '#121212',
    grey0: '#1A1A1A',
    grey1: '#2A2A2A',
    grey2: '#404040',
    grey3: '#737373',
    grey4: '#A3A3A3',
    grey5: '#E5E5E5',
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    divider: '#2A2A2A',
    white: '#FFFFFF',
    black: '#000000',
  },
  mode: 'dark',
  components: {
    Button: {
      raised: true,
      radius: 8,
      containerStyle: {
        paddingVertical: 8,
      },
    },
    Input: {
      containerStyle: {
        paddingHorizontal: 0,
      },
      inputContainerStyle: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
      },
      inputStyle: {
        minHeight: 44,
      },
    },
  },
}); 