import { useState } from 'react';
import { BookmarkPlus, ChevronRight, FilePlus2, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FormSection, ListField, SelectField, TextField } from '@/components/form/fields';
import { PeoplePicker } from '@/components/form/PeoplePicker';
import { blankMeeting, cancelMeeting, cloneAgenda, deleteMeeting, templateFromMeeting, upsertMeeting, upsertMeetingTemplate, validateMeeting } from '@/data/meetingMutations';
import { active, type ClientWorkspace } from '@/data/repository';
import type { Meeting } from '@/domain/types';
import { run } from '@/state/actions';
import { useStrategyOptions, withCurrent } from '@/features/strategy/options';
import { SheetFooter } from '@/features/strategy/SheetFooter';
import { AgendaEditor } from './AgendaEditor';
import { agendaMinutes } from '@/data/meetingSelectors';
import type { MeetingTemplate } from '@/domain/types';

/** Splits an ISO timestamp into local date and time inputs, and back. */
export function toLocalParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
export function fromLocalParts(date: string, time: string): string | null {
  if (!date) return null;
  const d = new Date(`${date}T${time || '09:00'}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Create or edit a meeting. A new meeting first asks whether to start from a template or a blank agenda,
 * unless the caller already chose (`templateId` set to a template id, or 'none' for blank).
 */
export function MeetingEditorSheet({ ws, meetingId, templateId, suggestedTemplateId, seed, onClose, onSaved }: { ws: ClientWorkspace; meetingId: string | null; templateId?: string | null; suggestedTemplateId?: string | null; seed?: Partial<Meeting>; onClose(): void; onSaved?(id: string): void }) {
  const existing = meetingId ? ws.meetings.find((m) => m.id === meetingId) ?? null : null;
  const templates = active(ws.meetingTemplates);
  const initialTemplate = templateId && templateId !== 'none' ? templates.find((t) => t.id === templateId) ?? null : null;
  const fromTemplate = (t: MeetingTemplate | null): Meeting => {
    const base = blankMeeting(ws.client.id, t);
    return { ...base, ...seed, objectives: seed?.objectives?.length ? seed.objectives : base.objectives, title: seed?.title || base.title };
  };
  const [m, setM] = useState<Meeting>(() => structuredClone(existing ?? fromTemplate(initialTemplate)));
  const [choosing, setChoosing] = useState(!existing && !templateId && templates.length > 0);
  const [parts, setParts] = useState(() => toLocalParts(m.startsAt));
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const o = useStrategyOptions(ws);
  const set = (patch: Partial<Meeting>) => (setM((x) => ({ ...x, ...patch })), setDirty(true));
  const isNew = !existing;
  const locked = existing?.status === 'finalized' || existing?.status === 'cancelled';

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return set({ templateId: null });
    const prevName = templates.find((x) => x.id === m.templateId)?.name;
    set({ templateId: t.id, agenda: cloneAgenda(t.agenda), objectives: [...t.objectives], title: !m.title || m.title === prevName ? t.name : m.title });
  };

  const save = () => {
    const next = { ...m, startsAt: fromLocalParts(parts.date, parts.time) };
    const problems = validateMeeting(next);
    if (problems.length) return setError(problems[0]);
    const r = run((d) => upsertMeeting(d, next), { clientId: ws.client.id, entity: 'meeting', entityId: next.id, summary: `${isNew ? 'Scheduled' : 'Updated'} meeting "${next.title.trim()}"` });
    if (r.ok) {
      onSaved?.(next.id);
      onClose();
    } else setError(r.error ?? '');
  };

  if (choosing) {
    const pick = (t: MeetingTemplate | null) => (setM(structuredClone(fromTemplate(t))), setChoosing(false));
    return (
      <Sheet open onClose={onClose} width="lg" title="New meeting" description="How would you like to build the agenda? You can edit every topic and duration afterwards." footer={<Button variant="ghost" onClick={onClose}>Cancel</Button>}>
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="eyebrow mb-3 flex items-center gap-1.5 text-ink"><LayoutTemplate size={13} aria-hidden /> Use a template</h3>
            <ul className="flex flex-col gap-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => pick(t)} className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-bold">
                        {t.name}
                        {t.id === suggestedTemplateId && <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted">Used last time</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-subtle">{t.agenda.length} topics · {agendaMinutes(t.agenda)} min</span>
                      <span className="mt-2 block text-sm text-muted">{t.agenda.map((a) => a.title).join(' · ')}</span>
                    </span>
                    <ChevronRight size={18} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="eyebrow mb-3 flex items-center gap-1.5 text-ink"><FilePlus2 size={13} aria-hidden /> Or start from scratch</h3>
            <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-line-strong p-4 text-left transition-colors hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">Blank agenda</span>
                <span className="mt-0.5 block text-sm text-muted">Add your own topics and durations.</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden />
            </button>
          </section>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      confirmClose={dirty}
      width="xl"
      title={isNew ? 'New meeting' : locked ? 'Meeting details' : 'Edit meeting'}
      description={locked ? 'This meeting is finalized or cancelled; details are read-only.' : 'All agenda durations and topics are editable.'}
      footer={
        locked ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <SheetFooter
            isNew={isNew}
            noun="meeting"
            error={error}
            onCancel={onClose}
            onSave={save}
            archived={false}
            archiveLabel="Cancel meeting"
            cancelLabel="Close"
            onArchiveToggle={
              existing && existing.status !== 'cancelled'
                ? () => {
                    if (!window.confirm('Cancel this meeting? It stays in the archive as cancelled.')) return;
                    const r = run((d) => cancelMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Cancelled meeting "${m.title}"` });
                    if (r.ok) onClose();
                  }
                : undefined
            }
            onDelete={
              existing?.status === 'scheduled'
                ? () => {
                    const r = run((d) => deleteMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: null, summary: `Deleted meeting "${m.title}"` });
                    if (r.ok) onClose();
                  }
                : undefined
            }
          />
        )
      }
    >
      <fieldset disabled={locked} className="flex flex-col gap-8">
        {isNew && templates.length > 0 && (
          <FormSection title="Template">
            <SelectField label="Start from template" value={m.templateId} onChange={applyTemplate} placeholder="Blank agenda" options={templates.map((t) => ({ value: t.id, label: t.name }))} className="sm:col-span-2" hint="Choosing a template replaces the agenda and objectives below. Everything stays editable." />
          </FormSection>
        )}
        <FormSection title="Meeting">
          <TextField label="Title" required value={m.title} onChange={(v) => set({ title: v })} className="sm:col-span-2" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Date" type="date" value={parts.date} onChange={(v) => (setParts((p) => ({ ...p, date: v })), setDirty(true))} />
            <TextField label="Time" type="time" value={parts.time} onChange={(v) => (setParts((p) => ({ ...p, time: v })), setDirty(true))} />
          </div>
          <TextField label="Location / link" value={m.location} onChange={(v) => set({ location: v })} placeholder="e.g. Austin studio, or Teams" />
          <SelectField label="Facilitator" value={m.facilitatorId} onChange={(v) => set({ facilitatorId: v || null })} placeholder="Not set" options={withCurrent(o.personOptions, m.facilitatorId, 'Inactive person')} />
          <PeoplePicker label="Attendees" people={o.people} value={m.attendeeIds} onChange={(v) => set({ attendeeIds: v })} />
          <ListField label="Meeting objectives" value={m.objectives} onChange={(v) => set({ objectives: v })} className="sm:col-span-2" />
        </FormSection>
        <FormSection title="Related workstreams">
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            {active(ws.workstreams)
              .sort((a, b) => a.order - b.order)
              .map((w) => (
                <label key={w.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 text-sm hover:border-line-strong">
                  <input type="checkbox" checked={m.workstreamIds.includes(w.id)} onChange={(e) => set({ workstreamIds: e.target.checked ? [...m.workstreamIds, w.id] : m.workstreamIds.filter((x) => x !== w.id) })} className="size-4 accent-[var(--accent)]" />
                  {w.order}. {w.title}
                </label>
              ))}
          </div>
        </FormSection>
        <div className="border-t border-line-strong pt-5">
          <AgendaEditor agenda={m.agenda} onChange={(agenda) => set({ agenda })} />
          {!locked && m.agenda.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              icon={<BookmarkPlus size={15} />}
              onClick={() => {
                const name = window.prompt('Template name', `${m.title || 'Meeting'} template`);
                if (!name?.trim()) return;
                run((d) => upsertMeetingTemplate(d, templateFromMeeting(m, name.trim())), { clientId: ws.client.id, entity: 'template', entityId: null, summary: `Saved agenda as template "${name.trim()}"` });
              }}
            >
              Save agenda as template
            </Button>
          )}
        </div>
      </fieldset>
    </Sheet>
  );
}
