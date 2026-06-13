# CLAUDE.md — Falu Mängelprotokoll

## What this is
A single self-contained file, `index.html`, containing a field tool for
documenting machine defects during installation/commissioning. Mechanics fill
one card per defect, attach camera photos, and export a branded PDF via the
browser print dialog. There is no build step, no framework, and no backend.
All HTML, CSS, JavaScript, and the logo (base64) live in `index.html`.

## Hard constraints (do not break)
- Keep everything in `index.html`. No external requests, no CDNs, no fonts
  fetched over the network — it must work fully offline in a factory.
- No `localStorage`/`sessionStorage`. State is in-memory; persistence is via
  JSON file export/import (Speichern/Laden) only.
- Photos are read with FileReader and downscaled on a canvas (max 1280px long
  edge, JPEG q≈0.72) before being stored as data URLs. Keep this — it keeps
  reports small.
- The PDF is produced by building a hidden `.print-doc` from state and calling
  `window.print()`. Screen UI is hidden in `@media print`; the print doc is
  hidden on screen. Keep this split.
- Labels are bilingual: German primary, English secondary.

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
FALU AG · Buchsweg 8, 4132 Muttenz, Switzerland · +41 61 555 12 34 · info@falu.ch
(Phone/email may be placeholders pending confirmation from the owner.)

## When making changes
- Match the existing token values above; don't introduce new colours/fonts.
- Update both the on-screen field and the `buildPrint()` output when adding or
  renaming a defect field, so the PDF stays in sync.
- After editing, verify the page opens with no console errors and that
  "PDF erstellen" renders all fields.
