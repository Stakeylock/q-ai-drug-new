'use client';

import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'qdrugforge.theme';

/**
 * Hook to manage theme switching
 * Uses data-theme attribute and CSS variables
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    const initialTheme =
      stored === 'light' || stored === 'dark'
        ? stored
        : 'light';

    setTheme(initialTheme);
    applyTheme(initialTheme);
    setIsLoaded(true);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.dataset.theme = newTheme;
    root.style.colorScheme = newTheme;

    // Also toggle dark class for any Tailwind dark: utilities that might still exist
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem(THEME_KEY, newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const setCurrentTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return {
    theme,
    toggleTheme,
    setTheme: setCurrentTheme,
    isLoaded,
  };
}
