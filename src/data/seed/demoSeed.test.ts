import { describe, expect, it } from 'vitest';
import { createDemoSeed } from './demoSeed';
import type { Dataset } from '@/domain/types';

const collections: (keyof Dataset)[] = ['clients', 'people', 'memberships', 'seats', 'projects', 'workstreams', 'initiatives', 'actions', 'decisions', 'risks', 'milestones', 'meetingTemplates', 'meetings', 'reports'];

describe('demo seed integrity', () => {
  const data = createDemoSeed();

  it('has globally unique IDs', () => {
    const ids = collections.flatMap((k) => (data[k] as { id: string }[]).map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only existing clients, people, workstreams and initiatives', () => {
    const clientIds = new Set(data.clients.map((c) => c.id));
    const personIds = new Set(data.people.map((p) => p.id));
    const wsIds = new Set(data.workstreams.map((w) => w.id));
    const initIds = new Set(data.initiatives.map((i) => i.id));
    const memberIds = new Set(data.memberships.map((m) => m.id));
    for (const k of collections) {
      for (const r of data[k] as { clientId?: string | null }[]) {
        if (r.clientId) expect(clientIds.has(r.clientId)).toBe(true);
      }
    }
    data.memberships.forEach((m) => expect(personIds.has(m.personId)).toBe(true));
    data.seats.forEach((s) => s.membershipId && expect(memberIds.has(s.membershipId)).toBe(true));
    data.initiatives.forEach((i) => i.workstreamId && expect(wsIds.has(i.workstreamId)).toBe(true));
    data.actions.forEach((a) => {
      if (a.workstreamId) expect(wsIds.has(a.workstreamId)).toBe(true);
      if (a.initiativeId) expect(initIds.has(a.initiativeId)).toBe(true);
    });
  });

  it('ships only fictional, clearly flagged projects', () => {
    expect(data.projects.length).toBeGreaterThan(0);
    for (const p of data.projects) {
      expect(p.isSample).toBe(true);
      expect(p.projectNumber).toMatch(/^DEMO-\d{3}$/);
      expect(p.provenance).toBeNull();
    }
  });

  it('never assigns calendar labels to revenue periods', () => {
    for (const p of data.projects) {
      const proj = p.businessDevelopment.revenueProjection;
      if (!proj) continue;
      expect(proj.calendarMapping).toBe('unresolved');
      expect(proj.periods.every((x) => x.label === null)).toBe(true);
    }
  });

  it('keeps unconfirmed leadership seats unassigned', () => {
    const filled = data.seats.filter((s) => s.membershipId);
    expect(filled).toHaveLength(1);
    expect(data.memberships.find((m) => m.id === filled[0].membershipId)?.personId).toBe('person_craig_puccetti');
  });

  it('does not create approved decisions', () => {
    expect(data.decisions.some((d) => d.status === 'approved')).toBe(false);
  });

  it('returns an independent copy each time', () => {
    const a = createDemoSeed();
    a.clients[0].name = 'changed';
    expect(createDemoSeed().clients[0].name).not.toBe('changed');
  });
});
