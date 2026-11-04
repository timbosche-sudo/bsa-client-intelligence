/**
 * Plain-text meeting notes for email, built from a finalized meeting record.
 *
 * Two audiences:
 * - internal: the full record (summary, topic notes, decisions, actions, issues, next topics) for BSA recipients only.
 * - client:   used whenever any recipient is not BSA. Contains only decisions and actions explicitly marked
 *             "Approved for Client Release". Notes, summary, discussion, issues and internal items are never included.
 *
 * Nothing is sent by the app: the text opens in the user's own email app (mailto) or is copied to the clipboard.
 */
import { ACTION_STATUS_LABELS, DECISION_STATUS_LABELS } from '@/domain/labels';
import type { ID, Meeting, Person } from '@/domain/types';
import { formatDate, formatDateTime } from '@/lib/format';
import type { ClientWorkspace } from './repository';

export type EmailAudience = 'internal' | 'client';

export interface MeetingEmail {
  audience: EmailAudience;
  subject: string;
  body: string;
  /** Items left out of a client email because they are not approved for client release. */
  withheld: number;
  /** Decisions and actions included (client version). */
  shared: number;
}

const AGENDA_STATUS: Record<string, string> = { discussed: 'Discussed', skipped: 'Skipped', pending: 'Not reached' };

export function isBsaPerson(p: Pick<Person, 'affiliation'> | undefined): boolean {
  return p?.affiliation === 'bsa';
}

/** The audience is decided by the recipients, never chosen freely: any non-BSA recipient means client-safe content. */
export function audienceFor(ws: ClientWorkspace, recipientIds: ID[]): EmailAudience {
  return recipientIds.every((id) => isBsaPerson(ws.people.find((p) => p.id === id))) ? 'internal' : 'client';
}

export function buildMeetingEmail(ws: ClientWorkspace, m: Meeting, audience: EmailAudience): MeetingEmail {
  const rec = m.record;
  if (!rec) throw new Error('Only finalized meetings can be emailed.');
  const when = m.startsAt ? formatDateTime(m.startsAt) : formatDate(rec.finalizedAt);
  const lines: string[] = [m.title, `${when}${m.location ? ` · ${m.location}` : ''}`, `Attendees: ${rec.attendees.join(', ') || 'None recorded'}`];
  if (rec.facilitator) lines.push(`Facilitator: ${rec.facilitator}`);
  const section = (title: string, items: string[]) => {
    if (items.length) lines.push('', title.toUpperCase(), ...items);
  };
  let withheld = 0;
  let shared = 0;

  if (audience === 'internal') {
    if (rec.summary.trim()) section('Summary', [rec.summary.trim()]);
    section(
      'Topics',
      rec.topics.map((t, i) => `${i + 1}. ${t.title} (${AGENDA_STATUS[t.status] ?? t.status})${t.notes.trim() ? `\n   ${t.notes.trim().replace(/\n/g, '\n   ')}` : ''}`),
    );
    if (rec.generalNotes.trim()) section('General notes', [rec.generalNotes.trim()]);
    section('Decisions', rec.decisions.map((x) => `- ${x.title} — ${DECISION_STATUS_LABELS[x.status as keyof typeof DECISION_STATUS_LABELS] ?? x.status}${x.approvedBy ? ` (approved by ${x.approvedBy})` : ''}`));
    section('Actions', rec.actions.map((a) => `- ${a.title} — ${a.owner ?? 'Owner to be confirmed'}${a.dueDate ? `, due ${formatDate(a.dueDate)}` : ''}`));
    section('Open issues', rec.issues.filter((r) => r.status !== 'closed').map((r) => `- ${r.title}`));
    section('Topics for the next meeting', rec.nextMeetingTopics.map((t) => `- ${t}`));
    lines.push('', 'INTERNAL — BSA Client Team use only. Not for distribution to the client.');
  } else {
    // Client-safe: only records whose live confidentiality is "approved" for client release.
    const approvedDecision = (id: ID) => ws.decisions.find((x) => x.id === id)?.confidentiality === 'approved';
    const approvedAction = (id: ID) => ws.actions.find((x) => x.id === id)?.confidentiality === 'approved';
    const decisions = rec.decisions.filter((x) => approvedDecision(x.id) && x.status === 'approved');
    const actions = rec.actions.filter((a) => approvedAction(a.id));
    shared = decisions.length + actions.length;
    withheld = rec.decisions.length - decisions.length + (rec.actions.length - actions.length) + rec.issues.length;
    section('Agreed decisions', decisions.map((x) => `- ${x.title}`));
    section('Actions', actions.map((a) => `- ${a.title} — ${a.owner ?? 'Owner to be confirmed'}${a.dueDate ? `, due ${formatDate(a.dueDate)}` : ''}${a.status !== 'not_started' ? ` (${ACTION_STATUS_LABELS[a.status as keyof typeof ACTION_STATUS_LABELS] ?? a.status})` : ''}`));
    lines.push('', 'Please reply with any corrections.');
  }
  lines.push('', `— Prepared from the meeting record finalized ${formatDate(rec.finalizedAt)}.`);
  return { audience, subject: `${audience === 'internal' ? '[Internal] ' : ''}Meeting notes: ${m.title} — ${formatDate(m.startsAt ?? rec.finalizedAt)}`, body: lines.join('\n'), withheld, shared };
}

/** mailto: URL. Very long bodies are replaced by a short note (the caller copies the full text to the clipboard). */
export function mailtoUrl(to: string[], subject: string, body: string, maxLength = 7000): { url: string; truncated: boolean } {
  const enc = encodeURIComponent;
  const make = (b: string) => `mailto:${to.map(enc).join(',')}?subject=${enc(subject)}&body=${enc(b)}`;
  const full = make(body);
  if (full.length <= maxLength) return { url: full, truncated: false };
  return { url: make('The meeting notes have been copied to your clipboard. Paste them here.\n'), truncated: true };
}
