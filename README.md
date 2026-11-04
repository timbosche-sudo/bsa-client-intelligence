# BSA Client Intelligence

Strategic client leadership and portfolio management platform for **BSA** Client Teams.

> **Prototype Mode.** Data is stored in your browser only, with no sign-in or access control.
> The public demo contains **fictional sample projects**. See [docs/prototype-security.md](docs/prototype-security.md).

## Status

**v1.0.0: prototype complete.** It's stable, documented and deployable with fictional demonstration data. It isn't ready for real client data on shared or public infrastructure. See [Known limitations & production requirements](docs/known-limitations.md).

| Stage | Scope | Status |
|---|---|---|
| 1 | Platform foundation, design system, shell, Client Overview, domain model, local persistence | ✅ Complete |
| 2 | Leadership & people, headshots, portfolio cards/table/detail, images, JSON + Excel/CSV import, BSA brand standards | ✅ Complete |
| 3 | Workstreams, initiatives, actions, decisions, risks, restart checklists, accountability views | ✅ Complete |
| 4 | Guided Meeting Mode: creation, templates, facilitation, closeout, finalization, history | ✅ Complete |
| 5 | Reports (4 types, PDF), confidentiality & release approval, report history, AI interface (disabled) | ✅ Complete |
| 6 | Administration, backup/restore, CSV export, QA (tests, accessibility, responsive), PWA, history confidentiality scan, documentation | ✅ Complete |

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # type-check, production build, confidentiality scan of dist/
npm run check:history  # confidentiality scan of the full git history
npm run preview      # serve the production build at http://localhost:4173
```

Preview on an iPad or phone on the same network: `npm run dev -- --host`, then open the printed LAN URL.

## Deployment (GitHub Pages)

1. In GitHub, go to **Settings → Pages → Build and deployment**, and set **Source** to **GitHub Actions**.
2. Push to `main`. `.github/workflows/deploy.yml` tests, builds, scans and publishes `dist/`.
3. The site is served at `https://<owner>.github.io/bsa-client-intelligence/`. The build uses a relative base (`./`) and hash routing, so it works from any sub-path.

GitHub Pages sites are **public**. Only publish the fictional demo dataset.

## Data backup

- **Export:** profile menu → *Export backup (JSON)*, or *Administration → Data & backup*. The file contains every workspace stored in that browser.
- **Images:** headshots and project images are stored in this browser's IndexedDB and **embedded (base64) in backups**, so a backup file is self-contained. Browser storage quotas apply; *Administration* shows usage.
- **Restore:** *Administration → Restore from backup*. It validates the file (format, schema version, references, images), shows what changes for each client, offers to export current data first, and replaces everything only after explicit confirmation.
- **CSV:** *Portfolio → Export CSV* (filtered projects) and *Actions → Export CSV*.
- **Reset:** *Administration → Reset to demo data* replaces all local data and deletes stored images. Export first.

## Strategy & accountability (Stage 3)

- **Workstreams**: edit, reorder, archive, or add new ones. Each has a champion, topics, deliverable and confidentiality.
- **Initiatives** each have a detail page with a champion, a lightweight RACI, related projects, and linked actions, decisions, risks and milestones.
- **Actions**: filter by owner, workstream, project, priority or overdue, and change status inline. Completing an action records the date and notes.
- **Decisions** are separate from actions. *Approved* requires a recorded approver and date, and *Superseded* requires the replacing decision. Approved decisions can be archived but never deleted.
- **Accountability**: commitments by person and by workstream, and an individual view of everything a person is accountable for, supports or is consulted on.
- **Restart checklists**: apply a template (such as the 8-consideration hospital restart template) to a project only after recording who confirmed its identity and scope. Includes program comparison, change log and leadership summary tools. Templates are managed in *Administration*.

## Guided Meeting Mode (Stage 4)

- **Plan**: create a meeting from a template (the 60-minute Client Team Kickoff is built in) or a blank agenda. Title, date and time, location, facilitator, attendees, objectives, workstreams, and every agenda topic and duration are editable. An edited agenda can be saved as a template.
- **Facilitate** (*Start meeting*): a focus view built for iPad, with no sidebar.
  - Agenda list with progress, free navigation and large Previous/Next controls.
  - Per-topic notes that autosave, with a visible save status.
  - One-tap **+ Action**, **+ Decision** and **Flag issue**.
  - Panels showing what's been captured, carried-over open actions, pending decisions and context.
  - An elapsed-vs-planned timer, and the screen is kept awake where supported.
