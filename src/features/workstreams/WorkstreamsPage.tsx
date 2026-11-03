import { ChevronDown, FileCheck2, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageNotice } from '@/components/ui/StageNotice';
import { ConfidentialityBadge, InitiativeStatusBadge, WorkstreamStatusBadge } from '@/components/status';
import { active, openActions, personName } from '@/data/repository';
import { useRequiredWorkspace } from '@/state/useWorkspace';

export function WorkstreamsPage() {
  const ws = useRequiredWorkspace();
  const streams = active(ws.workstreams).sort((a, b) => a.order - b.order);
  const actions = openActions(ws);

  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Strategic Workstreams" description="Delivery preparedness and proactive client value, organized into accountable workstreams." />
      <StageNotice stage={3} className="mb-6">
        Editing, reordering, archiving workstreams; managing initiatives, champions, risks and project restart checklists.
      </StageNotice>

      {streams.length === 0 ? (
        <Card>
          <EmptyState title="No workstreams defined for this client" />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {streams.map((w) => {
            const initiatives = active(ws.initiatives).filter((i) => i.workstreamId === w.id);
            const wsActions = actions.filter((a) => a.workstreamId === w.id);
            return (
              <Card key={w.id} className="overflow-hidden">
                <details className="group" open={w.order === 1}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-start gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                    <span className="tabular flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-accent-contrast">{w.order}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black tracking-tight">{w.title}</h2>
                        <WorkstreamStatusBadge status={w.status} />
                        <ConfidentialityBadge level={w.confidentiality} />
                      </div>
                      <p className="mt-1 text-sm text-muted">{w.purpose}</p>
                      <p className="mt-2 text-xs text-subtle">
                        Champion: {personName(ws, w.championId) ?? 'Unassigned'} · {initiatives.length} initiative{initiatives.length === 1 ? '' : 's'} · {wsActions.length} open action{wsActions.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <ChevronDown size={18} className="mt-2 shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="grid gap-6 border-t border-line p-4 sm:p-5 md:grid-cols-2">
                    <div>
                      <p className="eyebrow mb-3">Topics</p>
                      <ul className="flex flex-col gap-2">
                        {w.topics.map((t, i) => (
                          <li key={i} className="flex gap-2.5 text-sm">
                            <span className="mt-2 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-5">
                      <div>
                        <p className="eyebrow mb-2">Deliverable</p>
                        <p className="flex items-start gap-2 text-sm"><FileCheck2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />{w.deliverable}</p>
                      </div>
                      {w.confidentialityNote && <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">{w.confidentialityNote}</p>}
                      <div>
                        <p className="eyebrow mb-2">Initiatives</p>
                        {initiatives.length ? (
                          <ul className="flex flex-col gap-2">
                            {initiatives.map((i) => (
                              <li key={i.id} className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3">
                                <Target size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{i.title}</p>
                                  <p className="mt-0.5 text-xs text-subtle">Champion: {personName(ws, i.championId) ?? 'Unassigned'}</p>
                                </div>
                                <InitiativeStatusBadge status={i.status} />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-subtle">No initiatives yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
