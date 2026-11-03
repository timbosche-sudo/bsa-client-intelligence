import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getWorkspace, type ClientWorkspace } from '@/data/repository';
import { useDataStore } from './store';

/** Returns the client workspace for the :clientId route parameter, or null when not found. */
export function useWorkspace(): ClientWorkspace | null {
  const { clientId } = useParams();
  const data = useDataStore((s) => s.data);
  return useMemo(() => {
    if (!data || !clientId) return null;
    try {
      return getWorkspace(data, clientId);
    } catch {
      return null;
    }
  }, [data, clientId]);
}

/** Like useWorkspace but for pages rendered inside a validated workspace route. */
export function useRequiredWorkspace(): ClientWorkspace {
  const ws = useWorkspace();
  if (!ws) throw new Error('useRequiredWorkspace must be used inside a valid client workspace route.');
  return ws;
}
