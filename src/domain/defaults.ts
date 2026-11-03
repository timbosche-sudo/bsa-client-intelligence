import type { ClientConfig } from './types';

/**
 * Default workspace configuration applied to new clients.
 * Every value is editable per client (Administration, Stage 6) — nothing here is hardcoded per client.
 */
export function defaultClientConfig(): ClientConfig {
  return {
    portfolioCategories: [
      { id: 'potential', label: 'Potential', order: 1, builtIn: true, description: 'Pipeline opportunities not yet authorized.' },
      { id: 'active', label: 'Active', order: 2, builtIn: true, description: 'Authorized work in progress.' },
      { id: 'paused', label: 'Paused', order: 3, builtIn: true, description: 'Work on hold by the client or BSA.' },
      { id: 'completed', label: 'Completed', order: 4, builtIn: true, description: 'Delivered work retained for history.' },
      { id: 'archived', label: 'Archived', order: 5, builtIn: true, description: 'Removed from active views; history retained.' },
    ],
    leadershipTiers: [
      { id: 'executive', label: 'Executive Sponsorship', order: 1, description: 'Firm-level sponsorship, escalation authority and resource commitment.' },
      { id: 'relationship', label: 'Client Relationship Leadership', order: 2, description: 'Primary owner of the client relationship and strategic dialogue.' },
      { id: 'portfolio', label: 'Portfolio Delivery Leadership', order: 3, description: 'Oversight of delivery quality, staffing and coordination across projects.' },
      { id: 'project', label: 'Project Leadership', order: 4, description: 'Principals-in-charge and project managers for individual projects.' },
      { id: 'discipline', label: 'Discipline & Technical Leadership', order: 5, description: 'Design, planning, engineering and interiors technical leads.' },
    ],
    readinessDimensions: [
      { id: 'leadership', label: 'Leadership', order: 1, guidance: 'Accountable principal, PM and design leadership are confirmed and available.' },
      { id: 'staffing', label: 'Staffing', order: 2, guidance: 'Team capacity matches the anticipated schedule and scope.' },
      { id: 'scope', label: 'Scope', order: 3, guidance: 'Program and scope are defined well enough to plan resources.' },
      { id: 'budget', label: 'Budget', order: 4, guidance: 'Construction budget and fee basis are understood and agreed.' },
      { id: 'schedule', label: 'Schedule', order: 5, guidance: 'Authorization, start and key milestone dates are known.' },
      { id: 'client_decisions', label: 'Client Decisions', order: 6, guidance: 'Client decisions required to proceed are identified and on track.' },
    ],
  };
}
