import { ChevronRight, CircleDashed } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import type { ClientWorkspace } from '@/data/repository';

const STEPS: { title: string; to?: string }[] = [
  { title: 'Confirm relationship lead and executive sponsor', to: 'leadership' },
  { title: 'Build the Client Team roster and leadership structure', to: 'leadership' },
  { title: 'Add or import the project portfolio', to: 'portfolio' },
  { title: 'Define strategic initiatives and action plans', to: 'workstreams' },
  { title: 'Plan the Client Team kickoff meeting', to: 'meetings' },
];

/** Shown for workspaces that exist but have not been configured (e.g. Memorial Health). */
export function OnboardingPanel({ ws }: { ws: ClientWorkspace }) {
  return (
    <Card className="p-6 sm:p-8">
      <p className="eyebrow mb-2">Workspace setup</p>
      <h2 className="text-xl font-black tracking-tight">{ws.client.name} has not been configured yet</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        This workspace is separate from every other client. Nothing has been recorded here, so no portfolio, readiness or accountability information is shown.
      </p>
      <ol className="mt-6 flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={i}>
            {s.to ? (
              <Link to={`/c/${ws.client.id}/${s.to}`} className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 hover:border-line-strong">
                <CircleDashed size={16} className="shrink-0 text-subtle" aria-hidden />
                <span className="flex-1 text-sm font-bold">{s.title}</span>
                <ChevronRight size={16} className="text-subtle" aria-hidden />
              </Link>
            ) : (
              <div className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-surface-2 px-4">
                <CircleDashed size={16} className="shrink-0 text-subtle" aria-hidden />
                <span className="flex-1 text-sm">{s.title}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
