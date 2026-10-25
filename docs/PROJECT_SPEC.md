# Project specification — Rail & Route

## Goal
A polished, responsive public website for Indian train running status, with a privacy-first PNR redirect and a zero-cost hosting target for a student project.

## Brand and interaction
- Working name: Rail & Route.
- Palette: ivory `#F7F5EF`, obsidian `#171715`, silver, champagne gold `#C9A66B`, bronze.
- Tone: calm, editorial, premium, clear; no imitation of official railway branding.
- Motion: subtle train arrival, progress line, gentle reveal animations; honour reduced-motion preferences.
- Layout: responsive on mobile, tablet and desktop; accessible labels, keyboard focus and clear error messages.

## Features in current starter
1. Live status query by five-digit train number and optional journey date.
2. If a successful API response exists, show current/previous/next station fields, delay, speed when provided, route timeline, provider data and retrieval time.
3. Journey Explorer: search trains between two station codes/names, filter by journey date, compare scheduled departure/arrival, duration, distance and halts where supplied.
4. Station suggestions are filtered from a locally hosted station catalogue. No RailRadar call is made for autocomplete; users can also enter a station code directly.
5. Expand a train result to load its full halts-only schedule. Highlight the selected source-to-destination segment and show an animated illustrative route line. The decorative animation is never represented as live GPS.
6. PNR action redirects directly to the official enquiry page. There is no local PNR form, storage, logging or PNR API call.
7. Only live status calls the RailRadar adapter and is served through a short-lived Cloudflare edge cache (120 seconds, subject to provider terms). Station suggestions, trains-between-stations search and full timetables use static sharded JSON files and do not consume the RailRadar monthly API quota.
8. Daily GitHub Actions sync checks a community dataset source, creates compact station/train/route indexes and commits a new snapshot. The displayed upstream data revision date is distinct from the daily sync-check time.
9. Browser-local fallback that saves only the last successful live train status. Journey-search fallback is in-memory for the current page session only; old results are labelled.
10. Animated Privacy & Data Transparency page linked from the footer.
11. Honest no-provider, invalid-input, rate-limit and upstream-error states. No fabricated live train results.

## Architecture
- Frontend: React + Vite, static assets hosted on Cloudflare Pages.
- Backend: Cloudflare Pages Function under `functions/`.
- Data: optional external RailRadar API only for live status; static sharded timetable data for station suggestions, station-to-station search and full schedules. No mandatory database.
- Secret: `RAILRADAR_API_KEY` configured as a Cloudflare secret; never exposed to Vite/client code.
- Repository: GitHub; never commit `.dev.vars` or API secrets.

## Launch gate — provider must be verified
Before publicly enabling live API queries, verify the current provider account, free-tier quota, personal/non-commercial scope, caching allowance, response schema and privacy policy. Public docs have displayed inconsistent free quotas, so rely on the developer dashboard/terms, not this spec. If the plan is not permitted for public student deployment, swap the provider instead of bypassing controls.

## Not included / future work
- PNR lookup or storage.
- Guarantee that the upstream community timetable is updated daily; GitHub Actions checks daily, but the source maintainer controls when the actual dataset changes.
- Geographic map tiles and live GPS map. The first release uses an animated timeline; its movement is decorative and not a representation of train position.
- User accounts, personal search history, database, payment processing or analytics.
- Guarantee of five years of uninterrupted hosting or live railway data.
