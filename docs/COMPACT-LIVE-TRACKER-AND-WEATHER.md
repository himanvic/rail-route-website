# Compact live tracker and next-two-halt weather

## Live-status presentation

- The default view shows the previous official halt (when available), the provider-reported station/route position, and the next two official halts.
- The current reported station is kept visible even when the provider identifies it as a pass-through point.
- A visitor can open **View full route** to inspect all official halts from origin to destination.
- In the full route, a segment between adjacent official halts can be expanded to show pass-through stations supplied by the live provider.
- If the provider does not supply halt metadata, the UI keeps the supplied route records visible rather than guessing which are official stops.
- No new RailRadar request is made by the compact/full route toggle.

## Weather policy

- Weather is requested only for the next two **explicitly identified official halts** after the provider-reported position.
- The current station, previous halt, pass-through stations and visitor GPS coordinates are not sent to the weather endpoint.
- The weather endpoint accepts at most two station coordinates and makes one batched hourly-forecast request to Open-Meteo.
- The browser selects the forecast hour nearest the stop's estimated arrival time. An actual provider time is preferred; otherwise the estimate uses the scheduled time plus a reported stop delay or the current train delay when available.
- If a reliable arrival time, official-halt flag, coordinates or nearby forecast hour is missing, that stop's weather is omitted rather than guessed.
- The forecast is for the surrounding station area, not a platform sensor. It is labelled as a forecast at arrival.
- The response is cached at Cloudflare's edge and in the browser session for about 20 minutes. There is no polling or background refresh.

## Resource and privacy safeguards

- The batch is limited to two station coordinates and up to 72 hourly forecast rows per location.
- Weather fetches are triggered by a live-status result, not by each render or every animation frame.
- Passenger GPS remains opt-in, one-shot and device-local; it is not used for weather lookup.
- No RailRadar credentials are sent to Open-Meteo. The weather endpoint has no API key.
- No PNR data is collected by this website.
- Reduced-motion preferences remain respected. The route marker animates only when the result/layout changes, not as continuous simulated movement.
