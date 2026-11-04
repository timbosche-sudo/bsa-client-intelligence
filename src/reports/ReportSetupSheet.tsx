import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ListRestart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { FieldError, SelectField, TextArea, TextField } from '@/components/form/fields';
import { getAiProvider } from '@/ai/aiProvider';
import { commitmentSummary } from '@/data/accountability';
import { meetingTime } from '@/data/meetingSelectors';
import { active, type ClientWorkspace } from '@/data/repository';
import type { ReportKind } from '@/domain/types';
import { formatDate } from '@/lib/format';
import { currentUserName, run } from '@/state/actions';
import { REPORT_TITLES, summaryFromRecords } from './builders';
import { createReport } from './reportMutations';

export function ReportSetupSheet({ ws, kind, initial, onClose, onCreated }: { ws: ClientWorkspace; kind: ReportKind; initial?: Record<string, string>; onClose(): void; onCreated(id: string): void }) {
  const [preparedBy, setPreparedBy] = useState(currentUserName());
  const [meetingId, setMeetingId] = useState(initial?.meeting ?? '');
  const [summary, setSummary] = useState('');
  const [personId, setPersonId] = useState(initial?.person ?? commitmentSummary(ws)[0]?.person.id ?? ws.people[0]?.id ?? '');
  const [categories, setCategories] = useState<string[]>(['potential', 'active', 'paused'].filter((c) => ws.client.config.portfolioCategories.some((x) => x.id === c)));
  const [error, setError] = useState('');
  const ai = getAiProvider();
  const meetings = active(ws.meetings).filter((m) => m.status !== 'scheduled' && m.status !== 'cancelled').sort((a, b) => meetingTime(b).localeCompare(meetingTime(a)));
  const approvedCounts = useMemo(() => {
    const n = <T extends { confidentiality: string; archivedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.archivedAt && r.confidentiality === 'approved').length;
    return { workstreams: n(ws.workstreams), initiatives: n(ws.initiatives), decisions: n(ws.decisions), actions: n(ws.actions), milestones: n(ws.milestones) };
  }, [ws]);
  const totalApproved = Object.values(approvedCounts).reduce((a, b) => a + b, 0);

  const params = (): Record<string, unknown> => {
    if (kind === 'internal_team') return { meetingId: meetingId || null, executiveSummary: summary.trim() || undefined };
    if (kind === 'accountability_brief') return { personId };
    if (kind === 'portfolio_readiness') return { categories };
    return {};
  };

  const generate = () => {
    let id = '';
    const r = run((d) => void (id = createReport(d, { clientId: ws.client.id, kind, params: params(), preparedBy }).id), { clientId: ws.client.id, entity: 'report', entityId: null, summary: `Generated ${REPORT_TITLES[kind]}` });
    if (r.ok) {
      onClose();
      onCreated(id);
    } else setError(r.error ?? '');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={REPORT_TITLES[kind]}
      description={kind === 'client_alignment' ? 'External-facing. Generated as a draft that must be reviewed and approved before release.' : 'Internal Only. Generated from current records.'}
      footer={
        <>
          {error && <span className="mr-auto"><FieldError>{error}</FieldError></span>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<FileText size={16} />} onClick={generate}>{kind === 'client_alignment' ? 'Generate draft' : 'Generate report'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {kind === 'internal_team' && (
          <>
            <SelectField
              label="Meeting"
              value={meetingId}
              onChange={setMeetingId}
              placeholder="No meeting — current status report"
              options={meetings.map((m) => ({ value: m.id, label: `${m.title} · ${formatDate(meetingTime(m))}${m.status === 'finalized' ? '' : ' (not finalized)'}` }))}
              hint="Selecting a meeting adds meeting details, new actions and next-meeting topics."
            />
            <div className="flex flex-col gap-2">
              <TextArea label="Executive summary" rows={5} value={summary} onChange={setSummary} hint="Leave blank to use the meeting summary, or a summary generated from records." />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<ListRestart size={15} />} onClick={() => setSummary(summaryFromRecords(ws))}>Draft from records</Button>
                <Button size="sm" variant="ghost" icon={<Sparkles size={15} />} disabled title={ai.unavailableReason ?? undefined}>Draft with AI</Button>
              </div>
              <p className="text-xs text-subtle">“Draft from records” composes facts already recorded (not AI). {ai.unavailableReason}</p>
            </div>
          </>
        )}
        {kind === 'accountability_brief' && (
          <SelectField label="Person" required value={personId} onChange={setPersonId} options={ws.people.filter((p) => !p.archivedAt).map((p) => ({ value: p.id, label: p.fullName }))} hint="People in this client workspace." />
        )}
        {kind === 'portfolio_readiness' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">Portfolio categories</legend>
            {[...ws.client.config.portfolioCategories].sort((a, b) => a.order - b.order).map((c) => (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 text-sm">
                <input type="checkbox" checked={categories.includes(c.id)} onChange={(e) => setCategories(e.target.checked ? [...categories, c.id] : categories.filter((x) => x !== c.id))} className="size-4 accent-[var(--accent)]" />
                {c.label}
                <span className="ml-auto text-xs text-subtle">{active(ws.projects).filter((p) => p.categoryId === c.id).length}</span>
              </label>
            ))}
          </fieldset>
        )}
        {kind === 'client_alignment' && (
          <div className="flex flex-col gap-3 text-sm">
            <p>Only records classified <strong>Approved for Client Release</strong> are included. Risks, fees, readiness, staffing, notes and meeting discussion are never included.</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.entries(approvedCounts).map(([k, n]) => (
                <div key={k} className="rounded-lg border border-line p-2.5">
                  <dt className="text-xs capitalize text-subtle">{k}</dt>
                  <dd className="tabular text-xl font-black">{n}</dd>
                </div>
              ))}
            </dl>
            {totalApproved === 0 && <p className="border-l-2 border-bsa-yellow bg-surface-2 px-3 py-2">Nothing is approved for client release yet. Set the confidentiality of workstreams, initiatives, decisions, actions or milestones to “Approved for Client Release” first.</p>}
            <Link to={`/c/${ws.client.id}/actions`} onClick={onClose} className="inline-flex min-h-11 items-center self-start font-bold text-accent hover:underline">Review classifications in Actions & Decisions</Link>
          </div>
        )}
        <TextField label="Prepared by" required value={preparedBy} onChange={setPreparedBy} />
      </div>
    </Sheet>
  );
}
