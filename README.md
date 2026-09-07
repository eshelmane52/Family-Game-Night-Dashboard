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
- Fixed bottom navigation for Games, Workouts, and Gift Cards
- Categorized game selector with grouped native options
- Shared daily Workout Tracker for Evan, Scarlet, and Mom
- Workout calendar, monthly standings, and current streaks

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

## Dashboard navigation

Games, Workouts, and Gift Cards use a common fixed bottom toolbar. Each module
remains a small static page so the existing GitHub Pages and PWA architecture is
unchanged.

## Workout Tracker

The `workouts.html` page records one date-only workout credit per participant
per calendar day. Evan, Scarlet, and Mom can see everyone's activity, while the
locally selected identity controls which person's dates are editable. The
identity is remembered with `localStorage`; it is an honor-system convenience,
not authentication.

Workout activity is stored in Supabase rather than browser storage. The main
view includes a one-tap control for today, month-specific standings, current
streaks that can cross month boundaries, and a responsive monthly calendar.
Selecting a date or its date number opens a large-text summary with each
participant's full name and workout status.
Past dates can be corrected, future dates are disabled, and only a newly saved
workout for today triggers the completion animation.

### Workout Supabase setup

The Workout Tracker is not operational until its schema has been applied to the
same Supabase project used by the other modules.

1. Open the Supabase SQL Editor.
2. Review `supabase/workout-tracker.sql`.
3. Run the complete file manually.
4. Confirm `workout_results` has the unique constraint on
   `(workout_date, person)`, the future-date trigger, grants, and anonymous RLS
   policies.
5. Complete the cross-device tests before deployment.

The schema stores `workout_date` as PostgreSQL `date`, permits only Evan,
Scarlet, or Mom, prevents duplicate daily credit, and rejects future dates at
both the policy and trigger layers.

## Gift Card Tracker

The separate `gift-cards.html` page tracks gift cards for three household identities: Evan/Scarlet, Mom, and Brina/Ryan. The selected identity is remembered in that browser with `localStorage`. It controls which cards the interface requests and displays, and new cards automatically use that identity. The selector is a convenience filter only; it is not a login or authorization boundary.

Balances use an integer-cent ledger:

```text
remaining balance = initial balance - purchases + balance-correction adjustments
```

Purchases can be edited or deleted. A balance correction records the prior calculated balance, corrected balance, adjustment, and timestamp without removing purchase history. Cards with history are archived rather than deleted; cards with no history may be permanently deleted. Zero-balance cards appear with archived cards automatically.

All purchase and correction writes use transactional PostgreSQL RPC functions. Each function locks the parent gift-card row before calculating or changing the ledger, so concurrent clients serialize against the same authoritative balance. Browser validation is only for user experience; PostgreSQL prevents overdrafts and derives correction differences server-side.

Corrections remain immutable additive ledger adjustments. Editing or deleting an older purchase after a correction intentionally changes the current balance because the correction keeps its originally recorded adjustment rather than replacing history.

The Gift Card page shell is included in the PWA cache, but Supabase is authoritative for all card and ledger data. Balance-changing actions require a working network connection and are not queued offline. Game Night remains the root page and manifest start URL.

### Supabase setup

The Gift Card Tracker is not operational against Supabase until its schema has been reviewed and applied.

1. Open the Supabase SQL Editor for the same project used by `app.js`.
2. Review [`supabase/gift-card-tracker.sql`](supabase/gift-card-tracker.sql).
3. Run the file manually in the SQL Editor.
4. Confirm the three tables and their RLS policies exist.
5. Test the post-migration checklist below before deploying the static files.

The migration creates `gift_cards`, `gift_card_purchases`, and `gift_card_balance_corrections`, with UUID keys, integer-cent fields, protective foreign keys, indexes, constraints, and table-specific anonymous RLS policies.

Anonymous clients retain table reads and limited gift-card metadata writes, but purchase and correction writes are available only through the locking RPC functions.

### Security limitation

This static app intentionally has no authentication. The migration's anonymous policies allow anyone who can access the public application/API to read and modify Gift Card Tracker records. The household identity selector does not protect data. Treat tracker data as public to application users and never enter gift-card numbers, PINs, redemption codes, or payment credentials.

### Local testing

Serve the repository over HTTP rather than opening files directly:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/` for Games,
`http://localhost:8000/workouts.html` for Workouts, and
`http://localhost:8000/gift-cards.html` for Gift Cards. Service workers require localhost or HTTPS. Before a required SQL migration is applied, its tracker should show a clear Supabase setup/load error; that expected error is not a completed integration test.

### Deployment order

1. Back up existing Supabase data as appropriate; the migration does not reference or modify `game_results`.
2. Review and manually run `supabase/gift-card-tracker.sql`.
3. Test card creation, purchases, corrections, edits, deletes, archive/restore, identity switching, and mobile layout.
4. Deploy the static files through the existing GitHub Pages workflow.
5. Reload the installed PWA once so the bumped service-worker cache activates; reinstalling is not required.


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
```
