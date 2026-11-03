import { BarChart3, FileText, Handshake, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageNotice, StageTag } from '@/components/ui/StageNotice';
import { ConfidentialityBadge } from '@/components/status';
import type { Confidentiality } from '@/domain/types';
import { useRequiredWorkspace } from '@/state/useWorkspace';

const REPORTS: { title: string; icon: typeof FileText; level: Confidentiality; body: string }[] = [
  { title: 'Internal Client Team Report', icon: FileText, level: 'internal', body: 'Executive summary, workstream updates, confirmed decisions, risks, actions, champions and next meeting.' },
  { title: 'Individual Accountability Brief', icon: UserCheck, level: 'internal', body: 'One person’s initiatives, actions, due dates, dependencies and recent decisions affecting their work.' },
  { title: 'Client Alignment Report', icon: Handshake, level: 'approved', body: 'External-facing. Includes only content explicitly approved for client release, after review and approval.' },
  { title: 'Portfolio Readiness Report', icon: BarChart3, level: 'internal', body: 'Inventory, status, milestones, readiness assessments, resource gaps, open decisions and risks.' },
];

export function ReportsPage() {
  const ws = useRequiredWorkspace();
  return (
    <>
      <PageHeader eyebrow={ws.client.name} title="Reports" description="Reports are generated from the workspace’s current records — never maintained as separate copies." />
      <StageNotice stage={5} className="mb-6">
        PDF preview and export, report history, confidentiality controls and approval workflow for client-facing reports. Automated email delivery is not planned for Prototype Mode.
      </StageNotice>
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map(({ title, icon: Icon, level, body }) => (
          <Card key={title} className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-surface-3 text-accent"><Icon size={18} aria-hidden /></span>
              <StageTag stage={5} />
            </div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted">{body}</p>
            <div className="mt-auto pt-2"><ConfidentialityBadge level={level} /></div>
          </Card>
        ))}
      </div>
    </>
  );
}
