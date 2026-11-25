import { useCallback, useEffect, useState } from 'react';
import type { VoicePreferences } from '../types';

const STORAGE_KEY = 'salespilot_voice_preferences';

const DEFAULT_PREFERENCES: VoicePreferences = {
  autoSpeak: true,
  speechRate: 1.0,
  selectedVoiceURI: '',
  recognitionLang: 'en-US',
};

export function useVoicePreferences() {
  const [preferences, setPreferences] = useState<VoicePreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage errors
    }
  }, [preferences]);

  const updatePreferences = useCallback((patch: Partial<VoicePreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return { preferences, updatePreferences, resetPreferences };
}
