import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../services/api';
import type { SystemHealth } from '../types';

export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>({
    status: 'offline',
    gemini_configured: false,
    database_connected: false,
    rag_indexed: false,
    checked_at: new Date().toISOString(),
  });
  const [checking, setChecking] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    const result = await apiClient.getHealth();
    setHealth(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { health, checking, refresh };
}
