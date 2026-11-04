/** Administration mutations: client profiles, archiving and readiness configuration. */
import { nowIso } from '@/domain/ids';
import type { Client, Dataset, ID, ReadinessDimensionDef } from '@/domain/types';
import { IntegrityError } from './mutations';

export function updateClientProfile(d: Dataset, next: Client): void {
  const i = d.clients.findIndex((c) => c.id === next.id);
  if (i === -1) throw new IntegrityError('Client not found.');
  const name = next.name.trim();
  if (name.length < 2) throw new IntegrityError('Enter the client name.');
  if (d.clients.some((c) => c.id !== next.id && c.name.trim().toLowerCase() === name.toLowerCase())) throw new IntegrityError(`A workspace named "${name}" already exists.`);
  const monogram = next.monogram.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,3}$/.test(monogram)) throw new IntegrityError('The monogram must be 1–3 letters or numbers.');
  d.clients[i] = {
    ...next,
    name,
    shortName: next.shortName.trim() || name,
    monogram,
    clientCode: next.clientCode?.trim() || null,
    sector: next.sector?.trim() || null,
    strategicPriorities: next.strategicPriorities.map((p) => p.trim()).filter(Boolean),
    archivedAt: next.status === 'archived' ? d.clients[i].archivedAt ?? nowIso() : null,
    updatedAt: nowIso(),
  };
}

/** Archiving hides a workspace from the selector; all records are kept. At least one active client must remain. */
export function setClientArchived(d: Dataset, id: ID, archived: boolean): void {
  const c = d.clients.find((x) => x.id === id);
  if (!c) throw new IntegrityError('Client not found.');
  if (archived && d.clients.filter((x) => x.id !== id && !x.archivedAt && x.status !== 'archived').length === 0) throw new IntegrityError('At least one client workspace must remain active.');
  Object.assign(c, { status: archived ? 'archived' : 'active', archivedAt: archived ? nowIso() : null, updatedAt: nowIso() });
}

/**
 * Replaces readiness dimensions. Dimensions that hold recorded assessments cannot be removed
 * (that would hide human judgments); rename them instead.
 */
export function updateReadinessDimensions(d: Dataset, clientId: ID, dims: ReadinessDimensionDef[]): void {
  const client = d.clients.find((c) => c.id === clientId);
  if (!client) throw new IntegrityError('Client not found.');
  if (dims.some((x) => !x.label.trim())) throw new IntegrityError('Every dimension needs a name.');
  if (!dims.length) throw new IntegrityError('Keep at least one readiness dimension.');
  const keep = new Set(dims.map((x) => x.id));
  for (const removed of client.config.readinessDimensions.filter((x) => !keep.has(x.id))) {
    const used = d.projects.filter((p) => p.clientId === clientId && p.readiness[removed.id] && p.readiness[removed.id].status !== 'not_assessed').length;
    if (used) throw new IntegrityError(`"${removed.label}" has assessments on ${used} project(s). Rename it instead of removing it.`);
  }
  client.config = { ...client.config, readinessDimensions: dims.map((x, i) => ({ ...x, label: x.label.trim(), order: i + 1 })) };
  // New dimensions start as Not Assessed on every project of this client.
  for (const p of d.projects.filter((x) => x.clientId === clientId)) {
    for (const dim of dims) if (!p.readiness[dim.id]) p.readiness[dim.id] = { status: 'not_assessed', note: '', assessedById: null, assessedAt: null };
  }
  client.updatedAt = nowIso();
}
