import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import { getWorkspace } from './repository';
import { IntegrityError } from './mutations';
import { blankAction, blankDecision, blankRisk, deleteAction, deleteRisk, setActionStatus, upsertAction, upsertDecision, upsertRisk } from './strategyMutations';
import {
  blankMeeting,
  cancelMeeting,
  deleteMeeting,
  meetingDeletionImpact,
  endMeeting,
  finalizeMeeting,
  goToAgendaItem,
  setAgendaItemStatus,
  setMeetingNotes,
  startAmendment,
  startMeeting,
  templateFromMeeting,
  upsertMeeting,
  upsertMeetingTemplate,
} from './meetingMutations';
import { agendaMinutes, carryover, changesSince, meetingCaptures, previousMeeting, suggestNextTopics } from './meetingSelectors';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const CRAIG = 'person_craig_puccetti';

function kickoff(d = createDemoSeed()) {
  const t = d.meetingTemplates.find((x) => x.id === 'template_hm_kickoff')!;
  const m = { ...blankMeeting(HM, t), startsAt: '2026-11-10T15:00:00.000Z', facilitatorId: CRAIG, attendeeIds: [CRAIG] };
  upsertMeeting(d, m);
  return { d, m: d.meetings.find((x) => x.id === m.id)! };
}

describe('meeting creation', () => {
  it('copies the template agenda with fresh ids and editable durations', () => {
    const { d, m } = kickoff();
    const t = d.meetingTemplates[0];
    expect(m.agenda.map((a) => a.title)).toEqual(t.agenda.map((a) => a.title));
    expect(m.agenda.some((a) => t.agenda.some((x) => x.id === a.id))).toBe(false);
    expect(agendaMinutes(m.agenda)).toBe(60);
    expect(m.objectives.length).toBe(4);
    upsertMeeting(d, { ...m, agenda: m.agenda.map((a, i) => (i === 0 ? { ...a, minutes: 10 } : a)) });
    expect(agendaMinutes(d.meetings[0].agenda)).toBe(65);
  });
  it('validates title and agenda', () => {
    const d = createDemoSeed();
    expect(() => upsertMeeting(d, blankMeeting(HM))).toThrow(/title/);
    expect(() => upsertMeeting(d, { ...blankMeeting(HM), title: 'X', agenda: [{ id: 'a', title: '', minutes: 5, purpose: '', prompts: [] }] })).toThrow(/agenda item/);
  });
});

