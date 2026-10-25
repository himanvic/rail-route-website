# Rail & Route — Indian Train Status Website

A premium, privacy-aware website starter designed for a private GitHub source repository and public Cloudflare Pages deployment. It is a **website**, not a native mobile application.

> **Working project name:** Rail & Route. Rename it before public launch if desired.
>
> **Data note:** the frontend is real and interactive, but real live train results require an approved provider account and the `RAILRADAR_API_KEY` secret. This project intentionally does not include a hardcoded API key or fake train status.

## Features included

- Ivory, obsidian black, silver, champagne gold and bronze visual system.
- Responsive homepage with railway hero image, restrained transitions, light/dark appearance toggle and mobile navigation. In Live Status, the route marker moves only when a provider-reported position changes; scheduled Journey Explorer routes are static.
- Live train status form using a five-digit train number and optional journey date.
- Journey Explorer uses a locally hosted, compact scheduled-timetable catalogue for station autocomplete, station-to-station search, operating days, departure/arrival times, distance and full route schedules. These searches do not call RailRadar or consume its monthly API quota.
- Expand a train card to load a static schedule shard, highlight the requested route section, and inspect a static station-by-station schedule. Scheduled routes do not show a pretend moving train because timetable data is not live position data.
- Daily GitHub Actions job checks the community timetable snapshot upstream, builds compact sharded JSON files, records both the sync-check time and upstream data revision date, and commits changed data to trigger a Cloudflare Pages deployment.
- Cloudflare Pages Function proxy to the RailRadar live-status endpoint.
- API credential read from a Cloudflare **Secret**, never from the browser bundle.
- Two-minute Cloudflare edge cache to reduce repeat upstream calls.
- Last successful train-status result can be kept locally in the visitor's browser for fallback. It is shown with its original timestamp and a stale warning if the live request fails.
- PNR enquiry links directly to the official Indian Railways enquiry page; the website has no PNR form or PNR API integration.
- Separate animated `privacy.html` page that explains request flow, temporary caching, third-party services and the difference between local and provider storage.
- No Supabase requirement, login, central user database, analytics package, or paid service integration.

## Current data provider caveat

Only live running status uses the optional RailRadar API adapter: `GET https://api.railradar.in/v1/trains/{number}/live`. It uses `Authorization: Bearer <API_KEY>` from the server-side `RAILRADAR_API_KEY` secret. Station search, trains-between-stations and full schedules are served from the static timetable catalogue and do not call this API.

## Daily static timetable sync (no RailRadar requests)

The catalogue is generated from the community dataset at <https://github.com/prasenjit-27/Indian-Railway-Data>, whose repository declares MIT licensing. The workflow uses GitHub Actions at 03:00 IST daily and can also be started manually. It downloads the upstream snapshot (not RailRadar), compacts it into station, train-index, station-index and schedule-shard JSON files, and records:

- `syncCheckedAt`: when this workflow checked/generated the local catalogue.
- `sourceDataCommitAt`: latest upstream Git commit that touched `trains.json` or `stations.json`, when available.
- `sourceSnapshotCommit`: exact upstream revision used.

A daily sync check does **not** mean the upstream schedule changed that day. When upstream data does not change, the timetable remains the same; it is a schedule snapshot, not live status. The source repository itself warns that its data may be incomplete or out of date and that the upstream source license/terms should be reviewed. Its dataset page is here: <https://github.com/prasenjit-27/Indian-Railway-Data>. Generated data includes source attribution and a copy of the upstream `LICENSE` file. The sync job stops safely if that file is missing, rather than silently redistributing the dataset without its declared license text.

After pushing this project update to GitHub, run **Actions → Daily timetable snapshot sync → Run workflow** once to create the initial catalogue. The daily schedule then checks upstream automatically. The workflow needs repository `contents: write` permission. If its push step is denied, allow read/write workflow permissions under repository Settings → Actions → General. See `UPDATE-INSTRUCTIONS.md` for the safe update procedure. If the source repository changes its file layout, the workflow will fail safely rather than replace the current catalogue with an invalid dataset.

