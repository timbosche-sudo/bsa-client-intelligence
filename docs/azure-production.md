# Future production architecture (Microsoft Azure)

This describes how BSA Client Intelligence can move from **Prototype Mode** (browser-only, public demo) to a secure,
shared, BSA-hosted system. It's a target architecture for discussion with BSA IT, not an implemented design.
Nothing here exists in the current codebase except the client-side seams it plugs into.

## What already makes the move straightforward

| Seam in the prototype | Where | Production replacement |
|---|---|---|
| `StorageAdapter` (async load/save) | `src/data/repository.ts` | `RemoteApiAdapter` calling the API below |
| `MediaStore` (put/get/delete blobs) | `src/data/media/MediaStore.ts` | Blob Storage via API-issued SAS URLs |
| Client scoping (`getWorkspace(data, clientId)`) | `src/data/repository.ts` | Server-side query scoping plus authorization per client |
| Pure mutations with `IntegrityError` | `src/data/*Mutations.ts` | Same rules re-validated on the server (shared package) |
| Versioned schema with migrations | `src/data/schema.ts` | Database migrations; the JSON backup format stays as an import/export path |
| Activity log entries | `run(...)` in `src/state/actions.ts` | Append-only audit table written by the API, not the browser |
| `AiProvider` interface (disabled) | `src/ai/aiProvider.ts` | Server-side Azure OpenAI proxy |
| `AppRole` labels (display only today) | `src/domain/types.ts` | Entra ID app roles enforced by the API |

## Target components

```
 iPad / desktop browser (React SPA, MSAL)
        │  HTTPS, Entra ID access token
        ▼
 Azure Static Web Apps or App Service (behind Entra ID; Front Door/WAF optional)
        │
        ▼
 API: Azure Functions or App Service (Node/TypeScript)
   ├── Authorization: Entra app roles + per-client membership table
   ├── Azure SQL Database (or Cosmos DB), clientId on every row/partition
   ├── Azure Blob Storage (private containers, short-lived read SAS)
   ├── Azure Key Vault (connection strings, model keys) via Managed Identity
   ├── Azure OpenAI (optional; server-side only, approved data scopes)
   ├── Microsoft Graph (optional; Teams/Outlook report distribution)
   └── Application Insights + Log Analytics (telemetry, audit export)
```

### Identity and access

- Use **Microsoft Entra ID** single-tenant sign-in with MSAL (authorization code with PKCE) in the SPA. Tokens are validated by the API.
- Define **app roles** that map to the prototype's role labels: Executive Sponsor, Client Team Leader, Contributor and Viewer. Add an **Administrator** role for configuration and restore.
- Grant access **per client**. A user sees a client workspace only if a membership row grants it. This is enforced in every API query, not in the UI.
- **Conditional Access** follows BSA policy (MFA, compliant devices). Guests (client staff) aren't in scope. External audiences receive released PDFs only.

### Data

- **Azure SQL** suits the relational, integrity-heavy model (actions ↔ decisions ↔ meetings ↔ reports). Use **row-level security** keyed on `clientId` as defence in depth. Cosmos DB with `/clientId` as the partition key also works if document storage is preferred.
- **Finalized meeting records** and **released reports** are immutable rows. Amendments are new rows that reference the original, as in the prototype.
- **Confidentiality** (`internal` / `candidate` / `approved`) is stored and enforced server-side. The API that builds the Client Alignment Report must apply the same `approved`-only filter as `src/reports/builders.ts`, so a modified client can't widen it.
- Use **point-in-time restore** plus a long-term retention policy. The JSON export stays available to administrators for portability.

### Media

- Use **private Blob containers** per environment. Uploads go through the API (type and size checks, malware scanning with Defender for Storage), and reads use short-lived SAS URLs.
- Strip EXIF metadata from headshots on upload. Delete orphaned blobs on a schedule.

### Reports and distribution

- Generate PDFs client-side (as now) or server-side for consistent fonts and archiving. Store released PDFs in Blob Storage with the `ReportRecord` metadata.
- Distribute through **Microsoft Graph** (Teams channel post or Outlook email), only after the four release checks are recorded by an authorized approver.

### AI (optional, after approval)

- Call **Azure OpenAI** from the API only, using an approved deployment with data-retention settings agreed with BSA IT.
- Send only fields the requesting user can already read. Exclude `internal` confidentiality fields from any client-facing generation.
- Return drafts that are labeled as AI suggestions, and require a person to accept them before anything is saved. Log prompts and outputs to the audit store.

### Audit and monitoring

- Keep an **append-only audit log** of who, what, when, client, entity and before/after hashes, for edits, finalizations, approvals, exports and restores.
- Use **Application Insights** for errors and performance, with **no record content** in telemetry.
- Send alerts for unusual export volume and for failed authorization attempts.

### Environments and delivery

- **dev / test / prod** environments in separate resource groups, with infrastructure as code (Bicep or Terraform).
- GitHub Actions deploy with **OIDC federated credentials** (no stored secrets), the confidentiality scan, tests, and a required approval for prod.
- **GitHub Pages stays demo-only**, with fictional data and no connection to production.

## Migration path

1. Stand up Entra ID app registration, the API skeleton and the database, and port the domain types and mutation rules into a shared package.
2. Implement `RemoteApiAdapter` and the auth provider, and switch with `VITE_APP_MODE=production`. The UI is unchanged.
3. Import each workspace from its prototype JSON backup through an admin-only, audited import endpoint. Upload images to Blob Storage.
4. Run a pilot with one client team, then retire browser-local storage for production users. Keep the service worker app-shell-only.
