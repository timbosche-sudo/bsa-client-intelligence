import { useMemo } from 'react';
import { active, assignablePeople, type ClientWorkspace } from '@/data/repository';
import { CONFIDENTIALITY_LABELS, type Confidentiality } from '@/domain/types';
import { useDataStore } from '@/state/store';

/** Option lists for strategy record editors — always scoped to the current client. */
export function useStrategyOptions(ws: ClientWorkspace) {
  const data = useDataStore((s) => s.data)!;
  return useMemo(() => {
    const people = assignablePeople(data, ws.client.id);
    const label = (p: { fullName: string; affiliation: string }) => p.fullName + (p.affiliation === 'client' ? ' (client)' : p.affiliation === 'external' ? ' (external)' : '');
    return {
      people,
      personOptions: people.filter((p) => p.active).map((p) => ({ value: p.id, label: label(p) })),
      workstreamOptions: active(ws.workstreams).sort((a, b) => a.order - b.order).map((w) => ({ value: w.id, label: `${w.order}. ${w.title}` })),
      initiativeOptions: active(ws.initiatives).map((i) => ({ value: i.id, label: i.title })),
      projectOptions: active(ws.projects).sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ value: p.id, label: p.projectNumber ? `${p.name} (${p.projectNumber})` : p.name })),
      confidentialityOptions: (Object.keys(CONFIDENTIALITY_LABELS) as Confidentiality[]).map((c) => ({ value: c, label: CONFIDENTIALITY_LABELS[c] })),
    };
  }, [data, ws]);
}

/** Keeps an archived/inactive current value selectable so editing never silently drops it. */
export function withCurrent(options: { value: string; label: string }[], current: string | null | undefined, fallbackLabel: string) {
  return current && !options.some((o) => o.value === current) ? [...options, { value: current, label: fallbackLabel }] : options;
}
