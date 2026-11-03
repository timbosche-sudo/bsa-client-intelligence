import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReadinessBadge } from '@/components/status';
import { SelectField, TextArea } from '@/components/form/fields';
import { upsertProject } from '@/data/mutations';
import type { ClientWorkspace } from '@/data/repository';
import { READINESS_LABELS, type Project, type ReadinessAssessment, type ReadinessStatus } from '@/domain/types';
import { nowIso } from '@/domain/ids';
import { formatDateTime } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { DI, DL, Section } from './shared';
import { ChecklistSection } from './ChecklistSection';

const OPTIONS = (Object.keys(READINESS_LABELS) as ReadinessStatus[]).map((s) => ({ value: s, label: READINESS_LABELS[s] }));
const blank = (): ReadinessAssessment => ({ status: 'not_assessed', note: '', assessedById: null, assessedAt: null });

export function ReadinessTab({ ws, project: p }: { ws: ClientWorkspace; project: Project }) {
  const dims = [...ws.client.config.readinessDimensions].sort((a, b) => a.order - b.order);
  const [draft, setDraft] = useState(() => ({ dims: Object.fromEntries(dims.map((d) => [d.id, p.readiness[d.id] ?? blank()])), overall: p.overallReadiness }));
  const [editing, setEditing] = useState(false);

  const changed = (a: ReadinessAssessment, b: ReadinessAssessment) => a.status !== b.status || a.note !== b.note;
  const stamp = (next: ReadinessAssessment, prev: ReadinessAssessment): ReadinessAssessment => (changed(next, prev) ? { ...next, assessedAt: nowIso(), assessedByName: currentUserName() } : prev);

  const save = () => {
    const readiness = { ...p.readiness };
    dims.forEach((d) => (readiness[d.id] = stamp(draft.dims[d.id], p.readiness[d.id] ?? blank())));
    const overall = stamp(draft.overall, p.overallReadiness);
    const r = run((d) => upsertProject(d, { ...p, readiness, overallReadiness: overall }, currentUserName()), { clientId: ws.client.id, entity: 'project', entityId: p.id, summary: `Updated readiness for "${p.name}"` });
    if (r.ok) setEditing(false);
  };

  const tally = dims.reduce<Record<string, number>>((acc, d) => {
    const s = (p.readiness[d.id] ?? blank()).status;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      <Section title="Scope">
        <DL>
          <DI label="Description" value={p.description} wide />
          <DI label="Project type" value={p.projectType} />
          <DI label="Size" value={p.size.value !== null ? `${p.size.value.toLocaleString()} ${p.size.unit === 'sf' ? 'SF' : p.size.unit === 'beds' ? 'beds' : ''}` : null} tabular />
        </DL>
      </Section>

      <Section
        title="Readiness assessment"
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => (setDraft({ dims: Object.fromEntries(dims.map((d) => [d.id, p.readiness[d.id] ?? blank()])), overall: p.overallReadiness }), setEditing(false))}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={save}>Save assessment</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>Assess readiness</Button>
          )
        }
      >
        <p className="mb-5 flex items-start gap-2 text-xs text-subtle">
          <Info size={14} className="mt-px shrink-0" aria-hidden />
          Each dimension is an explicit judgment by an accountable leader. The overall assessment is recorded separately and is never calculated from the dimensions.
        </p>

        <div className="grid gap-3 lg:grid-cols-2">
          {dims.map((dim) => {
            const a = editing ? draft.dims[dim.id] : p.readiness[dim.id] ?? blank();
            return (
              <div key={dim.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{dim.label}</p>
                    <p className="text-xs text-subtle">{dim.guidance}</p>
                  </div>
                  {!editing && <ReadinessBadge status={a.status} />}
                </div>
                {editing ? (
                  <div className="mt-3 grid gap-3">
                    <SelectField label={`${dim.label} status`} value={a.status} onChange={(v) => setDraft((s) => ({ ...s, dims: { ...s.dims, [dim.id]: { ...s.dims[dim.id], status: v as ReadinessStatus } } }))} options={OPTIONS} />
                    <TextArea label="Basis / note" rows={2} value={a.note} onChange={(v) => setDraft((s) => ({ ...s, dims: { ...s.dims, [dim.id]: { ...s.dims[dim.id], note: v } } }))} />
                  </div>
                ) : (
                  <>
                    {a.note && <p className="mt-3 text-sm text-muted">{a.note}</p>}
                    {a.assessedAt && <p className="mt-2 text-xs text-subtle">Assessed {formatDateTime(a.assessedAt)}{a.assessedByName ? ` by ${a.assessedByName}` : ''}</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-line-strong bg-surface-2 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-ink">Overall readiness</p>
              <p className="mt-1 text-xs text-subtle">
                Dimensions: {Object.entries(tally).map(([s, n]) => `${n} ${READINESS_LABELS[s as ReadinessStatus].toLowerCase()}`).join(' · ')}
              </p>
            </div>
            {!editing && <ReadinessBadge status={p.overallReadiness.status} />}
          </div>
          {editing ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SelectField label="Overall status" value={draft.overall.status} onChange={(v) => setDraft((s) => ({ ...s, overall: { ...s.overall, status: v as ReadinessStatus } }))} options={OPTIONS} />
              <TextArea label="Rationale" rows={2} value={draft.overall.note} onChange={(v) => setDraft((s) => ({ ...s, overall: { ...s.overall, note: v } }))} />
            </div>
          ) : (
            <>
              {p.overallReadiness.note && <p className="mt-3 text-sm">{p.overallReadiness.note}</p>}
              {p.overallReadiness.assessedAt && <p className="mt-2 text-xs text-subtle">Assessed {formatDateTime(p.overallReadiness.assessedAt)}{p.overallReadiness.assessedByName ? ` by ${p.overallReadiness.assessedByName}` : ''}</p>}
            </>
          )}
        </div>
      </Section>

      <ChecklistSection ws={ws} project={p} />
    </div>
  );
}
