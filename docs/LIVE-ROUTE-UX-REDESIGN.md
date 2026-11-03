# Rail & Route: Live Status & Route Timeline UI/UX Redesign

**Specification Reference:** November 3, 2026 UI/UX Redesign & Implementation Specification  
**Reference Train:** 22366 (Danapur SF Express — SMVT Bengaluru to Danapur)  
**Target:** [Rail & Route](https://rail-route-website.pages.dev/)

---

## 1. Summary of Changes

This update addresses long-haul route usability bottlenecks and fixes a critical data-labelling bug that previously displayed future stops as `ACTUAL`.

### Key Enhancements

1. **Fixed Data-Labelling Bug (Past vs. Future Halts — P0 Critical):**
   - **Upcoming Stops (`index > currentIndex`):** Strictly rendered as `EST. · SCHED [Time]` (or `EST. FROM CURRENT DELAY · SCHED [Time]`) with a dashed border badge (`EST. LATE (+Xh Ym)`, `EST. ON TIME`, `EST. EARLY (-Xm)`).
   - **Departed Stops (`index <= currentIndex`):** Rendered as `ACTUAL · SCHED [Time]` with solid badges (`LATE (+Xh Ym)`, `ON TIME`).
   - Upcoming stops never display `ACTUAL`, ensuring travellers know future times are calculated guide estimates.

2. **Visual Railway Track Continuity (P0):**
   - The vertical track marker now displays a solid gold progress indicator up to the train's reported position, transitioning into a **dashed track line** for upcoming stops.
   - Stop row markers for upcoming stations use a dashed circle and dashed vertical connectors.

3. **Sticky "Jump to Train" Action Bar (P1 High):**
   - Floating pill bar sticky at the top of the route view:
     ```
     ● Live at [Station Name] (Stop X/Y) · Next: [Next Halt] — [Jump to Train ↓]
     ```
   - Includes a subtle pulsing green live status indicator.
   - Clicking triggers a smooth animated scroll (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) directly to the `REPORTED HERE` station node.

4. **Explicit Delay Delta Display (P1 High):**
   - Net delay differences are calculated and rendered inline (e.g. `LATE (+8h 34m)` or `EST. LATE (+9h 38m)`).
   - Early arrivals explicitly display negative deltas (e.g. `EARLY (-15m)` / `EST. EARLY (-15m)`).

5. **Pass-Through Station Cleanup & Skipped Ping Handling (P1 & P2):**
   - **Label Deduplication:** Removed repetitive `NO SCHEDULED HALT` text. Pass-through rows now render as a single compact row with station name, code, a discrete chip, and a right-aligned timestamp (`11:53 pm · PASS`).
   - **Skipped Provider Pings:** When an upstream data provider misses a pass-through ping for a past station, the row formats gracefully as `PASS TIME NOT REPORTED` with scheduled time `Sched [Time]` in dimmed text, preventing chronological confusion.

6. **Desktop Two-Column Split Layout (P2 Medium):**
   - Solves the 40% blank viewport issue on wide screens.
   - **Left Column (Sticky):** Train overview, delay badge, journey progress bar, metrics (last reported station, next halt, speed), and On-Device GPS comparison panel.
   - **Right Column (Scrollable):** Complete train route timeline, sticky Jump-to-Train bar, weather forecasts, and service notices.

7. **OLED Eco-Friendly Dark Mode (Section 5):**
   - Warm-dark palette tuned to `#121316` background with `#E6E1DA` text.
   - Significantly reduces battery power draw on mobile OLED screens for overnight train journeys.

---

## 2. Architecture & File Structure

* **`src/lib/live-status-presentation.js`:** Pure utility functions for delay formatting, timing calculation, and stop presentation (`formatDelayDelta`, `delayLabel`, `formatStopPresentation`, `formatPassThroughPresentation`).
* **`src/main.jsx`:** Two-column desktop grid layout, sticky Jump-to-Train pill bar, and timeline rendering.
* **`src/style.css`:** Responsive grid styles, dashed upcoming track styling, sticky pill bar, compact pass-through rows, and OLED dark mode.
* **`tests/live-status-presentation.test.mjs`:** Comprehensive unit tests verifying delta calculations, future vs. past stop labeling, and skipped ping handling.
