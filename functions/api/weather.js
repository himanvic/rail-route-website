const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL_SECONDS = 20 * 60;
const MAX_LOCATIONS = 2;
const MAX_HOURLY_ROWS = 72;

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200
        ? `public, max-age=${WEATHER_CACHE_TTL_SECONDS}, stale-while-revalidate=1800`
        : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  });
}

function parseCoordinateList(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length < 1 || parts.length > MAX_LOCATIONS) return null;
  const numbers = parts.map(Number);
  if (numbers.some((number) => !Number.isFinite(number))) return null;
  return numbers;
}

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeHourly(record) {
  const hourly = record?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time.slice(0, MAX_HOURLY_ROWS) : [];
  const field = (name, index) => Array.isArray(hourly[name]) ? finiteOrNull(hourly[name][index]) : null;
  return times.map((time, index) => ({
    time: typeof time === 'string' ? time : null,
    temperatureC: field('temperature_2m', index),
    apparentTemperatureC: field('apparent_temperature', index),
    relativeHumidityPercent: field('relative_humidity_2m', index),
    precipitationProbabilityPercent: field('precipitation_probability', index),
    windSpeedKmh: field('wind_speed_10m', index),
    weatherCode: field('weather_code', index),
    isDay: field('is_day', index),
  })).filter((row) => row.time);
}

export async function onRequestGet(context) {
  const { request, waitUntil } = context;
  const url = new URL(request.url);
  const latitudes = parseCoordinateList(url.searchParams.get('latitude'));
  const longitudes = parseCoordinateList(url.searchParams.get('longitude'));

  if (!latitudes || !longitudes || latitudes.length !== longitudes.length) {
    return jsonResponse({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Provide matching latitude and longitude lists for up to two upcoming stations.' } }, 400);
  }

  // This endpoint is only for coordinates from Indian railway stations.
  // Restricting the supported area prevents use as a general public weather proxy.
  const points = latitudes.map((latitude, index) => ({
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitudes[index].toFixed(2)),
  }));
  const validIndiaPoints = points.every((point) =>
    point.latitude >= 6 && point.latitude <= 38.7 && point.longitude >= 68 && point.longitude <= 98.5
  );
  if (!validIndiaPoints) {
    return jsonResponse({ success: false, error: { code: 'COORDINATES_OUT_OF_RANGE', message: 'Weather lookup is available only for supported Indian station coordinates.' } }, 400);
  }

  const latParam = points.map((point) => point.latitude.toFixed(2)).join(',');
  const lonParam = points.map((point) => point.longitude.toFixed(2)).join(',');
  const cacheKeyUrl = new URL(request.url);
  cacheKeyUrl.search = '';
  cacheKeyUrl.searchParams.set('latitude', latParam);
  cacheKeyUrl.searchParams.set('longitude', lonParam);
  cacheKeyUrl.searchParams.set('kind', 'hourly-arrival-forecast-v1');
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });

  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
    }
  } catch {
    // A cache miss must never prevent a weather lookup.
  }

  const upstreamUrl = new URL(OPEN_METEO_URL);
  upstreamUrl.searchParams.set('latitude', latParam);
  upstreamUrl.searchParams.set('longitude', lonParam);
  upstreamUrl.searchParams.set('hourly', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,is_day');
  upstreamUrl.searchParams.set('forecast_days', '3');
  upstreamUrl.searchParams.set('timezone', 'Asia/Kolkata');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return jsonResponse({ success: false, error: { code: 'WEATHER_PROVIDER_UNAVAILABLE', message: 'Nearby station forecasts are temporarily unavailable.' } }, 502);
    }

    const upstreamBody = await upstream.json();
    const records = Array.isArray(upstreamBody) ? upstreamBody : [upstreamBody];
    const locations = points.map((point, index) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      hourly: normalizeHourly(records[index]),
    }));
    if (!locations.some((location) => location.hourly.some((row) => typeof row.temperatureC === 'number'))) {
      return jsonResponse({ success: false, error: { code: 'WEATHER_DATA_MISSING', message: 'Hourly forecast data is not available for the next two stations right now.' } }, 502);
    }

    const response = jsonResponse({
      success: true,
      provider: 'Open-Meteo',
      retrievedAt: new Date().toISOString(),
      attribution: 'Weather data by Open-Meteo (CC BY 4.0)',
      locations,
    });

    try {
      if (typeof caches !== 'undefined' && caches.default) {
        const writePromise = caches.default.put(cacheKey, response.clone());
        if (waitUntil) waitUntil(writePromise);
        else await writePromise;
      }
    } catch {
      // Cache write failures are non-fatal.
    }
    return response;
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return jsonResponse({ success: false, error: { code: timedOut ? 'WEATHER_TIMEOUT' : 'WEATHER_PROVIDER_UNAVAILABLE', message: timedOut ? 'Station forecasts took too long to respond.' : 'Nearby station forecasts are temporarily unavailable.' } }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
