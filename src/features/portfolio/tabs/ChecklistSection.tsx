import { useState } from 'react';
import { Archive, ChevronDown, ClipboardList, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FieldError, SelectField, TextArea, TextField } from '@/components/form/fields';
import { active, type ClientWorkspace } from '@/data/repository';
import { applyChecklist, setChecklistArchived, updateChecklist } from '@/data/strategyMutations';
import { newId } from '@/domain/ids';
import type { ChangeLogEntry, ChecklistItem, ChecklistItemStatus, ProgramComparisonRow, Project, ProjectChecklist } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { useStrategyOptions, withCurrent } from '@/features/strategy/options';
import { Section } from './shared';

const ITEM_STATUS: Record<ChecklistItemStatus, { label: string; tone: Tone }> = {
  not_started: { label: 'Not started', tone: 'outline' },
  in_progress: { label: 'In progress', tone: 'accent' },
  complete: { label: 'Complete', tone: 'positive' },
  not_applicable: { label: 'Not applicable', tone: 'neutral' },
};

export function ChecklistSection({ ws, project }: { ws: ClientWorkspace; project: Project }) {
  const [applying, setApplying] = useState(false);
  const checklists = active(ws.checklists).filter((c) => c.projectId === project.id);
  const templates = active(ws.checklistTemplates);

  return (
    <Section title="Restart readiness checklists" actions={templates.length > 0 && <Button size="sm" icon={<Plus size={15} />} onClick={() => setApplying(true)}>Apply checklist</Button>}>
      {checklists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-muted">
          <p className="flex items-center gap-2 font-bold text-ink"><ClipboardList size={16} aria-hidden /> No checklist applied</p>
          <p className="mt-1">
            Project-specific checklists are applied only after the project’s identity and scope are confirmed. Not every project needs the same checklist{templates.length ? ` — ${templates.length} template${templates.length === 1 ? ' is' : 's are'} available.` : '. Create templates in Administration.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {checklists.map((c) => <ChecklistCard key={c.id} ws={ws} checklist={c} />)}
        </div>
      )}
      {applying && <ApplyDialog ws={ws} project={project} onClose={() => setApplying(false)} />}
    </Section>
  );
}

