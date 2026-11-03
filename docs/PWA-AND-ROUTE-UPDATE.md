# Route display and PWA behaviour

## Live route display

RailRadar's live-status endpoint supports `haltsOnly`. Rail & Route requests the complete route (`haltsOnly=false`) so the data can distinguish a scheduled halt (`isHalt: true`) from a pass-through point (`isHalt: false`).

The default route timeline lists official halts only. Between two adjacent halts, the user may expand the segment to reveal all pass-through stations supplied by the provider. If the live train is currently reported at one of those pass-through stations, the segment expands automatically to keep the reported location visible.

The display does not fabricate missing pass-through records. When `isHalt` metadata is absent, it keeps all supplied route records visible. Pass-through times are neutral and labelled as pass-through rather than coloured as if they were actual halt arrival/departure times.

## PWA support

Rail & Route is still a website. The PWA manifest and service worker allow supported browsers to install it as a standalone window/app on Android and desktop Chrome/Edge. The install button uses the browser's native install prompt when available and otherwise explains where to find the browser's install action.

Offline behaviour is intentionally limited:

- The app shell, privacy page, icons and previously visited static assets can be cached.
- The static timetable catalogue is network-first, with a cached fallback when offline.
- Live train and weather API responses are not cached by the service worker.
- Live data and new weather require an internet connection.

The service worker does not poll, track location, schedule background work or send notifications. Optional device GPS is requested only after an explicit visitor click and remains in page memory.

## Permissions and privacy

Cloudflare Pages `_headers` uses `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`. This allows the site's explicit on-device GPS feature without granting camera or microphone access. The visitor can still deny location permission in the browser.
