import { describe, expect, it } from 'vitest';
import { createDemoSeed, DEMO_CLIENT_IDS } from './seed/demoSeed';
import {
  addMedia,
  addMembership,
  blankMilestone,
  blankPerson,
  blankProject,
  deletePerson,
  deleteProject,
  describeProjectChanges,
  findDuplicatePeople,
  findDuplicateProjects,
  IntegrityError,
  personKey,
  removeMedia,
  removeMembership,
  updateLeadershipTiers,
  updatePortfolioCategories,
  upsertMilestone,
  upsertPerson,
  upsertProject,
} from './mutations';
import type { MediaRecord } from '@/domain/types';

const HM = DEMO_CLIENT_IDS.houstonMethodist;
const media = (id: string, ownerType: 'person' | 'project', ownerId: string): MediaRecord => ({ id, createdAt: '', updatedAt: '', archivedAt: null, clientId: ownerType === 'project' ? HM : null, ownerType, ownerId, kind: ownerType === 'person' ? 'headshot' : 'rendering', caption: '', credit: '', fileName: 'x', mime: 'image/webp', width: 1, height: 1, bytes: 1 });

describe('people', () => {
  it('normalizes "Last, First" for duplicate detection', () => {
    expect(personKey('Puccetti, Craig')).toBe('craig puccetti');
    expect(findDuplicatePeople(createDemoSeed(), 'craig  PUCCETTI')).toHaveLength(1);
  });
  it('blocks deleting a referenced person but allows an unreferenced one', () => {
    const d = createDemoSeed();
    expect(() => deletePerson(d, 'person_craig_puccetti')).toThrow(IntegrityError);
    const p = blankPerson({ fullName: 'Temp Person' });
    upsertPerson(d, p);
    addMedia(d, media('m1', 'person', p.id));
    expect(d.people.find((x) => x.id === p.id)!.headshotMediaId).toBe('m1');
    expect(deletePerson(d, p.id)).toBe('m1');
    expect(d.people.some((x) => x.id === p.id)).toBe(false);
    expect(d.media.some((m) => m.id === 'm1')).toBe(false);
  });
  it('replacing a headshot drops the old media record', () => {
    const d = createDemoSeed();
    addMedia(d, media('h1', 'person', 'person_craig_puccetti'));
    addMedia(d, media('h2', 'person', 'person_craig_puccetti'));
    expect(d.media.map((m) => m.id)).toEqual(['h2']);
    removeMedia(d, 'h2');
    expect(d.people[0].headshotMediaId).toBeNull();
  });
});

describe('leadership structure', () => {
  it('prevents duplicate roles and vacates seats on removal', () => {
    const d = createDemoSeed();
    expect(() => addMembership(d, { clientId: HM, personId: 'person_craig_puccetti', tierId: 'relationship', role: 'Relationship Lead', responsibilities: [], confirmed: true })).toThrow(IntegrityError);
    removeMembership(d, 'member_hm_craig');
    expect(d.seats.find((s) => s.id === 'seat_hm_rel')!.membershipId).toBeNull();
  });
  it('refuses to remove tiers that are in use and renumbers order', () => {
    const d = createDemoSeed();
    const tiers = d.clients[0].config.leadershipTiers;
    expect(() => updateLeadershipTiers(d, HM, tiers.filter((t) => t.id !== 'relationship'))).toThrow(/still has members/);
    updateLeadershipTiers(d, HM, [...tiers].reverse());
    expect(d.clients[0].config.leadershipTiers.map((t) => t.order)).toEqual([1, 2, 3, 4, 5]);
    expect(d.clients[0].config.leadershipTiers[0].id).toBe('discipline');
  });
});

describe('projects', () => {
  it('records history with a readable change summary', () => {
    const d = createDemoSeed();
    const p = structuredClone(d.projects[0]);
    upsertProject(d, { ...p, categoryId: 'active', businessDevelopment: { ...p.businessDevelopment, bsaFee: 1 } }, 'Tester');
    const h = d.projects[0].history.at(-1)!;
    expect(h.by).toBe('Tester');
    expect(h.summary).toContain('Category: Potential → Active');
    expect(h.summary).toContain('BSA fee');
    expect(describeProjectChanges(p, p)).toEqual([]);
  });
  it('detects duplicate project numbers within a client only', () => {
    const d = createDemoSeed();
    expect(findDuplicateProjects(d, HM, 'demo-101')).toHaveLength(1);
    expect(findDuplicateProjects(d, DEMO_CLIENT_IDS.memorialHealth, 'DEMO-101')).toHaveLength(0);
  });
  it('blocks deleting projects with related records and purges media otherwise', () => {
    const d = createDemoSeed();
    const p = blankProject(HM);
    p.name = 'Temp';
    upsertProject(d, p, null);
    addMedia(d, media('img1', 'project', p.id));
    addMedia(d, media('img2', 'project', p.id));
    const proj = d.projects.find((x) => x.id === p.id)!;
    expect(proj.coverImageId).toBe('img1');
    removeMedia(d, 'img1');
    expect(d.projects.find((x) => x.id === p.id)!.coverImageId).toBe('img2');
    upsertMilestone(d, { ...blankMilestone(HM, p.id), title: 'Kickoff' });
    expect(() => deleteProject(d, p.id)).toThrow(IntegrityError);
    d.milestones = d.milestones.filter((m) => m.projectId !== p.id);
    expect(deleteProject(d, p.id)).toEqual(['img2']);
    expect(d.media.some((m) => m.ownerId === p.id)).toBe(false);
  });
});

describe('portfolio categories', () => {
  it('protects built-in and in-use categories, allows custom ones', () => {
    const d = createDemoSeed();
    const cats = d.clients[0].config.portfolioCategories;
    expect(() => updatePortfolioCategories(d, HM, cats.filter((c) => c.id !== 'paused'))).toThrow(/built-in/);
    updatePortfolioCategories(d, HM, [...cats, { id: 'cat_x', label: 'On Watch', order: 9 }]);
    d.projects[0].categoryId = 'cat_x';
    expect(() => updatePortfolioCategories(d, HM, cats)).toThrow(/used by 1/);
    d.projects[0].categoryId = 'potential';
    updatePortfolioCategories(d, HM, cats);
    expect(d.clients[0].config.portfolioCategories).toHaveLength(5);
    expect(() => updatePortfolioCategories(d, HM, cats.map((c) => ({ ...c, label: 'Same' })))).toThrow(/unique/);
  });
});
