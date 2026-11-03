import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { StageNotice } from '@/components/ui/StageNotice';
import type { ClientWorkspace } from '@/data/repository';

/** Stage 1: previews the meeting template. Live facilitation (Meeting Mode) is delivered in Stage 4. */
export function StartMeetingDialog({ open, onClose, ws }: { open: boolean; onClose(): void; ws: ClientWorkspace }) {
  const template = ws.meetingTemplates[0];
  const total = template?.agenda.reduce((s, a) => s + a.minutes, 0) ?? 0;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start Meeting"
      description={template ? `${template.name} · ${total} minutes` : undefined}
      size="md"
      footer={
        <Link to={`/c/${ws.client.id}/meetings`} onClick={onClose} className="inline-flex h-11 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm hover:border-line-strong">
          Open Meetings
        </Link>
      }
    >
      <StageNotice stage={4} className="mb-4">
        Guided Meeting Mode — live facilitation, notes, quick actions and closeout — is built in Stage 4. Review the agenda below to prepare.
      </StageNotice>
      {template ? (
        <ol className="flex flex-col divide-y divide-line">
          {template.agenda.map((a, i) => (
            <li key={a.id} className="flex gap-4 py-3">
              <span className="tabular w-6 pt-0.5 text-xs font-semibold text-accent">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-0.5 text-sm text-muted">{a.purpose}</p>
              </div>
              <span className="tabular flex shrink-0 items-center gap-1 text-xs text-subtle">
                <Clock size={12} aria-hidden /> {a.minutes} min
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState compact title="No meeting template for this client yet" />
      )}
    </Dialog>
  );
}