function ApplyDialog({ ws, project, onClose }: { ws: ClientWorkspace; project: Project; onClose(): void }) {
  const templates = active(ws.checklistTemplates).filter((t) => !ws.checklists.some((c) => c.projectId === project.id && c.templateId === t.id && !c.archivedAt));
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [confirmedBy, setConfirmedBy] = useState(currentUserName());
  const [basis, setBasis] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  const template = templates.find((t) => t.id === templateId);

  const apply = () => {
    if (!ack) return setError('Confirm that the project identity and scope have been confirmed.');
    const r = run((d) => void applyChecklist(d, { clientId: ws.client.id, projectId: project.id, templateId, confirmedBy, basis }), {
      clientId: ws.client.id,
      entity: 'checklist',
      entityId: project.id,
      summary: `Applied "${template?.name}" to "${project.name}"`,
    });
    if (r.ok) onClose();
    else setError(r.error ?? '');
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Apply a restart checklist"
      description={project.name}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={apply} disabled={!templateId}>Apply checklist</Button>
        </>
      }
    >
      {templates.length === 0 ? (
        <p className="text-sm text-muted">All available templates are already applied to this project.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <SelectField label="Template" value={templateId} onChange={setTemplateId} options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.items.length} items)` }))} hint={template?.source} />
          {template && (
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
              {template.items.map((i) => <li key={i.id}>{i.title}</li>)}
            </ol>
          )}
          <div className="border-t border-line-strong pt-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-accent" aria-hidden /> Identity & scope confirmation</p>
            <div className="flex flex-col gap-3">
              <TextField label="Confirmed by" required value={confirmedBy} onChange={setConfirmedBy} />
              <TextArea label="Basis for confirmation" required rows={2} value={basis} onChange={setBasis} placeholder="e.g. Scope and project number confirmed with client leadership on …" />
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
                <span>I confirm this project’s identity and scope have been confirmed and this checklist applies to it.</span>
              </label>
            </div>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </div>
      )}
    </Dialog>
  );
}

function ChecklistCard({ ws, checklist: c }: { ws: ClientWorkspace; checklist: ProjectChecklist }) {
  const [tool, setTool] = useState<'items' | 'program' | 'changes' | 'summary'>('items');
  const save = (next: ProjectChecklist, summary: string, toast = false) =>
    run((d) => updateChecklist(d, next), { clientId: ws.client.id, entity: 'checklist', entityId: c.id, summary }, toast ? summary : false);
  const applicable = c.items.filter((i) => i.status !== 'not_applicable');
  const complete = applicable.filter((i) => i.status === 'complete').length;

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="font-black tracking-tight">{c.templateName}</p>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-subtle">
            <ShieldCheck size={13} className="mt-px shrink-0 text-accent" aria-hidden />
            Identity & scope confirmed by {c.identityConfirmation.confirmedBy} on {formatDateTime(c.identityConfirmation.confirmedAt)} — {c.identityConfirmation.note}
          </p>
          <p className="tabular mt-1 text-xs text-muted">
            {complete} of {applicable.length} applicable items complete{c.items.length !== applicable.length ? ` · ${c.items.length - applicable.length} not applicable` : ''}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<Archive size={15} />}
          onClick={() => window.confirm('Archive this checklist? It is kept in history and can be restored from the data backup.') && run((d) => setChecklistArchived(d, c.id, true), { clientId: ws.client.id, entity: 'checklist', entityId: c.id, summary: `Archived checklist "${c.templateName}"` })}
        >
          Archive
        </Button>
      </div>
      <div role="tablist" aria-label="Checklist tools" className="flex gap-1 overflow-x-auto border-b border-line px-2">
        {[
          ['items', `Considerations (${c.items.length})`],
          ['program', `Program comparison (${c.programComparison.length})`],
          ['changes', `Change log (${c.changeLog.length})`],
          ['summary', 'Leadership summary'],
        ].map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tool === id} onClick={() => setTool(id as typeof tool)} className={cn('relative min-h-11 shrink-0 px-3 text-sm', tool === id ? 'font-bold text-ink' : 'text-subtle hover:text-ink')}>
            {label}
            {tool === id && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-brand" aria-hidden />}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-5">
        {tool === 'items' && (
          <ol className="flex flex-col gap-2">
            {c.items.map((item, idx) => (
              <ItemRow key={item.id} ws={ws} n={idx + 1} item={item} onChange={(next, summary) => save({ ...c, items: c.items.map((x) => (x.id === item.id ? next : x)) }, summary)} />
            ))}
          </ol>
        )}
        {tool === 'program' && <ProgramTable rows={c.programComparison} onChange={(rows) => save({ ...c, programComparison: rows }, 'Updated program comparison')} />}
        {tool === 'changes' && <ChangeLog rows={c.changeLog} onChange={(rows) => save({ ...c, changeLog: rows }, 'Updated change log')} />}
        {tool === 'summary' && <SummaryEditor value={c.leadershipSummary} onSave={(v) => save({ ...c, leadershipSummary: v }, 'Saved leadership summary', true)} />}
      </div>
    </div>
  );
}

function ItemRow({ ws, n, item, onChange }: { ws: ClientWorkspace; n: number; item: ChecklistItem; onChange(next: ChecklistItem, summary: string): void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes);
  const o = useStrategyOptions(ws);
  const owner = ws.people.find((p) => p.id === item.ownerId);
  const st = ITEM_STATUS[item.status];
  return (
    <li className="rounded-lg border border-line">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
          <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-bold">{n}</span>
          <span className="min-w-0 flex-1">
            <span className={cn('block text-sm font-bold', item.status === 'not_applicable' && 'text-muted')}>{item.title}</span>
            <span className="block text-xs text-subtle">{owner?.fullName ?? 'Owner unassigned'}{item.dueDate ? ` · Due ${item.dueDate}` : ''}{item.notes ? ' · Notes recorded' : ''}</span>
          </span>
          <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        <div className="flex items-center gap-2 pl-10 sm:pl-0">
          <Badge tone={st.tone}>{st.label}</Badge>
          <select value={item.status} onChange={(e) => onChange({ ...item, status: e.target.value as ChecklistItemStatus }, `Checklist "${item.title}" → ${ITEM_STATUS[e.target.value as ChecklistItemStatus].label}`)} aria-label={`Status of ${item.title}`} className="h-10 rounded-lg border border-line bg-surface px-2 text-sm pointer-coarse:h-11">
            {Object.entries(ITEM_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {open && (
        <div className="grid gap-4 border-t border-line p-3 sm:grid-cols-2">
          {item.guidance.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm text-muted sm:col-span-2">
              {item.guidance.map((g, i) => <li key={i} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />{g}</li>)}
            </ul>
          )}
          <SelectField label="Owner" value={item.ownerId} onChange={(v) => onChange({ ...item, ownerId: v || null }, `Assigned checklist item "${item.title}"`)} placeholder="Unassigned" options={withCurrent(o.personOptions, item.ownerId, 'Inactive person')} />
          <TextField label="Due date" type="date" value={item.dueDate} onChange={(v) => onChange({ ...item, dueDate: v || null }, `Set due date on "${item.title}"`)} />
          <TextArea label="Notes" rows={3} value={notes} onChange={setNotes} onBlur={() => notes !== item.notes && onChange({ ...item, notes }, `Updated notes on "${item.title}"`)} className="sm:col-span-2" hint="Saved when you leave the field." />
        </div>
      )}
    </li>
  );
}

function EditableTable<T extends { id: string }>({ rows, columns, blank, onChange, addLabel, empty }: { rows: T[]; columns: { key: keyof T; label: string; wide?: boolean; options?: string[] }[]; blank(): T; onChange(rows: T[]): void; addLabel: string; empty: string }) {
  const [draft, setDraft] = useState(rows);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rows);
  return (
    <div className="flex flex-col gap-3">
      {draft.length === 0 ? (
        <p className="text-sm text-subtle">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-subtle">
                {columns.map((c) => <th key={String(c.key)} className="px-1 py-2 font-normal">{c.label}</th>)}
                <th className="w-12"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.map((r, i) => (
                <tr key={r.id} className="border-t border-line align-top">
                  {columns.map((c) => (
                    <td key={String(c.key)} className={cn('px-1 py-1.5', c.wide && 'min-w-[14rem]')}>
                      {c.options ? (
                        <select value={String(r[c.key] ?? '')} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))} aria-label={`${c.label}, row ${i + 1}`} className="h-11 w-full rounded border border-line bg-surface px-2">
                          {c.options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                        </select>
                      ) : (
                        <input value={String(r[c.key] ?? '')} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))} aria-label={`${c.label}, row ${i + 1}`} className="h-11 w-full rounded border border-line bg-surface px-2 outline-none focus:border-accent" />
                      )}
                    </td>
                  ))}
                  <td className="py-1.5">
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={15} />} aria-label={`Remove row ${i + 1}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setDraft([...draft, blank()])}>{addLabel}</Button>
        {dirty && (
          <>
            <Button size="sm" variant="primary" onClick={() => onChange(draft)}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(rows)}>Discard</Button>
          </>
        )}
      </div>
    </div>
  );
}

