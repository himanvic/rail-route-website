const RAILRADAR_BASE = 'https://api.railradar.in/v1';
const EDGE_CACHE_SECONDS = 120;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function errorBody(code, message) {
  return { success: false, error: { code, message } };
}

export async function onRequest(context) {
  const { request, env, params, waitUntil } = context;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET') {
    return jsonResponse(errorBody('METHOD_NOT_ALLOWED', 'Use GET for train status.'), 405, { Allow: 'GET' });
  }

  // Allow same-origin browser requests. This is a modest cross-site guard, not user authentication.
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== requestUrl.host) {
        return jsonResponse(errorBody('ORIGIN_NOT_ALLOWED', 'Cross-origin requests are not supported.'), 403);
      }
    } catch {
      return jsonResponse(errorBody('INVALID_ORIGIN', 'The request origin is invalid.'), 403);
    }
  }

  const trainNumber = String(params.number || '').trim();
  if (!/^\d{5}$/.test(trainNumber)) {
    return jsonResponse(errorBody('INVALID_TRAIN_NUMBER', 'Enter a valid five-digit train number.'), 400);
  }

  const journeyDate = requestUrl.searchParams.get('date') || '';
  if (journeyDate && !/^\d{4}-\d{2}-\d{2}$/.test(journeyDate)) {
    return jsonResponse(errorBody('INVALID_DATE', 'Use a journey date in YYYY-MM-DD format.'), 400);
  }

  if (!env.RAILRADAR_API_KEY || env.RAILRADAR_API_KEY === 'paste-your-own-key-here') {
    return jsonResponse(
      errorBody('PROVIDER_NOT_CONFIGURED', 'Live status is not connected yet. Configure the RAILRADAR_API_KEY secret in Cloudflare.'),
      503,
    );
  }

  const cache = caches.default;
  const cacheUrl = new URL(requestUrl.toString());
  cacheUrl.searchParams.set('_cache_provider', 'railradar-v1');
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  // Cache status responses briefly at the Cloudflare edge to reduce upstream calls.
  // This is not a permanent train database and holds no passenger/PNR data.
  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.json();
      body.cacheMode = 'edge';
      return jsonResponse(body, 200, { 'X-Rail-Route-Cache': 'HIT' });
    }
  } catch {
    // A cache error must not prevent a live lookup.
  }

  const upstreamUrl = new URL(`${RAILRADAR_BASE}/trains/${trainNumber}/live`);
  if (journeyDate) upstreamUrl.searchParams.set('date', journeyDate);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.RAILRADAR_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return jsonResponse(errorBody('UPSTREAM_UNAVAILABLE', 'The live train data provider could not be reached. Try again shortly.'), 502);
  }

  let providerBody;
  try {
    providerBody = await upstream.json();
  } catch {
    return jsonResponse(errorBody('INVALID_PROVIDER_RESPONSE', 'The live data provider returned an unreadable response.'), 502);
  }

  if (!upstream.ok || !providerBody?.success || !providerBody?.data) {
    if (upstream.status === 401 || upstream.status === 403) {
      return jsonResponse(errorBody('PROVIDER_AUTH_FAILED', 'The data provider rejected the configured credential.'), 502);
    }
    if (upstream.status === 429) {
      return jsonResponse(errorBody('PROVIDER_RATE_LIMIT', 'The free data-provider limit was reached. Try again later.'), 429);
    }
    if (upstream.status === 404) {
      return jsonResponse(errorBody('TRAIN_NOT_FOUND', 'No live status was returned for that train and journey date.'), 404);
    }
    if (upstream.status === 503 || upstream.status >= 500) {
      return jsonResponse(errorBody('UPSTREAM_UNAVAILABLE', 'The live data provider is temporarily unavailable.'), 502);
    }
    return jsonResponse(errorBody('PROVIDER_REQUEST_FAILED', 'The provider could not return a valid live status.'), 502);
  }

  const result = {
    success: true,
    data: providerBody.data,
    providerTimestamp: providerBody.meta?.timestamp || providerBody.data?.lastUpdatedAt || null,
    retrievedAt: new Date().toISOString(),
    cacheMode: 'live',
  };

  const cacheResponse = new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${EDGE_CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Rail-Route-Cache': 'MISS',
    },
  });
  try {
    if (waitUntil) waitUntil(cache.put(cacheKey, cacheResponse.clone()));
    else await cache.put(cacheKey, cacheResponse.clone());
  } catch {
    // Cache failure is non-fatal; the live response can still be used.
  }

  return jsonResponse(result, 200, { 'X-Rail-Route-Cache': 'MISS' });
}