- **Close out** (*End meeting*): review topics discussed, confirmed and proposed decisions, new actions with owners and due dates (gaps flagged), unresolved issues, upcoming milestones, and rule-based next-topic suggestions; then write a summary.
- **Finalize**: requires naming the approver and an explicit review acknowledgement. The record is frozen as a snapshot. Later changes to actions or decisions don't rewrite it, and the record shows what has changed since.
- **Amend**: a finalized record can only change through a recorded amendment (reason and requester) and must then be finalized again. The amendment history is kept.
- **History & continuity**: a chronological archive, "since the previous meeting" changes, carried-over actions, and *Schedule next meeting* carrying the agreed topics forward.

## Reports (Stage 5)

*Reports* generates four branded PDF reports from the current records:

| Report | Audience | Notes |
|---|---|---|
| Internal Client Team Report | BSA, internal | Optionally tied to a meeting; executive summary typed or drafted from records (not AI) |
| Individual Accountability Brief | One person | Their actions, initiatives, decisions, dependencies and related projects |
| Client Alignment Report | Client, external | **Only** records marked “Approved for Client Release”; proposed requests vs confirmed commitments; never risks, fees, readiness, staffing, notes or meeting discussion |
| Portfolio Readiness Report | BSA, internal | Choose categories; explicit readiness assessments, resource gaps, decisions, risks, actions |

- **Preview, then export.** Each report is frozen when generated, so the preview is exactly what exports. Use *New version* to pick up later changes.
- **Release approval.** Client Alignment reports start as drafts with a watermark, and their PDFs say “DRAFT — NOT FOR DISTRIBUTION”. Approving for release requires naming the approver and confirming four review checks. Released reports are kept as a record and can only be archived.
- **PDF format.** Letter size, Lato font, BSA header, a confidentiality designation and “Page x of y” on every page. Table rows never split across pages.
- **Delivery** is download only; there is no automated email. Microsoft 365 distribution is a production item.
- **AI** is an interface only (`src/ai/aiProvider.ts`), and it is **disabled**. No data leaves the browser. Any future provider must run server-side and return suggestions that a person reviews before saving.

## Importing projects

*Portfolio Readiness → Import* accepts:

- **Portfolio seed JSON**: the `client` / `source` / `projects` structure (mapping in [docs/seed-data-mapping.md](docs/seed-data-mapping.md)).
- **Excel (.xlsx) or CSV**: any column layout. Columns are auto-matched by name and can be remapped manually.

Every import shows a preview first: new projects, existing matches (by client + project number), the fields that would change, conflicts, missing values, warnings and validation errors. You choose **Add / Update / Skip** for each row and must explicitly approve. Blank source values never erase existing data. Each imported project records its source file, worksheet, row and date.

## Real client data

Keep real files (portfolio seed JSON, spreadsheets, headshots, renderings, backups) in `private-data/`, which is git-ignored.
Import them through the app on an approved machine. Never place them in `src/` or `public/`.
Field mapping for the Houston Methodist seed: [docs/seed-data-mapping.md](docs/seed-data-mapping.md).

## Administration & installation (Stage 6)

- **Client profiles:** edit name, monogram, sector, client code, summary and priorities, or archive a client. At least one stays active.
- **Configuration:** portfolio categories, readiness dimensions (protected once assessed), checklist templates, and meeting templates (from Meetings).
- **Install:** "Add to Home Screen" on iPad, or install from Chrome/Edge. The app shell works offline after the first visit, and data stays browser-local.

## Documentation

| Document | Contents |
|---|---|
| [docs/user-guide.md](docs/user-guide.md) | How to use the app |
| [docs/known-limitations.md](docs/known-limitations.md) | Prototype limitations and **production security requirements** |
| [docs/azure-production.md](docs/azure-production.md) | Future Azure architecture and migration path |
| [docs/prototype-security.md](docs/prototype-security.md) | What Prototype Mode does and doesn't protect |
| [docs/qa-record.md](docs/qa-record.md) | Test, accessibility, responsive and performance results |
| [docs/architecture.md](docs/architecture.md) | Code structure and data model |
| [docs/brand-standards.md](docs/brand-standards.md) | BSA 2026 brand implementation |
| [docs/seed-data-mapping.md](docs/seed-data-mapping.md) | Portfolio seed field mapping |

## Architecture and future backend

See [docs/architecture.md](docs/architecture.md). The UI talks to a `StorageAdapter` interface. Moving to
BSA-approved Azure services (Entra ID, an API, a managed database, Blob Storage) means adding a remote adapter and an
auth provider, without rewriting the UI.

## Brand standards

The UI follows the **BSA Brand Style Guide 2026** (Lato, the BSA palette, black/white backgrounds, perfect circles,
1pt divisions); see [docs/brand-standards.md](docs/brand-standards.md).

**Official logo:** the logo is never recreated. Download the white and red logo files from **Open Asset** and save
them as `src/brand/assets/bsa-logo-white.svg` and `bsa-logo-red.svg`; the app uses them automatically.
The app icons in `public/icon*` are still neutral placeholders.
