import {
  BarChart3,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Layers,
  Settings,
  Users,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string; // relative to /c/:clientId
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: 'overview', label: 'Client Overview', short: 'Overview', icon: LayoutDashboard },
  { path: 'leadership', label: 'Leadership', short: 'Leadership', icon: Users },
  { path: 'portfolio', label: 'Portfolio Readiness', short: 'Portfolio', icon: BarChart3 },
  { path: 'workstreams', label: 'Accountable Initiatives', short: 'Initiatives', icon: Layers },
  { path: 'meetings', label: 'Meetings', short: 'Meetings', icon: CalendarClock },
  { path: 'actions', label: 'Actions & Decisions', short: 'Actions', icon: ClipboardCheck },
  { path: 'reports', label: 'Reports', short: 'Reports', icon: FileText },
  { path: 'admin', label: 'Administration', short: 'Admin', icon: Settings },
];
