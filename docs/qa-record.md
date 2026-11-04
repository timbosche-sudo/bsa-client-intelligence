# QA record — v1.0.0 (Stage 6)

Recorded against the production build (`npm run build`, served with `vite preview`), using the fictional demo dataset.

## Automated checks

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc -b` | Pass |
| Unit and integration tests | `npm test` | 16 files, **100 tests passed** |
| Confidentiality: source and build | `npm run check:confidential` | Pass (`src`, `public`, `dist`) |
| Confidentiality: full git history | `npm run check:history` | Pass (every line ever added, on all refs; forbidden data paths absent) |
| Dependency audit | `npm audit` | 0 vulnerabilities |

CI (`ci.yml`) and deploy (`deploy.yml`) run the source scan, the history scan, the type check, tests and the build scan on every push. Any finding blocks the deploy.

Test coverage highlights: schema migrations v1→v5, client scoping, integrity guards (people, projects, decisions, meetings, readiness dimensions, client archiving), import parsing and preview, meeting lifecycle and amendments, report builders and the Client Alignment confidentiality filter, backup round-trip with images, restore validation (corrupt JSON, seed-file rejection, newer schema, orphaned references, non-image media), CSV escaping including the spreadsheet-formula injection guard.

## Accessibility (axe-core, WCAG 2.1 A/AA + best practice)

| Scope | Themes and viewports | Result |
|---|---|---|
| 15 pages (overview, leadership, portfolio cards/table, project detail tabs, import, workstreams, initiative, actions/decisions/risks/accountability, meetings, meeting record, reports, report viewer, administration) | Desktop dark, desktop light, phone dark | No violations |
| Action, person and project editors; meeting editor; Meeting Mode; closeout; report setup; report viewer; restore dialog | Desktop | No violations |

Issues found and fixed in Stage 6:
- Low-contrast image-overlay badges in the light theme.
- Prohibited ARIA attributes on the avatar placeholder.
- Accessible names that didn't match visible labels (search, new, cover image).
- Heading order on portfolio cards and workstream blocks.
- Definition-list structure in the overview hero.
- Light-theme caution colour contrast.

Built in by design, not separately measured in Stage 6: keyboard operation, visible focus styles, native modal dialogs (Escape to close, focus contained) and 44 px minimum touch targets on primary controls.

## Responsive layout

No horizontal page overflow at 390×844 (phone), 820×1180 (iPad portrait), 1180×820 (iPad landscape) or 1440×900 (desktop). Checked on every main page plus the restore, readiness-dimension and client-profile dialogs.
Fixed in Stage 6: leadership tier cards widened the page on phones because long names forced an implicit grid column.

## Performance

- Route-level code splitting. The initial JavaScript is about 168 KB gzip (down from 262 KB), and each page loads on demand.
- The PDF engine and Lato font load only on first export (about 585 KB gzip).
- The service worker caches the app shell and hashed assets for repeat and offline launches. Each deploy gets a new cache, and old caches are removed. Data is never cached by the service worker.

## Error handling and empty states

- A route-level error boundary with recovery links. Global `error` and `unhandledrejection` handlers show a throttled toast instead of failing silently.
- Save failures (such as a full storage quota) show in the save indicator. Unreadable stored data is offered for download before anything is replaced.
- Every list has an empty state that explains the next step. Missing records (deleted or belonging to another client) show "not found in this workspace".

## Not covered (manual follow-up recommended)

- Screen-reader walkthrough with VoiceOver on iPadOS.
- Testing on physical devices. Checks used Chromium emulation, not real Safari on iPad.
- Very large datasets (more than 1,000 projects, hundreds of images) near browser storage quotas.
