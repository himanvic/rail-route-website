import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveRouteRows, isPassThroughStop } from '../src/lib/live-route-view.js';

const route = [
  { stationCode: 'AAA', stationName: 'Origin', isHalt: true },
  { stationCode: 'AAB', stationName: 'Pass 1', isHalt: false },
  { stationCode: 'AAC', stationName: 'Pass 2', isHalt: false },
  { stationCode: 'BBB', stationName: 'Halt 1', isHalt: true },
  { stationCode: 'BBC', stationName: 'Pass 3', isHalt: false },
  { stationCode: 'CCC', stationName: 'Destination', isHalt: true },
];

test('classifies the RailRadar isHalt=false field as pass-through', () => {
  assert.equal(isPassThroughStop(route[1]), true);
  assert.equal(isPassThroughStop(route[0]), false);
  assert.equal(isPassThroughStop({ stationCode: 'UNK' }), false);
});

test('shows only official halts by default and puts pass-throughs behind segment controls', () => {
  const result = buildLiveRouteRows(route);
  assert.deepEqual(result.haltIndexes, [0, 3, 5]);
  assert.deepEqual(result.rows.filter((row) => row.type === 'stop').map((row) => row.index), [0, 3, 5]);
  assert.equal(result.passThroughCount, 3);
  assert.equal(result.rows.filter((row) => row.type === 'segment').length, 2);
});

test('expands only the clicked segment', () => {
  const result = buildLiveRouteRows(route, { '0-3': true });
  assert.deepEqual(result.rows.filter((row) => row.type === 'stop').map((row) => row.index), [0, 1, 2, 3, 5]);
});

test('automatically reveals a pass-through station when it is the reported current location', () => {
  const result = buildLiveRouteRows(route, {}, 4);
  assert.deepEqual(result.rows.filter((row) => row.type === 'stop').map((row) => row.index), [0, 3, 4, 5]);
  assert.equal(result.rows.find((row) => row.type === 'segment' && row.key === '3-5').activeInside, true);
});

test('keeps all records visible if the provider omits isHalt metadata', () => {
  const unknown = [{ stationCode: 'AAA' }, { stationCode: 'BBB' }, { stationCode: 'CCC' }];
  const result = buildLiveRouteRows(unknown);
  assert.deepEqual(result.rows.filter((row) => row.type === 'stop').map((row) => row.index), [0, 1, 2]);
  assert.equal(result.hasExplicitHaltMetadata, false);
});
