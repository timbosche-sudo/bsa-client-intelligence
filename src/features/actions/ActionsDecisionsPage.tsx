import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardPlus, Download, Gavel, Search, ShieldPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { active, isOverdue, type ClientWorkspace } from '@/data/repository';
import { ACTION_STATUS_LABELS, DECISION_STATUS_LABELS, OPEN_ACTION_STATUSES, PENDING_DECISION_STATUSES, PRIORITY_LABELS, SEVERITY_LABELS } from '@/domain/labels';
import { CONFIDENTIALITY_LABELS, type ActionItem } from '@/domain/types';
import { csvFilename, downloadCsv } from '@/services/csv';
import { cn } from '@/lib/cn';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { ActionList, DecisionList, RiskList } from '@/features/strategy/RecordRows';
import { RISK_KIND_LABELS } from '@/features/strategy/RiskSheet';
import { useRecordSheet } from '@/features/strategy/useRecordSheet';
import { AccountabilityTab } from './AccountabilityTab';

const TABS = ['actions', 'decisions', 'risks', 'accountability'] as const;
type TabId = (typeof TABS)[number];

export function ActionsDecisionsPage() {
  const ws = useRequiredWorkspace();
  const [params, setParams] = useSearchParams();
  const { open, sheet } = useRecordSheet(ws);
  const tab: TabId = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as TabId) : 'actions';
  const get = (k: string, d = '') => params.get(k) ?? d;
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };

  // Quick-add deep links: ?new=action|decision|risk
  useEffect(() => {
    const kind = params.get('new');
    if (kind === 'action' || kind === 'decision' || kind === 'risk') {
      open({ kind, id: null });
      const n = new URLSearchParams(params);
      n.delete('new');
      setParams(n, { replace: true });
    }
  }, [params, setParams, open]);

  const counts = {
    actions: active(ws.actions).filter((a) => OPEN_ACTION_STATUSES.includes(a.status)).length,
    decisions: active(ws.decisions).filter((d) => PENDING_DECISION_STATUSES.includes(d.status)).length,
    risks: active(ws.risks).filter((r) => r.status !== 'closed').length,
  };

  return (
    <>
      <PageHeader
        eyebrow={ws.client.name}
        title="Actions & Decisions"
        description="Commitments stay visible across meetings until closed. Decisions are recorded separately from actions and notes, and nothing is approved without an approval record."
        actions={
          <>
            <Button icon={<ShieldPlus size={16} />} onClick={() => open({ kind: 'risk', id: null })}>Risk / issue</Button>
            <Button icon={<Gavel size={16} />} onClick={() => open({ kind: 'decision', id: null })}>Decision</Button>
            <Button variant="primary" icon={<ClipboardPlus size={16} />} onClick={() => open({ kind: 'action', id: null })}>Action</Button>
          </>
        }
      />
      <Tabs
        idPrefix="ad"
        label="Actions and decisions sections"
        value={tab}
        onChange={(t) => setParams(t === 'actions' ? {} : { tab: t }, { replace: true })}
        tabs={[
          { id: 'actions', label: 'Actions', count: counts.actions },
          { id: 'decisions', label: 'Decisions', count: counts.decisions },
          { id: 'risks', label: 'Risks & opportunities', count: counts.risks },
          { id: 'accountability', label: 'Accountability' },
        ]}
      />
      <TabPanel idPrefix="ad" id={tab}>
        {tab === 'actions' && <ActionsTab ws={ws} get={get} set={set} onOpen={(id) => open({ kind: 'action', id })} />}
        {tab === 'decisions' && <DecisionsTab ws={ws} get={get} set={set} onOpen={(id) => open({ kind: 'decision', id })} />}
        {tab === 'risks' && <RisksTab ws={ws} get={get} set={set} onOpen={(id) => open({ kind: 'risk', id })} />}
        {tab === 'accountability' && <AccountabilityTab ws={ws} personId={get('person')} onPerson={(id) => set('person', id)} onOpen={open} />}
      </TabPanel>
      {sheet}
    </>
  );
}

type FilterProps = { ws: ClientWorkspace; get(k: string, d?: string): string; set(k: string, v: string): void; onOpen(id: string): void };

