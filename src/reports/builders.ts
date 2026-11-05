/**
 * Report builders (Part 12). Pure functions: ClientWorkspace → ReportDoc.
 *
 * - Every builder reads only the given client workspace, so other clients' data cannot appear.
 * - Reports are generated from current records; nothing is invented. Unknown values print as
 *   "To be confirmed" / "Not assessed".
 * - The client alignment report includes ONLY records classified "Approved for Client Release"
 *   and never includes risks, fees, readiness, staffing, notes or meeting discussion.
 */
import { commitmentsFor } from '@/data/accountability';
import { meetingCaptures, meetingTime, upcomingMilestonesWithin } from '@/data/meetingSelectors';
import { active, isOverdue, portfolioSummary, todayIso, type ClientWorkspace } from '@/data/repository';
import { ACTION_STATUS_LABELS, DECISION_STATUS_LABELS, INITIATIVE_STATUS_LABELS, OPEN_ACTION_STATUSES, PENDING_DECISION_STATUSES, PRIORITY_LABELS, SEVERITY_LABELS, WORKSTREAM_STATUS_LABELS } from '@/domain/labels';
import { READINESS_LABELS, type ActionItem, type ID, type Project, type ReadinessStatus, type ReportBlock, type ReportDoc, type ReportKind, type ReportSection } from '@/domain/types';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';

export interface BuildContext {
  preparedBy: string;
  version: number;
  now?: Date;
}

export const REPORT_TITLES: Record<ReportKind, string> = {
  internal_team: 'Internal Client Team Report',
  accountability_brief: 'Individual Accountability Brief',
  client_alignment: 'Client Alignment Report',
  portfolio_readiness: 'Portfolio Readiness Report',
};

const TBC = 'To be confirmed';
const d = (iso: string | null | undefined) => (iso ? formatDate(iso, TBC) : TBC);
const SHORT_READINESS: Record<ReadinessStatus, string> = { ready: 'Ready', partially_ready: 'Partial', not_ready: 'Not ready', not_applicable: 'N/A', not_assessed: 'Not assessed' };

function header(ws: ClientWorkspace, kind: ReportKind, ctx: BuildContext, subtitle: string, confidentiality: ReportDoc['confidentiality']): Omit<ReportDoc, 'sections' | 'reviewNotes'> {
  return {
    kind,
    title: REPORT_TITLES[kind],
    subtitle,
    clientName: ws.client.name,
    generatedAt: (ctx.now ?? new Date()).toISOString(),
    preparedBy: ctx.preparedBy,
    version: ctx.version,
    confidentiality,
  };
}

const nameOf = (ws: ClientWorkspace, id: ID | null | undefined) => (id ? ws.people.find((p) => p.id === id)?.fullName ?? 'Unknown' : 'Unassigned');
const wsTitle = (ws: ClientWorkspace, id: ID | null) => (id ? ws.workstreams.find((w) => w.id === id)?.title ?? '' : '');
const related = (ws: ClientWorkspace, r: { workstreamId: ID | null; projectId: ID | null; initiativeId: ID | null }) =>
  [ws.projects.find((p) => p.id === r.projectId)?.name, ws.initiatives.find((i) => i.id === r.initiativeId)?.title, wsTitle(ws, r.workstreamId)].filter(Boolean).join(' · ') || '—';
const dueLabel = (a: ActionItem, today: string) => (a.dueDate ? `${formatDate(a.dueDate)}${isOverdue(a, today) ? ' (overdue)' : ''}` : 'No due date');
const byDue = (a: ActionItem, b: ActionItem) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');

function actionsTable(ws: ClientWorkspace, actions: ActionItem[], today: string, opts: { owner?: boolean; empty: string }): ReportBlock {
  return {
    type: 'table',
    columns: [{ header: 'Action', width: '*' }, ...(opts.owner === false ? [] : [{ header: 'Owner', width: 90 as const }]), { header: 'Due', width: 80 }, { header: 'Status', width: 62 }, { header: 'Related', width: 120 }],
    rows: actions.map((a) => [a.title, ...(opts.owner === false ? [] : [nameOf(ws, a.ownerId)]), dueLabel(a, today), ACTION_STATUS_LABELS[a.status], related(ws, a)]),
    empty: opts.empty,
  };
}

