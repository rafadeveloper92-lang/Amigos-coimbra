import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  isSavingTheme: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveInitialMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>(resolveInitialMode());
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  useEffect(() => {
    const metadataMode = user?.user_metadata?.theme_mode;
    if (metadataMode === 'dark' || metadataMode === 'light') {
      setModeState(metadataMode);
      return;
    }
    setModeState(resolveInitialMode());
  }, [user?.id, user?.user_metadata?.theme_mode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-dark', mode === 'dark');
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const persistTheme = useCallback(async (nextMode: ThemeMode) => {
    if (!user) return;
    setIsSavingTheme(true);
    try {
      const currentMetadata = user.user_metadata || {};
      await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          theme_mode: nextMode,
        },
      });
    } catch (error) {
      console.error('Erro ao salvar preferência de tema:', error);
    } finally {
      setIsSavingTheme(false);
    }
  }, [user]);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await persistTheme(nextMode);
  }, [persistTheme]);

  const toggleMode = useCallback(async () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setModeState(nextMode);
    await persistTheme(nextMode);
  }, [mode, persistTheme]);

  const value = useMemo(() => ({
    mode,
    isDark: mode === 'dark',
    isSavingTheme,
    setMode,
    toggleMode,
  }), [mode, isSavingTheme, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
}
