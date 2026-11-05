/**
 * Demonstration seed — ships in the public build.
 *
 * CONTENT RULES
 *  - Projects are FICTIONAL ("DEMO-###" numbers, isSample = true). Real portfolio records are imported
 *    locally (Stage 2) and are never committed.
 *  - Only confirmed people/roles appear (Craig Puccetti as Houston Methodist relationship lead).
 *    Every other leadership seat is intentionally unassigned.
 *  - No readiness ratings, risk scores, dates or financial values are invented for real entities.
 *  - Confidential internal context from the project brief is NOT included here.
 */
import { defaultClientConfig } from '@/domain/defaults';
import { hospitalRestartTemplate } from '@/domain/checklistTemplates';
import type {
  ActionItem,
  BaseRecord,
  Client,
  Dataset,
  Decision,
  Initiative,
  LeadershipSeat,
  Meeting,
  MeetingTemplate,
  Milestone,
  Person,
  Project,
  ReadinessAssessment,
  Risk,
  TeamMembership,
  Workstream,
} from '@/domain/types';
import { SCHEMA_VERSION } from '../schema';
import { DEFAULT_PROJECT_SEAT_ROLES } from '@/domain/defaults';

const SEEDED_AT = '2026-11-03T00:00:00.000Z';
const base = (id: string, isSample = false): BaseRecord => ({
  id,
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
  archivedAt: null,
  ...(isSample ? { isSample: true } : {}),
});

const HM = 'client_houston_methodist';
const MH = 'client_memorial_health';
const CRAIG = 'person_craig_puccetti';

/* ───────────── Clients ───────────── */

const clients: Client[] = [
  {
    ...base(HM),
    name: 'Houston Methodist',
    shortName: 'Houston Methodist',
    clientCode: null,
    status: 'active',
    sector: 'Healthcare — academic medical system',
    monogram: 'HM',
    summary:
      'Long-standing healthcare client. Several initiatives were paused for client budgeting and planning; significant work may restart in 2027. The Client Team is preparing leadership, resources and new ideas ahead of that restart.',
    strategicPriorities: [
      'Establish clear vertical leadership and accountability before projects restart',
      'Prepare portfolio, staffing and resources for anticipated 2027 restarts',
      'Reduce prototypical clinic construction cost without sacrificing design quality',
      'Explore simulation-based operational insights as new client value',
    ],
    relationshipLeadId: CRAIG,
    executiveSponsorId: null,
    config: defaultClientConfig(),
  },
  {
    ...base(MH),
    name: 'Memorial Health',
    shortName: 'Memorial Health',
    clientCode: null,
    status: 'onboarding',
    sector: 'Healthcare',
    monogram: 'MH',
    summary: 'Workspace reserved for the Memorial Health Client Team. Leadership, portfolio and workstreams have not yet been configured.',
    strategicPriorities: [],
    relationshipLeadId: null,
    executiveSponsorId: null,
    config: defaultClientConfig(),
  },
];

/* ───────────── People & leadership ───────────── */

const people: Person[] = [
  {
    ...base(CRAIG),
    fullName: 'Craig Puccetti',
    title: 'Principal',
    organization: 'BSA',
    affiliation: 'bsa',
    studio: 'Austin',
    email: null,
    phone: null,
    discipline: null,
    notes: '',
    headshotMediaId: null,
    active: true,
    isAppUser: false,
    homeClientId: null,
  },
];

const memberships: TeamMembership[] = [
  {
    ...base('member_hm_craig'),
    clientId: HM,
    personId: CRAIG,
    tierId: 'relationship',
    role: 'Relationship Lead',
    responsibilities: ['Primary relationship with Houston Methodist leadership', 'Client Team convening and continuity'],
    confirmed: true,
  },
];

const seat = (id: string, tierId: string, role: string, description: string, membershipId: string | null = null): LeadershipSeat => ({
  ...base(id),
  clientId: HM,
  tierId,
  role,
  description,
  membershipId,
});

