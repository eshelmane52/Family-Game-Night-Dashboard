# Family Game Night Dashboard

A simple shared family scoreboard app for logging game night results, winners, notes, and basic stats.

The app is built as a small static HTML/CSS/JavaScript project and is hosted through GitHub Pages. It is also installable as a Progressive Web App, so family members can open it from their phone or tablet home screen.

## Current status

The project is currently a working hosted PWA with shared backend sync.

Completed:

- Static frontend app
- Game result entry form
- Game dropdown
- Winner dropdown
- Game log
- Reverse chronological display, newest results first
- Delete result
- Basic stats
- Wins by player
- JSON export/import backup tools
- Browser local cache fallback
- GitHub Pages hosting
- PWA install support
- Offline app shell support
- Supabase shared backend persistence
- Cross-device shared sync for add/delete/reset/import behavior

## Tech stack

- HTML
- CSS
- JavaScript
- GitHub Pages
- Progressive Web App files
  - `manifest.webmanifest`
  - `service-worker.js`
  - app icons in `/icons`
- Supabase REST API backend
- Browser `localStorage` as a local last-saved cache/fallback

## Project structure

```txt
Family-Game-Night-Dashboard/
├─ index.html
├─ styles.css
├─ app.js
├─ manifest.webmanifest
├─ service-worker.js
├─ README.md
└─ icons/
   ├─ icon-192.png
   ├─ icon-512.png
   ├─ apple-touch-icon.png
   └─ .gitkeep