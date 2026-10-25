import { jsonResponse, errorBody, railRadarGet } from '../../../_shared/railradar.js';

export async function onRequest(context) {
  const { request, params } = context;
  const number = String(params.number || '').trim();
  if (request.method !== 'GET') {
    return jsonResponse(errorBody('METHOD_NOT_ALLOWED', 'Use GET to retrieve a train schedule.'), 405, { Allow: 'GET' });
  }
  if (!/^\d{5}$/.test(number)) {
    return jsonResponse(errorBody('INVALID_TRAIN_NUMBER', 'Enter a valid five-digit train number.'), 400);
  }
  const url = new URL(request.url);
  const upstream = new URLSearchParams({ haltsOnly: 'true' });
  return railRadarGet({
    context,
    upstreamPath: `/trains/${encodeURIComponent(number)}?${upstream.toString()}`,
    cacheSeconds: 3600,
    cacheTag: 'railradar-schedule-v1',
  });
}
