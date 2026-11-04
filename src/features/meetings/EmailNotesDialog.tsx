import { useMemo, useState } from 'react';
import { Copy, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { audienceFor, buildMeetingEmail, isBsaPerson, mailtoUrl } from '@/data/meetingEmail';
import type { ClientWorkspace } from '@/data/repository';
import type { Meeting } from '@/domain/types';
import { toast } from '@/state/toast';

/**
 * Drafts the meeting notes as an email in the user's own email app. The app sends nothing itself.
 * Content is client-safe automatically whenever a non-BSA recipient is selected.
 */
export function EmailNotesDialog({ ws, m, onClose }: { ws: ClientWorkspace; m: Meeting; onClose(): void }) {
  const [selected, setSelected] = useState<string[]>(m.attendeeIds);
  const people = m.attendeeIds.map((id) => ({ id, p: ws.people.find((x) => x.id === id) }));
  const audience = audienceFor(ws, selected);
  const email = useMemo(() => buildMeetingEmail(ws, m, audience), [ws, m, audience]);
  const to = selected.map((id) => ws.people.find((p) => p.id === id)?.email?.trim()).filter((e): e is string => !!e);
  const missing = selected.map((id) => ws.people.find((p) => p.id === id)).filter((p) => p && !p.email?.trim()).map((p) => p!.fullName);
  const externals = selected.map((id) => ws.people.find((p) => p.id === id)).filter((p) => p && !isBsaPerson(p)).map((p) => p!.fullName);
  const nothingShared = audience === 'client' && email.shared === 0;

  const copy = async (quiet = false) => {
    try {
      await navigator.clipboard.writeText(`${email.subject}\n\n${email.body}`);
      if (!quiet) toast('Meeting notes copied.');
      return true;
    } catch {
      toast('Could not copy automatically. Select the text in the preview and copy it.', 'error');
      return false;
    }
  };
  const open = async () => {
    const { url, truncated } = mailtoUrl(to, email.subject, email.body);
    if (truncated && !(await copy(true))) return;
    if (truncated) toast('The notes are long, so they were copied. Paste them into the email.');
    window.location.href = url;
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Email meeting notes"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button icon={<Copy size={16} aria-hidden />} onClick={() => void copy()}>Copy notes</Button>
          <Button variant="primary" icon={<Mail size={16} aria-hidden />} disabled={!selected.length} onClick={() => void open()}>Open in email app</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 text-sm">
        <fieldset>
          <legend className="mb-2 font-bold">Recipients</legend>
          {people.length === 0 ? (
            <p className="text-subtle">No attendees recorded for this meeting. You can still copy the notes.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {people.map(({ id, p }) => (
                <li key={id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 hover:border-line-strong">
                    <input type="checkbox" checked={selected.includes(id)} onChange={(e) => setSelected(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))} className="size-4 accent-[var(--brand)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{p?.fullName ?? 'Unknown person'}{p && !isBsaPerson(p) && <span className="ml-1.5 text-xs font-normal text-subtle">({p.affiliation === 'client' ? 'client' : 'external'})</span>}</span>
                      <span className="block truncate text-xs text-subtle">{p?.email?.trim() || 'No email recorded'}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && <p className="mt-2 text-xs text-subtle">No email address for {missing.join(', ')}. Add it in Leadership → People, or type it in your email app.</p>}
        </fieldset>

        {audience === 'internal' ? (
          <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span>All recipients are BSA, so the full internal record is included: summary, topic notes, decisions, actions, issues and next topics.</span>
          </p>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-caution/40 bg-caution-soft p-3 text-ink">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <span>
              <strong>Client-safe version.</strong> {externals.join(', ')} {externals.length === 1 ? 'is' : 'are'} not BSA, so only decisions and actions marked <em>Approved for Client Release</em> are included. Notes, summary, issues and internal items are left out{email.withheld ? ` (${email.withheld} item${email.withheld === 1 ? '' : 's'} withheld)` : ''}. Deselect non-BSA recipients to send the full internal notes.
              {nothingShared && <span className="mt-1 block">Nothing from this meeting is approved for client release yet. Open the actions or decisions and set their confidentiality to include them.</span>}
            </span>
          </div>
        )}

        <div>
          <p className="mb-1 font-bold">Preview</p>
          <p className="mb-2 text-xs text-subtle">Subject: {email.subject}</p>
          <textarea readOnly value={email.body} rows={12} aria-label="Email preview" className="w-full resize-y rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed text-muted outline-none focus:border-accent" />
        </div>
        <p className="text-xs text-subtle">The app doesn't send email. “Open in email app” starts a draft in your own mail app, so you can review it before sending.</p>
      </div>
    </Dialog>
  );
}