function ProgramTable({ rows, onChange }: { rows: ProgramComparisonRow[]; onChange(r: ProgramComparisonRow[]): void }) {
  return (
    <>
      <p className="mb-3 text-xs text-subtle">Compare original, approved and proposed programs. Separate the proposed 150-bed addition from unrelated changes. Enter values as recorded in source documents.</p>
      <EditableTable
        rows={rows}
        onChange={onChange}
        addLabel="Add program component"
        empty="No program components recorded."
        blank={() => ({ id: newId('pc'), component: '', original: '', approved: '', proposed: '', note: '' })}
        columns={[
          { key: 'component', label: 'Component', wide: true },
          { key: 'original', label: 'Original' },
          { key: 'approved', label: 'Approved' },
          { key: 'proposed', label: 'Proposed' },
          { key: 'note', label: 'Note', wide: true },
        ]}
      />
    </>
  );
}

function ChangeLog({ rows, onChange }: { rows: ChangeLogEntry[]; onChange(r: ChangeLogEntry[]): void }) {
  return (
    <>
      <p className="mb-3 text-xs text-subtle">Record scope and cost changes, their drivers and approvals — the basis for client change control.</p>
      <EditableTable
        rows={rows}
        onChange={onChange}
        addLabel="Add change"
        empty="No changes logged."
        blank={() => ({ id: newId('chg'), date: new Date().toISOString().slice(0, 10), change: '', driver: '', costImpact: '', approvedBy: '', status: 'proposed' as const })}
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'change', label: 'Change', wide: true },
          { key: 'driver', label: 'Cost driver' },
          { key: 'costImpact', label: 'Cost impact' },
          { key: 'approvedBy', label: 'Approved by' },
          { key: 'status', label: 'Status', options: ['proposed', 'approved', 'rejected'] },
        ]}
      />
    </>
  );
}

function SummaryEditor({ value, onSave }: { value: string; onSave(v: string): void }) {
  const [v, setV] = useState(value);
  return (
    <div className="flex flex-col gap-3">
      <TextArea label="Leadership summary" rows={8} value={v} onChange={setV} hint="Internal only. A concise briefing for BSA leadership: where the restart stands, key decisions and risks." />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={v === value} onClick={() => onSave(v)}>Save summary</Button>
        {v !== value && <Button size="sm" variant="ghost" onClick={() => setV(value)}>Discard</Button>}
      </div>
    </div>
  );
}