const seats: LeadershipSeat[] = [
  seat('seat_hm_exec', 'executive', 'Executive Sponsor', 'Firm-level sponsor with escalation and resourcing authority.'),
  seat('seat_hm_rel', 'relationship', 'Relationship Lead', 'Owns the client relationship and strategic dialogue.', 'member_hm_craig'),
  seat('seat_hm_portfolio', 'portfolio', 'Portfolio Delivery Lead', 'Oversees delivery standards, staffing and coordination across all projects.'),
  seat('seat_hm_project', 'project', 'Project Principals & PMs', 'Assigned per project as work is authorized.'),
  seat('seat_hm_design', 'discipline', 'Design Leadership', 'Design quality and continuity across the portfolio.'),
  seat('seat_hm_eng', 'discipline', 'Engineering Leadership', 'MEP / structural technical leadership.'),
];

/* ───────────── Fictional sample projects ───────────── */

const notAssessed = (): ReadinessAssessment => ({ status: 'not_assessed', note: '', assessedById: null, assessedAt: null });
const readinessAll = (): Record<string, ReadinessAssessment> =>
  Object.fromEntries(defaultClientConfig().readinessDimensions.map((d) => [d.id, notAssessed()]));

const unresolvedProjection = (amounts: number[]) => ({
  periods: amounts.map((amount, i) => ({ index: i + 1, label: null, amount })),
  calendarMapping: 'unresolved' as const,
  basisNote: 'Sample data. Period-to-calendar mapping not established.',
});

function sampleProject(p: {
  id: string;
  number: string;
  name: string;
  description: string;
  category: string;
  type: string;
  location: string;
  fee: number | null;
  probability: number | null;
  feeMix: [number, number, number];
  projection?: number[];
  readiness?: Partial<Record<string, ReadinessAssessment>>;
  overall?: ReadinessAssessment;
}): Project {
  return {
    ...base(p.id, true),
    clientId: HM,
    projectNumber: p.number,
    name: p.name,
    description: p.description,
    location: p.location,
    studio: 'Sample',
    categoryId: p.category,
    projectType: p.type,
    size: { value: null, unit: 'sf', note: '' },
    coverImageId: null,
    imageIds: [],
    businessDevelopment: {
      relationshipPrincipalId: null,
      relationshipPrincipalRaw: null,
      pursuitPrincipalId: null,
      pipelineProbability: p.probability,
      estimatedConstructionCost: null,
      bsaFee: p.fee,
      feeMix: { architecture: p.feeMix[0], engineering: p.feeMix[1], interiors: p.feeMix[2] },
      revenueProjection: p.projection ? unresolvedProjection(p.projection) : null,
      anticipatedAuthorization: null,
      anticipatedStart: null,
      anticipatedCompletion: null,
    },
    delivery: {
      seats: DEFAULT_PROJECT_SEAT_ROLES.map((role, i) => ({ id: `${p.id}_seat_${i + 1}`, role, personId: null })),
      resourceNotes: '',
      dependencies: [],
    },
    readiness: { ...readinessAll(), ...(p.readiness as Record<string, ReadinessAssessment>) },
    overallReadiness: p.overall ?? notAssessed(),
    documentLinks: [],
    provenance: null,
    history: [{ at: SEEDED_AT, by: 'System', summary: 'Fictional demonstration record created.' }],
  };
}

const assessed = (status: ReadinessAssessment['status'], note: string): ReadinessAssessment => ({
  status,
  note,
  assessedById: null,
  assessedAt: SEEDED_AT,
});