function Select({ label, value, onChange, options }: { label: string; value: string; onChange(v: string): void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn('h-11 min-w-0 rounded-lg border bg-surface px-3 text-sm', value ? 'border-accent text-ink' : 'border-line text-muted')}>
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange(v: string): void; placeholder: string }) {
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-accent">
      <Search size={16} className="shrink-0 text-subtle" aria-hidden />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-w-0 flex-1 self-stretch bg-transparent text-base outline-none placeholder:text-subtle sm:text-sm" />
    </label>
  );
}

function ActionsTab({ ws, get, set, onOpen }: FilterProps) {
  const status = get('status', 'open');
  const owner = get('owner');
  const workstream = get('ws');
  const project = get('project');
  const priority = get('priority');
  const overdueOnly = get('overdue') === '1';
  const group = get('group');
  const q = get('q').toLowerCase();

  const rows = useMemo(() => {
    return active(ws.actions)
      .filter((a) => (status === 'open' ? OPEN_ACTION_STATUSES.includes(a.status) : status === 'all' ? true : a.status === status))
      .filter((a) => !owner || (owner === 'none' ? !a.ownerId : a.ownerId === owner))
      .filter((a) => !workstream || (workstream === 'none' ? !a.workstreamId : a.workstreamId === workstream))
      .filter((a) => !project || a.projectId === project)
      .filter((a) => !priority || a.priority === priority)
      .filter((a) => !overdueOnly || isOverdue(a))
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
      .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title));
  }, [ws, status, owner, workstream, project, priority, overdueOnly, q]);

  const groups: { key: string; title: string; items: ActionItem[] }[] = useMemo(() => {
    if (group === 'workstream') {
      const keys = [...new Set(rows.map((a) => a.workstreamId ?? ''))];
      return keys
        .map((k) => {
          const w = ws.workstreams.find((x) => x.id === k);
          return { key: k, title: w ? `${w.order}. ${w.title}` : 'No workstream', order: w?.order ?? 999, items: rows.filter((a) => (a.workstreamId ?? '') === k) };
        })
        .sort((a, b) => a.order - b.order);
    }
    if (group === 'owner') {
      const keys = [...new Set(rows.map((a) => a.ownerId ?? ''))];
      return keys
        .map((k) => ({ key: k, title: ws.people.find((p) => p.id === k)?.fullName ?? 'Unassigned', items: rows.filter((a) => (a.ownerId ?? '') === k) }))
        .sort((a, b) => (a.key ? 0 : 1) - (b.key ? 0 : 1) || a.title.localeCompare(b.title));
    }
    return [{ key: 'all', title: '', items: rows }];
  }, [rows, group, ws]);

  const peopleWithActions = ws.people.filter((p) => ws.actions.some((a) => a.ownerId === p.id));
  return (
    <>
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchBox value={get('q')} onChange={(v) => set('q', v)} placeholder="Search actions" />
          <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted">
            <input type="checkbox" checked={overdueOnly} onChange={(e) => set('overdue', e.target.checked ? '1' : '')} className="size-4 accent-[var(--accent)]" /> Overdue only
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <select value={status} onChange={(e) => set('status', e.target.value === 'open' ? '' : e.target.value)} aria-label="Status" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="open">Status: Open</option>
            <option value="all">Status: All</option>
            {Object.entries(ACTION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>Status: {l}</option>)}
          </select>
          <Select label="Owner" value={owner} onChange={(v) => set('owner', v)} options={[{ value: 'none', label: 'Unassigned' }, ...peopleWithActions.map((p) => ({ value: p.id, label: p.fullName }))]} />
          <Select label="Workstream" value={workstream} onChange={(v) => set('ws', v)} options={[...active(ws.workstreams).sort((a, b) => a.order - b.order).map((w) => ({ value: w.id, label: `${w.order}. ${w.title}` })), { value: 'none', label: 'No workstream' }]} />
          <Select label="Project" value={project} onChange={(v) => set('project', v)} options={active(ws.projects).filter((p) => ws.actions.some((a) => a.projectId === p.id)).map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Priority" value={priority} onChange={(v) => set('priority', v)} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
          <select value={group} onChange={(e) => set('group', e.target.value)} aria-label="Group by" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="">Group: None</option>
            <option value="workstream">Group: Workstream</option>
            <option value="owner">Group: Owner</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" role="status">{rows.length} action{rows.length === 1 ? '' : 's'}{rows.filter((a) => isOverdue(a)).length ? ` · ${rows.filter((a) => isOverdue(a)).length} overdue` : ''}</p>
          <Button
            size="sm"
            variant="ghost"
            icon={<Download size={15} />}
            onClick={() =>
              downloadCsv(csvFilename(ws.client.name, 'Actions'), [
                ['Action', 'Description', 'Owner', 'Supporting', 'Due date', 'Overdue', 'Priority', 'Status', 'Commitment', 'Workstream', 'Initiative', 'Project', 'Completed', 'Completion notes', 'Confidentiality'],
                ...rows.map((a) => [
                  a.title,
                  a.description,
                  ws.people.find((p) => p.id === a.ownerId)?.fullName ?? 'Unassigned',
                  a.participantIds.map((id) => ws.people.find((p) => p.id === id)?.fullName ?? '').filter(Boolean).join('; '),
                  a.dueDate,
                  isOverdue(a) ? 'Yes' : 'No',
                  PRIORITY_LABELS[a.priority],
                  ACTION_STATUS_LABELS[a.status],
                  a.commitment === 'confirmed' ? 'Confirmed' : 'Proposed',
                  ws.workstreams.find((w) => w.id === a.workstreamId)?.title,
                  ws.initiatives.find((i) => i.id === a.initiativeId)?.title,
                  ws.projects.find((p) => p.id === a.projectId)?.name,
                  a.completedAt,
                  a.completionNotes,
                  CONFIDENTIALITY_LABELS[a.confidentiality],
                ]),
              ])
            }
          >
            Export CSV
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <Card key={g.key} className="overflow-hidden">
            {g.title && <p className="border-b border-line-strong px-4 py-3 font-black tracking-tight sm:px-5">{g.title} <span className="tabular font-normal text-subtle">· {g.items.length}</span></p>}
            <ActionList ws={ws} actions={g.items} onOpen={onOpen} empty="No actions match these filters" />
          </Card>
        ))}
      </div>
    </>
  );
}