/** Deterministic executive summary from recorded facts (not AI). */
export function summaryFromRecords(ws: ClientWorkspace, today = todayIso()): string {
  const open = active(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status));
  const overdue = open.filter((a) => isOverdue(a, today)).length;
  const unowned = open.filter((a) => !a.ownerId).length;
  const pending = active(ws.decisions).filter((x) => PENDING_DECISION_STATUSES.includes(x.status)).length;
  const approved = active(ws.decisions).filter((x) => x.status === 'approved').length;
  const serious = active(ws.risks).filter((r) => r.kind !== 'opportunity' && r.status !== 'closed' && (r.severity === 'high' || r.severity === 'critical')).length;
  const initiatives = active(ws.initiatives).filter((i) => i.status === 'active' || i.status === 'proposed').length;
  const parts = [
    `${ws.client.name} has ${open.length} open action${open.length === 1 ? '' : 's'}${overdue ? `, ${overdue} overdue` : ''}${unowned ? ` and ${unowned} without an accountable owner` : ''}.`,
    `${approved} decision${approved === 1 ? ' is' : 's are'} approved and ${pending} ${pending === 1 ? 'is' : 'are'} pending.`,
    `${initiatives} action plan${initiatives === 1 ? ' is' : 's are'} proposed or active.`,
    serious ? `${serious} high or critical risk${serious === 1 ? '' : 's'}/issue${serious === 1 ? '' : 's'} require attention.` : 'No high or critical risks or issues are open.',
  ];
  return parts.join(' ');
}

/* ───────────────────────── 12.1 Internal Client Team Report ───────────────────────── */