const projects: Project[] = [
  sampleProject({
    id: 'project_demo_101',
    number: 'DEMO-101',
    name: 'Sample Comprehensive Care Clinic',
    description: 'Fictional demonstration record: prototypical outpatient clinic used to illustrate a potential project.',
    category: 'potential',
    type: 'Ambulatory clinic',
    location: 'Sample City, TX',
    fee: 1_250_000,
    probability: 0.5,
    feeMix: [0.85, 0, 0.15],
    projection: [0, 0, 0, 0, 90_000, 90_000, 120_000, 120_000, 120_000, 80_000, 80_000, 40_000],
  }),
  sampleProject({
    id: 'project_demo_102',
    number: 'DEMO-102',
    name: 'Sample Hospital Campus Renovation Program',
    description: 'Fictional demonstration record: multi-phase renovation program used to illustrate restart planning.',
    category: 'potential',
    type: 'Hospital renovation',
    location: 'Sample City, TX',
    fee: null,
    probability: null,
    feeMix: [0.6, 0.3, 0.1],
  }),
  sampleProject({
    id: 'project_demo_103',
    number: 'DEMO-103',
    name: 'Sample Outpatient Imaging Center',
    description: 'Fictional demonstration record: paused project awaiting client budget decisions.',
    category: 'paused',
    type: 'Diagnostic imaging',
    location: 'Sample City, TX',
    fee: 640_000,
    probability: null,
    feeMix: [0.7, 0.2, 0.1],
  }),
  sampleProject({
    id: 'project_demo_104',
    number: 'DEMO-104',
    name: 'Sample Ambulatory Surgery Suite',
    description: 'Fictional demonstration record: active project showing how explicit readiness assessments appear.',
    category: 'active',
    type: 'Surgical services',
    location: 'Sample City, TX',
    fee: 980_000,
    probability: 1,
    feeMix: [0.65, 0.25, 0.1],
    readiness: {
      leadership: assessed('ready', 'Sample: principal and PM confirmed.'),
      staffing: assessed('partially_ready', 'Sample: interiors lead not yet assigned.'),
      schedule: assessed('not_ready', 'Sample: authorization date unknown.'),
    },
    overall: assessed('partially_ready', 'Sample: human judgment recorded by the project principal.'),
  }),
  sampleProject({
    id: 'project_demo_105',
    number: 'DEMO-105',
    name: 'Sample Medical Office Fit-Out',
    description: 'Fictional demonstration record: completed project retained for history.',
    category: 'completed',
    type: 'Medical office',
    location: 'Sample City, TX',
    fee: 310_000,
    probability: 1,
    feeMix: [0.8, 0, 0.2],
  }),
];

/* ───────────── Strategic workstreams ───────────── */

const ws = (
  n: number,
  title: string,
  purpose: string,
  topics: string[],
  deliverable: string,
  confidentiality: Workstream['confidentiality'] = 'internal',
  confidentialityNote = '',
): Workstream => ({
  ...base(`ws_hm_${n}`),
  clientId: HM,
  order: n,
  title,
  purpose,
  topics,
  deliverable,
  championId: null,
  status: 'planned',
  confidentiality,
  confidentialityNote,
});

const workstreams: Workstream[] = [
  ws(
    1,
    'Client Leadership and Governance',
    'Establish relationship ownership, executive sponsorship, portfolio leadership, decision authority and escalation procedures.',
    [
      'Confirm primary client relationship leadership',
      'Identify required executive oversight',
      'Establish vertical leadership structure',
      'Confirm client-facing communication responsibilities',
      'Define accountability across multiple PICs and project leaders',
      'Establish escalation pathways',
    ],
    'Client Team charter and accountability structure',
  ),
  ws(
    2,
    'Portfolio and Project Readiness',
    'Prepare for project restarts and future resource requirements.',
    [
      'Review all potential and paused work',
      'Gather active project inventory',
      'Identify anticipated restart timing',
      'Evaluate leadership and staffing requirements',
      'Identify resource constraints',
      'Establish portfolio milestones',
      'Review major project risks',
      'Prepare for the potential large decanting project',
    ],
    'Portfolio readiness summary and resource preparedness plan',
  ),
  ws(
    3,
    'Delivery Excellence and Team Culture',
    'Establish consistent leadership, coordination, quality and decision-making standards.',
    [
      'Clarify project leadership expectations',
      'Establish appropriate delegation and oversight',
      'Define communication protocols',
      'Address cross-studio coordination',
      'Establish quality expectations',
      'Define conflict resolution and escalation processes',
      'Establish consistent reporting',
    ],
    'Delivery leadership standards and communication expectations',
    'internal',
    'Internal performance discussions in this workstream are Internal Only and are excluded from client-facing reports.',
  ),
  ws(
    4,
    'Cost Innovation and Design Value',
    'Help Houston Methodist deliver more cost-effective facilities without compromising design intent or client experience.',
    [
      'Status of prior clinic cost-reduction challenge',
      'Prefabrication opportunities',
      'Modular construction',
      'Alternative materials',
      'Prototype standardization',
      'Constructability',
      'Value analysis',
      'Cost benchmarking',
      'Construction partner collaboration',
    ],
    'Clinic cost-innovation roadmap and potential client presentation',
    'candidate',
  ),
  ws(
    5,
    'Research, Simulation and Strategic Insights',
    'Use research and emerging technologies to generate additional client value.',
    [
      'Identify a completed clinic for potential simulation',
      'Establish a meaningful operational question',
      'Identify data requirements',
      'Evaluate privacy and data-sharing limitations',
      'Confirm external partner scope',
      'Define expected insights',
      'Determine client engagement strategy',
      'Establish pilot milestones',
    ],
    'Simulation pilot concept and client engagement plan',
    'candidate',
    'No simulation has been performed. No results exist yet.',
  ),
];

