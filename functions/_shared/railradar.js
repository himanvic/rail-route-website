const RAILRADAR_BASE = 'https://api.railradar.in/v1';

export function jsonResponse(body, status = 200, extraHeaders = {}) {
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

export function errorBody(code, message) {
  return { success: false, error: { code, message } };
}

export function rejectNonGetOrCrossOrigin(request, requestUrl) {
  if (request.method !== 'GET') {
    return jsonResponse(errorBody('METHOD_NOT_ALLOWED', 'Use GET for this enquiry.'), 405, { Allow: 'GET' });
  }
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== requestUrl.host) {
        return jsonResponse(errorBody('ORIGIN_NOT_ALLOWED', 'Cross-origin browser requests are not supported.'), 403);
      }
    } catch {
      return jsonResponse(errorBody('INVALID_ORIGIN', 'The request origin is invalid.'), 403);
    }
  }
  return null;
}

/**
 * Authenticated, provider-neutral response wrapper for RailRadar GET endpoints.
 * Only successful static/data responses are cached. Cache duration must remain
 * within the provider's terms; reduce it if the selected account terms require it.
 */
export async function railRadarGet({ context, upstreamPath, cacheSeconds = 300, cacheTag = 'railradar-v1' }) {
  const { request, env, waitUntil } = context;
  const requestUrl = new URL(request.url);
  const rejected = rejectNonGetOrCrossOrigin(request, requestUrl);
  if (rejected) return rejected;

  if (!env.RAILRADAR_API_KEY || env.RAILRADAR_API_KEY === 'paste-your-own-key-here') {
    return jsonResponse(errorBody('PROVIDER_NOT_CONFIGURED', 'Station and schedule lookup needs the RAILRADAR_API_KEY secret in Cloudflare. You can still enter a station code manually.'), 503);
  }

  const cache = caches.default;
  const cacheUrl = new URL(requestUrl.toString());
  cacheUrl.searchParams.set('_cache_provider', cacheTag);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.json();
      body.cacheMode = 'edge';
      return jsonResponse(body, 200, { 'X-Rail-Route-Cache': 'HIT' });
    }
  } catch {
    // Cache failures are non-fatal.
  }

  let upstream;
  try {
    upstream = await fetch(`${RAILRADAR_BASE}${upstreamPath}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.RAILRADAR_API_KEY}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return jsonResponse(errorBody('UPSTREAM_UNAVAILABLE', 'The railway data provider could not be reached. Try again shortly.'), 502);
  }

  let providerBody;
  try {
    providerBody = await upstream.json();
  } catch {
    return jsonResponse(errorBody('INVALID_PROVIDER_RESPONSE', 'The railway data provider returned an unreadable response.'), 502);
  }

  if (!upstream.ok || providerBody?.success !== true || providerBody?.data == null) {
    if (upstream.status === 401 || upstream.status === 403) {
      return jsonResponse(errorBody('PROVIDER_AUTH_FAILED', 'The provider rejected the configured credential.'), 502);
    }
    if (upstream.status === 429) {
      return jsonResponse(errorBody('PROVIDER_RATE_LIMIT', 'The railway data provider rate limit was reached. Wait before trying again.'), 429);
    }
    if (upstream.status === 404) {
      return jsonResponse(errorBody('NO_RESULTS', 'No matching railway data was returned. Check the station codes or try another date.'), 404);
    }
    if (upstream.status === 400) {
      return jsonResponse(errorBody('INVALID_QUERY', 'The provider rejected the enquiry. Check the station codes and date.'), 400);
    }
    if (upstream.status === 503 || upstream.status >= 500) {
      return jsonResponse(errorBody('UPSTREAM_UNAVAILABLE', 'The railway data provider is temporarily unavailable.'), 502);
    }
    const message = typeof providerBody?.error?.message === 'string'
      ? providerBody.error.message.slice(0, 220)
      : 'The provider could not return a valid response.';
    return jsonResponse(errorBody('PROVIDER_REQUEST_FAILED', message), 502);
  }

  const result = {
    success: true,
    data: providerBody.data,
    providerTimestamp: providerBody.meta?.timestamp || null,
    meta: providerBody.meta || null,
    retrievedAt: new Date().toISOString(),
    cacheMode: 'live',
  };
  const cacheResponse = new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=0, s-maxage=${cacheSeconds}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Rail-Route-Cache': 'MISS',
    },
  });
  try {
    if (waitUntil) waitUntil(cache.put(cacheKey, cacheResponse.clone()));
    else await cache.put(cacheKey, cacheResponse.clone());
  } catch {
    // Cache failures should not discard a valid provider response.
  }
  return jsonResponse(result, 200, { 'X-Rail-Route-Cache': 'MISS' });
}
