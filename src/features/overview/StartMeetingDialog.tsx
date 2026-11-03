import { CalendarPlus, Clock, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { startMeeting } from '@/data/meetingMutations';
import { agendaMinutes, meetingTime } from '@/data/meetingSelectors';
import { active, type ClientWorkspace } from '@/data/repository';
import { formatDateTime } from '@/lib/format';
import { run } from '@/state/actions';

/** Start Meeting: resume a running meeting, start a scheduled one, or plan a new one from a template. */
export function StartMeetingDialog({ open, onClose, ws }: { open: boolean; onClose(): void; ws: ClientWorkspace }) {
  const navigate = useNavigate();
  const meetings = active(ws.meetings);
  const running = meetings.filter((m) => m.status === 'in_progress');
  const scheduled = meetings.filter((m) => m.status === 'scheduled').sort((a, b) => meetingTime(a).localeCompare(meetingTime(b)));
  const templates = active(ws.meetingTemplates);
  const go = (path: string) => (onClose(), navigate(path));
  const base = `/c/${ws.client.id}/meetings`;

  return (
    <Dialog open={open} onClose={onClose} title="Start Meeting" description={ws.client.name} size="md">
      <div className="flex flex-col gap-5">
        {running.length > 0 && (
          <section>
            <p className="eyebrow mb-2 text-ink">In progress</p>
            <ul className="flex flex-col gap-2">
              {running.map((m) => (
                <li key={m.id}><Button variant="primary" className="w-full justify-start" icon={<Play size={16} />} onClick={() => go(`${base}/${m.id}/run`)}>Resume “{m.title}”</Button></li>
              ))}
            </ul>
          </section>
        )}
        {scheduled.length > 0 && (
          <section>
            <p className="eyebrow mb-2 text-ink">Scheduled</p>
            <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
              {scheduled.slice(0, 4).map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{m.title}</span>
                    <span className="flex items-center gap-1 text-xs text-subtle"><Clock size={12} aria-hidden />{m.startsAt ? formatDateTime(m.startsAt) : 'Time TBC'} · {agendaMinutes(m.agenda)} min</span>
                  </span>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Play size={14} />}
                    onClick={() => {
                      const r = run((d) => startMeeting(d, m.id), { clientId: ws.client.id, entity: 'meeting', entityId: m.id, summary: `Started meeting "${m.title}"` }, false);
                      if (r.ok) go(`${base}/${m.id}/run`);
                    }}
                  >
                    Start
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <p className="eyebrow mb-2 text-ink">Plan a new meeting</p>
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <li key={t.id}>
                <Button className="w-full justify-start" icon={<CalendarPlus size={16} />} onClick={() => go(`${base}?new=1&template=${t.id}`)}>
                  {t.name} · {agendaMinutes(t.agenda)} min
                </Button>
              </li>
            ))}
            <li><Button variant="ghost" className="w-full justify-start" icon={<CalendarPlus size={16} />} onClick={() => go(`${base}?new=1&template=none`)}>Blank agenda</Button></li>
          </ul>
        </section>
      </div>
    </Dialog>
  );
}