export function buildInternalTeamReport(ws: ClientWorkspace, params: { meetingId?: ID | null; executiveSummary?: string }, ctx: BuildContext): ReportDoc {
  const today = (ctx.now ?? new Date()).toISOString().slice(0, 10);
  const meeting = params.meetingId ? ws.meetings.find((m) => m.id === params.meetingId) ?? null : null;
  const open = active(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status)).sort(byDue);
  const decisions = active(ws.decisions);
  const caps = meeting ? meetingCaptures(ws, meeting.id) : null;
  const windowStart = new Date(Date.parse(today) - 90 * 86400000).toISOString().slice(0, 10);
  const confirmed = decisions.filter((x) => x.status === 'approved' && (x.meetingId === meeting?.id || (x.approval?.approvedAt ?? x.date ?? '') >= windowStart));
  const pending = decisions.filter((x) => PENDING_DECISION_STATUSES.includes(x.status));
  const risks = active(ws.risks)
    .filter((r) => r.kind !== 'opportunity' && r.status !== 'closed')
    .sort((a, b) => ['critical', 'high', 'medium', 'low', 'not_assessed'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low', 'not_assessed'].indexOf(b.severity));
  const streams = active(ws.workstreams).sort((a, b) => a.order - b.order);
  const nextMeeting = active(ws.meetings).filter((m) => m.status === 'scheduled' && m.id !== meeting?.id).sort((a, b) => meetingTime(a).localeCompare(meetingTime(b)))[0];
  const summary = params.executiveSummary?.trim() || meeting?.summary?.trim() || summaryFromRecords(ws, today);

  const sections: ReportSection[] = [
    {
      title: meeting ? 'Client and meeting' : 'Client',
      blocks: [
        {
          type: 'kv',
          items: [
            ['Client', ws.client.name],
            ['Relationship lead', nameOf(ws, ws.client.relationshipLeadId)],
            ['Executive sponsor', ws.client.executiveSponsorId ? nameOf(ws, ws.client.executiveSponsorId) : 'Not yet assigned'],
            ...(meeting
              ? ([
                  ['Meeting', meeting.title],
                  ['Date', meeting.startsAt ? formatDate(meeting.startsAt) : d(meeting.startedAt)],
                  ['Facilitator', nameOf(ws, meeting.facilitatorId)],
                  ['Attendees', meeting.attendeeIds.map((id) => nameOf(ws, id)).join(', ') || 'Not recorded'],
                  ['Record status', meeting.status === 'finalized' ? `Finalized by ${meeting.finalizedByName}` : 'Not yet finalized'],
                ] as [string, string][])
              : ([['Reporting date', formatDate(today)]] as [string, string][])),
          ],
        },
      ],
    },
    {
      title: 'Executive summary',
      blocks: [
        { type: 'paragraph', text: summary },
        {
          type: 'stats',
          items: [
            ['Open actions', String(open.length)],
            ['Overdue', String(open.filter((a) => isOverdue(a, today)).length)],
            ['Pending decisions', String(pending.length)],
            ['Open risks & issues', String(risks.length)],
            ['Active action plans', String(active(ws.initiatives).filter((i) => i.status === 'active').length)],
          ],
        },
      ],
    },
    { title: 'Major priorities', blocks: [ws.client.strategicPriorities.length ? { type: 'list', items: ws.client.strategicPriorities } : { type: 'paragraph', text: 'No strategic priorities recorded.', muted: true }] },
    {
      title: 'Accountable initiative updates',
      blocks: [
        {
          type: 'table',
          columns: [{ header: '#', width: 18, align: 'right' }, { header: 'Initiative', width: '*' }, { header: 'Champion', width: 90 }, { header: 'Status', width: 55 }, { header: 'Open actions', width: 55, align: 'right' }, { header: 'Action plans', width: 52, align: 'right' }, { header: 'Pending decisions', width: 55, align: 'right' }],
          rows: streams.map((w) => {
            const acts = open.filter((a) => a.workstreamId === w.id);
            const od = acts.filter((a) => isOverdue(a, today)).length;
            return [String(w.order), w.title, nameOf(ws, w.championId), WORKSTREAM_STATUS_LABELS[w.status], `${acts.length}${od ? ` (${od} overdue)` : ''}`, String(active(ws.initiatives).filter((i) => i.workstreamId === w.id && i.status !== 'complete' && i.status !== 'cancelled').length), String(pending.filter((x) => x.workstreamId === w.id).length)];
          }),
          empty: 'No initiatives defined.',
        },
      ],
    },
    {
      title: 'Confirmed decisions',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Decision', width: '*' }, { header: 'Date', width: 72 }, { header: 'Approved by', width: 95 }, { header: 'Related', width: 120 }],
          rows: confirmed.map((x) => [x.title, d(x.date ?? x.approval?.approvedAt), nameOf(ws, x.approval?.approvedById), related(ws, x)]),
          empty: meeting ? 'No decisions were confirmed in this meeting or the last 90 days.' : 'No decisions approved in the last 90 days.',
        },
        ...(pending.length
          ? ([{ type: 'table', columns: [{ header: 'Pending decision', width: '*' }, { header: 'Status', width: 75 }, { header: 'Owner', width: 95 }, { header: 'Related', width: 120 }], rows: pending.map((x) => [x.title, DECISION_STATUS_LABELS[x.status], nameOf(ws, x.ownerId), related(ws, x)]) }] as ReportBlock[])
          : []),
      ],
    },
    {
      title: 'Important risks and issues',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Risk / issue', width: '*' }, { header: 'Type', width: 45 }, { header: 'Severity', width: 62 }, { header: 'Owner', width: 90 }, { header: 'Response', width: 140 }],
          rows: risks.map((r) => [r.title, r.kind === 'issue' ? 'Issue' : 'Risk', SEVERITY_LABELS[r.severity], nameOf(ws, r.ownerId), r.mitigation || '—']),
          empty: 'No open risks or issues recorded.',
        },
      ],
    },
    ...(caps
      ? [{ title: 'New actions from this meeting', blocks: [actionsTable(ws, [...caps.actions].sort(byDue), today, { empty: 'No actions were assigned in this meeting.' })] }]
      : []),
    { title: 'Outstanding actions', blocks: [actionsTable(ws, caps ? open.filter((a) => a.meetingId !== meeting!.id) : open, today, { empty: 'No outstanding actions.' })] },
    {
      title: 'Accountable champions',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Area', width: 70 }, { header: 'Name', width: '*' }, { header: 'Champion', width: 110 }, { header: 'Status', width: 70 }],
          rows: [
            ...streams.map((w) => ['Initiative', w.title, nameOf(ws, w.championId), WORKSTREAM_STATUS_LABELS[w.status]]),
            ...active(ws.initiatives).filter((i) => i.status !== 'cancelled').map((i) => ['Action plan', i.title, nameOf(ws, i.championId), INITIATIVE_STATUS_LABELS[i.status]]),
          ],
          empty: 'No initiatives or action plans.',
        },
      ],
    },
    {
      title: 'Upcoming milestones',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Milestone', width: '*' }, { header: 'Timing', width: 140 }, { header: 'Confirmed', width: 60 }],
          rows: upcomingMilestonesWithin(ws, 365, today).map((m) => [m.title, m.date ? formatDate(m.date) : m.timingNote || TBC, m.confirmed ? 'Yes' : 'No']),
          empty: 'No upcoming milestones recorded.',
        },
      ],
    },
    {
      title: 'Next meeting',
      blocks: [
        { type: 'kv', items: [['Next scheduled', nextMeeting ? `${nextMeeting.title}${nextMeeting.startsAt ? ` — ${formatDate(nextMeeting.startsAt)}` : ''}` : 'Not yet scheduled']] },
        ...(meeting?.nextMeetingTopics.length ? ([{ type: 'list', items: meeting.nextMeetingTopics }] as ReportBlock[]) : []),
      ],
    },
  ];
  return { ...header(ws, 'internal_team', ctx, meeting ? meeting.title : `Status as of ${formatDate(today)}`, 'internal'), sections, reviewNotes: [] };
}

