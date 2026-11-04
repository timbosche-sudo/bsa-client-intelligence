import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { deleteMeeting, meetingDeletionImpact } from '@/data/meetingMutations';
import type { ClientWorkspace } from '@/data/repository';
import type { Meeting } from '@/domain/types';
import { run } from '@/state/actions';
import { useDataStore } from '@/state/store';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Permanent meeting deletion, including held or finalized meetings (for example practice runs).
 * Offers to remove the items captured in the meeting too, and explains what is always kept.
 */
export function DeleteMeetingDialog({ ws, m, open, onClose, onDeleted }: { ws: ClientWorkspace; m: Meeting; open: boolean; onClose(): void; onDeleted(): void }) {
  const data = useDataStore((s) => s.data)!;
  const impact = meetingDeletionImpact(data, m.id);
  const captured = impact.actions + impact.decisions + impact.issues;
  const [removeCaptured, setRemoveCaptured] = useState(true);
  const [ack, setAck] = useState(false);
  const needsAck = impact.held;

  const confirm = () => {
    const r = run((d) => deleteMeeting(d, m.id, { removeCaptured: captured > 0 && removeCaptured }), {
      clientId: ws.client.id,
      entity: 'meeting',
      entityId: null,
      summary: `Deleted meeting "${m.title}"${captured ? (removeCaptured ? ' and the items captured in it' : ' (captured items kept)') : ''}`,
    });
    if (r.ok) onDeleted();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete “${m.title}”?`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon={<Trash2 size={16} aria-hidden />} disabled={needsAck && !ack} onClick={confirm}>Delete permanently</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm text-muted">
        <p>
          This permanently removes the meeting{impact.held ? ', its notes' : ''}{impact.finalized ? ' and its finalized record' : ''} from this browser. It cannot be undone; export a backup first if you might need it.
        </p>
        {captured > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-bold text-ink">
              Items captured in this meeting: {[impact.actions && plural(impact.actions, 'action'), impact.decisions && plural(impact.decisions, 'decision'), impact.issues && plural(impact.issues, 'issue')].filter(Boolean).join(', ')}
            </legend>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-line-strong">
              <input type="radio" name="captured" checked={removeCaptured} onChange={() => setRemoveCaptured(true)} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span>
                <span className="block font-bold text-ink">Delete them too</span>
                Best for practice or mock meetings.
                {impact.approvedDecisions > 0 && ` ${plural(impact.approvedDecisions, 'approved decision')} will be archived instead, because approved decisions are never deleted.`}
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-line-strong">
              <input type="radio" name="captured" checked={!removeCaptured} onChange={() => setRemoveCaptured(false)} className="mt-0.5 size-4 accent-[var(--brand)]" />
              <span>
                <span className="block font-bold text-ink">Keep them</span>
                They stay in Actions &amp; Decisions, no longer linked to a meeting.
              </span>
            </label>
          </fieldset>
        )}
        {impact.reports > 0 && <p>{plural(impact.reports, 'report')} generated from this meeting will be kept as already written.</p>}
        {needsAck && (
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-5 accent-[var(--brand)]" />
            <span className="text-ink">I understand this meeting {impact.finalized ? 'record ' : ''}will be permanently deleted.</span>
          </label>
        )}
      </div>
    </Dialog>
  );
}
