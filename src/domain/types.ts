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
  /**
   * For client contacts: the client workspace the person belongs to. They are never offered in other
   * clients' pickers. BSA personnel and independent external people have null (reusable everywhere).
   */
  homeClientId: ID | null;
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
  /** Display name of who recorded the assessment (prototype has no user→person link yet). */
  assessedByName?: string | null;
  assessedAt: ISODateTime | null;
}

export interface DocumentLink {
  id: ID;
  title: string;
  /** Link to the document in its system of record (e.g. SharePoint/Teams). Files are not stored in the app. */
  url: string;
  addedAt: ISODateTime;
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

  documentLinks: DocumentLink[];
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

/**
 * Lightweight RACI (Part 10.4). The record's owner/champion is Accountable; participants are Supporting
 * (Responsible). Consulted and Informed are optional and never required for small actions.
 */
export interface RaciFields {
  consultedIds: ID[];
  informedIds: ID[];
}

export type InitiativeStatus = 'proposed' | 'active' | 'on_hold' | 'complete' | 'cancelled';

export interface Initiative extends BaseRecord, ClientScoped, RaciFields {
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

export interface ActionItem extends BaseRecord, ClientScoped, RaciFields {
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
  /**
   * For client-facing reports: whether the owner has confirmed this commitment or it is still a
   * proposed request (Part 12.3). Defaults to proposed.
   */
  commitment: 'proposed' | 'confirmed';
}

export type DecisionStatus = 'proposed' | 'under_review' | 'approved' | 'deferred' | 'rejected' | 'superseded';

export interface Decision extends BaseRecord, ClientScoped, RaciFields {
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
  initiativeId: ID | null;
  /** Set when flagged during a meeting. */
  meetingId: ID | null;
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
  confidentiality: Confidentiality;
}

/* ───────────────────────── Restart checklists ───────────────────────── */

export interface ChecklistTemplateItem {
  id: ID;
  title: string;
  /** Considerations / prompts shown to the team. */
  guidance: string[];
}

/** Reusable project readiness template. null clientId = available to every client. */
export interface ChecklistTemplate extends BaseRecord {
  clientId: ID | null;
  name: string;
  description: string;
  source: string;
  items: ChecklistTemplateItem[];
}

export type ChecklistItemStatus = 'not_started' | 'in_progress' | 'complete' | 'not_applicable';

export interface ChecklistItem {
  id: ID;
  title: string;
  guidance: string[];
  status: ChecklistItemStatus;
  ownerId: ID | null;
  dueDate: ISODate | null;
  notes: string;
}

export interface ProgramComparisonRow {
  id: ID;
  component: string;
  original: string;
  approved: string;
  proposed: string;
  note: string;
}

export interface ChangeLogEntry {
  id: ID;
  date: ISODate | null;
  change: string;
  driver: string;
  costImpact: string;
  approvedBy: string;
  status: 'proposed' | 'approved' | 'rejected';
}

/**
 * A checklist applied to one project. It can only be created after someone records that the project's
 * identity and scope are confirmed (Part 9). Template items are copied, so later template edits don't
 * rewrite history.
 */
export interface ProjectChecklist extends BaseRecord, ClientScoped {
  projectId: ID;
  templateId: ID | null;
  templateName: string;
  identityConfirmation: { confirmedBy: string; confirmedAt: ISODateTime; note: string };
  items: ChecklistItem[];
  programComparison: ProgramComparisonRow[];
  changeLog: ChangeLogEntry[];
  leadershipSummary: string;
  confidentiality: Confidentiality;
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
  objectives: string[];
  agenda: AgendaItem[];
}

export type MeetingStatus = 'scheduled' | 'in_progress' | 'closeout' | 'finalized' | 'cancelled';

export type AgendaItemStatus = 'pending' | 'discussed' | 'skipped';

export interface AgendaItemState {
  status: AgendaItemStatus;
  /** When the facilitator first opened this item (for pacing). */
  startedAt: ISODateTime | null;
}

/**
 * Immutable snapshot taken at finalization. Later edits to actions or decisions do not change
 * what the meeting recorded; the live records remain linked by id.
 */
export interface MeetingRecordSnapshot {
  finalizedAt: ISODateTime;
  finalizedBy: string;
  attendees: string[];
  facilitator: string | null;
  topics: { title: string; status: AgendaItemStatus; notes: string }[];
  generalNotes: string;
  summary: string;
  actions: { id: ID; title: string; owner: string | null; dueDate: ISODate | null; status: string }[];
  decisions: { id: ID; title: string; status: string; approvedBy: string | null }[];
  issues: { id: ID; title: string; severity: string; status: string }[];
  carriedOver: { id: ID; title: string; owner: string | null; status: string }[];
  nextMeetingTopics: string[];
}

export interface MeetingAmendment {
  id: ID;
  reason: string;
  requestedBy: string;
  startedAt: ISODateTime;
  /** Set when the amended record is finalized again. */
  completedAt: ISODateTime | null;
}

export interface Meeting extends BaseRecord, ClientScoped {
  title: string;
  startsAt: ISODateTime | null;
  location: string;
  facilitatorId: ID | null;
  attendeeIds: ID[];
  objectives: string[];
  workstreamIds: ID[];
  templateId: ID | null;
  agenda: AgendaItem[];
  /** Facilitator notes per agenda item id. */
  notes: Record<ID, string>;
  generalNotes: string;
  agendaState: Record<ID, AgendaItemState>;
  currentAgendaItemId: ID | null;
  status: MeetingStatus;
  startedAt: ISODateTime | null;
  endedAt: ISODateTime | null;
  /** Open actions brought into the meeting from before it started. */
  carryoverActionIds: ID[];
  summary: string;
  nextMeetingTopics: string[];
  finalizedAt: ISODateTime | null;
  finalizedById: ID | null;
  finalizedByName: string | null;
  record: MeetingRecordSnapshot | null;
  amendments: MeetingAmendment[];
}

/* ───────────────────────── Reports & activity ───────────────────────── */

export type ReportKind = 'internal_team' | 'accountability_brief' | 'client_alignment' | 'portfolio_readiness';

/** Structured report content rendered identically to the on-screen preview and to PDF. */
export type ReportBlock =
  | { type: 'paragraph'; text: string; muted?: boolean }
  | { type: 'kv'; items: [string, string][] }
  | { type: 'stats'; items: [string, string][] }
  | { type: 'list'; items: string[] }
  | { type: 'table'; columns: { header: string; width?: number | 'auto' | '*'; align?: 'left' | 'right' | 'center' }[]; rows: string[][]; empty?: string }
  | { type: 'callout'; text: string; tone: 'info' | 'caution' };

export interface ReportSection {
  title: string;
  blocks: ReportBlock[];
}

export interface ReportDoc {
  kind: ReportKind;
  title: string;
  subtitle: string;
  clientName: string;
  generatedAt: ISODateTime;
  preparedBy: string;
  version: number;
  confidentiality: Confidentiality;
  sections: ReportSection[];
  /** Notes about what was deliberately excluded (shown to reviewers, not printed). */
  reviewNotes: string[];
}

/**
 * Lifecycle: internal reports are 'final' when generated. Client-facing reports start as 'draft'
 * and can only be exported for distribution after explicit approval ('approved').
 */
export type ReportStatus = 'final' | 'draft' | 'approved';

export interface ReportRecord extends BaseRecord, ClientScoped {
  kind: ReportKind;
  title: string;
  version: number;
  preparedBy: string | null;
  confidentiality: Confidentiality;
  generatedAt: ISODateTime;
  parameters: Record<string, unknown>;
  status: ReportStatus;
  /** Frozen content: what was previewed is exactly what is exported. */
  content: ReportDoc;
  approval: { approvedBy: string; approvedAt: ISODateTime; checks: string[] } | null;
  exports: { at: ISODateTime; draft: boolean }[];
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

/* ───────────────────────── Media ───────────────────────── */

export type MediaKind = 'headshot' | 'rendering' | 'construction' | 'plan' | 'photo' | 'other';

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  headshot: 'Headshot',
  rendering: 'Rendering',
  construction: 'Construction photography',
  plan: 'Plan / diagram',
  photo: 'Photograph',
  other: 'Other',
};

/**
 * Metadata for an uploaded image. The binary lives in the MediaStore (IndexedDB in Prototype Mode),
 * keyed by the same id. Headshots belong to a person (global, clientId null); project images to a client.
 */
export interface MediaRecord extends BaseRecord {
  clientId: ID | null;
  ownerType: 'person' | 'project';
  ownerId: ID;
  kind: MediaKind;
  caption: string;
  credit: string;
  fileName: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
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
  media: MediaRecord[];
  checklistTemplates: ChecklistTemplate[];
  checklists: ProjectChecklist[];
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
  'checklists',
] as const satisfies readonly (keyof Dataset)[];

export type ClientScopedCollection = (typeof CLIENT_SCOPED_COLLECTIONS)[number];