RailRadar's publicly visible pages have shown inconsistent free-sandbox quotas (the homepage and pricing information have displayed different allowances). The free sandbox is also described as being for personal/non-commercial testing. Before using this key on a publicly available deployment, check the current developer dashboard, quota, caching terms, acceptable-use terms and privacy policy. Treat this as a **replaceable provider adapter**, not a five-year availability guarantee. If the provider terms do not permit your planned public student project, do not use it; replace the adapter with a permitted provider. No paid plan or billing is enabled by this repository.

## Troubleshooting: missing `caniuse-lite` module

If Vite reports `Cannot find module \`caniuse-lite/dist/unpacker/feature\` or another missing file inside `caniuse-lite`, the local `node_modules` tree may be incomplete. Stop the dev server with `Ctrl+C`. From this folder, run:

```powershell
npm ci
npm run dev
```

If `package-lock.json` exists and matches `package.json`, `npm ci` removes and reinstalls `node_modules` from that lockfile. If the lockfile is missing or npm reports a package/lock mismatch, remove the local installation and generated lockfile, then resolve a fresh tree:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache verify
npm install
npm run dev
```

This needs a working connection to the npm registry. If the install reports network errors, resolve network/proxy access first; do not edit application source to work around a missing package file.

## Validate the timetable generator

The included Python unit tests do not require a RailRadar API key or network access:

```bash
python -m unittest discover -s tests -v
```

## Run the frontend locally

Requirements: Node.js 20.19+ (Node 22 recommended) and npm.

```bash
npm install
npm run dev
```

Vite serves the UI at the local URL shown in the terminal. In plain Vite mode, the Cloudflare Pages Function does not run, so live status will show an explanatory unavailable/configuration message. This is expected.

## Run the Cloudflare Function locally

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Add your own permitted test API key to `.dev.vars`.
3. Run:

```bash
npm run dev:cloudflare
```

This builds the frontend and serves `dist` plus the `functions/` API through Wrangler Pages Dev. The `dist` files are not hot-reloaded in this command; rerun after frontend changes. Never commit `.dev.vars`.

## Deploy to GitHub + Cloudflare Pages

1. Push this folder to your GitHub repository (it can remain private). Do not commit `.dev.vars`, API keys or account credentials.
2. In Cloudflare Dashboard, open **Workers & Pages → Create → Pages → Connect to Git** and select the repository.
3. Use build command `npm run build` and output directory `dist`.
4. Ensure `functions/` is in the repository root (it is). Cloudflare Pages detects this folder for Pages Functions.
5. In the Pages project's settings, add a **Secret** named `RAILRADAR_API_KEY` for Production and (if needed) Preview. Paste your own permitted key as its value. Do not create this as a public Vite variable.
6. Deploy. Test a valid five-digit train number, an invalid number, a missing secret, a bad provider key, a provider rate-limit response, and a provider outage.
7. Open `/privacy.html` and confirm that the live-data and provider disclosures match the provider you have configured.

Cloudflare dashboard labels can change. Use the **Secret** type, not a plaintext variable, for API credentials. Official guidance: <https://developers.cloudflare.com/workers/configuration/secrets/>.

## API route

- `GET /api/trains/{five-digit-number}/live?date=YYYY-MM-DD` — the only RailRadar-backed lookup.

Station search, station-to-station timetable search and complete schedule lookup read `/data/timetable/*.json` static files, so they do not consume RailRadar requests.

Possible responses include:

- `200`: successful provider result, with `retrievedAt` and `cacheMode`.
- `400`: invalid train number/date.
- `403`: cross-origin browser request rejected.
- `404`: provider says the train/date has no result.
- `429`: provider rate limit reached.
- `502`: provider or upstream failed.
- `503`: provider secret is not configured.

The two-minute edge cache is for live status, not a permanent train database. A fallback saved by the browser is only available on that visitor's device and only for the most recent successful live-status lookup. The response may still be incomplete or delayed; the interface shows a retrieval timestamp.

## PNR design decision

There is intentionally no PNR input field and no PNR number is sent to this website's Worker. PNR buttons open the official enquiry service:

<https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.html>

