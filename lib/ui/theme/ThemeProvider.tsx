import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import {
  getResolvedPalette,
  theme,
  tokens,
  type ColorPalette,
  type DesignTokens,
  type ThemeMode,
} from '../../theme';

const THEME_STORAGE_KEY = '@cymru_rugby/theme_mode';

interface ThemeContextValue {
  tokens: DesignTokens;
  resolvedColors: ColorPalette;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (cancelled) return;
        if (stored === 'dark' || stored === 'light' || stored === 'system') {
          setModeState(stored);
        }
      } catch {
        // keep default 'system'
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  const resolvedColors = useMemo(
    () => getResolvedPalette(mode, systemColorScheme ?? null),
    [mode, systemColorScheme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens,
      resolvedColors,
      mode,
      setMode,
    }),
    [resolvedColors, mode, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

/** Resolved palette for current mode; falls back to default theme when outside ThemeProvider. */
export function useResolvedColors(): ColorPalette {
  const ctx = useContext(ThemeContext);
  return ctx?.resolvedColors ?? theme.colors;
}
