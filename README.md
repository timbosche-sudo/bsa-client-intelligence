# BSA Client Intelligence

Strategic client leadership and portfolio management platform for **BSA LifeStructures** Client Teams.

> **Prototype Mode.** Data is stored in your browser only, with no sign-in or access control.
> The public demo contains **fictional sample projects**. See [docs/prototype-security.md](docs/prototype-security.md).

## Status

| Stage | Scope | Status |
|---|---|---|
| 1 | Platform foundation, design system, shell, Client Overview, domain model, local persistence | ✅ Complete |
| 2 | Leadership & people, portfolio cards/table/detail, images, JSON + Excel/CSV import | Next |
| 3 | Workstreams, initiatives, actions, decisions, risks, readiness, restart checklists | |
| 4 | Guided Meeting Mode | |
| 5 | Reporting (PDF) and AI interface | |
| 6 | Administration, backup/restore, QA, PWA, deployment hardening | |

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # type-check, production build, confidentiality scan of dist/
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
- **Restore:** arrives in Stage 6 (with preview and confirmation).
- **Reset:** *Administration → Reset to demo data* replaces all local data. Export first.
- Media (Stage 2+) is stored in IndexedDB and will be embedded in backups. Browser storage quotas apply.

## Real client data

Keep real files (portfolio seed JSON, spreadsheets, headshots, renderings, backups) in `private-data/`, which is git-ignored.
Import them through the app on an approved machine. Never place them in `src/` or `public/`.
Field mapping for the Houston Methodist seed: [docs/seed-data-mapping.md](docs/seed-data-mapping.md).

## Architecture and future backend

See [docs/architecture.md](docs/architecture.md). The UI talks to a `StorageAdapter` interface. Moving to
BSA-approved Azure services (Entra ID, an API, a managed database, Blob Storage) means adding a remote adapter and an
auth provider, without rewriting the UI.

## Brand assets

The wordmark (`src/brand/Wordmark.tsx`), app icons (`public/icon*`) and color tokens (`src/styles/index.css`) are
**temporary placeholders** based on the written brand direction. Replace them with official BSA Intelligence Design System assets when they're supplied.
