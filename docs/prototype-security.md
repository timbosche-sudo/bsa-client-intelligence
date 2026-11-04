# Prototype Mode — security limitations

Prototype Mode is for demonstration and local evaluation. It is **not** a secure system of record.

| Area | Prototype behavior | Implication |
|---|---|---|
| Authentication | None. A placeholder "Prototype User" is shown. | Anyone using the browser can view and edit everything. |
| Authorization | Roles appear in the UI only. | No permission boundary exists. Do not describe it as access control. |
| Storage | Records in `localStorage`, images in IndexedDB; one browser profile; unencrypted. | Not shared, not synchronized, not backed up, and cleared if the user clears site data. Readable by anyone with access to the device profile. |
| Client separation | Enforced in the data-access layer. | This guards against accidental cross-client display, **not** against a user who can open developer tools. |
| Backups | Plain JSON downloads of every workspace, with images embedded. | Treat them as confidential files and keep them only in BSA-approved storage. |
| Hosting | GitHub Pages is public on the internet. | Only fictional demo data may be published. The build also sets `noindex`, which is not a security control. |
| AI | Disabled. No data leaves the browser. | Enabling AI requires an approved server-side integration. |
| Offline cache | A service worker caches the app's code, styles, fonts and icons only. | Records and images are never placed in the service-worker cache; they remain in localStorage / IndexedDB. |
| Restore | Replaces all local data after validation, a per-client preview and explicit confirmation. | Restoring an untrusted file can overwrite work. Export first; the seed file and newer-schema files are refused. |
| Secrets | None in the client. `VITE_*` variables are public by design. | Never add keys or tokens to the frontend. |

## Safeguards in this repository

- `.gitignore` excludes `private-data/`, seed JSON files, spreadsheets, CSVs, backups and media folders.
- `scripts/check-confidential.mjs` fails the build or CI when it finds real-format BSA project numbers,
  sensitive internal phrases, or any term listed in a local `private-data/denylist.txt`.
  `--history` mode scans every line ever added on all git refs and fails on forbidden data-file paths;
  it runs in CI and before every deploy.
- CSV exports neutralise spreadsheet formula injection (cells starting with `= + - @`).
- The public seed (`src/data/seed/demoSeed.ts`) contains fictional `DEMO-###` projects only, enforced by tests.

## Before using real data

1. Use a BSA-managed device, and import real files locally from `private-data/`.
2. Add real project names and identifiers to `private-data/denylist.txt` so an accidental paste into source fails the build.
3. Don't deploy builds made on a machine with real data in `src/`. Deployment happens only from CI.

See [known-limitations.md](known-limitations.md) for the full limitations list and production security requirements.
