# Falu Mängelprotokoll

A single-file, offline-capable web app for documenting machine defects during
installation and commissioning in the field. Mechanics fill one card per defect,
capture photos with the device camera, and export a branded PDF.

Everything (logo, styles, logic) is inlined in `index.html`. No build step,
no server, no dependencies.

## Use it

Open `index.html` in any browser, or visit the live URL once deployed.

- **+ Mangel hinzufügen** — add a defect card
- **+ Foto** — capture/attach photos (auto-downscaled)
- **Speichern / Laden** — save and reopen a report as a `.json` file
- **PDF erstellen** — produce the formatted PDF (browser print → "Save as PDF")

All data stays on the device. Nothing is sent anywhere until you export.

## Deploy on GitHub Pages (branch method — simplest)

1. Create a repository and push these files to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, select **main** and **/ (root)**, Save.
4. Wait ~1 minute. Your site is live at
   `https://<your-username>.github.io/<repo>/`.

Every push to `main` redeploys automatically.

**Notes**
- The repo must be **public** for free Pages. Private-repo Pages requires a paid
  GitHub plan.
- HTTPS is automatic and is required for the camera button on phones.

## Edit with Claude Code

From this folder:
```bash
claude
```
Then ask in plain language, e.g. "add a field for batch number" or
"swap the order of the description and cause fields". Claude Code edits
`index.html`, and can commit and push for you (with the `gh` CLI authenticated).
`CLAUDE.md` holds the brand rules so changes stay on-brand.
