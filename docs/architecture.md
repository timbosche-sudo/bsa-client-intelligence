# Architecture

## Principles

- **One platform, many clients.** Every workspace-owned record carries `clientId`. Reads go through
  `getWorkspace(data, clientId)` (`src/data/repository.ts`), which returns only that client's records.
  Search and reports are built from that scoped object, so client separation is structural rather than a UI filter.
- **Unknown stays unknown.** Missing values are `null` and render as "To Be Confirmed" or "Not Assessed".
  Readiness is a set of explicit, human-recorded assessments, never a computed score.
- **Records, not copies.** Meetings, reports and dashboards reference the same records by ID.
- **Swap-ready persistence.** UI → Zustand store → `StorageAdapter` interface. The prototype uses
  `LocalStorageAdapter`; production replaces it with an authenticated API adapter.

## Layers

```
src/
├── domain/          Types, labels, defaults, ID helpers. No React and no I/O.
├── data/
│   ├── schema.ts        Schema version, envelope validation (zod), migrations
│   ├── repository.ts    Client-scoped reads, derived views, search
│   ├── persistence/     StorageAdapter interface + LocalStorageAdapter
│   └── seed/            Fictional demonstration seed (public build)
├── state/           Zustand stores: dataset + autosave, UI preferences, useWorkspace()
├── data/media/      MediaStore interface + IndexedDB implementation, useMediaUrl()
├── data/mutations.ts  Pure dataset mutations with integrity guards (no deleting referenced records)
├── services/        Backup/export with embedded images, image validation/crop/compression
├── auth/            AuthProvider interface + prototype placeholder (Entra ID later)
├── config/          Non-secret runtime environment
├── components/      Reusable UI primitives and status badges
├── layout/          App shell: sidebar, top bar, client selector, search, quick add
├── features/        One folder per module (overview, leadership, portfolio, import, admin, …)
└── brand/           Temporary wordmark (replace with official BSA assets)
```

## Routing

`HashRouter`, with URLs of the form `#/c/:clientId/:module`. Hash routing avoids 404s on GitHub Pages deep links,
and the client ID in the URL makes the active workspace explicit and bookmarkable.

## Media

Image binaries are kept out of the JSON dataset. `MediaRecord` metadata (owner, kind, caption, credit, size) lives in
`dataset.media`; the bytes live in the `MediaStore` (IndexedDB in Prototype Mode, Azure Blob Storage later) under the same ID.
Uploads are validated (JPEG/PNG/WebP, ≤15 MB), then resized (headshots 600×600 square crop; project images ≤2400 px on the long edge)
and compressed to WebP (JPEG fallback). Backups embed the bytes as base64.

## Meeting lifecycle

`scheduled → in_progress → closeout → finalized` (or `cancelled`). Meeting Mode lives at `#/c/:clientId/meetings/:id/run`, outside the app shell.
Notes autosave with a debounce and are not written to the activity log, to avoid noise. Finalization stores an immutable `MeetingRecordSnapshot`.
Finalized meetings reject edits in the data layer, and amendments reopen closeout with a recorded reason.
Actions, decisions and issues captured in a meeting carry `meetingId` and cannot be deleted, only cancelled or closed.

## Reporting

Builders are pure functions over a `ClientWorkspace`, so other clients' data cannot appear in a report. The same `ReportDoc` drives the on-screen preview and the PDF.
A report's content is frozen when it is generated: exports always match what was reviewed or approved.
The client alignment builder filters to `confidentiality === 'approved'` and has no code path for risks, fees, readiness, staffing or notes.
Tests in `src/reports/reports.test.ts` assert these exclusions.

## Accountability model

Owner/champion = **Accountable**; participants = **Supporting**; optional `consultedIds` / `informedIds` complete a lightweight RACI.
`data/accountability.ts` derives every view from a `ClientWorkspace`, so another client's commitments can never appear.

## Integrity rules

`data/mutations.ts` blocks deleting people or projects that other records reference; the UI explains why and offers archiving instead.
Leadership tiers and portfolio categories can't be removed while in use, and built-in categories can only be renamed.
Project edits append a readable entry to `project.history`.
Decisions: *Approved* requires an approval record, *Superseded* requires a valid superseding decision, and approved, superseding or meeting-recorded decisions cannot be deleted.
Actions recorded in a meeting cannot be deleted (cancel them instead). Workstreams and initiatives with linked records can only be archived.
Restart checklists require an identity/scope confirmation (who + basis) and copy template items, so later template edits don't rewrite applied checklists.

## Persistence and save status

`mutate()` applies an immutable change and schedules a debounced save (400 ms). The save indicator reads the
store's real state (`pending → saving → saved | error`). It only shows "Saved locally" after the adapter
resolves. Pending writes are flushed on `pagehide` / `visibilitychange`.

Schema changes: bump `SCHEMA_VERSION` and add `migrations[n]` (n → n+1) in `src/data/schema.ts`.
Data from a newer schema is refused rather than overwritten. Unreadable stored data is never auto-replaced:
the user is offered a download of it first.

## Planned additions by stage

| Stage | Adds |
|---|---|
| 2 ✅ | IndexedDB media store behind `MediaStore`; people/leadership/project editing; JSON/Excel/CSV import pipeline (`features/import`: parsers → candidates → preview → approved commit) |
| 3 ✅ | `data/strategyMutations.ts` (workstreams, initiatives, actions, decisions, risks, checklists with integrity rules), `data/accountability.ts` (person / workstream views), `features/strategy` (shared record editors via `useRecordSheet`), schema v3 |
| 4 ✅ | `data/meetingMutations.ts` (lifecycle scheduled → in_progress → closeout → finalized, snapshot, amendments), `data/meetingSelectors.ts` (captures, continuity, rule-based suggestions), `features/meetings` (Meeting Mode route outside the app shell), schema v4 |
| 5 ✅ | `src/reports`: pure builders (`ClientWorkspace` → `ReportDoc`), shared HTML preview and pdfmake renderer (lazy-loaded, Lato WOFF embedded), versioned frozen `ReportRecord`s with client-release approval; `src/ai/aiProvider.ts` (disabled), schema v5 |
| 6 ✅ | `services/restore.ts` (validated, previewed restore incl. media), `services/csv.ts` (injection-safe CSV), `data/adminMutations.ts` (client profiles/archiving, readiness dimensions), route-level code splitting, app-shell service worker (`public/sw.js`, build-stamped cache), global error handling, history confidentiality scan |

## Future production (Azure) — outline

Full detail: [azure-production.md](azure-production.md). Limitations and requirements: [known-limitations.md](known-limitations.md).

- **Identity:** Microsoft Entra ID (MSAL in the SPA, tokens validated server-side). App roles map to `AppRole`.
- **API:** Azure Functions or App Service implementing a `RemoteApiAdapter` behind `StorageAdapter`, with per-client
  authorization enforced server-side.
- **Data:** Azure SQL or Cosmos DB, with `clientId` as a partition / row-level-security key.
- **Media:** Azure Blob Storage with private containers and short-lived SAS URLs.
- **Audit:** append-only activity log written server-side.
- **AI:** Azure OpenAI (or another approved model) called only from the server, with no client-side keys and
  confidentiality-aware prompt filtering.
- **Hosting:** Azure Static Web Apps or App Service behind Entra ID. GitHub Pages remains demo-only.
