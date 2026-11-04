/**
 * PDF rendering with pdfmake (lazy-loaded only when exporting).
 * Brand document standards (BSA Brand Guide 2026 pp.24–28): Lato, 0.625" margins, black/white with red
 * accents, single 1pt division lines, page numbers, confidentiality designation on every page.
 */
import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces';
import latoRegular from '@fontsource/lato/files/lato-latin-400-normal.woff?url';
import latoItalic from '@fontsource/lato/files/lato-latin-400-italic.woff?url';
import latoBold from '@fontsource/lato/files/lato-latin-700-normal.woff?url';
import latoBlack from '@fontsource/lato/files/lato-latin-900-normal.woff?url';
import { officialLogo } from '@/brand/Logo';
import { CONFIDENTIALITY_LABELS, type ReportBlock, type ReportDoc } from '@/domain/types';
import { formatDateTime } from '@/lib/format';

const RED = '#cc1b2d';
const BLACK = '#000000';
const GREY80 = '#58595b';
const GREY10 = '#e6e7e8';
const GREY05 = '#f3f3f4';
const MARGIN = 45; // 0.625 in

type PdfMake = typeof import('pdfmake/build/pdfmake');
let loader: Promise<PdfMake> | null = null;

async function toBase64(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

function loadPdfMake(): Promise<PdfMake> {
  loader ??= (async () => {
    const mod = (await import('pdfmake/build/pdfmake')) as unknown as { default?: PdfMake } & PdfMake;
    const pdfMake = (mod.default ?? mod) as PdfMake & { vfs: Record<string, string>; fonts: Record<string, Record<string, string>> };
    const [r, i, b, k] = await Promise.all([latoRegular, latoItalic, latoBold, latoBlack].map(toBase64));
    pdfMake.vfs = { 'Lato-Regular.woff': r, 'Lato-Italic.woff': i, 'Lato-Bold.woff': b, 'Lato-Black.woff': k };
    // "bold" maps to Lato Black (headlines); Lato Bold is used for emphasis via bolditalics slot is not needed.
    pdfMake.fonts = { Lato: { normal: 'Lato-Regular.woff', italics: 'Lato-Italic.woff', bold: 'Lato-Black.woff', bolditalics: 'Lato-Bold.woff' } };
    return pdfMake;
  })().catch((e) => {
    loader = null;
    throw e;
  });
  return loader;
}

/** Characters outside the embedded Lato Latin subset are replaced with safe equivalents. */
export function pdfText(s: string): string {
  return s
    .replace(/→/g, 'to')
    .replace(/[←↔]/g, '-')
    .replace(/[✓✔]/g, 'Yes')
    .replace(/[^\u0000-ɏ‐-‧‰-⁞€]/g, '');
}

function block(b: ReportBlock): Content {
  switch (b.type) {
    case 'paragraph':
      return { text: pdfText(b.text), color: b.muted ? GREY80 : BLACK, italics: !!b.muted, margin: [0, 0, 0, 8] };
    case 'list':
      return { ul: b.items.map(pdfText), margin: [0, 0, 0, 8], markerColor: BLACK };
    case 'kv':
      return {
        table: { widths: [120, '*'], body: b.items.map(([k, v]) => [{ text: pdfText(k), color: GREY80 }, { text: pdfText(v) }]) },
        layout: { hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === node.table.body.length ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => GREY10, paddingLeft: () => 0, paddingTop: () => 4, paddingBottom: () => 4 },
        margin: [0, 0, 0, 10],
      } as Content;
    case 'stats':
      return {
        table: {
          widths: b.items.map(() => '*'),
          body: [b.items.map(([label, value]) => ({ stack: [{ text: pdfText(value), bold: true, fontSize: 16 }, { text: pdfText(label).toUpperCase(), fontSize: 7, color: GREY80, characterSpacing: 0.6 }], fillColor: GREY05, margin: [6, 6, 6, 6] }))],
        },
        layout: { hLineWidth: () => 0, vLineWidth: (i: number) => (i === 0 ? 0 : 3), vLineColor: () => '#ffffff' },
        margin: [0, 2, 0, 12],
      } as Content;
    case 'callout':
      return {
        table: { widths: [3, '*'], body: [[{ text: '', fillColor: b.tone === 'caution' ? RED : BLACK }, { text: pdfText(b.text), fillColor: GREY05, margin: [8, 6, 6, 6] }]] },
        layout: 'noBorders',
        margin: [0, 0, 0, 10],
      } as Content;
    case 'table': {
      if (!b.rows.length) return { text: pdfText(b.empty ?? 'None.'), italics: true, color: GREY80, margin: [0, 0, 0, 10] };
      const align = (i: number) => b.columns[i].align ?? 'left';
      return {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: b.columns.map((c) => c.width ?? '*'),
          body: [
            b.columns.map((c, i) => ({ text: pdfText(c.header).toUpperCase(), bold: true, color: '#ffffff', fillColor: BLACK, fontSize: 7, characterSpacing: 0.4, alignment: align(i) })),
            ...b.rows.map((r, ri) => r.map((cell, i) => ({ text: pdfText(cell), alignment: align(i), fillColor: ri % 2 ? GREY05 : null, color: /overdue/i.test(cell) ? RED : BLACK }))),
          ],
        },
        fontSize: 8.5,
        layout: { hLineWidth: (i: number) => (i <= 1 ? 0 : 0.5), vLineWidth: () => 0, hLineColor: () => GREY10, paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 4, paddingRight: () => 4 },
        margin: [0, 0, 0, 12],
      } as Content;
    }
  }
}