/* ───────────────────────── 12.2 Individual Accountability Brief ───────────────────────── */

export function buildAccountabilityBrief(ws: ClientWorkspace, params: { personId: ID }, ctx: BuildContext): ReportDoc {
  const today = (ctx.now ?? new Date()).toISOString().slice(0, 10);
  const c = commitmentsFor(ws, params.personId, today);
  const p = c.person;
  const roles = ws.memberships.filter((m) => m.personId === params.personId && !m.archivedAt).map((m) => m.role);
  const actionIds = [...c.actions.accountable, ...c.actions.supporting];
  const projectIds = new Set<ID>([...actionIds.map((a) => a.projectId), ...c.initiatives.champion.flatMap((i) => i.relatedProjectIds), ...c.initiatives.involved.flatMap((i) => i.relatedProjectIds), ...c.checklistItems.map((i) => i.projectId)].filter((x): x is ID => !!x));
  const projects = [...projectIds].map((id) => ws.projects.find((x) => x.id === id)).filter((x): x is Project => !!x && !x.archivedAt);
  const dependencies = [
    ...projects.flatMap((pr) => pr.delivery.dependencies.map((dep) => `${pr.name}: ${dep}`)),
    ...[...c.decisions.owned, ...c.decisions.involved].filter((x) => x.dependencies.trim()).map((x) => `Decision “${x.title}”: ${x.dependencies.trim()}`),
  ];
  const initiatives = [...c.initiatives.champion.map((i) => ({ i, role: 'Champion' })), ...c.initiatives.involved.map((i) => ({ i, role: 'Involved' }))];

  const sections: ReportSection[] = [
    {
      title: 'Person and role',
      blocks: [
        {
          type: 'kv',
          items: [
            ['Name', p?.fullName ?? 'Unknown'],
            ['Title', p?.title ?? TBC],
            ['Organization', [p?.organization, p?.studio && `${p.studio} studio`].filter(Boolean).join(' · ') || TBC],
            ['Client Team role', roles.join(' · ') || 'No Client Team role recorded'],
          ],
        },
        {
          type: 'stats',
          items: [
            ['Actions owned', String(c.actions.accountable.length)],
            ['Overdue', String(c.overdue)],
            ['Supporting', String(c.actions.supporting.length)],
            ['Action plans', String(initiatives.length)],
            ['Decisions to resolve', String(c.decisions.owned.length)],
          ],
        },
      ],
    },
    { title: 'Actions you are accountable for', blocks: [actionsTable(ws, c.actions.accountable, today, { owner: false, empty: 'No open actions owned.' })] },
    ...(c.actions.supporting.length ? [{ title: 'Actions you are supporting', blocks: [actionsTable(ws, c.actions.supporting, today, { empty: '' })] }] : []),
    {
      title: 'Assigned action plans',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Action plan', width: '*' }, { header: 'Role', width: 60 }, { header: 'Target', width: 75 }, { header: 'Status', width: 60 }, { header: 'Desired outcome', width: 150 }],
          rows: initiatives.map(({ i, role }) => [i.title, role, d(i.targetDate), INITIATIVE_STATUS_LABELS[i.status], i.desiredOutcome || '—']),
          empty: 'No active action plans.',
        },
      ],
    },
    {
      title: 'Decisions to resolve',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Decision', width: '*' }, { header: 'Status', width: 75 }, { header: 'Your role', width: 70 }, { header: 'Related', width: 130 }],
          rows: [...c.decisions.owned.map((x) => [x.title, DECISION_STATUS_LABELS[x.status], 'Owner', related(ws, x)]), ...c.decisions.involved.map((x) => [x.title, DECISION_STATUS_LABELS[x.status], 'Involved', related(ws, x)])],
          empty: 'No pending decisions.',
        },
      ],
    },
    {
      title: 'Recent decisions affecting your work',
      blocks: [{ type: 'table', columns: [{ header: 'Decision', width: '*' }, { header: 'Date', width: 75 }, { header: 'Related', width: 150 }], rows: c.decisions.recentApproved.map((x) => [x.title, d(x.date ?? x.approval?.approvedAt), related(ws, x)]), empty: 'None recorded.' }],
    },
    { title: 'Dependencies', blocks: [dependencies.length ? { type: 'list', items: dependencies } : { type: 'paragraph', text: 'No dependencies recorded on related projects or decisions.', muted: true }] },
    {
      title: 'Related projects',
      blocks: [{ type: 'table', columns: [{ header: 'Project', width: '*' }, { header: 'Number', width: 80 }, { header: 'Overall readiness', width: 90 }], rows: projects.map((x) => [x.name + (x.isSample ? ' (sample)' : ''), x.projectNumber ?? '—', READINESS_LABELS[x.overallReadiness.status]]), empty: 'No related projects.' }],
    },
    ...(c.risks.length ? [{ title: 'Open risks and issues you own', blocks: [{ type: 'table', columns: [{ header: 'Title', width: '*' }, { header: 'Severity', width: 70 }, { header: 'Response', width: 170 }], rows: c.risks.map((r) => [r.title, SEVERITY_LABELS[r.severity], r.mitigation || '—']) } as ReportBlock] }] : []),
    ...(c.checklistItems.length
      ? [{ title: 'Restart checklist items', blocks: [{ type: 'table', columns: [{ header: 'Item', width: '*' }, { header: 'Project', width: 150 }, { header: 'Due', width: 75 }], rows: c.checklistItems.map((i) => [i.itemTitle, ws.projects.find((x) => x.id === i.projectId)?.name ?? '—', d(i.dueDate)]) } as ReportBlock] }]
      : []),
  ];
  return { ...header(ws, 'accountability_brief', ctx, p?.fullName ?? 'Unknown person', 'internal'), sections, reviewNotes: [] };
}