The external official service has its own terms and privacy practices. The project is independent and is not affiliated with Indian Railways, IRCTC, CRIS or NTES.

## Privacy and storage summary

- No user account or centralized search-history database is included.
- The most recent successful train-status response may be stored in the visitor's local browser storage for fallback. It does not include a PNR or ticket details.
- Train-status responses may be briefly cached at Cloudflare's edge to reduce repeat API usage.
- Cloudflare and the live data provider may process request metadata and technical logs under their own policies. This project does not claim that infrastructure providers retain no logs.
- If you change the provider, update `public/privacy.html`, this README and any data-source disclosures.

## Important limits

- A free hosting quota is separate from a third-party railway API quota.
- Free API access, endpoint formats, permitted use and uptime can change. The site cannot guarantee uninterrupted live data for five years without occasional intervention.
- Do not log full query URLs or add passenger/ticket details to this project.
- Keep dependencies and hosting configuration reviewed periodically, even if the site is designed to be low-maintenance.

## Journey Explorer data handling

Station suggestions are filtered from the locally hosted stations catalogue. The station-to-station search intersects local stop indexes and loads compact schedule shards on demand. These operations do not call RailRadar. Visitors can type a station code (e.g. `NDLS`, `HWH`, `MMCT`) directly when suggestions are unavailable.

The full timetable snapshot is checked daily by GitHub Actions against its upstream dataset source. The `syncCheckedAt` date means we checked the source; `sourceDataCommitAt` records the latest upstream commit touching the timetable files when available. Neither date guarantees a train operator changed or verified the schedule that day. In Live Status, the marker transitions to the provider-reported station or segment progress when available; it does not free-run or represent continuous GPS. Scheduled Journey Explorer routes use a static timeline. The source snapshot may contain errors or omissions, so verify important travel details with official railway sources. Train locations and delays are shown only in the separate live-status response when supplied by the provider.

## Project structure

```text
rail-route-website/
├── .github/workflows/daily-timetable-sync.yml # Daily upstream snapshot check
├── scripts/sync_timetable.py                  # Build compact static JSON catalogue
├── functions/api/trains/[number]/live.js      # Only RailRadar-backed route
├── functions/_shared/railradar.js             # Secret, cache and API proxy helper
├── public/data/timetable/                     # Generated by GitHub Actions
│   ├── metadata.json
│   ├── stations.json
│   ├── train-index.json
│   ├── station-index/                         # Small station-code shards
│   └── schedules/                             # Train schedule shards
├── public/assets/hero-train.webp               # Generated hero artwork
├── public/privacy.html                         # Animated privacy & data-flow page
├── src/lib/static-timetable.js                # Offline/static schedule search
├── src/main.jsx
├── src/style.css
├── .dev.vars.example
├── index.html
├── package.json
├── vite.config.js
└── wrangler.toml
```

# Rail & Route: Exact Time + Color Status Update

This patch updates the live train route timeline to present clock times rather than numeric delay offsets.

## Visual behavior

- Late: red themed time and `LATE` tag.
- Early: green themed time and `EARLY` tag.
- On time: green themed time and `ON TIME` tag.
- Unknown delay: neutral styling, without guessing.
- When the provider returns actual times, display those. If only a schedule and a reported delay are available, calculate the estimated clock time and label it `EST.` with the scheduled time as context.
- The top-level status pill also shows `LATE`, `EARLY`, `ON TIME`, or `STATUS UNAVAILABLE` rather than a number of minutes.

Only `src/main.jsx` and `src/style.css` are included. Apply to the existing project; do not replace the repository or any API workflow configuration.

# Rail & Route — GPS + full route timeline update

This patch combines the existing on-device GPS feature, privacy explanation, exact clock-time status styling, and a full live-status route timeline.

## Files included

- `src/main.jsx` — retains GPS support and color-coded actual/estimated station times; removes the route slicing so every stop returned by the provider is rendered from origin to destination.
- `src/style.css` — retains the current ivory / black / silver / champagne-gold theme, GPS styles, and late/early/on-time colors.
- `public/privacy.html` — privacy notes for on-device GPS and external live data.

## Apply to your existing repository

