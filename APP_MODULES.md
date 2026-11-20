# Mercury Operations Platform — modular build (v66)

This is the live app (`index.html` as deployed on 16 Nov 2026) split into separate files.
**Nothing users see or do has changed.** The code inside the files is exactly the
code from the original `index.html`, in the same order.

## What's here

| File | Contains |
| --- | --- |
| `index.html` | The page shell: page head, libraries, and the list of files below, in order |
| `css/app.css` | All the styling (was the `<style>` block) |
| `js/00-settings.js` | Supabase address and public key |
| `js/01-core-login-shell.js` | Helpers, start-up, login, profile, notification bells |
| `js/02-data-shell.js` | Loading a client's data, the app shell and menu, derived values |
| `js/03-pages.js` | Overview, sites, schedule, teams and other programme pages |
| `js/04-shift-rota.js` | Shift rota |
| `js/05-compliance-engineers.js` | Compliance cockpit, engineer register |
| `js/06-report-capture.js` | Call-out and shift report forms (photos, signature, GPS, PDF) |
| `js/07-clients-hub.js` | Clients hub, logins |
| `js/08-command-centre.js` | Command centre, SLA timers, map, check-ins |
| `js/09-report-pdfs-lists.js` | Report PDFs, call-out and shift report lists |
| `js/10-documents-project-plan.js` | Document vault, project plan |
| `js/11-crm.js` | Internal CRM |
| `js/12-analytics-export.js` | Analytics, client report export |
| `js/13-hq-jobs-digest.js` | HQ overview, job status, completed works, daily digest |
| `js/14-work-quote-requests.js` | Work requests, quote requests |
| `js/15-sites-daily.js` | Site editor, daily updates |
| `js/16-suppliers.js` | Suppliers hub and supplier portal |
| `js/17-rates-profit.js` | Rate card, profit |
| `js/18-email-updates.js` | Email Updates page |
| `js/19-router.js` | Page titles and the page router |
| `js/20-jobs.js` | Jobs register (Phase 1; quote-only creation from v66) |
| `js/21-quotes.js` | **New in v66:** Quotes (Phase 2): editor, PDF, revisions, acceptance, convert to job |

The files are ordinary browser scripts loaded one after another, so they share
everything exactly as the single file did. There is no build step and no new software.
The `?v=66` on each file name makes browsers fetch the new files after each release;
bump it on every release.

## How it was checked

1. **Exact copy:** joining the files back together reproduces the original `index.html`
   character for character (checked automatically).
2. **Load order:** no file needs anything from a later file while loading (checked automatically).
3. **Browser test:** the original and the split version were opened in Chrome as an admin,
   engineer, client and supplier login (with a simulated database), and all 36 pages were
   opened in each. Every page rendered identical content in both versions, with no new errors.

## How to release it (with the agreed safety net)

1. Keep the original `index.html` as the backup.
2. In the GitHub repository that deploys the live site, create a new branch, e.g. `modular-v64`,
   and replace the repository's `index.html` with the files in this folder
   (`index.html`, `css/`, `js/`, `README.md`). Leave `manifest.json` and the icons as they are.
3. Vercel automatically builds a **preview address** for the branch (shown on the branch's
   commit in GitHub, or in Vercel → Deployments). It uses the live database, so test with the
   **TEST client** only: sign in as admin, engineer and client, open each page, submit and
   delete a test call-out with a photo and signature.
4. If all is well and Louis approves, merge the branch into the main branch. Vercel publishes it.
5. Rollback: in Vercel → Deployments, choose the previous deployment → "Promote to Production"
   (instant), or put the original `index.html` back in the repository.

## v65 — Jobs register (20 Nov 2026)

New **Jobs** page in the Admin menu (needs database releases 1 and 2, both live on 20 Nov):
create a job (the Q reference is issued automatically), filter and search, open and edit,
change status, archive with a reason, restore (Directors), and view each job's change history
(Directors). What each person sees follows their staff role: contract values only with
"margins.view" (Director, Commercial); create only with "jobs.create"; edit with "jobs.edit".

Changes to existing files: one menu button in `02-data-shell.js`, one route line in
`19-router.js`, one extra script line and the version number in `index.html`.

Checked: all 36 existing pages render identically to v64 for admin, engineer, client and
supplier logins; 42 automated checks on the Jobs page as a Director, Operations and Read-only
user (simulated database) all pass with no errors.

## v66 — Quotes and quote-to-job (20 Nov 2026) — replaces v65, which was not published

Needs database release 3 (`20261120120000_phase2_quotes.sql`).
- **Quotes** page (Admin menu): create a quote (Q reference issued), add priced lines (internal unit
  cost + markup %, margin % or fixed price; cost code per line), live cost / profit / margin, issue it
  (locks it and saves a branded PDF to the private store), revise (same Q ref, previous version kept
  and downloadable), record rejection or acceptance (PO number, or written confirmation with a note),
  archive/restore, change history.
- **Convert to job** on accepted quotes: creates the job with the same Q reference, client, site,
  value and PO; the quote's costs become the job's locked original budget.
- **Jobs** page: no free "New job" any more; jobs show their quote, the read-only original value, and
  (with margins.view) the locked original budget and expected margin.

Checked: 41 end-to-end checks in a browser against a local database with releases 1–3 (Director,
Operations, Read-only), including prices, totals, PDF content (no internal costs printed), locking,
revisions, acceptance rules, conversion and permissions; all 36 existing pages unchanged for admin,
engineer, client and supplier logins.
