import { Lock, Share2, ShieldCheck } from 'lucide-react';
import { ACTION_STATUS_LABELS, DECISION_STATUS_LABELS, INITIATIVE_STATUS_LABELS, PRIORITY_LABELS, WORKSTREAM_STATUS_LABELS } from '@/domain/labels';
import {
  CONFIDENTIALITY_LABELS,
  READINESS_LABELS,
  type ActionStatus,
  type Confidentiality,
  type DecisionStatus,
  type InitiativeStatus,
  type Priority,
  type ReadinessStatus,
  type WorkstreamStatus,
} from '@/domain/types';
import { Badge, type Tone } from './ui/Badge';

const readinessTone: Record<ReadinessStatus, Tone> = {
  not_assessed: 'outline',
  ready: 'positive',
  partially_ready: 'caution',
  not_ready: 'negative',
  not_applicable: 'neutral',
};
export const ReadinessBadge = ({ status }: { status: ReadinessStatus }) => (
  <Badge tone={readinessTone[status]} dot={status !== 'not_assessed'}>
    {READINESS_LABELS[status]}
  </Badge>
);

const actionTone: Record<ActionStatus, Tone> = {
  not_started: 'outline',
  in_progress: 'accent',
  waiting: 'neutral',
  blocked: 'negative',
  complete: 'positive',
  cancelled: 'neutral',
};
export const ActionStatusBadge = ({ status }: { status: ActionStatus }) => <Badge tone={actionTone[status]}>{ACTION_STATUS_LABELS[status]}</Badge>;

const decisionTone: Record<DecisionStatus, Tone> = {
  proposed: 'outline',
  under_review: 'caution',
  approved: 'positive',
  deferred: 'neutral',
  rejected: 'negative',
  superseded: 'neutral',
};
export const DecisionStatusBadge = ({ status }: { status: DecisionStatus }) => <Badge tone={decisionTone[status]}>{DECISION_STATUS_LABELS[status]}</Badge>;

export const InitiativeStatusBadge = ({ status }: { status: InitiativeStatus }) => (
  <Badge tone={status === 'active' ? 'accent' : status === 'complete' ? 'positive' : 'outline'}>{INITIATIVE_STATUS_LABELS[status]}</Badge>
);

export const WorkstreamStatusBadge = ({ status }: { status: WorkstreamStatus }) => (
  <Badge tone={status === 'active' ? 'accent' : 'outline'}>{WORKSTREAM_STATUS_LABELS[status]}</Badge>
);

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <Badge tone={priority === 'high' ? 'caution' : 'neutral'}>{PRIORITY_LABELS[priority]}</Badge>
);

const confIcon = { internal: Lock, candidate: Share2, approved: ShieldCheck };
export function ConfidentialityBadge({ level }: { level: Confidentiality }) {
  const Icon = confIcon[level];
  return (
    <Badge tone={level === 'approved' ? 'positive' : level === 'candidate' ? 'caution' : 'neutral'}>
      <Icon size={11} aria-hidden />
      {CONFIDENTIALITY_LABELS[level]}
    </Badge>
  );
}

export const SampleBadge = () => <Badge tone="outline">Sample</Badge>;
