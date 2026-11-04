import { Building2, CalendarPlus, ClipboardPlus, FolderPlus, Gavel, Plus, ShieldPlus, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePopover } from '@/lib/usePopover';


/** Quick-add entry point. Items whose editors are not built yet are shown as disabled with their stage. */
export function QuickAddMenu({ clientId }: { clientId: string }) {
  const { open, setOpen, toggle, ref } = usePopover();
  const navigate = useNavigate();
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-11 items-center justify-center gap-2 rounded-lg bg-brand font-bold text-brand-contrast hover:bg-brand-strong md:w-auto md:px-4 md:text-sm"
      >
        <Plus size={18} aria-hidden />
        <span className="sr-only md:not-sr-only">New</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
          <p className="eyebrow px-2.5 pb-1.5 pt-2">Create</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate(`/c/${clientId}/admin?newClient=1`);
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-surface-3"
          >
            <Building2 size={16} className="text-accent" aria-hidden /> Client workspace
          </button>
          {[
            { label: 'Project', icon: FolderPlus, to: `/c/${clientId}/portfolio?new=1` },
            { label: 'Person', icon: UserPlus, to: `/c/${clientId}/leadership?newPerson=1` },
            { label: 'Action', icon: ClipboardPlus, to: `/c/${clientId}/actions?new=action` },
            { label: 'Decision', icon: Gavel, to: `/c/${clientId}/actions?tab=decisions&new=decision` },
            { label: 'Risk or issue', icon: ShieldPlus, to: `/c/${clientId}/actions?tab=risks&new=risk` },
            { label: 'Meeting', icon: CalendarPlus, to: `/c/${clientId}/meetings?new=1` },
          ].map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(to);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-surface-3"
            >
              <Icon size={16} className="text-accent" aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
