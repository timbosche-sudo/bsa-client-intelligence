# User guide

A short guide for Client Team Leaders using BSA Client Intelligence in **Prototype Mode**.
Your data stays in this browser on this device. Export a backup regularly (see *Data & backup*).

## Getting around
- **Client switcher** (top left) changes workspaces. Each client's records are kept separate.
- **Search** (⌘K / Ctrl+K) finds people, projects, workstreams, initiatives, actions, decisions and risks in the current client.
- **New** (+) quickly adds a project, person, action, decision, risk or meeting.
- The **save indicator** shows *Saving…*, *Saved* or an error. If a save fails, export a backup and free up storage.
- On iPad, the sidebar collapses into a menu. Meeting Mode is designed for landscape iPad.

## Typical cycle
1. **Overview:** the client's leadership, portfolio summary, upcoming meetings and open commitments.
2. **Leadership:** maintain people (with headshots), the team structure by tier, and open seats.
3. **Portfolio:** cards or table, with filters by category, studio and readiness. Open a project for leadership, scope and readiness, milestones, risks and decisions, actions, images and history. Use *Export CSV* for the filtered list.
4. **Workstreams & initiatives:** strategic topics with champions and a lightweight RACI.
5. **Actions & decisions:** track owners, due dates and status. *Accountability* shows everything one person owns.
6. **Meetings:** *New meeting* asks whether to start from a template or a blank agenda. *Start meeting* to facilitate; the **Attendees** tab lets you add people as they join (or add the whole Client Team). *End meeting* to close out, then *Finalize*. Finalized records only change through a recorded amendment.
   - **Email notes:** on a finalized meeting, *Email notes to attendees* drafts the notes in your own email app (or copies them). If every recipient is BSA, the full internal record is included; if anyone is a client or external contact, only decisions and actions marked *Approved for Client Release* are included.
   - **Delete:** *Delete* on any meeting page removes it permanently, including practice runs. You choose whether the actions, decisions and issues captured in it are deleted too or kept; approved decisions are always kept (archived).
7. **Reports:** generate, preview, then export a PDF. Client Alignment reports include **only** records marked *Approved for Client Release*, and stay watermarked drafts until release approval.

## Confidentiality
Every action, decision, milestone and meeting outcome has a confidentiality level:
- **Internal (BSA only):** never appears in client-facing output.
- **Candidate for client release:** under review, still excluded from client output.
- **Approved for client release:** may appear in the Client Alignment Report.

Internal performance matters belong in internal notes only, and are never included in external reports.

## Data & backup (Administration)
- **Export backup (JSON):** every workspace and image in this browser. Treat the file as confidential.
- **Restore from backup:** choose a file to see a validation report and a per-client preview of what will be added, replaced or removed. Export the current data first, confirm, then *Replace all data*. Files from newer app versions, and the raw portfolio seed file, are refused.
- **Remove sample data:** permanently removes the fictional sample projects (marked *Sample*) and their images. People, leadership, workstreams, initiatives, actions, decisions, meetings, reports, and projects you created or imported are kept. Records that were linked to a sample project are kept and unlinked. The button disappears once no samples remain.
- **Reset to demo data:** replaces everything with the fictional demo set.
- **Client profiles:** edit name, monogram, sector and status, or archive a client. At least one client must stay active.
- **Configuration:** portfolio categories, readiness dimensions (a dimension with recorded assessments can't be removed), checklist templates. Meeting templates are managed under *Meetings → Templates*.

## Importing real project data
Use a BSA-approved device. Keep source files in `private-data/` (never in the app source), then use *Portfolio → Import*. Review the preview, choose Add, Update or Skip for each row, and approve.

## Installing as an app
On iPad: Safari → Share → **Add to Home Screen**. On desktop Chrome or Edge: the install icon in the address bar. The app then opens full-screen and loads offline after the first visit. Your data is the same browser-local data.
