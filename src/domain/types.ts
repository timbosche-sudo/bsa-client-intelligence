/**
 * BSA Client Intelligence — domain model.
 *
 * Rules that apply to every record:
 *  - `id` is a stable, opaque, application-generated identifier. It never encodes business data
 *    (project numbers, names) so it survives renames and re-imports.
 *  - Workspace-owned records carry `clientId`. Data access is scoped by clientId in the repository
 *    layer (src/data/repository.ts), not only in UI filters.
 *  - People are global (reusable across clients); their participation in a client workspace is a
 *    `TeamMembership`.
 *  - Unknown values are `null`, never invented. The UI renders null as "Not Assessed" / "To Be Confirmed".
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO 8601 timestamp

export interface BaseRecord {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Reversible archiving is preferred to deletion. */
  archivedAt: ISODateTime | null;
  /** True for fictional demonstration records shipped with the public build. */
  isSample?: boolean;
}

export interface ClientScoped {
  clientId: ID;
}

/* ───────────────────────── Confidentiality ───────────────────────── */

export type Confidentiality = 'internal' | 'candidate' | 'approved';

export const CONFIDENTIALITY_LABELS: Record<Confidentiality, string> = {
  internal: 'Internal Only',
  candidate: 'Candidate for Client Sharing',
  approved: 'Approved for Client Release',
};

/* ───────────────────────── Configuration ───────────────────────── */

export interface CategoryDef {
  id: ID;
  label: string;
  description?: string;
  order: number;
  /** Built-in categories can be relabelled but not removed. */
  builtIn?: boolean;
}

export interface LeadershipTierDef {
  id: ID;
  label: string;
  description: string;
  order: number;
}

export interface ClientConfig {
  portfolioCategories: CategoryDef[];
  leadershipTiers: LeadershipTierDef[];
  readinessDimensions: ReadinessDimensionDef[];
}

/* ───────────────────────── Clients ───────────────────────── */

export type ClientStatus = 'active' | 'onboarding' | 'archived';

export interface Client extends BaseRecord {
  name: string;
  shortName: string;
  /** Accounting/client code, if known (used for import validation). */
  clientCode: string | null;
  status: ClientStatus;
  sector: string | null;
  summary: string;
  strategicPriorities: string[];
  relationshipLeadId: ID | null;
  executiveSponsorId: ID | null;
  /** Short accent label for the client selector (2–3 letters). */
  monogram: string;
  config: ClientConfig;
}

/* ───────────────────────── People ───────────────────────── */

export type Affiliation = 'bsa' | 'client' | 'external';

export interface Person extends BaseRecord {
  fullName: string;
  title: string | null;
  organization: string | null;
  affiliation: Affiliation;
  studio: string | null;
  email: string | null;
  phone: string | null;
  discipline: string | null;
  notes: string;
  /** Reference to a media asset (Stage 2). */
  headshotMediaId: ID | null;
  active: boolean;
  /** Contacts are not assumed to be application users. */
  isAppUser: boolean;
}

export type RaciRole = 'accountable' | 'responsible' | 'consulted' | 'informed';

export interface TeamMembership extends BaseRecord, ClientScoped {
  personId: ID;
  tierId: ID;
  /** Role in the Client Team, e.g. "Relationship Lead". */
  role: string;
  responsibilities: string[];
  confirmed: boolean;
}

/** A leadership seat that must be filled but has no confirmed person yet. */
export interface LeadershipSeat extends BaseRecord, ClientScoped {
  tierId: ID;
  role: string;
  description: string;
  membershipId: ID | null;
}

/* ───────────────────────── Projects ───────────────────────── */

export type ReadinessStatus = 'not_assessed' | 'ready' | 'partially_ready' | 'not_ready' | 'not_applicable';

export const READINESS_LABELS: Record<ReadinessStatus, string> = {
  not_assessed: 'Not Assessed',
  ready: 'Ready',
  partially_ready: 'Partially Ready',
  not_ready: 'Not Ready',
  not_applicable: 'Not Applicable',
};

export interface ReadinessDimensionDef {
  id: ID;
  label: string;
  guidance: string;
  order: number;
}

export interface ReadinessAssessment {
  status: ReadinessStatus;
  note: string;
  assessedById: ID | null;
  assessedAt: ISODateTime | null;
}

