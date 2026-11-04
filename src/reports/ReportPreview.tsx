import { CONFIDENTIALITY_LABELS, type ReportBlock, type ReportDoc } from '@/domain/types';
import { Logo, officialLogo } from '@/brand/Logo';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { confidentialityLine } from './pdf';

/**
 * Document preview rendered from the same ReportDoc as the PDF. Always "paper" styled (white, black
 * text) regardless of app theme, so reviewers see what will be exported.
 */
export function ReportPreview({ doc, draft }: { doc: ReportDoc; draft: boolean }) {
  const conf = confidentialityLine(doc, draft);
  return (
    <article aria-label={`${doc.title} preview`} className="relative mx-auto w-full max-w-[860px] overflow-hidden rounded-md bg-white text-black shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_12px_40px_rgba(0,0,0,0.35)]" style={{ colorScheme: 'light' }}>
      {draft && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-[30deg] whitespace-nowrap text-5xl font-black tracking-wide text-[#cc1b2d]/10 sm:text-7xl">DRAFT — NOT FOR DISTRIBUTION</span>
        </div>
      )}
      <div className="relative px-5 py-6 sm:px-12 sm:py-10">
        <header className="mb-6 flex items-center justify-between gap-4 text-[11px] text-[#58595b]">
          {officialLogo.red ? <span className="[&_img]:h-4"><Logo height={16} variant="red" /></span> : <span className="text-sm font-black text-black">BSA</span>}
          <span className="truncate text-right">{doc.clientName} · {doc.title}</span>
        </header>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#58595b]">{doc.clientName}</p>
        <h2 className="mt-1 text-[28px] font-black leading-tight tracking-tight sm:text-[32px]">{doc.title}</h2>
        <p className="mt-1 text-base text-[#58595b]">{doc.subtitle}</p>
        <hr className="my-4 border-t border-black" />
        <KV items={[
          ['Client', doc.clientName],
          ['Generated', formatDateTime(doc.generatedAt)],
          ['Prepared by', doc.preparedBy],
          ['Version', String(doc.version)],
          ['Confidentiality', draft ? 'Draft — pending approval' : doc.confidentiality === 'internal' ? 'Internal Only' : CONFIDENTIALITY_LABELS[doc.confidentiality]],
        ]} />
        {doc.sections.map((s, i) => (
          <section key={i} className="mt-7">
            <h3 className="border-b border-black pb-1 text-[17px] font-black tracking-tight">{s.title}</h3>
            <div className="mt-3 flex flex-col gap-3">
              {s.blocks.map((b, j) => <Block key={j} b={b} />)}
            </div>
          </section>
        ))}
        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-[#e6e7e8] pt-2 text-[10px]">
          <span className={cn('font-black', draft || doc.confidentiality === 'internal' ? 'text-[#cc1b2d]' : 'text-black')}>{conf}</span>
          <span className="text-[#58595b]">v{doc.version} · {doc.generatedAt.slice(0, 10)} · Page numbers appear in the PDF</span>
        </footer>
      </div>
    </article>
  );
}

function KV({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,9rem)_1fr] text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="border-b border-[#e6e7e8] py-1.5 text-[#58595b]">{k}</dt>
          <dd className="border-b border-[#e6e7e8] py-1.5">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ b }: { b: ReportBlock }) {
  switch (b.type) {
    case 'paragraph':
      return <p className={cn('text-sm leading-relaxed', b.muted && 'italic text-[#58595b]')}>{b.text}</p>;
    case 'list':
      return <ul className="list-disc pl-5 text-sm leading-relaxed marker:text-black">{b.items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
    case 'kv':
      return <KV items={b.items} />;
    case 'stats':
      return (
        <dl className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
          {b.items.map(([l, v], i) => (
            <div key={i} className="bg-[#f3f3f4] px-3 py-2">
              <dd className="tabular text-xl font-black">{v}</dd>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-[#58595b]">{l}</dt>
            </div>
          ))}
        </dl>
      );
    case 'callout':
      return <p className={cn('border-l-[3px] bg-[#f3f3f4] px-3 py-2 text-sm', b.tone === 'caution' ? 'border-[#cc1b2d]' : 'border-black')}>{b.text}</p>;
    case 'table':
      if (!b.rows.length) return <p className="text-sm italic text-[#58595b]">{b.empty ?? 'None.'}</p>;
      return (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
            <thead>
              <tr>{b.columns.map((c, i) => <th key={i} scope="col" className={cn('bg-black px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-[0.06em] text-white', c.align === 'right' && 'text-right')}>{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri} className={cn('border-b border-[#e6e7e8]', ri % 2 === 1 && 'bg-[#f3f3f4]')}>
                  {r.map((cell, ci) => <td key={ci} className={cn('px-2 py-1.5 align-top', b.columns[ci]?.align === 'right' && 'tabular text-right', /overdue/i.test(cell) && 'font-bold text-[#cc1b2d]')}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
