import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import { getWorkspace } from './repository';
import { blankMeeting, endMeeting, finalizeMeeting, setMeetingAttendees, setMeetingNotes, startMeeting, updateCloseout, upsertMeeting } from './meetingMutations';
import { blankAction, blankDecision, blankRisk, upsertAction, upsertDecision, upsertRisk } from './strategyMutations';
import { audienceFor, buildMeetingEmail, mailtoUrl } from './meetingEmail';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const CRAIG = 'person_craig_puccetti';

function finalized() {
  const d = createDemoSeed();
  d.people.push({ ...structuredClone(d.people[0]), id: 'person_client', fullName: 'Client Person', affiliation: 'client', homeClientId: HM, email: 'client@example.com' });
  const t = d.meetingTemplates.find((x) => x.id === 'template_hm_kickoff')!;
  const m = { ...blankMeeting(HM, t), startsAt: '2026-11-10T15:00:00.000Z', facilitatorId: CRAIG, attendeeIds: [CRAIG] };
  upsertMeeting(d, m);
  startMeeting(d, m.id);
  setMeetingAttendees(d, m.id, [CRAIG, 'person_client', CRAIG]);
  setMeetingNotes(d, m.id, m.agenda[0].id, 'Internal discussion about staffing concerns');
  upsertAction(d, { ...blankAction(HM), id: 'a_internal', title: 'Internal follow-up', ownerId: CRAIG, meetingId: m.id });
  upsertAction(d, { ...blankAction(HM), id: 'a_shared', title: 'Share restart schedule', ownerId: CRAIG, meetingId: m.id, confidentiality: 'approved' });
  upsertDecision(d, { ...blankDecision(HM), id: 'd_shared', title: 'Monthly cadence', meetingId: m.id, confidentiality: 'approved', status: 'approved', approval: { approvedById: CRAIG, approvedAt: '2026-11-10T16:00:00.000Z', note: '' } });
  upsertRisk(d, { ...blankRisk(HM), title: 'Staffing gap', kind: 'issue', meetingId: m.id });
  endMeeting(d, m.id);
  updateCloseout(d, m.id, { summary: 'Internal summary text', nextMeetingTopics: ['Budget'] });
  finalizeMeeting(d, m.id, { approvedBy: 'Craig Puccetti', acknowledged: true });
  return { ws: getWorkspace(d, HM)!, m: getWorkspace(d, HM)!.meetings[0] };
}

describe('meeting notes email', () => {
  it('records attendees added during the meeting, without duplicates', () => {
    const { m } = finalized();
    expect(m.attendeeIds).toEqual([CRAIG, 'person_client']);
    expect(m.record!.attendees).toContain('Client Person');
  });

  it('uses the internal version only when every recipient is BSA', () => {
    const { ws } = finalized();
    expect(audienceFor(ws, [CRAIG])).toBe('internal');
    expect(audienceFor(ws, [CRAIG, 'person_client'])).toBe('client');
  });

  it('includes the full record for internal recipients', () => {
    const { ws, m } = finalized();
    const e = buildMeetingEmail(ws, m, 'internal');
    expect(e.subject).toMatch(/^\[Internal\]/);
    for (const s of ['Internal summary text', 'Internal discussion about staffing concerns', 'Internal follow-up', 'Share restart schedule', 'Monthly cadence', 'Staffing gap', 'Budget', 'INTERNAL']) expect(e.body).toContain(s);
  });

  it('never puts internal content in the client version', () => {
    const { ws, m } = finalized();
    const e = buildMeetingEmail(ws, m, 'client');
    expect(e.body).toContain('Share restart schedule');
    expect(e.body).toContain('Monthly cadence');
    for (const s of ['Internal summary text', 'staffing concerns', 'Internal follow-up', 'Staffing gap', 'Budget', 'INTERNAL']) expect(e.body).not.toContain(s);
    expect(e.withheld).toBe(2); // internal action + issue
  });

  it('falls back to the clipboard for very long emails', () => {
    expect(mailtoUrl(['a@b.c'], 'S', 'short').truncated).toBe(false);
    const long = mailtoUrl(['a@b.c'], 'S', 'x'.repeat(9000));
    expect(long.truncated).toBe(true);
    expect(long.url.length).toBeLessThan(7000);
  });
});
