import { personName, type ClientWorkspace } from '@/data/repository';
import type { Project } from '@/domain/types';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { DI, DL, Section } from './shared';

export function OverviewTab({ ws, project: p }: { ws: ClientWorkspace; project: Project }) {
  const bd = p.businessDevelopment;
  const proj = bd.revenueProjection;
  const total = proj?.periods.reduce((s, x) => s + (x.amount ?? 0), 0) ?? null;
  const max = proj ? Math.max(1, ...proj.periods.map((x) => x.amount ?? 0)) : 1;
  const sizeUnit = { sf: 'SF', beds: 'beds', other: '' }[p.size.unit];

  return (
    <div className="grid gap-8 xl:grid-cols-2">
      <div className="flex flex-col gap-8">
        <Section title="Project">
          <DL>
            <DI label="Description" value={p.description} wide />
            <DI label="Project type" value={p.projectType} />
            <DI label="Size" value={p.size.value !== null ? `${p.size.value.toLocaleString()} ${sizeUnit}`.trim() : null} tabular />
            <DI label="Location" value={p.location} />
            <DI label="Studio" value={p.studio} />
          </DL>
        </Section>
        <Section title="Business development">
          <DL>
            <DI label="Relationship principal" value={personName(ws, bd.relationshipPrincipalId) ?? (bd.relationshipPrincipalRaw ? `${bd.relationshipPrincipalRaw} (unmatched source value)` : null)} />
            <DI label="Pursuit principal" value={personName(ws, bd.pursuitPrincipalId)} />
            <DI label="Pipeline probability" value={bd.pipelineProbability !== null ? formatPercent(bd.pipelineProbability) : null} tabular />
            <DI label="Estimated construction cost" value={bd.estimatedConstructionCost !== null ? formatCurrency(bd.estimatedConstructionCost) : null} tabular />
            <DI label="BSA fee" value={bd.bsaFee !== null ? formatCurrency(bd.bsaFee) : null} tabular />
            <DI
              label="Fee mix (Arch / Eng / Int)"
              value={[bd.feeMix.architecture, bd.feeMix.engineering, bd.feeMix.interiors].every((v) => v === null) ? null : [bd.feeMix.architecture, bd.feeMix.engineering, bd.feeMix.interiors].map((v) => formatPercent(v, '—')).join(' / ')}
              tabular
            />
            <DI label="Anticipated authorization" value={bd.anticipatedAuthorization ? formatDate(bd.anticipatedAuthorization) : null} />
            <DI label="Anticipated start" value={bd.anticipatedStart ? formatDate(bd.anticipatedStart) : null} />
            <DI label="Anticipated completion" value={bd.anticipatedCompletion ? formatDate(bd.anticipatedCompletion) : null} />
          </DL>
        </Section>
      </div>

      <Section title="Revenue projection">
        {!proj ? (
          <p className="text-sm text-subtle">No revenue projection recorded.</p>
        ) : (
          <>
            <ol className="flex h-44 items-end gap-1.5" aria-label="Revenue projection by period">
              {proj.periods.map((x) => (
                <li key={x.index} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${x.label ?? `Period ${x.index}`}: ${formatCurrency(x.amount, { empty: 'No value' })}`}>
                  <span className="w-full bg-bsa-teal" style={{ height: `${((x.amount ?? 0) / max) * 100}%`, minHeight: x.amount ? 2 : 0 }} />
                  <span className="tabular text-[10px] text-subtle">{x.label ?? x.index}</span>
                </li>
              ))}
            </ol>
            <span className="sr-only">
              {proj.periods.map((x) => `${x.label ?? `Period ${x.index}`}: ${formatCurrency(x.amount, { empty: 'no value' })}`).join('; ')}
            </span>
            <DL className="mt-5">
              <DI label="Projection total" value={formatCurrency(total)} tabular />
              <DI label="Calendar mapping" value={proj.calendarMapping === 'unresolved' ? 'Unresolved — period labels not established by source' : 'Confirmed'} />
              {proj.basisNote && <DI label="Basis" value={proj.basisNote} wide />}
            </DL>
            {bd.bsaFee !== null && total !== null && total > bd.bsaFee && (
              <p className="mt-4 border-l-2 border-bsa-yellow bg-surface-2 px-3 py-2 text-sm">The projection total exceeds the BSA fee. The source basis should be confirmed; values are shown as recorded.</p>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