describe('facilitation lifecycle', () => {
  it('captures carryover, navigates freely, and keeps notes per item', () => {
    const { d, m } = kickoff();
    startMeeting(d, m.id);
    let cur = d.meetings[0];
    expect(cur.status).toBe('in_progress');
    expect(cur.carryoverActionIds).toHaveLength(5);
    expect(cur.currentAgendaItemId).toBe(cur.agenda[0].id);
    goToAgendaItem(d, m.id, cur.agenda[3].id, 'discussed');
    goToAgendaItem(d, m.id, cur.agenda[1].id);
    setMeetingNotes(d, m.id, cur.agenda[1].id, 'Restart timing discussed');
    setMeetingNotes(d, m.id, null, 'General note');
    setAgendaItemStatus(d, m.id, cur.agenda[2].id, 'skipped');
    cur = d.meetings[0];
    expect(cur.agendaState[cur.agenda[0].id].status).toBe('discussed');
    expect(cur.currentAgendaItemId).toBe(cur.agenda[1].id);
    expect(cur.notes[cur.agenda[1].id]).toBe('Restart timing discussed');
    expect(cur.generalNotes).toBe('General note');
    endMeeting(d, m.id);
    cur = d.meetings[0];
    expect(cur.status).toBe('closeout');
    expect(cur.agendaState[cur.agenda[1].id].status).toBe('discussed');
  });

  it('finalizes only with explicit approval and freezes a snapshot', () => {
    const { d, m } = kickoff();
    startMeeting(d, m.id);
    upsertAction(d, { ...blankAction(HM), title: 'Confirm sponsor', ownerId: CRAIG, meetingId: m.id });
    upsertDecision(d, { ...blankDecision(HM), title: 'Monthly cadence', meetingId: m.id });
    upsertRisk(d, { ...blankRisk(HM), title: 'Staffing gap', kind: 'issue', meetingId: m.id });
    expect(() => finalizeMeeting(d, m.id, { approvedBy: 'Craig', acknowledged: true })).toThrow(/End the meeting/);
    endMeeting(d, m.id);
    expect(() => finalizeMeeting(d, m.id, { approvedBy: 'Craig', acknowledged: false })).toThrow(/reviewed/);
    expect(() => finalizeMeeting(d, m.id, { approvedBy: ' ', acknowledged: true })).toThrow(/who/);
    finalizeMeeting(d, m.id, { approvedBy: 'Craig Puccetti', acknowledged: true });
    const f = d.meetings[0];
    expect(f.status).toBe('finalized');
    expect(f.record!.actions).toEqual([expect.objectContaining({ title: 'Confirm sponsor', owner: 'Craig Puccetti' })]);
    expect(f.record!.decisions[0]).toMatchObject({ title: 'Monthly cadence', status: 'proposed' });
    expect(f.record!.issues[0].title).toBe('Staffing gap');
    expect(f.record!.carriedOver).toHaveLength(5);

    // Snapshot is immutable; live records can change.
    const actionId = f.record!.actions[0].id;
    setActionStatus(d, actionId, 'complete');
    expect(d.meetings[0].record!.actions[0].status).toBe('not_started');

    // Finalized meetings are locked; captured items can't be deleted.
    expect(() => setMeetingNotes(d, m.id, null, 'edit')).toThrow(IntegrityError);
    expect(() => upsertMeeting(d, { ...f, title: 'Changed' })).toThrow(/amendment/);
    expect(() => deleteAction(d, actionId)).toThrow(/meeting/);
    expect(() => deleteRisk(d, f.record!.issues[0].id)).toThrow(/meeting/);
    expect(() => cancelMeeting(d, m.id)).toThrow(IntegrityError);
  });

  it('amends through a recorded, re-finalized process', () => {
    const { d, m } = kickoff();
    startMeeting(d, m.id);
    endMeeting(d, m.id);
    finalizeMeeting(d, m.id, { approvedBy: 'Craig Puccetti', acknowledged: true });
    expect(() => startAmendment(d, m.id, { reason: '', requestedBy: 'Craig' })).toThrow();
    startAmendment(d, m.id, { reason: 'Correct attendee list', requestedBy: 'Craig Puccetti' });
    expect(d.meetings[0].status).toBe('closeout');
    expect(d.meetings[0].amendments[0].completedAt).toBeNull();
    setMeetingNotes(d, m.id, null, 'Corrected');
    finalizeMeeting(d, m.id, { approvedBy: 'Craig Puccetti', acknowledged: true });
    const f = d.meetings[0];
    expect(f.record!.generalNotes).toBe('Corrected');
    expect(f.amendments[0].completedAt).not.toBeNull();
  });

  it('deletes a never-held meeting', () => {
    const { d, m } = kickoff();
    deleteMeeting(d, m.id);
    expect(d.meetings).toHaveLength(0);
  });

  const heldWithCaptures = () => {
    const { d, m } = kickoff();
    startMeeting(d, m.id);
    upsertAction(d, { ...blankAction(HM), id: 'a_mock', title: 'Mock action', meetingId: m.id });
    upsertDecision(d, { ...blankDecision(HM), id: 'dec_mock', title: 'Mock decision', meetingId: m.id });
    upsertRisk(d, { ...blankRisk(HM), id: 'risk_mock', title: 'Mock issue', kind: 'issue', meetingId: m.id });
    endMeeting(d, m.id);
    finalizeMeeting(d, m.id, { approvedBy: 'Craig Puccetti', acknowledged: true });
    const approved = d.decisions.find((x) => x.id === 'dec_mock')!;
    Object.assign(approved, { status: 'approved', approval: { approvedById: CRAIG, approvedAt: '2026-11-10T16:00:00.000Z', note: '' } });
    upsertDecision(d, { ...blankDecision(HM), id: 'dec_mock2', title: 'Mock proposal', meetingId: m.id });
    const later = { ...blankMeeting(HM), title: 'Later', carryoverActionIds: ['a_mock'] };
    d.meetings.push(later);
    return { d, m };
  };

  it('deletes a finalized meeting and, on request, the items captured in it', () => {
    const { d, m } = heldWithCaptures();
    expect(meetingDeletionImpact(d, m.id)).toMatchObject({ held: true, finalized: true, actions: 1, decisions: 2, approvedDecisions: 1, issues: 1 });
    deleteMeeting(d, m.id, { removeCaptured: true });
    expect(d.meetings.map((x) => x.title)).toEqual(['Later']);
    expect(d.meetings[0].carryoverActionIds).toEqual([]);
    expect(d.actions.some((a) => a.id === 'a_mock')).toBe(false);
    expect(d.risks.some((r) => r.id === 'risk_mock')).toBe(false);
    expect(d.decisions.some((x) => x.id === 'dec_mock2')).toBe(false);
    // Approved decisions are never deleted: kept, unlinked and archived.
    expect(d.decisions.find((x) => x.id === 'dec_mock')).toMatchObject({ meetingId: null, archivedAt: expect.any(String) });
  });

  it('can delete a held meeting but keep its captured items, unlinked', () => {
    const { d, m } = heldWithCaptures();
    deleteMeeting(d, m.id, { removeCaptured: false });
    expect(d.actions.find((a) => a.id === 'a_mock')!.meetingId).toBeNull();
    expect(d.risks.find((r) => r.id === 'risk_mock')!.meetingId).toBeNull();
    expect(d.decisions.filter((x) => x.id.startsWith('dec_mock')).every((x) => x.meetingId === null && !x.archivedAt)).toBe(true);
  });
});