export interface FeeMix {
  /** Fractions of the BSA fee, 0–1, preserved exactly as supplied. */
  architecture: number | null;
  engineering: number | null;
  interiors: number | null;
}

export interface RevenuePeriod {
  /** 1-based position in the source sequence. */
  index: number;
  /** Calendar label. `null` = unresolved; never inferred from position. */
  label: string | null;
  amount: number | null;
}

export interface RevenueProjection {
  periods: RevenuePeriod[];
  /** Whether period → calendar mapping is known. */
  calendarMapping: 'unresolved' | 'confirmed';
  basisNote: string;
}

export interface Provenance {
  sourceFile: string;
  worksheet: string | null;
  sourceRow: number | null;
  sourceRecordId: string | null;
  sourceAsOf: ISODate | null;
  importedAt: ISODateTime;
  importedBy: string | null;
  extractMethod: string | null;
}

export interface ProjectSize {
  value: number | null;
  unit: 'sf' | 'beds' | 'other';
  note: string;
}

export interface Project extends BaseRecord, ClientScoped {
  projectNumber: string | null;
  name: string;
  description: string;
  location: string | null;
  studio: string | null;
  categoryId: ID; // portfolio category (Potential/Active/…)
  projectType: string | null;
  size: ProjectSize;
  coverImageId: ID | null;
  imageIds: ID[];

  businessDevelopment: {
    relationshipPrincipalId: ID | null;
    /** Name exactly as it appeared in the source when it could not be matched to a person. */
    relationshipPrincipalRaw: string | null;
    pursuitPrincipalId: ID | null;
    pipelineProbability: number | null; // 0–1
    estimatedConstructionCost: number | null;
    bsaFee: number | null;
    feeMix: FeeMix;
    revenueProjection: RevenueProjection | null;
    anticipatedAuthorization: ISODate | null;
    anticipatedStart: ISODate | null;
    anticipatedCompletion: ISODate | null;
  };

  delivery: {
    projectExecutiveId: ID | null;
    projectManagerId: ID | null;
    designLeaderId: ID | null;
    planningLeaderId: ID | null;
    engineeringLeaderId: ID | null;
    disciplineLeads: { discipline: string; personId: ID | null }[];
    resourceNotes: string;
    dependencies: string[];
  };

  readiness: Record<string, ReadinessAssessment>;
  /** Overall assessment is an explicit human judgment, never computed. */
  overallReadiness: ReadinessAssessment;

  provenance: Provenance | null;
  history: ProjectHistoryEntry[];
}

export interface ProjectHistoryEntry {
  at: ISODateTime;
  by: string | null;
  summary: string;
}

/* ───────────────────────── Strategy ───────────────────────── */

export type WorkstreamStatus = 'active' | 'planned' | 'paused' | 'archived';

export interface Workstream extends BaseRecord, ClientScoped {
  order: number;
  title: string;
  purpose: string;
  topics: string[];
  deliverable: string;
  championId: ID | null;
  status: WorkstreamStatus;
  confidentiality: Confidentiality;
  confidentialityNote: string;
}

export type InitiativeStatus = 'proposed' | 'active' | 'on_hold' | 'complete' | 'cancelled';

export interface Initiative extends BaseRecord, ClientScoped {
  workstreamId: ID | null;
  title: string;
  description: string;
  championId: ID | null;
  participantIds: ID[];
  desiredOutcome: string;
  targetDate: ISODate | null;
  status: InitiativeStatus;
  relatedProjectIds: ID[];
  notes: string;
  confidentiality: Confidentiality;
}

export type ActionStatus = 'not_started' | 'in_progress' | 'waiting' | 'blocked' | 'complete' | 'cancelled';
export type Priority = 'high' | 'medium' | 'low';

export interface ActionItem extends BaseRecord, ClientScoped {
  title: string;
  description: string;
  ownerId: ID | null;
  participantIds: ID[];
  dueDate: ISODate | null;
  priority: Priority;
  status: ActionStatus;
  workstreamId: ID | null;
  initiativeId: ID | null;
  projectId: ID | null;
  meetingId: ID | null;
  completionNotes: string;
  completedAt: ISODate | null;
  confidentiality: Confidentiality;
}

export type DecisionStatus = 'proposed' | 'under_review' | 'approved' | 'deferred' | 'rejected' | 'superseded';

