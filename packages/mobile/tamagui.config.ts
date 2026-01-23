import { createTamagui, createTokens, createTheme } from 'tamagui';
import { config } from '@tamagui/config/v3';

// Custom tokens based on Daily Orbit design
const tokens = createTokens({
  ...config.tokens,
  color: {
    ...config.tokens.color,
    // Primary colors
    primary: '#4F46E5',
    primaryLight: '#EEF2FF',

    // Neutral colors
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',

    // Text colors
    textMain: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',

    // Status colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',

    // Accent
    indigo: '#4F46E5',
  },
});

// Create light theme
const lightTheme = createTheme({
  bg: '#F8FAFC',
  bgFocus: '#F1F5F9',
  bgHover: '#F1F5F9',
  borderColor: '#E2E8F0',
  color: '#0F172A',
  colorFocus: '#1E293B',
  colorHover: '#1E293B',
  colorPress: '#0F172A',
  placeholderColor: '#94A3B8',
});

// Create dark theme
const darkTheme = createTheme({
  bg: '#0F172A',
  bgFocus: '#1E293B',
  bgHover: '#1E293B',
  borderColor: '#334155',
  color: '#F8FAFC',
  colorFocus: '#E2E8F0',
  colorHover: '#E2E8F0',
  colorPress: '#F8FAFC',
  placeholderColor: '#64748B',
});

export const tamalogui = createTamagui({
  ...config,
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  settings: {
    allowedStyleValues: 'somewhat-strict',
    maxDarkLuminosity: 0.3,
  },
});

export type AppConfig = typeof tamalogui;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
