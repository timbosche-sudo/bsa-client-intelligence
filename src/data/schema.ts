import { z } from 'zod';
import type { Dataset } from '@/domain/types';

/** Bump when the persisted Dataset shape changes, and add a migration below. */
export const SCHEMA_VERSION = 2;

/**
 * Structural envelope validation. Deep per-record validation is added with the editing forms
 * (Stage 2+) and the restore workflow (Stage 6).
 */
const record = z.object({ id: z.string().min(1) }).passthrough();
const scoped = record.extend({ clientId: z.string().min(1) });

export const datasetEnvelope = z.object({
  schemaVersion: z.number().int().positive(),
  origin: z.enum(['demo-seed', 'restored', 'empty']),
  savedAt: z.string().nullable(),
  clients: z.array(record),
  people: z.array(record),
  memberships: z.array(scoped),
  seats: z.array(scoped),
  projects: z.array(scoped),
  workstreams: z.array(scoped),
  initiatives: z.array(scoped),
  actions: z.array(scoped),
  decisions: z.array(scoped),
  risks: z.array(scoped),
  milestones: z.array(scoped),
  meetingTemplates: z.array(record),
  meetings: z.array(scoped),
  reports: z.array(scoped),
  media: z.array(record.extend({ ownerId: z.string().min(1), ownerType: z.enum(['person', 'project']) })),
  activity: z.array(z.object({ id: z.string() }).passthrough()),
});

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] upgrades a dataset from version n to n + 1. */
const migrations: Record<number, Migration> = {
  // v1 → v2: introduce media metadata collection (Stage 2).
  1: (d) => ({
    ...d,
    media: Array.isArray(d.media) ? d.media : [],
    people: (d.people as Record<string, unknown>[]).map((p) => ({ homeClientId: null, ...p })),
    projects: (d.projects as Record<string, unknown>[]).map((p) => ({ documentLinks: [], ...p })),
  }),
};

export class SchemaError extends Error {}

export function migrate(raw: unknown): Dataset {
  if (!raw || typeof raw !== 'object') throw new SchemaError('Data is not an object.');
  let data = raw as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new SchemaError(`Data was saved by a newer version of the app (schema ${version}; this app supports ${SCHEMA_VERSION}).`);
  }
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new SchemaError(`No migration available from schema version ${version}.`);
    data = { ...step(data), schemaVersion: version + 1 };
    version += 1;
  }
  const parsed = datasetEnvelope.safeParse(data);
  if (!parsed.success) {
    throw new SchemaError('Data failed validation: ' + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return data as unknown as Dataset;
}
