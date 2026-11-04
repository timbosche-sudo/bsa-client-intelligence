import { useEffect, useState } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { usePreferences } from '@/state/preferences';
import { useWorkspace } from '@/state/useWorkspace';
import { ClientSelector } from './ClientSelector';
import { MobileNav } from './MobileNav';
import { ProfileMenu } from './ProfileMenu';
import { PrototypeBadge } from './PrototypeBadge';
import { QuickAddMenu } from './QuickAddMenu';
import { SaveIndicator } from './SaveIndicator';
import { SearchDialog } from './SearchDialog';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { clientId } = useParams();
  const workspace = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const setLastClientId = usePreferences((s) => s.setLastClientId);
  const sidebarCollapsed = usePreferences((s) => s.sidebarCollapsed);
  const toggleSidebar = usePreferences((s) => s.toggleSidebar);

  useEffect(() => {
    if (workspace) setLastClientId(workspace.client.id);
  }, [workspace?.client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        usePreferences.getState().toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!workspace || !clientId) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast">
        Skip to content
      </a>
      <Sidebar clientId={clientId} />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} clientId={clientId} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md safe-top">
          <div className="flex h-16 items-center gap-2 px-3 safe-x sm:gap-3 sm:px-5 lg:px-8">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden size-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink lg:inline-flex"
              aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!sidebarCollapsed}
              aria-keyshortcuts="Control+Backslash Meta+Backslash"
              title={sidebarCollapsed ? 'Show menu labels (⌘\\)' : 'Collapse menu to icons (⌘\\)'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <div className="min-w-0 flex-1">
              <ClientSelector current={workspace.client} />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-subtle hover:border-line-strong hover:text-muted max-md:w-11 max-md:justify-center max-md:px-0"
              aria-keyshortcuts="Control+K Meta+K"
            >
              <Search size={17} aria-hidden />
              <span className="sr-only md:not-sr-only">Search</span>
              <kbd aria-hidden className="ml-4 hidden rounded border border-line px-1.5 text-[10px] text-subtle lg:inline">⌘K</kbd>
            </button>
            <SaveIndicator />
            <span className="hidden sm:inline-flex"><PrototypeBadge /></span>
            <QuickAddMenu clientId={clientId} />
            <ProfileMenu />
          </div>
          <p className="flex items-center justify-center gap-1.5 border-t border-caution/20 bg-caution-soft px-4 py-1 text-[11px] font-medium text-caution sm:hidden">
            Prototype Mode · data saved in this browser only
          </p>
        </header>
        <main id="main" className="flex-1 px-4 pb-16 pt-6 sm:px-6 md:pt-8 lg:px-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1400px] safe-x">
            <Outlet />
          </div>
        </main>
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} workspace={workspace} />
    </div>
  );
}
