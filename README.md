# Rail & Route — combined route and PWA update

A one-time overlay for the existing Rail & Route React/Vite + Cloudflare Pages project.

Includes:
- Live route with official halts visible by default and click-to-expand pass-through segments.
- Automatic expansion if the latest reported train position is at a pass-through point.
- Nearby Open-Meteo weather and on-device GPS from the earlier privacy/performance update.
- Exact time/status presentation, existing vertical train position marker and low-motion behaviour.
- Installable PWA support for Android and desktop Chrome/Edge, with app icons, offline shell and an Install action.
- Privacy text updated for PWA caching and route halt/pass-through display.

See [`APPLY-UPDATE.md`](./APPLY-UPDATE.md) for safe overlay instructions. Do not replace `.git`, secrets, package files, timetable data or the GitHub Actions workflow.
