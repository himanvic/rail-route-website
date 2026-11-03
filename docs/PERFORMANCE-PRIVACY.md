# Performance and privacy notes

- Train-status API credentials remain server-side in the `RAILRADAR_API_KEY` Cloudflare secret.
- Live API calls are user initiated; the service worker never caches `/api/*` responses.
- The service worker caches the app shell and timetable assets, uses network-first for timetable data, and falls back to saved assets offline.
- Nearby station weather is fetched in one batched request for up to three public station coordinates, with a 20-minute session/edge cache and no polling.
- Passenger GPS is one-shot, opt-in, low-accuracy by default and processed locally. GPS coordinates are not sent to RailRadar or Open-Meteo by this feature.
- PNR is redirected to the official enquiry website; no PNR input or ticket data is collected by Rail & Route.
- Animations are event-driven; the service worker adds no background sync, geolocation watch, notification polling or periodic timers.
- `prefers-reduced-motion` is respected by existing route and UI motion styles.
- This cannot guarantee zero infrastructure logs: Cloudflare and external providers may process technical request metadata under their own policies.
