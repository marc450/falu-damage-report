# CLAUDE.md — Falu Mängelprotokoll

## What this is
A single self-contained file, `index.html`, containing a field tool for
documenting machine defects during installation/commissioning. Mechanics fill
one card per defect, attach camera photos, export a branded PDF via the
browser print dialog, and submit the report to a central Supabase backend.
There is no build step and no framework. All HTML, CSS, JavaScript, and the
logo (base64) live in `index.html`. Deployed via GitHub Pages
(https://marc450.github.io/falu-damage-report/, repo marc450/falu-damage-report).

## Hard constraints (do not break)
- Keep everything in `index.html`. No build step, no framework, no CDNs, no
  fonts fetched over the network. The ONLY network calls are to Supabase
  (auth, storage, REST) — see "Central reporting" below.
- The form must keep working OFFLINE: all editing is in-memory, and JSON file
  export/import (Speichern/Laden) is the offline persistence path. Supabase
  submit (Senden) is an additional, online-only action. Never make core form
  editing depend on the network.
- No `localStorage`/`sessionStorage`. In-memory state only. The Supabase auth
  session is also memory-only (mechanic re-logs in per page load) — do not
  persist tokens to storage without explicitly revisiting this.
- Photos are read with FileReader and downscaled on a canvas (max 1280px long
  edge, JPEG q≈0.72) before being stored as data URLs. Keep this — it keeps
  reports small. On Senden, data-URL photos are converted to Blobs and uploaded
  to Supabase Storage; the local JSON export keeps the base64 data URLs.
- The PDF is produced by building a hidden `.print-doc` from state and calling
  `window.print()`. Screen UI is hidden in `@media print`; the print doc is
  hidden on screen. Keep this split.
- Labels are bilingual: German primary, English secondary.

## Central reporting (Supabase)
- Backend is the **shared** Supabase project "Whatsapp <> Slack Bridge"
  (`xasehavpvasplrhvwyuu`). Falu objects are **namespaced** to avoid collisions:
  table `falu_reports`, storage bucket `falu-report-photos`. Do not rename.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are constants in `index.html`. The anon
  key is public (the site is public on GitHub Pages) — security relies on RLS,
  not key secrecy.
- Auth: Supabase email/password. A full-screen `.auth` gate blocks the app until
  login. Calls hit `/auth/v1/token` directly via `fetch` (no SDK). Access tokens
  are refreshed via `refresh_token` on a 401 (`authFetch` retries once).
- Submit (`sendReport`): for each defect, data-URL photos → Blob → uploaded to
  `falu-report-photos/{userId}/{reportId}/{defIdx}-{photoIdx}.jpg`, then one row
  is inserted into `falu_reports` (broken-out header columns + `data` JSONB that
  holds the full defect list with photo *paths*, not base64). `created_by`
  defaults to `auth.uid()` from the JWT. Empty dates are sent as `null`.
- RLS: authenticated users may INSERT/SELECT only their own rows; storage
  policies restrict each user to their own `{userId}/...` folder. Admin reads all
  reports via the dashboard (service role bypasses RLS).
- Failures surface as a toast telling the mechanic to use Speichern and retry —
  never lose data on a network error.

## Brand (from the Falu design system — keep consistent)
- **Falu red** `rgb(236,28,36)` (dark `rgb(200,20,28)`) — key highlights ONLY
  (primary button, active states, safety-critical severity, section numbers).
  Do not use red for general structure.
- **Navy** `#002e5b` — headlines, structural UI, "functional" severity.
- Ink `#222`, ink-soft `#555`, ink-muted `#8a8a8a`.
- Rules `#d8dde3`, rule-soft `#e9ecef`; bg `#fff`, bg-alt `#f5f6f8`.
- Type: Inter (`"Inter","Helvetica Neue",Helvetica,Arial,sans-serif`) for text;
  JetBrains Mono (`"JetBrains Mono","IBM Plex Mono",ui-monospace,Menlo,monospace`)
  for uppercase labels, counters, and section eyebrows (0.18em tracking).
- **Zero border-radius everywhere.** Flat surfaces, hairline borders. Industrial.
- Severity edge colours: safety = red, functional = navy, minor = ink-muted.

## Company details shown on the document
FALU AG · Joweidzentrum 5, 8630 Rüti, Switzerland · +41 55 225 51 51 · sales@falu.com

## When making changes
- Match the existing token values above; don't introduce new colours/fonts.
- Update both the on-screen field and the `buildPrint()` output when adding or
  renaming a defect field, so the PDF stays in sync.
- After editing, verify the page opens with no console errors and that
  "PDF erstellen" renders all fields.
