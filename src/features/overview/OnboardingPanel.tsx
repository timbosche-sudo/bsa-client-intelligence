import { CircleDashed } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StageTag } from '@/components/ui/StageNotice';
import type { ClientWorkspace } from '@/data/repository';

const STEPS = [
  { title: 'Confirm relationship lead and executive sponsor', stage: 2 },
  { title: 'Build the Client Team roster and leadership structure', stage: 2 },
  { title: 'Add or import the project portfolio', stage: 2 },
  { title: 'Define strategic workstreams and initiatives', stage: 3 },
  { title: 'Configure the kickoff meeting template', stage: 4 },
];

/** Shown for workspaces that exist but have not been configured (e.g. Memorial Health). */
export function OnboardingPanel({ ws }: { ws: ClientWorkspace }) {
  return (
    <Card className="p-6 sm:p-8">
      <p className="eyebrow mb-2">Workspace setup</p>
      <h2 className="text-xl font-semibold tracking-tight">{ws.client.name} has not been configured yet</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        This workspace is separate from every other client. Nothing has been recorded here, so no portfolio, readiness or accountability information is shown.
      </p>
      <ol className="mt-6 flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <li key={i} className="flex min-h-12 items-center gap-3 rounded-lg border border-line bg-surface-2 px-4">
            <CircleDashed size={16} className="shrink-0 text-subtle" aria-hidden />
            <span className="flex-1 text-sm">{s.title}</span>
            <StageTag stage={s.stage} />
          </li>
        ))}
      </ol>
    </Card>
  );
}