/** Official red logo as SVG text, with CSS class fills inlined (the PDF SVG renderer ignores <style>). */
async function logoSvg(): Promise<string | null> {
  const url = officialLogo.red;
  if (!url || !(url.endsWith('.svg') || url.startsWith('data:image/svg+xml'))) return null;
  try {
    return inlineSvgClassFills(await (await fetch(url)).text());
  } catch {
    return null;
  }
}

export function inlineSvgClassFills(svg: string): string {
  const fills = new Map<string, string>();
  for (const m of svg.matchAll(/\.([\w-]+)\s*\{[^}]*?fill:\s*([^;}\s]+)/g)) fills.set(m[1], m[2]);
  return svg
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/class=["']([\w-]+)["']/g, (all, cls: string) => (fills.has(cls) ? `fill="${fills.get(cls)}"` : all));
}

export function reportFilename(doc: ReportDoc, draft: boolean): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `BSA_${safe(doc.clientName)}_${safe(doc.title)}_v${doc.version}_${doc.generatedAt.slice(0, 10)}${draft ? '_DRAFT' : ''}.pdf`;
}

export function confidentialityLine(doc: ReportDoc, draft: boolean): string {
  if (draft) return 'DRAFT — NOT FOR DISTRIBUTION · Pending release approval';
  if (doc.confidentiality === 'internal') return 'INTERNAL ONLY — BSA Client Team use. Not for distribution to the client.';
  return CONFIDENTIALITY_LABELS[doc.confidentiality].toUpperCase();
}

export async function buildDefinition(doc: ReportDoc, opts: { draft: boolean }): Promise<TDocumentDefinitions> {
  const svg = await logoSvg();
  const conf = confidentialityLine(doc, opts.draft);
  const meta: [string, string][] = [
    ['Client', doc.clientName],
    ['Generated', formatDateTime(doc.generatedAt)],
    ['Prepared by', doc.preparedBy],
    ['Version', String(doc.version)],
    ['Confidentiality', opts.draft ? 'Draft — pending approval' : doc.confidentiality === 'internal' ? 'Internal Only' : CONFIDENTIALITY_LABELS[doc.confidentiality]],
  ];
  const content: Content[] = [
    { text: pdfText(doc.clientName).toUpperCase(), fontSize: 8, characterSpacing: 1.4, color: GREY80, margin: [0, 6, 0, 4] },
    { text: pdfText(doc.title), bold: true, fontSize: 24, lineHeight: 1.05 },
    { text: pdfText(doc.subtitle), fontSize: 13, color: GREY80, margin: [0, 2, 0, 10] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 522, y2: 0, lineWidth: 1, lineColor: BLACK }], margin: [0, 0, 0, 8] },
    block({ type: 'kv', items: meta }),
  ];
  for (const s of doc.sections) {
    content.push({ text: pdfText(s.title), bold: true, fontSize: 13, margin: [0, 10, 0, 2], headlineLevel: 1 } as Content);
    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 522, y2: 0, lineWidth: 1, lineColor: BLACK }], margin: [0, 0, 0, 6] });
    s.blocks.forEach((b) => content.push(block(b)));
  }
  return {
    pageSize: 'LETTER',
    pageMargins: [MARGIN, 64, MARGIN, 54],
    info: { title: `${doc.title} — ${doc.clientName}`, author: doc.preparedBy, subject: conf, creator: 'BSA Client Intelligence' },
    defaultStyle: { font: 'Lato', fontSize: 10, lineHeight: 1.3, color: BLACK },
    ...(opts.draft ? { watermark: { text: 'DRAFT — NOT FOR DISTRIBUTION', color: RED, opacity: 0.12, bold: true, fontSize: 40 } } : {}),
    header: () => ({
      margin: [MARGIN, 24, MARGIN, 0],
      columns: [
        svg ? { svg, height: 16 } : { text: 'BSA', bold: true, fontSize: 12 },
        { text: pdfText(`${doc.clientName} · ${doc.title}`), alignment: 'right', fontSize: 8, color: GREY80, margin: [0, 3, 0, 0] },
      ],
    }),
    footer: (page: number, pages: number) => ({
      margin: [MARGIN, 14, MARGIN, 0],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 522, y2: 0, lineWidth: 0.5, lineColor: GREY10 }] },
        {
          columns: [
            { text: pdfText(conf), fontSize: 7, bold: true, color: opts.draft || doc.confidentiality === 'internal' ? RED : BLACK, width: '*' },
            { text: `v${doc.version} · ${doc.generatedAt.slice(0, 10)} · Page ${page} of ${pages}`, alignment: 'right', fontSize: 7, color: GREY80, width: 'auto' },
          ],
          margin: [0, 5, 0, 0],
        },
      ],
    }),
    // Avoid a section heading stranded at the bottom of a page: break if it starts in the last ~15% of the page.
    pageBreakBefore: (node) => (node as { headlineLevel?: number }).headlineLevel === 1 && ((node as { startPosition?: { verticalRatio?: number } }).startPosition?.verticalRatio ?? 0) > 0.82,
    content,
  };
}

export async function downloadReportPdf(doc: ReportDoc, opts: { draft: boolean }): Promise<void> {
  const [pdfMake, def] = await Promise.all([loadPdfMake(), buildDefinition(doc, opts)]);
  pdfMake.createPdf(def).download(reportFilename(doc, opts.draft));
}

/** Opens the PDF in a new tab (useful on iPad for viewing/sharing). The tab is opened synchronously to avoid popup blocking. */
export async function openReportPdf(doc: ReportDoc, opts: { draft: boolean }): Promise<void> {
  const win = window.open('', '_blank');
  try {
    const [pdfMake, def] = await Promise.all([loadPdfMake(), buildDefinition(doc, opts)]);
    pdfMake.createPdf(def).getBlob((blob: Blob) => {
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  } catch (e) {
    win?.close();
    throw e;
  }
}
