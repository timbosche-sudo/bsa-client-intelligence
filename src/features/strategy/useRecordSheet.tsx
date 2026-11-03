import { useCallback, useState, type ReactNode } from 'react';
import type { ClientWorkspace } from '@/data/repository';
import type { ActionItem, Decision, Initiative, Risk } from '@/domain/types';
import { ActionSheet } from './ActionSheet';
import { DecisionSheet } from './DecisionSheet';
import { InitiativeSheet } from './InitiativeSheet';
import { RiskSheet } from './RiskSheet';
import { WorkstreamSheet } from './WorkstreamSheet';

export type SheetRequest =
  | { kind: 'action'; id: string | null; defaults?: Partial<ActionItem> }
  | { kind: 'decision'; id: string | null; defaults?: Partial<Decision> }
  | { kind: 'risk'; id: string | null; defaults?: Partial<Risk> }
  | { kind: 'initiative'; id: string | null; defaults?: Partial<Initiative>; onDeleted?(): void }
  | { kind: 'workstream'; id: string | null };

/** One place to open any strategy record editor from any page. */
export function useRecordSheet(ws: ClientWorkspace): { open(req: SheetRequest): void; sheet: ReactNode } {
  const [req, setReq] = useState<(SheetRequest & { key: number }) | null>(null);
  const open = useCallback((r: SheetRequest) => setReq({ ...r, key: Date.now() }), []);
  const close = () => setReq(null);
  let sheet: ReactNode = null;
  if (req?.kind === 'action') sheet = <ActionSheet key={req.key} ws={ws} actionId={req.id} defaults={req.defaults} onClose={close} />;
  if (req?.kind === 'decision') sheet = <DecisionSheet key={req.key} ws={ws} decisionId={req.id} defaults={req.defaults} onClose={close} />;
  if (req?.kind === 'risk') sheet = <RiskSheet key={req.key} ws={ws} riskId={req.id} defaults={req.defaults} onClose={close} />;
  if (req?.kind === 'initiative') sheet = <InitiativeSheet key={req.key} ws={ws} initiativeId={req.id} defaults={req.defaults} onClose={close} onDeleted={req.onDeleted} />;
  if (req?.kind === 'workstream') sheet = <WorkstreamSheet key={req.key} ws={ws} workstreamId={req.id} onClose={close} />;
  return { open, sheet };
}
