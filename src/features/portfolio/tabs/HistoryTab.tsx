import type { ClientWorkspace } from '@/data/repository';
import type { Project } from '@/domain/types';
import { formatDate, formatDateTime } from '@/lib/format';
import { DI, DL, Section } from './shared';

export function HistoryTab({ project: p }: { ws: ClientWorkspace; project: Project }) {
  const entries = [...p.history].reverse();
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Section title="Change history">
        {entries.length === 0 ? (
          <p className="text-sm text-subtle">No changes recorded.</p>
        ) : (
          <ol className="relative flex flex-col gap-5 border-l border-line-strong pl-5">
            {entries.map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border border-line-strong bg-bg" aria-hidden />
                <p className="text-sm">{h.summary}</p>
                <p className="mt-0.5 text-xs text-subtle">
                  {formatDateTime(h.at)} · {h.by ?? 'System'}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Source provenance">
        {p.provenance ? (
          <DL className="sm:grid-cols-1">
            <DI label="Source file" value={p.provenance.sourceFile} />
            <DI label="Worksheet" value={p.provenance.worksheet} />
            <DI label="Source row" value={p.provenance.sourceRow} tabular />
            <DI label="Source record ID" value={p.provenance.sourceRecordId} />
            <DI label="Extract method" value={p.provenance.extractMethod} />
            <DI label="Source as of" value={p.provenance.sourceAsOf ? formatDate(p.provenance.sourceAsOf) : null} />
            <DI label="Imported" value={`${formatDateTime(p.provenance.importedAt)}${p.provenance.importedBy ? ` by ${p.provenance.importedBy}` : ''}`} />
          </DL>
        ) : (
          <p className="text-sm text-subtle">{p.isSample ? 'Fictional demonstration record.' : 'Created manually in the application.'}</p>
        )}
      </Section>
    </div>
  );
}
