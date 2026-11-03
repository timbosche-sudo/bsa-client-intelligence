import { useEffect } from 'react';
import { createHashRouter, Navigate, RouterProvider, useRouteError, Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { LocalStorageAdapter } from '@/data/persistence/LocalStorageAdapter';
import { listClients } from '@/data/repository';
import { AppShell } from '@/layout/AppShell';
import { ClientOverviewPage } from '@/features/overview/ClientOverviewPage';
import { LeadershipPage } from '@/features/leadership/LeadershipPage';
import { PortfolioPage } from '@/features/portfolio/PortfolioPage';
import { ProjectDetailPage } from '@/features/portfolio/ProjectDetailPage';
import { ImportPage } from '@/features/import/ImportPage';
import { WorkstreamsPage } from '@/features/workstreams/WorkstreamsPage';
import { MeetingsPage } from '@/features/meetings/MeetingsPage';
import { ActionsDecisionsPage } from '@/features/actions/ActionsDecisionsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { Button } from '@/components/ui/Button';
import { Toaster } from '@/components/ui/Toaster';
import { usePreferences } from '@/state/preferences';
import { useDataStore } from '@/state/store';
import { backupFilename, downloadJson } from '@/services/backup';

function RootRedirect() {
  const data = useDataStore((s) => s.data);
  const last = usePreferences((s) => s.lastClientId);
  if (!data) return null;
  const clients = listClients(data);
  const target = clients.find((c) => c.id === last) ?? clients[0];
  if (!target) return <Navigate to="/setup" replace />;
  return <Navigate to={`/c/${target.id}/overview`} replace />;
}

function NoClients() {
  const resetToDemo = useDataStore((s) => s.resetToDemo);
  return (
    <CenteredMessage title="No client workspaces" body="There are no active client workspaces in this browser.">
      <Button variant="primary" onClick={() => void resetToDemo()}>Load demonstration data</Button>
    </CenteredMessage>
  );
}

function RouteError() {
  const err = useRouteError();
  return (
    <CenteredMessage title="Something went wrong" body={err instanceof Error ? err.message : 'An unexpected error occurred while displaying this page.'}>
      <Link to="/" className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-bold text-brand-contrast">Return to overview</Link>
    </CenteredMessage>
  );
}

const router = createHashRouter([
  { path: '/', element: <RootRedirect />, errorElement: <RouteError /> },
  { path: '/setup', element: <NoClients /> },
  {
    path: '/c/:clientId',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: 'overview', element: <ClientOverviewPage /> },
      { path: 'leadership', element: <LeadershipPage /> },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'portfolio/import', element: <ImportPage /> },
      { path: 'portfolio/:projectId', element: <ProjectDetailPage /> },
      { path: 'workstreams', element: <WorkstreamsPage /> },
      { path: 'meetings', element: <MeetingsPage /> },
      { path: 'actions', element: <ActionsDecisionsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: '*', element: <Navigate to="overview" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

const adapter = new LocalStorageAdapter();

export default function App() {
  const { loadState, loadError, init, resetToDemo } = useDataStore();
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0b0d' : '#f4f5f6');
  }, [theme]);

  useEffect(() => {
    if (loadState === 'idle') void init(adapter);
  }, [loadState, init]);

  if (loadState === 'error') {
    const saveRaw = async () => {
      const raw = await adapter.load().catch(() => null);
      downloadJson(backupFilename().replace('backup', 'unreadable-data'), raw);
    };
    return (
      <CenteredMessage title="Stored data could not be loaded" body={loadError ?? 'Unknown error.'}>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={saveRaw}>Download stored data</Button>
          <Button variant="danger" onClick={() => void resetToDemo()}>Replace with demonstration data</Button>
        </div>
      </CenteredMessage>
    );
  }
  if (loadState !== 'ready') {
    return (
      <div className="flex min-h-dvh items-center justify-center text-subtle" role="status">
        <Loader2 className="mr-2 animate-spin" size={18} aria-hidden /> Loading workspace…
      </div>
    );
  }
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}

function CenteredMessage({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-4 text-caution" size={28} aria-hidden />
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