function DecisionsTab({ ws, get, set, onOpen }: FilterProps) {
  const status = get('dstatus', 'pending');
  const q = get('q').toLowerCase();
  const showArchived = get('archived') === '1';
  const rows = ws.decisions
    .filter((d) => showArchived || !d.archivedAt)
    .filter((d) => (status === 'pending' ? PENDING_DECISION_STATUSES.includes(d.status) : status === 'all' ? true : d.status === status))
    .filter((d) => !q || d.title.toLowerCase().includes(q))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title));
  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchBox value={get('q')} onChange={(v) => set('q', v)} placeholder="Search decisions" />
        <select value={status} onChange={(e) => set('dstatus', e.target.value === 'pending' ? '' : e.target.value)} aria-label="Decision status" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
          <option value="pending">Pending (proposed / under review)</option>
          <option value="all">All statuses</option>
          {Object.entries(DECISION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => set('archived', e.target.checked ? '1' : '')} className="size-4 accent-[var(--accent)]" /> Archived
        </label>
      </div>
      <Card className="overflow-hidden">
        <DecisionList ws={ws} decisions={rows} onOpen={onOpen} empty="No decisions match" />
      </Card>
    </>
  );
}

function RisksTab({ ws, get, set, onOpen }: FilterProps) {
  const kind = get('kind');
  const status = get('rstatus', 'open');
  const severity = get('severity');
  const rows = active(ws.risks)
    .filter((r) => !kind || r.kind === kind)
    .filter((r) => (status === 'open' ? r.status !== 'closed' : status === 'all' ? true : r.status === status))
    .filter((r) => !severity || r.severity === severity)
    .sort((a, b) => ['critical', 'high', 'medium', 'low', 'not_assessed'].indexOf(a.severity) - ['critical', 'high', 'medium', 'low', 'not_assessed'].indexOf(b.severity));
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        <Select label="Type" value={kind} onChange={(v) => set('kind', v)} options={Object.entries(RISK_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
        <select value={status} onChange={(e) => set('rstatus', e.target.value === 'open' ? '' : e.target.value)} aria-label="Status" className="h-11 rounded-lg border border-line bg-surface px-3 text-sm">
          <option value="open">Status: Open & monitoring</option>
          <option value="all">Status: All</option>
          <option value="closed">Status: Closed</option>
        </select>
        <Select label="Severity" value={severity} onChange={(v) => set('severity', v)} options={Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <Card className="overflow-hidden">
        <RiskList ws={ws} risks={rows} onOpen={onOpen} empty="Nothing matches these filters" />
      </Card>
    </>
  );
}
