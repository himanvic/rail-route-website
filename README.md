# Rail & Route — Indian Train Status Website

A premium, privacy-aware website starter built for a public GitHub repository and Cloudflare Pages. It is a **website**, not a native mobile application.

> **Working project name:** Rail & Route. Rename it before public launch if desired.
>
> **Data note:** the frontend is real and interactive, but real live train results require an approved provider account and the `RAILRADAR_API_KEY` secret. This project intentionally does not include a hardcoded API key or fake train status.

## Features included

- Ivory, obsidian black, silver, champagne gold and bronze visual system.
- Responsive homepage with railway hero image, subtle train/route animations, light/dark appearance toggle and mobile navigation.
- Live train status form using a five-digit train number and optional journey date.
- Journey Explorer: station autocomplete, source-to-destination train search, scheduled departure/arrival, duration, distance and halt count where returned by the provider.
- Expand a train card to load the complete halts-only timetable, highlight the requested route section, and view an animated route-line preview explicitly labelled as illustrative rather than live GPS.
- Cloudflare Pages Function proxy to the RailRadar live-status endpoint.
- API credential read from a Cloudflare **Secret**, never from the browser bundle.
- Two-minute Cloudflare edge cache to reduce repeat upstream calls.
- Last successful train-status result can be kept locally in the visitor's browser for fallback. It is shown with its original timestamp and a stale warning if the live request fails.
- PNR enquiry links directly to the official Indian Railways enquiry page; the website has no PNR form or PNR API integration.
- Separate animated `privacy.html` page that explains request flow, temporary caching, third-party services and the difference between local and provider storage.
- No Supabase requirement, login, central user database, analytics package, or paid service integration.

## Current data provider caveat

The adapters currently target these documented RailRadar endpoints:

- `GET https://api.railradar.in/v1/trains/{number}/live`
- `GET https://api.railradar.in/v1/lookup/search/stations?q=...&limit=10`
- `GET https://api.railradar.in/v1/trains/between/{from}/{to}?date=YYYY-MM-DD&live=false`
- `GET https://api.railradar.in/v1/trains/{number}?haltsOnly=true`

Each request uses `Authorization: Bearer <API_KEY>` from the server-side `RAILRADAR_API_KEY` secret. The between-stations query asks for static timetable results (`live=false`) to conserve live-data quota.

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

1. Create a public GitHub repository and push this folder. Do not commit `.dev.vars`, API keys or account credentials.
2. In Cloudflare Dashboard, open **Workers & Pages → Create → Pages → Connect to Git** and select the repository.
3. Use build command `npm run build` and output directory `dist`.
4. Ensure `functions/` is in the repository root (it is). Cloudflare Pages detects this folder for Pages Functions.
5. In the Pages project's settings, add a **Secret** named `RAILRADAR_API_KEY` for Production and (if needed) Preview. Paste your own permitted key as its value. Do not create this as a public Vite variable.
6. Deploy. Test a valid five-digit train number, an invalid number, a missing secret, a bad provider key, a provider rate-limit response, and a provider outage.
7. Open `/privacy.html` and confirm that the live-data and provider disclosures match the provider you have configured.

Cloudflare dashboard labels can change. Use the **Secret** type, not a plaintext variable, for API credentials. Official guidance: <https://developers.cloudflare.com/workers/configuration/secrets/>.

## API route

- `GET /api/trains/{five-digit-number}/live?date=YYYY-MM-DD`
- `GET /api/stations/search?q=New%20Delhi`
- `GET /api/trains/between/{FROM_CODE}/{TO_CODE}?date=YYYY-MM-DD`
- `GET /api/trains/{five-digit-number}/schedule`

Possible responses include:

- `200`: successful provider result, with `retrievedAt` and `cacheMode`.
- `400`: invalid train number/date.
- `403`: cross-origin browser request rejected.
- `404`: provider says the train/date has no result.
- `429`: provider rate limit reached.
- `502`: provider or upstream failed.
- `503`: provider secret is not configured.

The two-minute edge cache is a quota-saving cache, not a permanent train database. A fallback saved by the browser is only available on that visitor's device and only for the most recent successful lookup. The response may still be incomplete or delayed; the interface shows a retrieval timestamp.

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

Station suggestions are requested only after the visitor has typed at least three characters and paused briefly. An in-memory browser cache avoids re-requesting the same query during the page session; Cloudflare may edge-cache suggestion and static timetable responses. These requests can still consume the provider's free quota. Visitors can type a station code (e.g. `NDLS`, `HWH`, `MMCT`) directly when suggestions are unavailable. Search by code requires valid provider-recognized station codes.

The train-between-stations response returns scheduled trains and segment-level summary. Selecting a result fetches that train's full stop schedule separately. The moving locomotive on the route line is a visual animation only; it does not claim to reflect current train position. Train locations and delays are shown only in the separate live-status response when supplied by the provider.

## Project structure

```text
rail-route-website/
├── functions/api/trains/[number]/live.js  # Cloudflare Pages live-status proxy
├── functions/api/trains/[number]/schedule.js # Full scheduled route
├── functions/api/trains/between/[from]/[to].js # Search between station codes
├── functions/api/stations/search.js       # Server-side station autocomplete
├── functions/_shared/railradar.js         # Secret, cache and API proxy helper
├── public/
│   ├── assets/hero-train.webp              # Generated hero artwork
│   ├── privacy.html                        # Animated privacy & data-flow page
│   ├── manifest.webmanifest
│   └── _headers
├── src/
│   ├── main.jsx
│   └── style.css
├── .dev.vars.example
├── index.html
├── package.json
├── vite.config.js
└── wrangler.toml
```