/* ───────────── Initiatives, actions, decisions ───────────── */

const initiative = (n: number, workstreamId: string, title: string, description: string, desiredOutcome: string): Initiative => ({
  ...base(`init_hm_${n}`),
  clientId: HM,
  workstreamId,
  title,
  description,
  championId: null,
  participantIds: [],
  desiredOutcome,
  targetDate: null,
  status: 'proposed',
  relatedProjectIds: [],
  notes: '',
  confidentiality: 'internal',
  consultedIds: [],
  informedIds: [],
});

const initiatives: Initiative[] = [
  initiative(1, 'ws_hm_1', 'Activate portfolio delivery leadership', 'Confirm the leaders accountable for delivery across the Houston Methodist portfolio.', 'Named, available delivery leadership before work restarts.'),
  initiative(2, 'ws_hm_2', 'Prepare for major project restart', 'Readiness planning for the anticipated restart of paused work.', 'Leadership, staffing and early decisions ready ahead of authorization.'),
  initiative(3, 'ws_hm_4', 'Evaluate clinic construction cost-reduction strategies', 'Respond to the client challenge to reduce prototypical clinic cost while preserving design quality.', 'A credible cost-innovation roadmap to present to the client.'),
  initiative(4, 'ws_hm_5', 'Develop AI simulation pilot', 'Scope a potential no-initial-fee simulation study of an existing clinic with an external partner.', 'An agreed pilot concept and client engagement plan.'),
];

const action = (n: number, title: string, workstreamId: string, initiativeId: string | null, priority: ActionItem['priority']): ActionItem => ({
  ...base(`action_hm_${n}`),
  clientId: HM,
  title,
  description: '',
  ownerId: null,
  participantIds: [],
  dueDate: null,
  priority,
  status: 'not_started',
  workstreamId,
  initiativeId,
  projectId: null,
  meetingId: null,
  completionNotes: '',
  completedAt: null,
  confidentiality: 'internal',
  commitment: 'proposed',
  consultedIds: [],
  informedIds: [],
});

const actions: ActionItem[] = [
  action(1, 'Identify and confirm an executive sponsor', 'ws_hm_1', null, 'high'),
  action(2, 'Gather the active project inventory', 'ws_hm_2', 'init_hm_2', 'high'),
  action(3, 'Confirm status of the prior clinic cost-reduction challenge', 'ws_hm_4', 'init_hm_3', 'medium'),
  action(4, 'Identify a completed clinic candidate for simulation', 'ws_hm_5', 'init_hm_4', 'medium'),
  action(5, 'Schedule the Client Team kickoff meeting', 'ws_hm_1', null, 'high'),
];

const decisions: Decision[] = [
  {
    ...base('decision_hm_1'),
    clientId: HM,
    title: 'Adopt five-workstream structure for the Client Team',
    description: 'Organize Client Team activity under five strategic workstreams.',
    date: null,
    ownerId: null,
    participantIds: [],
    projectId: null,
    initiativeId: null,
    workstreamId: 'ws_hm_1',
    status: 'proposed',
    rationale: 'Balances delivery preparedness with proactive client value creation.',
    alternatives: '',
    dependencies: 'Confirmation at the Client Team kickoff.',
    approval: null,
    supersededById: null,
    meetingId: null,
    confidentiality: 'internal',
    consultedIds: [],
    informedIds: [],
  },
];

