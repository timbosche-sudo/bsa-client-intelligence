# Known limitations and production security requirements

## Known limitations (Prototype Mode, v1.0.0)

### Security and data
- **No authentication or authorization.** Role names are labels only, and anyone with the browser can view, edit, export or restore everything.
- **Browser-local, single-device storage.** Records live in `localStorage` and images in IndexedDB, unencrypted. Nothing is shared, synchronized or backed up automatically. Clearing site data erases it.
- **Client separation is a display safeguard, not a security boundary.** Developer tools expose all stored workspaces.
- **Backups are plain JSON** with base64 images. They're as sensitive as the underlying records and must be stored in BSA-approved locations.
- **The public site is public.** GitHub Pages serves the demo to anyone with the URL. `noindex` only discourages search engines.
- **Activity history and approvals are self-asserted.** "Approved by" and "Finalized by" names are typed, not verified identities.

### Capacity and platform
- **Storage quota:** `localStorage` holds about 5–10 MB of records. Image space depends on the browser (shown in *Administration*). Very large portfolios or many high-resolution images can hit the limit. Saves then fail with a visible error, and nothing is lost silently.
- **Single user at a time.** Two tabs editing the same workspace can overwrite each other (last save wins).
- **Safari/iPadOS** may evict IndexedDB data for sites not used for about 7 days unless the app is added to the Home Screen. Export regularly.
- **Offline:** the service worker caches the app itself, so it reopens offline after one visit. Data is already local. There's no offline sync, because there is no server.
- **PDF generation** runs in the browser. The first export downloads the PDF engine (about 600 KB compressed). Very long reports can take several seconds on older iPads.

### Functional
- **No email, Teams or calendar integration.** Reports are download-only, and meetings aren't sent as invitations.
- **AI is disabled.** Executive summaries are typed, or drafted from records by deterministic rules.
- **Import covers projects only** (seed JSON, Excel, CSV). People, actions and decisions are entered in the app or restored from backup.
- **Restore replaces all data** in the browser. There is no per-client merge.
- **Readiness, health and risk are never inferred.** Values show only when a person records them. This is intentional, not a gap.
- **App icons** (home-screen and browser tab) are still neutral placeholders. The official logo is installed for the app header and reports.

## Production security requirements

Before any real client data is used beyond a single approved device, the following are required. The implementation outline is in [azure-production.md](azure-production.md).

1. **Identity:** Entra ID sign-in with MFA and Conditional Access, plus no anonymous access to any environment holding real data.
2. **Server-side authorization:** per-client membership and app roles enforced by the API on every read and write. Client-side checks are only UX.
3. **Server-side confidentiality enforcement:** `internal` / `candidate` / `approved` filtering applied in the API, especially for the Client Alignment Report and any external export.
4. **Managed data stores:** a database with encryption at rest, backups, point-in-time restore and an agreed retention period; images in private Blob Storage with short-lived SAS access.
5. **Secrets:** stored only in Key Vault and accessed through Managed Identity. No keys or tokens in the SPA, the repository or CI variables visible to the frontend.
6. **Audit:** an immutable, server-written log of edits, finalizations, release approvals, exports, imports and restores, with verified user identity.
7. **Verified approvals:** finalization and client-release approval recorded against the signed-in identity, not a typed name.
8. **Upload safety:** server-side file type and size validation, malware scanning, EXIF stripping, and CSV/Excel import validation re-run on the server.
9. **AI governance:** only an approved, server-side model deployment with agreed retention, data minimization and confidentiality filtering, plus human review before saving.
10. **Transport and headers:** HTTPS only, HSTS, a strict Content-Security-Policy, `frame-ancestors 'none'`, and a WAF where BSA policy requires one.
11. **Operations:** separate dev/test/prod environments, OIDC-based deployments with prod approval, dependency scanning (`npm audit`, Dependabot) and an incident-response contact.
12. **Data handling policy:** documented owner, classification, retention and deletion procedures for client records, headshots and renderings, agreed with BSA IT and leadership.
13. **Repository hygiene (already in place, must stay):** the confidentiality scan of source, build and full git history in CI; `private-data/` git-ignored; demo data fictional only.
