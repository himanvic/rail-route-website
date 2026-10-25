import { jsonResponse, errorBody, railRadarGet } from '../../_shared/railradar.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (context.request.method !== 'GET') {
    return jsonResponse(errorBody('METHOD_NOT_ALLOWED', 'Use GET to search stations.'), 405, { Allow: 'GET' });
  }
  const query = (url.searchParams.get('q') || '').trim();
  if (query.length < 2 || query.length > 80) {
    return jsonResponse(errorBody('INVALID_QUERY', 'Enter at least two characters to search for a station.'), 400);
  }
  const upstream = new URLSearchParams({ q: query, limit: '10' });
  return railRadarGet({
    context,
    upstreamPath: `/lookup/search/stations?${upstream.toString()}`,
    cacheSeconds: 3600,
    cacheTag: 'railradar-station-search-v1',
  });
}