const risks: Risk[] = [
  {
    ...base('risk_hm_1'),
    clientId: HM,
    kind: 'opportunity',
    title: 'Clinic cost-reduction challenge',
    description: 'Client has asked BSA to reduce prototypical clinic construction cost while preserving design quality.',
    severity: 'not_assessed',
    ownerId: null,
    projectId: null,
    workstreamId: 'ws_hm_4',
    initiativeId: 'init_hm_3',
    meetingId: null,
    status: 'open',
    mitigation: '',
    confidentiality: 'internal',
  },
  {
    ...base('risk_hm_2'),
    clientId: HM,
    kind: 'opportunity',
    title: 'Potential AI simulation partnership',
    description: 'Potential to study an existing clinic with an external simulation provider at no initial simulation fee.',
    severity: 'not_assessed',
    ownerId: null,
    projectId: null,
    workstreamId: 'ws_hm_5',
    initiativeId: 'init_hm_4',
    meetingId: null,
    status: 'open',
    mitigation: '',
    confidentiality: 'internal',
  },
];

const milestones: Milestone[] = [
  {
    ...base('milestone_hm_1'),
    clientId: HM,
    title: 'Client Team kickoff',
    date: null,
    timingNote: 'To be scheduled',
    confirmed: false,
    projectId: null,
    initiativeId: null,
    workstreamId: 'ws_hm_1',
    status: 'upcoming',
    confidentiality: 'internal',
  },
  {
    ...base('milestone_hm_2'),
    clientId: HM,
    title: 'Anticipated restart of paused work',
    date: null,
    timingNote: '2027 — anticipated, unconfirmed',
    confirmed: false,
    projectId: null,
    initiativeId: 'init_hm_2',
    workstreamId: 'ws_hm_2',
    status: 'upcoming',
    confidentiality: 'internal',
  },
];

/* ───────────── Meeting templates ───────────── */

const meetingTemplates: MeetingTemplate[] = [
  {
    ...base('template_hm_kickoff'),
    clientId: HM,
    name: 'Client Team Kickoff (60 min)',
    description: 'Activates the Client Team: shared purpose, current state, attention areas, leadership and cadence.',
    objectives: [
      'Align on the purpose of the Houston Methodist Client Team',
      'Surface what needs attention across the five workstreams',
      'Identify leaders, champions and accountable owners',
      'Agree the operating cadence and escalation path',
    ],
    agenda: [
      { id: 'ag_1', title: 'Why We Are Here', minutes: 5, purpose: 'Explain the strategic Client Team activation objective.', prompts: [] },
      { id: 'ag_2', title: 'Current State', minutes: 10, purpose: 'Relationship overview, anticipated project restarts, major opportunities.', prompts: [] },
      { id: 'ag_3', title: 'What Needs Attention', minutes: 15, purpose: 'Review the five workstreams and surface emerging issues.', prompts: [] },
      { id: 'ag_4', title: 'Leadership and Accountability', minutes: 15, purpose: 'Identify needed participants, champions and leadership roles.', prompts: [] },
      { id: 'ag_5', title: 'Operating Cadence', minutes: 10, purpose: 'Agree on reporting, meeting frequency, escalation and communication.', prompts: [] },
      { id: 'ag_6', title: 'Closeout', minutes: 5, purpose: 'Confirm assignments, priorities and next steps.', prompts: [] },
    ],
  },
];

const meetings: Meeting[] = [];

export function createDemoSeed(): Dataset {
  // Deep clone so callers can mutate freely.
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    origin: 'demo-seed',
    savedAt: null,
    clients,
    people,
    memberships,
    seats,
    projects,
    workstreams,
    initiatives,
    actions,
    decisions,
    risks,
    milestones,
    meetingTemplates,
    meetings,
    reports: [],
    media: [],
    checklistTemplates: [hospitalRestartTemplate(HM)],
    checklists: [],
    activity: [],
  } satisfies Dataset);
}

export const DEMO_CLIENT_IDS = { houstonMethodist: HM, memorialHealth: MH } as const;
