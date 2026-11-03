import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateStopArrivalDate,
  getCompactLiveStopIndexes,
  getNextOfficialHaltIndexes,
  selectForecastForArrival,
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
