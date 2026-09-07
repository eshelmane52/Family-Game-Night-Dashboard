# Change Log

## 2026-09-06 - Workout Tracker Follow-up

- Fixed the workout page's first-load initialization order so saved identities refresh normally.
- Added an accessible, reduced-motion-aware date details dialog with full participant names and statuses.
- Kept participant-marker editing separate from general date-cell detail viewing.
- Moved Wheel of Fortune into the Trivia / Game Show category.
- Bumped the offline app-shell cache for the refreshed workout assets.

## 2026-09-06 - Workout Tracker and Dashboard Navigation

- Added a fixed, safe-area-aware bottom toolbar for Games, Workouts, and Gift Cards.
- Grouped the native game selector by category and added Gin Rummy, Wheel of Fortune, Jeopardy, Password, and Blank Space.
- Added the shared Workout Tracker for Evan, Scarlet, and Mom with remembered device identity.
- Added one-tap daily completion, historical corrections, selected-user-only editing, and future-date protection.
- Added monthly standings, current cross-month streaks, and a responsive month calendar.
- Added a review-only Supabase schema with a date-only model, participant validation, RLS policies, and a unique daily-credit constraint.
- Added workout calculation tests and a mock browser fixture for non-destructive UI testing.
- Bumped the offline app-shell cache for all new pages and assets.

## Version 1.03

- Replaced player win text with responsive bars scaled against the current leader.
- Sorted win bars from most wins to least while preserving configured order for ties.
- Updated the Most Wins statistic to list every tied leader in configured display order.
- Added a local victory sound and lightweight, reduced-motion-aware confetti for valid result submissions.
- Added a session-only dismissible Rules card above the result form.
- Added the new dashboard UI and audio assets to the bumped offline cache.

## 2026-07-12 - Gift Card Tracker

- Added a separate, responsive Gift Card Tracker page with household identity filtering.
- Added integer-cent purchase and balance-correction ledgers, transaction history, card management, and archive/restore behavior.
- Added a review-only Supabase schema with constraints, indexes, foreign keys, and anonymous RLS policies.
- Added cross-page navigation and cached the new PWA shell assets.
- Documented the manual database setup, no-auth security limitation, testing, and deployment order.
- Applied the Supabase migration and verified transactional purchase locking with a controlled live concurrency test.

## Version 1.00 (aka V3 service worker)

- Initial Release

## Version 1.01

- Set up the new GitHub Desktop workflow for the live Family Game Night Dashboard project.
- Confirmed that pushing to GitHub automatically redeploys the GitHub Pages app.
- Deleted unused empty `download` file.
- Refreshed `README.md` to reflect the current hosted PWA + Supabase shared-sync state.
- Alphabetized the default game dropdown.
- Added `Scattergories` to the game list.
- Added `Other / Custom Game` option to the game dropdown.
- Added custom game text input that appears only when custom game is selected.
- Added validation so custom game submissions require a typed game name.
- Updated submit logic so custom games save using the typed name instead of the dropdown placeholder value.
- Bumped the service worker cache version to help installed PWA users receive the latest update.
- Full local functional test passed.

## Version 1.02

- Updated to include Pickleball as selection item
- Show/hide for game log
- Updated note text for better readability. 



## Planned Changes
- Visual Refresh
- Twitter page add (will be release 2.0)
- Better Stats page
- Win percentage
- Win Graphs?
