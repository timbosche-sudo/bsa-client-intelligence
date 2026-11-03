import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Wordmark } from '@/brand/Wordmark';
import { cn } from '@/lib/cn';
import { usePreferences } from '@/state/preferences';
import { NAV_ITEMS } from './navigation';
import { PrototypeBadge } from './PrototypeBadge';

export function NavList({ clientId, collapsed, onNavigate }: { clientId: string; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
        <li key={path}>
          <NavLink
            to={`/c/${clientId}/${path}`}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-surface-3 font-medium text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
                <Icon size={18} className={cn(isActive ? 'text-accent' : 'text-subtle group-hover:text-muted')} aria-hidden />
                {!collapsed && <span className="truncate">{label}</span>}
                {collapsed && <span className="sr-only">{label}</span>}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** Persistent sidebar for desktop and iPad landscape (≥1024px). */
export function Sidebar({ clientId }: { clientId: string }) {
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const toggle = usePreferences((s) => s.toggleSidebar);
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface safe-top lg:flex',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
      aria-label="Primary"
    >
      <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center' : 'px-5')}>
        <Wordmark compact={collapsed} />
      </div>
      <nav className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-3' : 'px-3')}>
        <NavList clientId={clientId} collapsed={collapsed} />
      </nav>
      <div className={cn('flex flex-col gap-2 border-t border-line p-3 safe-bottom', collapsed && 'items-center')}>
        {!collapsed && <PrototypeBadge variant="panel" />}
        <button
          type="button"
          onClick={toggle}
          className={cn('flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-subtle hover:bg-surface-2 hover:text-ink', collapsed && 'justify-center px-0 w-11')}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  );
}
