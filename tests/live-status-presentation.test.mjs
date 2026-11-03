import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateStopArrivalDate,
  getCompactLiveStopIndexes,
  getNextOfficialHaltIndexes,
  selectForecastForArrival,
  formatDelayDelta,
  delayLabel,
  formatStopPresentation,
  formatPassThroughPresentation,
} from '../src/lib/live-status-presentation.js';

const route = [
  { stationCode: 'AAA', stationName: 'Origin', isHalt: true },
  { stationCode: 'AAB', stationName: 'Pass 1', isHalt: false },
  { stationCode: 'AAC', stationName: 'Halt 1', isHalt: true },
  { stationCode: 'AAD', stationName: 'Pass 2', isHalt: false },
  { stationCode: 'AAE', stationName: 'Halt 2', isHalt: true },
  { stationCode: 'AAF', stationName: 'Pass 3', isHalt: false },
  { stationCode: 'AAG', stationName: 'Halt 3', isHalt: true },
];
const halts = [0, 2, 4, 6];

test('weather targets only the next two official halts after the reported station', () => {
  assert.deepEqual(getNextOfficialHaltIndexes(route, halts, 2, 2, true), [4, 6]);
});

test('weather excludes the current halt and pass-through points', () => {
  assert.deepEqual(getNextOfficialHaltIndexes(route, halts, 1, 2, true), [2, 4]);
  const partlyUnknown = [...route];
  partlyUnknown[4] = { stationCode: 'AAE', stationName: 'Unknown stop type' };
  assert.deepEqual(getNextOfficialHaltIndexes(partlyUnknown, halts, 2, 2, true), [6]);
  assert.deepEqual(getNextOfficialHaltIndexes(route, halts, 2, 2, false), []);
});

test('compact view includes previous halt, current position and next two halts', () => {
  assert.deepEqual(getCompactLiveStopIndexes(route, halts, 4, 2), [2, 4, 6]);
});

test('compact view includes current pass-through position between official halts', () => {
  assert.deepEqual(getCompactLiveStopIndexes(route, halts, 3, 2), [2, 3, 4, 6]);
});

test('without a matched live position the compact view starts with only three halts', () => {
  assert.deepEqual(getCompactLiveStopIndexes(route, halts, -1, 2), [0, 2, 4]);
});

test('scheduled arrival estimate applies the latest delay in India time', () => {
  const now = new Date('2026-11-03T10:00:00+05:30');
  const arrival = estimateStopArrivalDate({ scheduledArrival: '11:00 am', arrivalDay: 1 }, 25, now);
  assert.equal(arrival.toISOString(), '2026-11-03T05:55:00.000Z'); // 11:25 IST
});

test('null station delay falls back to the current train delay', () => {
  const now = new Date('2026-11-03T10:00:00+05:30');
  const arrival = estimateStopArrivalDate({ scheduledArrival: '11:00 am', delayArrival: null, arrivalDay: 1 }, 25, now);
  assert.equal(arrival.toISOString(), '2026-11-03T05:55:00.000Z');
});

test('actual provider arrival is not adjusted a second time', () => {
  const now = new Date('2026-11-03T10:00:00+05:30');
  const arrival = estimateStopArrivalDate({ actualArrival: '2026-11-03T11:10:00+05:30', scheduledArrival: '11:00 am' }, 25, now);
  assert.equal(arrival.toISOString(), '2026-11-03T05:40:00.000Z');
});

test('forecast selector picks the hourly record nearest the arrival estimate', () => {
  const arrival = new Date('2026-11-03T11:25:00+05:30');
  const selected = selectForecastForArrival([
    { time: '2026-11-03T10:00', temperatureC: 29, weatherCode: 1 },
    { time: '2026-11-03T11:00', temperatureC: 28, weatherCode: 2 },
    { time: '2026-11-03T12:00', temperatureC: 27, weatherCode: 3 },
  ], arrival);
  assert.equal(selected.temperatureC, 28);
  assert.equal(selected.forecastTime, '2026-11-03T11:00');
});

