# Family Game Night Dashboard

A simple family scoreboard app for logging game night results, winners, notes, and basic stats.

## Current status

This is the local frontend MVP prepared for Phase 3A hosting.

The app is intentionally static and simple:

- `index.html`
- `styles.css`
- `app.js`
- Browser `localStorage`
- JSON export/import backup tools

## Hosting target

This project can be hosted on any static hosting provider, including:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

For the first online version, GitHub Pages is recommended because this app does not need a build process yet.

## Important data note

Moving the app from a local file to a hosted URL creates a new browser storage location.

Before switching to the hosted version:

1. Open the current local app.
2. Use **Data Tools → Export JSON Backup**.
3. Open the hosted app URL.
4. Use **Data Tools → Import JSON Backup**.

This restores your existing local data into the hosted version.

## GitHub Pages deployment steps

1. Create a new GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
   - `README.md`
3. Commit the files to the `main` branch.
4. Open the repository on GitHub.
5. Go to **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Set the branch to `main` and the folder to `/root`.
8. Save.
9. Wait for GitHub Pages to publish the site.
10. Open the published URL and run the smoke test below.

## Hosted smoke test

After deployment:

- Page loads without errors.
- Date defaults to today.
- Game dropdown renders.
- Winner dropdown renders.
- Add a test result.
- Refresh the page and confirm the result persists.
- Delete the test result.
- Export a backup.
- Import a backup.
- Reset all data only if intentionally testing recovery.

## Phase 3A result

When the hosted URL works, Phase 3A is complete.

This does **not** complete shared sync. It only makes the current frontend reachable from a URL.

## Next phase

Recommended next step after Phase 3A:

- Phase 3B: PWA installability
- Phase 3C: shared backend/data architecture
- Phase 3D: sync implementation