describe('continuity', () => {
  it('finds the previous finalized meeting and changes since', () => {
    const { d, m } = kickoff();
    startMeeting(d, m.id);
    endMeeting(d, m.id);
    finalizeMeeting(d, m.id, { approvedBy: 'Craig', acknowledged: true });
    const since = d.meetings[0].finalizedAt!;
    const second = { ...blankMeeting(HM, d.meetingTemplates[0]), title: 'Client Team #2', startsAt: '2099-01-01T15:00:00.000Z' };
    upsertMeeting(d, second);
    setActionStatus(d, 'action_hm_2', 'complete');
    upsertAction(d, { ...blankAction(HM), title: 'New between meetings' });
    const ws = getWorkspace(d, HM);
    const s2 = ws.meetings.find((x) => x.id === second.id)!;
    expect(previousMeeting(ws, s2)?.id).toBe(m.id);
    const ch = changesSince(ws, since, '2099-12-31T00:00:00.000Z', s2.id);
    expect(ch.completedActions.map((a) => a.id)).toContain('action_hm_2');
    expect(ch.newActions.map((a) => a.title)).toContain('New between meetings');
  });

  it('suggests next topics with reasons from recorded facts only', () => {
    const { d, m } = kickoff();
    startMeeting(d, m.id);
    upsertDecision(d, { ...blankDecision(HM), title: 'Escalation path', meetingId: m.id });
    const cur = d.meetings[0];
    setAgendaItemStatus(d, m.id, cur.agenda[2].id, 'skipped');
    const ws = getWorkspace(d, HM);
    const topics = suggestNextTopics(ws, ws.meetings[0], '2026-11-10').map((s) => s.topic);
    expect(topics).toContain('Revisit: What Needs Attention');
    expect(topics).toContain('Decide: Escalation path');
    expect(topics).toContain('Assign owners to 5 actions');
    expect(meetingCaptures(ws, m.id).proposedDecisions).toHaveLength(1);
    expect(carryover(ws, ws.meetings[0])).toHaveLength(5);
  });
});

describe('templates', () => {
  it('saves an edited agenda as a reusable template', () => {
    const { d, m } = kickoff();
    const t = templateFromMeeting(m, 'Monthly Client Team');
    upsertMeetingTemplate(d, t);
    expect(d.meetingTemplates.find((x) => x.id === t.id)!.agenda).toHaveLength(6);
    expect(t.agenda[0].id).not.toBe(m.agenda[0].id);
    expect(() => upsertMeetingTemplate(d, { ...t, agenda: [] })).toThrow(/agenda item/);
  });
});