test('forecast selector does not invent a distant time match', () => {
  const arrival = new Date('2026-11-03T18:00:00+05:30');
  const selected = selectForecastForArrival([
    { time: '2026-11-03T10:00', temperatureC: 29, weatherCode: 1 },
  ], arrival);
  assert.equal(selected, null);
});

test('formatDelayDelta formats hours and minutes clearly with +/- signs', () => {
  assert.equal(formatDelayDelta(null), null);
  assert.equal(formatDelayDelta(0), null);
  assert.equal(formatDelayDelta(15), '+15m');
  assert.equal(formatDelayDelta(65), '+1h 5m');
  assert.equal(formatDelayDelta(514), '+8h 34m');
  assert.equal(formatDelayDelta(-12), '-12m');
  assert.equal(formatDelayDelta(-70), '-1h 10m');
});

test('delayLabel distinguishes past vs upcoming stops with explicit deltas', () => {
  assert.equal(delayLabel(514, false), 'LATE (+8h 34m)');
  assert.equal(delayLabel(514, true), 'EST. LATE (+8h 34m)');
  assert.equal(delayLabel(0, false), 'ON TIME');
  assert.equal(delayLabel(0, true), 'EST. ON TIME');
  assert.equal(delayLabel(-15, false), 'EARLY (-15m)');
  assert.equal(delayLabel(-15, true), 'EST. EARLY (-15m)');
  assert.equal(delayLabel(null, false), 'STATUS UNAVAILABLE');
  assert.equal(delayLabel(null, true), 'SCHEDULED');
});

test('formatStopPresentation prevents upcoming halts from showing ACTUAL', () => {
  // Provider returned projected arrival 21:36 and scheduled 11:58 am with 578 min delay
  const upcomingStop = {
    stationCode: 'OGL',
    stationName: 'Ongole',
    scheduledArrival: '11:58 am',
    actualArrival: '21:36',
    delayArrival: 578,
    isHalt: true,
  };
  const presentation = formatStopPresentation(upcomingStop, 578, true, false);
  assert.equal(presentation.hasActual, false);
  assert.equal(presentation.hasEstimate, true);
  assert.equal(presentation.statusLabel, 'EST. LATE (+9h 38m)');
  assert.equal(presentation.detail, 'ESTIMATED · SCHED 11:58 am');
  assert.doesNotMatch(presentation.detail, /ACTUAL/);
});

test('formatStopPresentation labels historical departed halts as ACTUAL', () => {
  const pastStop = {
    stationCode: 'GDR',
    stationName: 'Gudur Jn',
    scheduledArrival: '09:53 am',
    actualArrival: '06:27 pm',
    delayArrival: 514,
    isHalt: true,
  };
  const presentation = formatStopPresentation(pastStop, 514, false, true);
  assert.equal(presentation.hasActual, true);
  assert.equal(presentation.hasEstimate, false);
  assert.equal(presentation.statusLabel, 'LATE (+8h 34m)');
  assert.equal(presentation.detail, 'ACTUAL · SCHED 09:53 am');
});

test('formatPassThroughPresentation deduplicates labels and flags missed pings', () => {
  // Past pass-through with missed provider ping
  const missedPingStop = {
    stationCode: 'NLR',
    stationName: 'Nellore South',
    scheduledArrival: '10:25 am',
    actualArrival: null,
    isHalt: false,
  };
  const missedResult = formatPassThroughPresentation(missedPingStop, 514, false, true);
  assert.equal(missedResult.skippedPing, true);
  assert.equal(missedResult.statusLabel, 'SKIPPED PING');
  assert.equal(missedResult.displayTime, 'PASS TIME NOT REPORTED');
  assert.equal(missedResult.detail, 'Sched 10:25 am');

  // Upcoming pass-through
  const upcomingPass = {
    stationCode: 'BYPW',
    stationName: 'Baiyyappanahalli',
    scheduledArrival: '11:53 pm',
    isHalt: false,
  };
  const upcomingResult = formatPassThroughPresentation(upcomingPass, 0, true, false);
  assert.equal(upcomingResult.statusLabel, 'PASS');
  assert.equal(upcomingResult.detail, '');
  assert.match(upcomingResult.displayTime, /PASS/);
});