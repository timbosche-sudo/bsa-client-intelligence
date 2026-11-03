import type { ChecklistTemplate } from './types';

export const HOSPITAL_RESTART_TEMPLATE_ID = 'template_restart_hospital_8';

/**
 * Eight restart considerations from the preparation document by Teri Joy (Part 9 of the brief).
 * Applied to a project only after its identity and scope are confirmed. Not tied to any project here.
 */
export function hospitalRestartTemplate(clientId: string | null, at = '2026-11-03T00:00:00.000Z'): ChecklistTemplate {
  const item = (n: number, title: string, guidance: string[]) => ({ id: `tri_${n}`, title, guidance });
  return {
    id: HOSPITAL_RESTART_TEMPLATE_ID,
    createdAt: at,
    updatedAt: at,
    archivedAt: null,
    clientId,
    name: 'Hospital restart readiness — 8 considerations',
    description: 'Restart planning for a paused hospital expansion. Use the program comparison, change log and leadership summary tools as needed.',
    source: 'Preparation document by Teri Joy (restart considerations).',
    items: [
      item(1, 'Program and cost history', [
        'Compare original, approved and proposed programs.',
        'Document cost drivers and the approvals behind each change.',
      ]),
      item(2, 'BSA team alignment', ['Confirm the BSA leadership and delivery team for the restart.', 'Agree internal roles, decision authority and escalation.']),
      item(3, 'Coordination with client leadership', ['Identify client decision-makers and their priorities for the restart.', 'Establish client change-control procedures.']),
      item(4, 'Strategy and service mix', ['Evaluate the clinical service mix and how it affects the program.']),
      item(5, '150-bed care model', ['Separate the proposed 150-bed addition from unrelated changes.', 'Confirm the care model assumptions behind the bed count.']),
      item(6, 'Support services and infrastructure', ['Assess hospital support requirements and infrastructure capacity.']),
      item(7, 'Options for right-sizing', ['Develop options to right-size scope against budget and need.', 'Clarify phasing assumptions.']),
      item(8, 'Schedule and early decisions', ['Evaluate the construction schedule and long-lead decisions.', 'List the early client decisions required to hold the schedule.']),
    ],
  };
}