/* ───────────────────────── 12.3 Client Alignment Report ───────────────────────── */

export function buildClientAlignmentReport(ws: ClientWorkspace, _params: Record<string, never>, ctx: BuildContext): ReportDoc {
  const today = (ctx.now ?? new Date()).toISOString().slice(0, 10);
  const ok = <T extends { confidentiality: string; archivedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.archivedAt && r.confidentiality === 'approved');
  const notOk = <T extends { confidentiality: string; archivedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.archivedAt && r.confidentiality !== 'approved');
  const candidates = <T extends { confidentiality: string; archivedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.archivedAt && r.confidentiality === 'candidate').length;

  const streams = ok(ws.workstreams).sort((a, b) => a.order - b.order);
  const initiatives = ok(ws.initiatives).filter((i) => i.status !== 'cancelled');
  const decisions = ok(ws.decisions);
  const confirmed = decisions.filter((x) => x.status === 'approved');
  const needsInput = decisions.filter((x) => PENDING_DECISION_STATUSES.includes(x.status));
  const actions = ok(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status)).sort(byDue);
  const isClientOwned = (a: ActionItem) => ws.people.find((p) => p.id === a.ownerId)?.affiliation === 'client';
  const clientActions = actions.filter(isClientOwned);
  const bsaActions = actions.filter((a) => !isClientOwned(a));
  const milestones = ok(ws.milestones).filter((m) => m.status === 'upcoming').sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  const nothing = !streams.length && !initiatives.length && !decisions.length && !actions.length && !milestones.length;
  const linkLabel = (r: { workstreamId: ID | null; initiativeId: ID | null }) =>
    [initiatives.find((i) => i.id === r.initiativeId)?.title, streams.find((w) => w.id === r.workstreamId)?.title].filter(Boolean).join(' · ') || '—';

  const sections: ReportSection[] = [
    ...(nothing ? [{ title: 'Status', blocks: [{ type: 'callout', tone: 'caution', text: 'No content has been approved for client release. Mark records “Approved for Client Release” to include them.' } as ReportBlock] }] : []),
    {
      title: 'Joint priorities',
      blocks: [
        streams.length || initiatives.length
          ? { type: 'list', items: [...streams.map((w) => `${w.title}${w.purpose ? ` — ${w.purpose}` : ''}`), ...initiatives.map((i) => `${i.title}${i.desiredOutcome ? ` — ${i.desiredOutcome}` : ''}`)] }
          : { type: 'paragraph', text: 'No priorities approved for release.', muted: true },
      ],
    },
    {
      title: 'Confirmed decisions',
      blocks: [{ type: 'table', columns: [{ header: 'Decision', width: '*' }, { header: 'Date', width: 80 }, { header: 'Area', width: 150 }], rows: confirmed.map((x) => [x.title, d(x.date ?? x.approval?.approvedAt), linkLabel(x)]), empty: 'No confirmed decisions approved for release.' }],
    },
    {
      title: 'BSA responsibilities',
      blocks: [{ type: 'table', columns: [{ header: 'Commitment', width: '*' }, { header: 'Lead', width: 100 }, { header: 'Target date', width: 80 }], rows: bsaActions.map((a) => [a.title, a.ownerId ? nameOf(ws, a.ownerId) : 'BSA team', d(a.dueDate)]), empty: 'None approved for release.' }],
    },
    {
      title: `${ws.client.shortName || ws.client.name} responsibilities`,
      blocks: [
        { type: 'paragraph', text: 'Proposed requests are BSA’s requests awaiting confirmation. Confirmed commitments have been agreed by the responsible person.', muted: true },
        { type: 'table', columns: [{ header: 'Item', width: '*' }, { header: 'Responsible', width: 100 }, { header: 'Target date', width: 75 }, { header: 'Standing', width: 95 }], rows: clientActions.map((a) => [a.title, nameOf(ws, a.ownerId), d(a.dueDate), a.commitment === 'confirmed' ? 'Confirmed commitment' : 'Proposed request']), empty: 'None approved for release.' },
      ],
    },
    {
      title: 'Items requiring client input',
      blocks: [{ type: 'table', columns: [{ header: 'Item', width: '*' }, { header: 'Status', width: 80 }, { header: 'Area', width: 150 }], rows: needsInput.map((x) => [x.title, DECISION_STATUS_LABELS[x.status], linkLabel(x)]), empty: 'None approved for release.' }],
    },
    {
      title: 'Upcoming milestones',
      blocks: [{ type: 'table', columns: [{ header: 'Milestone', width: '*' }, { header: 'Timing', width: 140 }, { header: 'Standing', width: 70 }], rows: milestones.map((m) => [m.title, m.date ? formatDate(m.date) : m.timingNote || TBC, m.confirmed ? 'Confirmed' : 'Tentative']), empty: 'None approved for release.' }],
    },
    {
      title: 'Next steps',
      blocks: [
        actions.length
          ? { type: 'list', items: actions.slice(0, 8).map((a) => `${a.title} — ${isClientOwned(a) ? nameOf(ws, a.ownerId) : 'BSA'}${a.dueDate ? `, by ${formatDate(a.dueDate)}` : ''}`) }
          : { type: 'paragraph', text: 'No next steps approved for release.', muted: true },
      ],
    },
  ];

  const excluded = [
    ['initiatives', notOk(ws.workstreams).length],
    ['action plans', notOk(ws.initiatives).length],
    ['decisions', notOk(ws.decisions).length],
    ['open actions', notOk(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status)).length],
    ['milestones', notOk(ws.milestones).length],
  ].filter(([, n]) => (n as number) > 0);
  const cand = candidates(ws.workstreams) + candidates(ws.initiatives) + candidates(ws.decisions) + candidates(ws.actions) + candidates(ws.milestones);
  const reviewNotes = [
    excluded.length ? `Excluded because not approved for client release: ${excluded.map(([l, n]) => `${n} ${l}`).join(', ')}.` : 'All initiatives, action plans, decisions, open actions and milestones are approved for release.',
    ...(cand ? [`${cand} record${cand === 1 ? ' is' : 's are'} marked “Candidate for Client Sharing” — approve individually to include.`] : []),
    'Never included: risks and issues, fees and financial data, readiness assessments, staffing and performance matters, notes, and meeting discussion.',
    `${clientActions.filter((a) => a.commitment !== 'confirmed').length} client item(s) are labeled as proposed requests, ${clientActions.filter((a) => a.commitment === 'confirmed').length} as confirmed commitments.`,
  ];
  void today;
  return { ...header(ws, 'client_alignment', ctx, `${ws.client.name} and BSA`, 'approved'), sections, reviewNotes };
}

