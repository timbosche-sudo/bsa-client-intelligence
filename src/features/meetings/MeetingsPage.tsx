import { CalendarClock, Clock } from 'lucide-react';
import { Card, Panel } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageNotice } from '@/components/ui/StageNotice';
import { active } from '@/data/repository';
import { formatDateTime } from '@/lib/format';
import { useRequiredWorkspace } from '@/state/useWorkspace';

export function MeetingsPage() {
  const ws = useRequiredWorkspace();
  const meetings = active(ws.meetings).sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Meetings" description="Guided Client Team meetings with continuity from one meeting to the next." />
      <StageNotice stage={4} className="mb-6">
        Meeting creation, guided Meeting Mode, live notes, quick actions and decisions, closeout with explicit finalization, and meeting history with action carryover.
      </StageNotice>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="flex flex-col gap-4 xl:col-span-3">
          {ws.meetingTemplates.length === 0 ? (
            <Card><EmptyState title="No meeting templates for this client" /></Card>
          ) : (
            ws.meetingTemplates.map((t) => (
              <Panel key={t.id} eyebrow="Template" title={t.name} icon={<CalendarClock size={18} />}>
                <p className="mb-4 text-sm text-muted">{t.description}</p>
                <ol className="flex flex-col divide-y divide-line">
                  {t.agenda.map((a, i) => (
                    <li key={a.id} className="flex gap-4 py-3">
                      <span className="tabular w-6 pt-0.5 text-xs font-semibold text-accent">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="mt-0.5 text-sm text-muted">{a.purpose}</p>
                      </div>
                      <span className="tabular flex shrink-0 items-center gap-1 text-xs text-subtle"><Clock size={12} aria-hidden />{a.minutes} min</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 border-t border-line pt-3 text-right text-xs text-subtle">Total {t.agenda.reduce((s, a) => s + a.minutes, 0)} minutes</p>
              </Panel>
            ))
          )}
        </div>
        <Panel className="xl:col-span-2" title="Meeting history" icon={<Clock size={18} />}>
          {meetings.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {meetings.map((m) => (
                <li key={m.id} className="py-2.5 text-sm">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-subtle">{formatDateTime(m.startsAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No meetings recorded yet" />
          )}
        </Panel>
      </div>
    </>
  );
}
