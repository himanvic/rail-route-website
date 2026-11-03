import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/weather.js';

const originalFetch = globalThis.fetch;

function requestFor(latitude, longitude) {
  return new Request(`https://rail-route.example/api/weather?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
}

test('weather endpoint batches no more than two upcoming station coordinates', async () => {
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    const rows = [
      {
        hourly: {
          time: ['2026-11-03T10:00', '2026-11-03T11:00'],
          temperature_2m: [29, 28],
          apparent_temperature: [31, 30],
          relative_humidity_2m: [60, 62],
          precipitation_probability: [10, 20],
          weather_code: [1, 2],
          wind_speed_10m: [8, 9],
          is_day: [1, 1],
        },
      },
      {
        hourly: {
          time: ['2026-11-03T10:00', '2026-11-03T11:00'],
          temperature_2m: [27, 26],
          apparent_temperature: [29, 28],
          relative_humidity_2m: [70, 72],
          precipitation_probability: [30, 40],
          weather_code: [61, 63],
          wind_speed_10m: [11, 12],
          is_day: [1, 1],
        },
      },
    ];
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const response = await onRequestGet({ request: requestFor('22.57,25.61', '88.36,85.13') });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.locations.length, 2);
    assert.equal(body.locations[0].hourly[1].temperatureC, 28);
    assert.equal(body.locations[1].hourly[1].weatherCode, 63);
    assert.equal(requestedUrl.searchParams.get('forecast_days'), '3');
    assert.match(requestedUrl.searchParams.get('hourly'), /temperature_2m/);
    assert.equal(requestedUrl.searchParams.has('current'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('weather endpoint rejects more than two locations without an upstream request', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('Should not be called'); };
  try {
    const response = await onRequestGet({ request: requestFor('22.57,25.61,26.00', '88.36,85.13,82.00') });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'INVALID_COORDINATES');
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
