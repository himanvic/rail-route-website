# Deployment checklist

## Before publishing
- [ ] Choose the final public brand name.
- [ ] Review RailRadar's latest free tier, non-commercial testing scope, cache permissions and privacy terms.
- [ ] Confirm the API key is allowed for the intended public student demonstration.
- [ ] If terms do not allow public use, replace the provider adapter before enabling live lookups.
- [ ] Add the provider name and current policy link to `public/privacy.html`.
- [ ] Confirm the official PNR link opens and the site has no PNR field.

## GitHub
- [ ] Create a repository and commit source files.
- [ ] Confirm `.dev.vars` and real secrets are not staged or committed.
- [ ] Keep the repository README and privacy wording aligned with the deployed provider.

## Cloudflare Pages
- [ ] Connect the GitHub repository to Cloudflare Pages.
- [ ] Build command: `npm run build`.
- [ ] Build output directory: `dist`.
- [ ] Confirm `functions/` is at the repository root.
- [ ] Add `RAILRADAR_API_KEY` as a Secret in the project's environment settings.
- [ ] Confirm the Free plan and API provider quotas before launch; don't enable paid upgrades without owner approval.
- [ ] Smoke-test invalid input, valid train, missing secret, bad key, 429 quota response, provider outage and device-local stale fallback.
- [ ] Test `/privacy.html` on desktop and mobile.

## After deployment
- [ ] Make one valid live request and verify the returned train and data timestamp.
- [ ] Check `X-Rail-Route-Cache` responses and ensure repeat lookups do not make unnecessary provider calls.
- [ ] Verify no API key appears in the browser's network requests, page source, built assets or GitHub history.
- [ ] Verify the service worker does not cache `/api/` responses.
- [ ] Keep a copy of the source and document how to switch API providers.