export interface Decision extends BaseRecord, ClientScoped {
  title: string;
  description: string;
  date: ISODate | null;
  ownerId: ID | null;
  participantIds: ID[];
  projectId: ID | null;
  initiativeId: ID | null;
  workstreamId: ID | null;
  status: DecisionStatus;
  rationale: string;
  alternatives: string;
  dependencies: string;
  /** Required to move to "approved". */
  approval: { approvedById: ID | null; approvedAt: ISODateTime | null; note: string } | null;
  supersededById: ID | null;
  meetingId: ID | null;
  confidentiality: Confidentiality;
}

export type RiskKind = 'risk' | 'issue' | 'opportunity';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'not_assessed';

export interface Risk extends BaseRecord, ClientScoped {
  kind: RiskKind;
  title: string;
  description: string;
  severity: RiskSeverity;
  ownerId: ID | null;
  projectId: ID | null;
  workstreamId: ID | null;
  status: 'open' | 'monitoring' | 'closed';
  mitigation: string;
  confidentiality: Confidentiality;
}

export interface Milestone extends BaseRecord, ClientScoped {
  title: string;
  /** Exact date when known. */
  date: ISODate | null;
  /** Free-text timing when only approximate ("2027 — unconfirmed"). */
  timingNote: string;
  confirmed: boolean;
  projectId: ID | null;
  initiativeId: ID | null;
  workstreamId: ID | null;
  status: 'upcoming' | 'complete' | 'missed' | 'cancelled';
}

/* ───────────────────────── Meetings ───────────────────────── */

export interface AgendaItem {
  id: ID;
  title: string;
  minutes: number;
  purpose: string;
  prompts: string[];
}

export interface MeetingTemplate extends BaseRecord {
  /** null = available to every client. */
  clientId: ID | null;
  name: string;
  description: string;
  agenda: AgendaItem[];
}

export type MeetingStatus = 'scheduled' | 'in_progress' | 'closeout' | 'finalized' | 'cancelled';

export interface Meeting extends BaseRecord, ClientScoped {
  title: string;
  startsAt: ISODateTime | null;
  facilitatorId: ID | null;
  attendeeIds: ID[];
  objectives: string[];
  workstreamIds: ID[];
  templateId: ID | null;
  agenda: AgendaItem[];
  notes: Record<ID, string>;
  status: MeetingStatus;
  finalizedAt: ISODateTime | null;
  finalizedById: ID | null;
}

/* ───────────────────────── Reports & activity ───────────────────────── */

export type ReportKind = 'internal_team' | 'accountability_brief' | 'client_alignment' | 'portfolio_readiness';

export interface ReportRecord extends BaseRecord, ClientScoped {
  kind: ReportKind;
  title: string;
  version: number;
  preparedBy: string | null;
  confidentiality: Confidentiality;
  generatedAt: ISODateTime;
  parameters: Record<string, unknown>;
}

export interface ActivityEntry {
  id: ID;
  clientId: ID | null;
  at: ISODateTime;
  actor: string | null;
  entity: string;
  entityId: ID | null;
  summary: string;
}

/* ───────────────────────── Dataset ───────────────────────── */

/** The complete persisted dataset. Versioned for migrations. */
export interface Dataset {
  schemaVersion: number;
  /** Where this dataset came from: built-in demo seed, a restore, etc. */
  origin: 'demo-seed' | 'restored' | 'empty';
  savedAt: ISODateTime | null;
  clients: Client[];
  people: Person[];
  memberships: TeamMembership[];
  seats: LeadershipSeat[];
  projects: Project[];
  workstreams: Workstream[];
  initiatives: Initiative[];
  actions: ActionItem[];
  decisions: Decision[];
  risks: Risk[];
  milestones: Milestone[];
  meetingTemplates: MeetingTemplate[];
  meetings: Meeting[];
  reports: ReportRecord[];
  activity: ActivityEntry[];
}

/** Collections that are owned by a single client workspace. */
export const CLIENT_SCOPED_COLLECTIONS = [
  'memberships',
  'seats',
  'projects',
  'workstreams',
  'initiatives',
  'actions',
  'decisions',
  'risks',
  'milestones',
  'meetings',
  'reports',
] as const satisfies readonly (keyof Dataset)[];

export type ClientScopedCollection = (typeof CLIENT_SCOPED_COLLECTIONS)[number];
