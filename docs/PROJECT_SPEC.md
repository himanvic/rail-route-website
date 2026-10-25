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
4. Station suggestions through a debounced, server-side lookup endpoint. Users can still enter a station code manually if the provider is not configured.
5. Expand a train result to load its full halts-only schedule. Highlight the selected source-to-destination segment and show an animated illustrative route line. The decorative animation is never represented as live GPS.
6. PNR action redirects directly to the official enquiry page. There is no local PNR form, storage, logging or PNR API call.
7. Short-lived Cloudflare edge caches for live status, station suggestions, between-station timetable results and static train schedules. The live-status cache uses a 120-second TTL; lookup and schedule TTLs are defined in the shared API helper/routes and must follow provider terms.
8. Browser-local fallback that saves only the last successful live train status. Journey-search fallback is in-memory for the current page session only; stale results are labelled with the original retrieval time.
9. Animated Privacy & Data Transparency page linked from the footer.
10. Honest no-provider, invalid-input, rate-limit and upstream-error states. No fabricated train results.

## Architecture
- Frontend: React + Vite, static assets hosted on Cloudflare Pages.
- Backend: Cloudflare Pages Function under `functions/`.
- Data: optional external RailRadar API through server-side adapters for live status, station suggestions, train-between-stations search and full schedule lookup. No mandatory database.
- Secret: `RAILRADAR_API_KEY` configured as a Cloudflare secret; never exposed to Vite/client code.
- Repository: GitHub; never commit `.dev.vars` or API secrets.

## Launch gate — provider must be verified
Before publicly enabling live API queries, verify the current provider account, free-tier quota, personal/non-commercial scope, caching allowance, response schema and privacy policy. Public docs have displayed inconsistent free quotas, so rely on the developer dashboard/terms, not this spec. If the plan is not permitted for public student deployment, swap the provider instead of bypassing controls.

## Not included / future work
- PNR lookup or storage.
- Offline full national station/train database; search suggestions and schedules require the configured provider, while manual station-code search remains available.
- Geographic map tiles and live GPS map. The first release uses an animated timeline; its movement is decorative and not a representation of train position.
- User accounts, personal search history, database, payment processing or analytics.
- Guarantee of five years of uninterrupted hosting or live railway data.
