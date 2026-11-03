const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL_SECONDS = 20 * 60;
const MAX_LOCATIONS = 3;

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

function normalizeCurrent(record) {
  const current = record?.current || {};
  const numeric = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return {
    temperatureC: numeric(current.temperature_2m),
    apparentTemperatureC: numeric(current.apparent_temperature),
    relativeHumidityPercent: numeric(current.relative_humidity_2m),
    windSpeedKmh: numeric(current.wind_speed_10m),
    weatherCode: numeric(current.weather_code),
    isDay: numeric(current.is_day),
    time: typeof current.time === 'string' ? current.time : null,
  };
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const latitudes = parseCoordinateList(url.searchParams.get('latitude'));
  const longitudes = parseCoordinateList(url.searchParams.get('longitude'));

  if (!latitudes || !longitudes || latitudes.length !== longitudes.length) {
    return jsonResponse({ success: false, error: { code: 'INVALID_COORDINATES', message: 'Provide matching latitude and longitude lists for up to three stations.' } }, 400);
  }

  // This project serves Indian railway stations. Restrict this endpoint to Indian coordinates
  // so it cannot be used as a general-purpose public weather proxy.
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
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });

  // Cloudflare's per-location edge cache reduces repeat weather requests.
  // If Cache API is unavailable in local tooling, the request still works without caching.
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
    }
  } catch {
    // A cache miss must never prevent weather from loading.
  }

  const upstreamUrl = new URL(OPEN_METEO_URL);
  upstreamUrl.searchParams.set('latitude', latParam);
  upstreamUrl.searchParams.set('longitude', lonParam);
  upstreamUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,is_day,wind_speed_10m');
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
      return jsonResponse({ success: false, error: { code: 'WEATHER_PROVIDER_UNAVAILABLE', message: 'Nearby weather is temporarily unavailable.' } }, 502);
    }

    const upstreamBody = await upstream.json();
    const records = Array.isArray(upstreamBody) ? upstreamBody : [upstreamBody];
    const locations = points.map((point, index) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      current: normalizeCurrent(records[index]),
    }));
    if (!locations.some((location) => typeof location.current.temperatureC === 'number')) {
      return jsonResponse({ success: false, error: { code: 'WEATHER_DATA_MISSING', message: 'Weather data is not available for these stations right now.' } }, 502);
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
        if (typeof context.waitUntil === 'function') context.waitUntil(writePromise);
        else await writePromise;
      }
    } catch {
      // Cache write failure is non-fatal; the browser also keeps a short session cache.
    }
    return response;
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    return jsonResponse({ success: false, error: { code: timedOut ? 'WEATHER_TIMEOUT' : 'WEATHER_PROVIDER_UNAVAILABLE', message: timedOut ? 'Nearby weather took too long to respond.' : 'Nearby weather is temporarily unavailable.' } }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
}
