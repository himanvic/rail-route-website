import { jsonResponse, errorBody, railRadarGet } from '../../../../_shared/railradar.js';

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  if (request.method !== 'GET') {
    return jsonResponse(errorBody('METHOD_NOT_ALLOWED', 'Use GET to find trains between stations.'), 405, { Allow: 'GET' });
  }

  const from = String(params.from || '').trim().toUpperCase();
  const to = String(params.to || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(from) || !/^[A-Z0-9]{2,10}$/.test(to)) {
    return jsonResponse(errorBody('INVALID_STATION_CODE', 'Use valid station codes, such as NDLS, HWH, MMCT or INDB.'), 400);
  }
  if (from === to) {
    return jsonResponse(errorBody('SAME_STATION', 'Choose two different stations.'), 400);
  }

  const date = url.searchParams.get('date') || '';
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse(errorBody('INVALID_DATE', 'Use the date format YYYY-MM-DD.'), 400);
  }

  const upstream = new URLSearchParams({ live: 'false' });
  if (date) upstream.set('date', date);
  // Timetable search remains static by default to protect the limited live API quota.
  return railRadarGet({
    context,
    upstreamPath: `/trains/between/${encodeURIComponent(from)}/${encodeURIComponent(to)}?${upstream.toString()}`,
    cacheSeconds: 1800,
    cacheTag: 'railradar-between-static-v1',
  });
}