1. Make sure you are in your existing `rail-route-website` repo on `feature/live-route-ui` (or the branch for your open Pull Request).
2. Back up/commit current work before overwriting files.
3. Extract this ZIP and copy the files inside `rail-route-full-timeline-gps-update` into your project root, preserving folder paths, replacing only the matching files.
4. Do not replace `.git`, `.dev.vars`, `.gitignore`, package files, `functions/`, `.github/workflows/`, generated timetable files, `vite.config.js`, or `wrangler.toml`.
5. Run `npm run build`.
6. Inspect Live Status: it should show the full provider-returned route, from first to last stop. The list may be long and can be scrolled normally; it is no longer truncated to a few stations around the reported location.
7. Check the `Use my GPS` feature: it asks only after a user click and compares device location with station coordinates locally. Device GPS is not verified train GPS and does not establish delays.
8. Review the Git diff and run `git status`. Stage and commit on the feature branch; push it and review the existing Pull Request before merging to `main`.

## Behavior and limits

- The Live Status route timeline renders all route stops present in the live provider response. If the API itself returns an incomplete route, the site cannot invent missing stops.
- Station time shows an actual time when provided, otherwise an estimated time only when a scheduled time and numerical delay exist. Late is red; early and on-time are green; unknown is neutral.
- No minute-offset label such as `+28m` is displayed in each route row.
- The GPS button makes no RailRadar request and sends no coordinates to our backend; coordinates are kept in page memory only.
- This update itself makes no API calls and does not change provider credentials or quota settings.
- Full route rows are rendered in the page rather than cropped to stations near the current position. Long routes will naturally require scrolling.

## Security

Never commit `.dev.vars` or an API key. Keep your existing secret configuration untouched.

# Rail & Route — Live position, timeline estimate, and vertical train animation update

This update is intended for the existing Rail & Route project. It changes only `src/main.jsx` and `src/style.css` and retains the current GPS button, full provider-returned route, exact-time color statuses, and GitHub footer credit.

## What changes

- After a live-status result arrives, the page smoothly scrolls to the station marked `REPORTED HERE`. If the provider's current station cannot be matched to a route stop, it scrolls to the result panel instead.
- Replaces the small horizontal train glyph on the route summary with a **vertical train set** in the station timeline's left track: a locomotive and small coaches in the existing champagne-gold palette.
- The vertical train is positioned at the provider-reported station or along the segment only when the API supplies a usable segment-progress value. It eases to a new position after a new response; it does not simulate continuous live GPS movement.
- Full route stations remain listed from origin to destination.
- For upcoming stations without actual times and without stop-specific delay, the UI may calculate an estimate by carrying forward the latest reported overall delay. These rows are marked `EST. LATE`, `EST. EARLY`, or `EST. ON TIME`, show the scheduled time alongside the estimate, and use red/green theme-matched colors. If delay is unavailable, the scheduled time remains neutral.
- Adds a note explaining that estimated future times are guides and the delay can change.
- Keeps the optional on-device GPS function. Device GPS describes the visitor's device, not the train.

## Apply

1. Make a backup or commit your current branch first.
2. In VS Code, confirm you are on `feature/live-route-ui` (or the feature branch for your open PR).
3. Extract this ZIP and copy the files inside into the project root, replacing only `src/main.jsx` and `src/style.css`.
4. Do not replace `.dev.vars`, `.git`, `package.json`, `package-lock.json`, `.gitignore`, `functions/`, `.github/workflows/`, generated timetable data, `wrangler.toml`, or `vite.config.js`.
5. Run `npm run build`.
6. Check that the new result scrolls to the reported station, that the vertical train is beside the stop list, and that only upcoming stations without actual times display estimates.
7. In Source Control, review the diff, commit on the feature branch, push it, and update the Pull Request. Merge only after review/checks pass.

## Data accuracy and quota

- This UI patch makes no API requests and does not change the RailRadar credential or quota logic.
- Estimated future times are derived from the latest reported overall delay and the saved timetable. They are not actual arrival/departure reports and must be labelled estimated.
- If the provider response lacks a matched route station, the UI does not invent a train position and cannot automatically scroll to a specific stop.
