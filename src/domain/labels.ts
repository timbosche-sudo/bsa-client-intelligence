import type {
  ActionStatus,
  ClientStatus,
  DecisionStatus,
  InitiativeStatus,
  Priority,
  RiskSeverity,
  WorkstreamStatus,
} from './types';

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  blocked: 'Blocked',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const OPEN_ACTION_STATUSES: ActionStatus[] = ['not_started', 'in_progress', 'waiting', 'blocked'];

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  proposed: 'Proposed',
  under_review: 'Under Review',
  approved: 'Approved',
  deferred: 'Deferred',
  rejected: 'Rejected',
  superseded: 'Superseded',
};

export const PENDING_DECISION_STATUSES: DecisionStatus[] = ['proposed', 'under_review'];

export const INITIATIVE_STATUS_LABELS: Record<InitiativeStatus, string> = {
  proposed: 'Proposed',
  active: 'Active',
  on_hold: 'On Hold',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const WORKSTREAM_STATUS_LABELS: Record<WorkstreamStatus, string> = {
  active: 'Active',
  planned: 'Planned',
  paused: 'Paused',
  archived: 'Archived',
};

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  not_assessed: 'Not Assessed',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Active',
  onboarding: 'Onboarding',
  archived: 'Archived',
};
