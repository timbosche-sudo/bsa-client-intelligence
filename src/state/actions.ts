import { prototypeAuth } from '@/auth/session';
import { IntegrityError } from '@/data/mutations';
import type { Dataset } from '@/domain/types';
import { useDataStore } from './store';
import { toast } from './toast';

export const currentUserName = () => prototypeAuth.getCurrentUser().displayName;

export interface RunResult {
  ok: boolean;
  error?: string;
  references?: string[];
}

/**
 * Applies a mutation with activity logging and user feedback.
 * The recipe runs on a draft; if it throws, nothing is changed.
 */
export function run(
  recipe: (d: Dataset) => void,
  activity: { clientId: string | null; entity: string; entityId: string | null; summary: string },
  success?: string | false,
): RunResult {
  try {
    useDataStore.getState().mutate(recipe, activity);
    if (success !== false) toast(success ?? activity.summary);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    toast(message, 'error');
    return { ok: false, error: message, references: err instanceof IntegrityError ? err.references : undefined };
  }
}