/* ───────────────────────── 12.4 Portfolio Readiness Report ───────────────────────── */

export function buildPortfolioReadinessReport(ws: ClientWorkspace, params: { categories: string[] }, ctx: BuildContext): ReportDoc {
  const today = (ctx.now ?? new Date()).toISOString().slice(0, 10);
  const cats = [...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order);
  const catLabel = (id: string) => cats.find((c) => c.id === id)?.label ?? id;
  const projects = active(ws.projects)
    .filter((p) => params.categories.includes(p.categoryId))
    .sort((a, b) => (cats.find((c) => c.id === a.categoryId)?.order ?? 99) - (cats.find((c) => c.id === b.categoryId)?.order ?? 99) || a.name.localeCompare(b.name));
  const ids = new Set(projects.map((p) => p.id));
  const name = (p: Project) => p.name + (p.isSample ? ' (sample)' : '');
  const pname = (id: ID | null) => (id ? (ws.projects.find((p) => p.id === id)?.name ?? '—') : '—');
  const summary = portfolioSummary(ws, { excludeCategories: cats.map((c) => c.id).filter((c) => !params.categories.includes(c)) });
  const dims = [...ws.client.config.readinessDimensions].sort((a, b) => a.order - b.order);
  const roleGaps = (p: Project) => p.delivery.seats.filter((s) => !s.personId).map((s) => s.role);
  const principal = (p: Project) => (p.businessDevelopment.relationshipPrincipalId ? nameOf(ws, p.businessDevelopment.relationshipPrincipalId) : p.businessDevelopment.relationshipPrincipalRaw ?? TBC);

  const sections: ReportSection[] = [
    {
      title: 'Portfolio summary',
      blocks: [
        { type: 'kv', items: [['Categories included', params.categories.map(catLabel).join(', ') || 'None'], ['Reporting date', formatDate(today)]] },
        {
          type: 'stats',
          items: [
            ['Projects', String(projects.length)],
            ...summary.byCategory.filter((c) => c.count).map((c) => [c.label, String(c.count)] as [string, string]),
            ['Known BSA fee', summary.projectsWithFee ? formatCurrency(summary.knownFeeTotal, { compact: true }) : TBC],
            ['Readiness assessed', `${summary.readiness.assessed} of ${summary.total}`],
          ],
        },
        ...(summary.projectsMissingFee ? ([{ type: 'paragraph', text: `${summary.projectsMissingFee} project(s) have no recorded fee and are excluded from the fee total.`, muted: true }] as ReportBlock[]) : []),
      ],
    },
    {
      title: 'Portfolio inventory',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'No.', width: 62 }, { header: 'Project', width: '*' }, { header: 'Category', width: 55 }, { header: 'Principal', width: 80 }, { header: 'BSA fee', width: 62, align: 'right' }, { header: 'Prob.', width: 34, align: 'right' }, { header: 'Start', width: 62 }],
          rows: projects.map((p) => [p.projectNumber ?? '—', name(p), catLabel(p.categoryId), principal(p), formatCurrency(p.businessDevelopment.bsaFee, { empty: TBC }), formatPercent(p.businessDevelopment.pipelineProbability, '—'), d(p.businessDevelopment.anticipatedStart)]),
          empty: 'No projects in the selected categories.',
        },
      ],
    },
    {
      title: 'Readiness assessments',
      blocks: [
        { type: 'paragraph', text: 'Explicit assessments recorded by accountable leaders. No scores are calculated; “Not assessed” means no assessment has been recorded.', muted: true },
        {
          type: 'table',
          columns: [{ header: 'Project', width: '*' }, ...dims.map((dim) => ({ header: dim.label, width: 50 as const })), { header: 'Overall', width: 54 }],
          rows: projects.map((p) => [name(p), ...dims.map((dim) => SHORT_READINESS[p.readiness[dim.id]?.status ?? 'not_assessed']), SHORT_READINESS[p.overallReadiness.status]]),
          empty: 'No projects.',
        },
      ],
    },
    {
      title: 'Key milestones',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Project', width: 150 }, { header: 'Milestone', width: '*' }, { header: 'Timing', width: 110 }, { header: 'Confirmed', width: 55 }],
          rows: active(ws.milestones).filter((m) => m.projectId && ids.has(m.projectId) && m.status === 'upcoming').sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')).map((m) => [pname(m.projectId), m.title, m.date ? formatDate(m.date) : m.timingNote || TBC, m.confirmed ? 'Yes' : 'No']),
          empty: 'No project milestones recorded.',
        },
      ],
    },
    {
      title: 'Resource gaps',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Project', width: 150 }, { header: 'Unassigned leadership roles', width: '*' }, { header: 'Staffing', width: 60 }],
          rows: projects
            .map((p) => [name(p), roleGaps(p).join(', ') || 'All key roles assigned', SHORT_READINESS[p.readiness.staffing?.status ?? 'not_assessed']])
            .filter((r) => r[1] !== 'All key roles assigned' || r[2] === 'Not ready' || r[2] === 'Partial'),
          empty: 'No resource gaps recorded.',
        },
      ],
    },
    {
      title: 'Open decisions',
      blocks: [{ type: 'table', columns: [{ header: 'Decision', width: '*' }, { header: 'Project', width: 150 }, { header: 'Status', width: 75 }, { header: 'Owner', width: 85 }], rows: active(ws.decisions).filter((x) => x.projectId && ids.has(x.projectId) && PENDING_DECISION_STATUSES.includes(x.status)).map((x) => [x.title, pname(x.projectId), DECISION_STATUS_LABELS[x.status], nameOf(ws, x.ownerId)]), empty: 'No open decisions linked to these projects.' }],
    },
    {
      title: 'Critical risks',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Risk / issue', width: '*' }, { header: 'Project', width: 140 }, { header: 'Severity', width: 60 }, { header: 'Owner', width: 85 }],
          rows: active(ws.risks).filter((r) => r.projectId && ids.has(r.projectId) && r.kind !== 'opportunity' && r.status !== 'closed').sort((a, b) => ['critical', 'high', 'medium', 'low', 'not_assessed'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low', 'not_assessed'].indexOf(b.severity)).map((r) => [r.title, pname(r.projectId), SEVERITY_LABELS[r.severity], nameOf(ws, r.ownerId)]),
          empty: 'No open risks or issues linked to these projects.',
        },
      ],
    },
    {
      title: 'Recommended actions',
      blocks: [
        {
          type: 'table',
          columns: [{ header: 'Action', width: '*' }, { header: 'Project', width: 130 }, { header: 'Owner', width: 85 }, { header: 'Due', width: 75 }, { header: 'Priority', width: 48 }],
          rows: active(ws.actions).filter((a) => a.projectId && ids.has(a.projectId) && OPEN_ACTION_STATUSES.includes(a.status)).sort(byDue).map((a) => [a.title, pname(a.projectId), nameOf(ws, a.ownerId), dueLabel(a, today), PRIORITY_LABELS[a.priority]]),
          empty: 'No open actions linked to these projects.',
        },
      ],
    },
  ];
  const sample = projects.some((p) => p.isSample);
  return { ...header(ws, 'portfolio_readiness', ctx, params.categories.map(catLabel).join(' · ') || 'No categories', 'internal'), sections, reviewNotes: sample ? ['Includes fictional sample projects (marked “sample”).'] : [] };
}

export function buildReport(ws: ClientWorkspace, kind: ReportKind, params: Record<string, unknown>, ctx: BuildContext): ReportDoc {
  switch (kind) {
    case 'internal_team':
      return buildInternalTeamReport(ws, params as { meetingId?: ID | null; executiveSummary?: string }, ctx);
    case 'accountability_brief':
      return buildAccountabilityBrief(ws, params as { personId: ID }, ctx);
    case 'client_alignment':
      return buildClientAlignmentReport(ws, {}, ctx);
    case 'portfolio_readiness':
      return buildPortfolioReadinessReport(ws, params as { categories: string[] }, ctx);
  }
}
