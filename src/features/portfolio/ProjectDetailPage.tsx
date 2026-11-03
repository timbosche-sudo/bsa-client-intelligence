import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { ReadinessBadge, SampleBadge } from '@/components/status';
import { mediaStore } from '@/data/media/MediaStore';
import { deleteProject, findProjectReferences, setProjectArchived, upsertProject } from '@/data/mutations';
import { currentUserName, run } from '@/state/actions';
import { useDataStore } from '@/state/store';
import { useRequiredWorkspace } from '@/state/useWorkspace';
import { ProjectCover } from './ProjectCover';
import { ProjectEditSheet } from './ProjectEditSheet';
import { HistoryTab } from './tabs/HistoryTab';
import { ActionsTab, RisksDecisionsTab } from './tabs/LinkedRecordsTabs';
import { LeadershipTab } from './tabs/LeadershipTab';
import { MediaTab } from './tabs/MediaTab';
import { MilestonesTab } from './tabs/MilestonesTab';
import { OverviewTab } from './tabs/OverviewTab';
import { ReadinessTab } from './tabs/ReadinessTab';

const TAB_IDS = ['overview', 'leadership', 'readiness', 'milestones', 'risks', 'actions', 'media', 'history'] as const;
type TabId = (typeof TAB_IDS)[number];

export function ProjectDetailPage() {
  const ws = useRequiredWorkspace();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | 'delete' | 'archive'>(null);
  const data = useDataStore((s) => s.data)!;
  const project = ws.projects.find((p) => p.id === projectId);

  if (!project) {
    return (
      <Card>
        <EmptyState title="Project not found in this workspace" action={<Link to={`/c/${ws.client.id}/portfolio`} className="font-bold text-accent hover:underline">Back to portfolio</Link>}>
          It may have been deleted, or it belongs to a different client.
        </EmptyState>
      </Card>
    );
  }

  const tab: TabId = (TAB_IDS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as TabId) : 'overview';
  const setTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const cats = [...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order);
  const refs = findProjectReferences(data, project.id);
  const counts = {
    milestones: ws.milestones.filter((m) => m.projectId === project.id && !m.archivedAt).length,
    risks: ws.risks.filter((r) => r.projectId === project.id).length + ws.decisions.filter((d) => d.projectId === project.id).length,
    actions: ws.actions.filter((a) => a.projectId === project.id).length,
    media: project.imageIds.length + project.documentLinks.length,
  };
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'leadership', label: 'Leadership & Resources' },
    { id: 'readiness', label: 'Scope & Readiness' },
    { id: 'milestones', label: 'Milestones', count: counts.milestones },
    { id: 'risks', label: 'Risks & Decisions', count: counts.risks },
    { id: 'actions', label: 'Actions', count: counts.actions },
    { id: 'media', label: 'Images & Documents', count: counts.media },
    { id: 'history', label: 'History', count: project.history.length },
  ];

  const changeCategory = (categoryId: string) => {
    if (categoryId === project.categoryId) return;
    run((d) => upsertProject(d, { ...project, categoryId }, currentUserName()), {
      clientId: ws.client.id,
      entity: 'project',
      entityId: project.id,
      summary: `Moved "${project.name}" to ${cats.find((c) => c.id === categoryId)?.label ?? categoryId}`,
    });
  };

  const archive = () => {
    const archived = !project.archivedAt;
    run((d) => setProjectArchived(d, project.id, archived, currentUserName()), { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: `${archived ? 'Archived' : 'Restored'} "${project.name}"` });
    setConfirm(null);
  };

  const remove = () => {
    let purge: string[] = [];
    const r = run((d) => void (purge = deleteProject(d, project.id)), { clientId: ws.client.id, entity: 'project', entityId: project.id, summary: `Deleted "${project.name}"` });
    if (r.ok) {
      purge.forEach((id) => void mediaStore().delete(id).catch(() => undefined));
      navigate(`/c/${ws.client.id}/portfolio`);
    }
  };

  return (
    <>
      <Link to={`/c/${ws.client.id}/portfolio`} className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Portfolio
      </Link>

      <header className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="eyebrow">{project.projectNumber ?? 'No project number'}</p>
            {project.isSample && <SampleBadge />}
            {project.archivedAt && <Badge tone="caution">Archived</Badge>}
            {project.provenance && <Badge tone="outline">Imported</Badge>}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-balance md:text-[32px] md:leading-tight">{project.name}</h1>
          <p className="mt-2 text-sm text-muted">{[project.projectType, project.location, project.studio && `${project.studio} studio`].filter(Boolean).join(' · ') || 'Type, location and studio to be confirmed'}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-surface pl-3 text-sm">
              <span className="text-subtle">Category</span>
              <select value={project.categoryId} onChange={(e) => changeCategory(e.target.value)} aria-label="Portfolio category" className="h-full rounded-r-lg bg-transparent pr-3 font-bold outline-none">
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <span className="text-subtle">Readiness</span>
              <ReadinessBadge status={project.overallReadiness.status} />
            </span>
            <div className="flex flex-wrap gap-2 sm:ml-auto lg:ml-0">
              <Button variant="primary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="ghost" icon={project.archivedAt ? <ArchiveRestore size={16} /> : <Archive size={16} />} onClick={() => (project.archivedAt ? archive() : setConfirm('archive'))}>
                {project.archivedAt ? 'Restore' : 'Archive'}
              </Button>
              <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirm('delete')}>Delete</Button>
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setTab('media')} className="aspect-[16/10] overflow-hidden rounded-xl border border-line" aria-label="Open project images">
          <ProjectCover mediaId={project.coverImageId} alt={project.name} />
        </button>
      </header>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Project sections" idPrefix="project" />
      <TabPanel idPrefix="project" id={tab}>
        {tab === 'overview' && <OverviewTab ws={ws} project={project} />}
        {tab === 'leadership' && <LeadershipTab ws={ws} project={project} onEdit={() => setEditing(true)} />}
        {tab === 'readiness' && <ReadinessTab ws={ws} project={project} />}
        {tab === 'milestones' && <MilestonesTab ws={ws} project={project} />}
        {tab === 'risks' && <RisksDecisionsTab ws={ws} project={project} />}
        {tab === 'actions' && <ActionsTab ws={ws} project={project} />}
        {tab === 'media' && <MediaTab ws={ws} project={project} />}
        {tab === 'history' && <HistoryTab ws={ws} project={project} />}
      </TabPanel>

      {editing && <ProjectEditSheet ws={ws} open projectId={project.id} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={confirm === 'archive'} title={`Archive "${project.name}"?`} confirmLabel="Archive" onClose={() => setConfirm(null)} onConfirm={archive}>
        Archived projects leave current views but keep their history, images and links. You can restore them at any time.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete "${project.name}"?`}
        confirmLabel="Delete permanently"
        tone="danger"
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        blockedReason={refs.length ? <>This project has {refs.length} related record(s) ({refs.slice(0, 3).join('; ')}{refs.length > 3 ? '…' : ''}). Archive it instead to preserve history.</> : undefined}
      >
        This permanently removes the project, its images and its history from this browser. This cannot be undone. Consider archiving instead.
      </ConfirmDialog>
    </>
  );
}
