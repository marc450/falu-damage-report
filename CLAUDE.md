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
- Keep everything in `index.html`. No build step, no framework, no fonts fetched
  over the network. Network calls: Supabase (auth, storage, REST) — see "Central
  reporting" — and two lazy-loaded libraries (html2canvas + jsPDF, cdnjs),
  fetched only on first PDF download (see PDF below).
- The app is online/central now (requires login). It **autosaves** to Supabase:
  any edit marks the report dirty, debounces ~1.2s, then upserts (`scheduleSave`
  → `saveReport`); `flushSave()` runs at the top of `router()` so navigating away
  persists pending edits first. A `#saveStatus` indicator in the form header shows
  Änderungen…/Speichern…/Gespeichert ✓/error (click to retry). There is NO manual
  save button. New reports aren't created until `hasContent()` is true. After a
  photo uploads, `signedCache[path]=dataURL` so the thumbnail keeps showing
  without a sign round-trip; photo paths are written back into `state.defects`
  in place (don't replace the defect objects — live DOM closures hold references).
- `localStorage` is used ONLY to persist the auth session: `falu_session` holds
  the Supabase refresh token + the last access token + its `expiresAt`, so a
  reload stays signed in (`saveSession`, `restoreSession`, cleared on logout).
  On reload `restoreSession` uses the cached access token directly if still valid
  (avoids consuming/rotating the refresh token every reload), else refreshes.
  Do not store report/patient-like data there. (Storing tokens is an accepted
  XSS tradeoff for staying logged in.)
- Photos are read with FileReader and downscaled on a canvas (max 1280px long
  edge, JPEG q≈0.72) before being stored as data URLs. Keep this — it keeps
  reports small. The file input has NO `capture` attribute, so phones offer
  camera OR existing library. On Speichern, data-URL photos are converted to
  Blobs and uploaded to Supabase Storage; the row stores their paths.
- AI text rewrite: each defect free-text field (`fieldEl`) has a "✨ EN" button
  that sends the field's current text to the **`falu-rewrite` Edge Function**
  (`supabase/functions/falu-rewrite/index.ts`) and replaces it with clear English
  (still editable; triggers autosave). The function is authenticated (any logged-in
  user), keeps the Anthropic API key server-side (`ANTHROPIC_API_KEY` secret, set
  via `supabase secrets set`), and calls Claude (`claude-opus-4-8`, thinking
  disabled, output-only system prompt) via raw HTTPS. Incurs Anthropic API cost.
- Confirmations use the app-native `modalConfirm(message, {okLabel, cancelLabel,
  danger})` (a Falu-styled `#modal`, returns a Promise<boolean>) — never the
  browser `confirm()`/`alert()`. `danger:true` makes the OK button Falu-red.
- PDF is generated client-side for a direct download (no browser print dialog,
  no header/footer stamp). `downloadPdf()` lazy-loads **html2canvas + jsPDF**
  (cdnjs, via `loadPdfLibs`), ensures defect photos are data URLs
  (`ensurePhotoDataUrls` — avoids cross-origin canvas taint), builds the hidden
  `.print-doc` (`buildPrint`), renders it to ONE canvas, then **slices that canvas
  into A4 page-height chunks itself** (each placed at the top margin) and stamps
  "Seite X / Y" per page. Do NOT use html2pdf.js's own pagination — its flow
  splitter mis-placed content (header pushed to page bottom, tables clipped); the
  manual slice keeps every page top-anchored. The `.print-doc` is laid out at a
  fixed 760px width inside `.print-host` (`position:absolute;height:0;overflow:hidden`)
  so it's measurable but invisible on screen — do NOT position `.print-doc` itself
  (an absolute/fixed clone collapses the capture to 0 height). All `.p-*` styles
  live in normal CSS (not `@media print`) so html2canvas sees them. No footer
  (header address suffices); signature blocks have blank space above the line.
  Output is rasterized (image-based) — `html2canvas.scale` 2 balances crispness vs
  size; content may split across a page boundary (acceptable).
- Language: the **app UI/chrome is German** (top nav buttons, reports overview,
  user admin, toasts, dialogs, login/reset, autosave status, "PDF erstellen").
  The **protocol/report itself is English-only** (per request): the report-form
  field/section labels, dropdown options (KATEGORIE/VERURSACHER/STATUS/SEV are
  English values now), the read-only view (`renderView`), and the printed PDF
  (`buildPrint`). Use the `lbl(de,en)` helper for field labels — pass English in
  the first slot and `""` in the second (no bilingual `· · ·` secondary anymore).
  The report (PDF + view) shows a disclaimer before the signatures: "This protocol
  does not constitute acceptance of the current condition of the machinery."
- Navigation is hash-routed (`router()` on `hashchange`): `#/reports` (overview,
  default landing), `#/new` (blank form), `#/report/<id>` (load+edit a report),
  `#/users` (admin). `navigate(h)` sets the hash (or calls `router()` if
  unchanged); `showOnly(view)` toggles the `#reportsView`/`#usersView` overlays
  over the base `.app` form. The FALU logo lockup in every header (`#formHome`,
  `#reportsHome`, `#usersHome`) links to `#/reports`. After a new report is sent,
  `history.replaceState` updates the URL to `#/report/<id>` without reloading.

## Central reporting (Supabase)
- Backend is the **shared** Supabase project "Whatsapp <> Slack Bridge"
  (`xasehavpvasplrhvwyuu`). Falu objects are **namespaced** to avoid collisions:
  table `falu_reports`, storage bucket `falu-report-photos`. Do not rename.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are constants in `index.html`. The anon
  key is public (the site is public on GitHub Pages) — security relies on RLS,
  not key secrecy.
- Auth: Supabase email/password, presented as a general **FALU account** login
  (not app-specific branding). A full-screen `.auth` gate (`#authGate`) blocks the
  app until login. Calls hit `/auth/v1/token` directly via `fetch` (no SDK).
  Access tokens are refreshed via `refresh_token` on a 401 (`authFetch` retries
  once). `establishSession()` is the shared entry used by login and reset.
- Password reset: "Passwort vergessen?" → POST `/auth/v1/recover?redirect_to=<app url>`
  emails a link back to the app. On load, `handleRecoveryHash()` parses the URL
  hash; `type=recovery` + `access_token` shows the `#resetGate` set-new-password
  view, which PUTs `/auth/v1/user` then establishes the session. NOTE: the app URL
  must be listed in Supabase Auth → URL Configuration (Site URL + Redirect URLs).
- Submit (`sendReport`) is an upsert: `state.reportId` null → INSERT (new uuid,
  sets `created_by_email`), non-null → PATCH `?id=eq.{id}` (sets `updated_at`,
  preserves owner). For each defect, data-URL photos → Blob → uploaded to
  `falu-report-photos/{userId}/{reportId}/...jpg`; already-uploaded paths are
  kept as-is (no re-upload). The row stores broken-out header columns + `data`
  JSONB holding the full defect list with photo *paths*, not base64. Empty dates
  are sent as `null`. The Speichern button (triggers `sendReport`) relabels to
  "Aktualisieren" when editing.
- All views share the same header: a logo-only FALU lockup (no wordmark text) on
  the left that links to `#/reports`, plus context buttons on the right.
- The reports overview (`#reportsView`) is the landing view after login. It lists
  rows (own, or all for admin), each named **"{date} · {Kunde} · {creator name}"**
  (creator name resolved from `PROFILES` via `nameForEmail`). The per-row Löschen
  button deletes the row + best-effort storage cleanup. The bar has
  "+ Neues Mängelprotokoll", "Benutzer" (admin only), "Abmelden".
- Routes for a single report: `#/report/<id>` = **read-only view** (`#viewReport`,
  `renderView()` from state — meta table + defect cards + signatures, with
  Bearbeiten + "PDF herunterladen" buttons); `#/report/<id>/edit` = editable form.
  Clicking a row opens the read-only view; `loadReportData(id)` fetches+sets state
  (photos via signed URLs into `signedCache`) for both. `downloadPdf()` is shared
  by the form and view PDF buttons. The view also has "Link kopieren"
  (`copyReportLink` → clipboard, deep-links to `#/report/<id>`; opening it prompts
  login then lands on the report).
- Roles: admin = `app_metadata.role === "admin"` in the JWT (`session.isAdmin`).
  RLS: SELECT/UPDATE/DELETE = own row OR admin (via an `is_admin()` SQL helper);
  INSERT = `created_by = auth.uid()`. Storage: own `{userId}/` folder, or admin.
- User names live in Supabase `user_metadata.name`. The **`falu-admin` Edge
  Function** (`supabase/functions/falu-admin/index.ts`) actions: `names`
  (any authenticated user — returns {name,email} for ALL users, powers the
  technician dropdown), and admin-only `list`, `create` (sets name+role,
  `email_confirm:true`), `rename` (set a user's name), `delete` (no self-delete).
- The "Monteur(e) / Techniker" field is a `userselect` dropdown populated by
  `loadProfiles()` (caches `PROFILES`, called after login + after create/rename/
  delete) → `populateMonteurOptions()`. Shows name, or email if a user has no
  name yet. Admin user list (`#usersView`) shows name + email and has Umbenennen
  (via `modalPrompt`) / Löschen per row.
- Failures surface as a toast telling the mechanic to try again later. A 401
  triggers one token refresh; if that fails the auth gate reappears.

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
