const DATA_ROOT = '/data/timetable';
const requestCache = new Map();
let stationsByCodePromise;
let metadataPromise;
let trainIndexPromise;

function datasetNotReady() {
  return new Error('The local timetable catalogue has not been generated for this deployment yet. In GitHub, open Actions → Daily timetable snapshot sync → Run workflow, then wait for Cloudflare Pages to redeploy.');
}

async function getJson(path) {
  if (!requestCache.has(path)) {
    const promise = fetch(path, { headers: { Accept: 'application/json' }, cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) throw datasetNotReady();
        const body = await response.json().catch(() => null);
        if (body == null) throw datasetNotReady();
        return body;
      })
      .catch((error) => {
        requestCache.delete(path);
        throw error;
      });
    requestCache.set(path, promise);
  }
  return requestCache.get(path);
}

export function getStaticStations() {
  if (!stationsByCodePromise) {
    stationsByCodePromise = getJson(`${DATA_ROOT}/stations.json`).then((rows) => {
      if (!Array.isArray(rows)) throw datasetNotReady();
      return rows;
    }).catch((error) => {
      stationsByCodePromise = null;
      throw error;
    });
  }
  return stationsByCodePromise;
}

export function getTimetableMetadata() {
  if (!metadataPromise) {
    metadataPromise = getJson(`${DATA_ROOT}/metadata.json`).catch((error) => {
      metadataPromise = null;
      throw error;
    });
  }
  return metadataPromise;
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function searchStaticStations(query, limit = 10) {
  const term = String(query || '').trim();
  if (term.length < 2) return [];
  const normalized = normalizeSearch(term);
  const codeTerm = term.toUpperCase().replace(/\s+/g, '');
  const stations = await getStaticStations();
  const matches = [];
  for (const station of stations) {
    const code = String(station.code || '').toUpperCase();
    const name = normalizeSearch(station.name);
    const city = normalizeSearch(station.city || station.address || '');
    const state = normalizeSearch(station.state || '');
    let score = Number.POSITIVE_INFINITY;
    if (code === codeTerm) score = 0;
    else if (code.startsWith(codeTerm)) score = 1;
    else if (name === normalized) score = 2;
    else if (name.startsWith(normalized)) score = 3;
    else if (name.includes(normalized)) score = 4;
    else if (city.startsWith(normalized)) score = 5;
    else if (city.includes(normalized) || state.includes(normalized)) score = 6;
    if (Number.isFinite(score)) matches.push({ score, station });
  }
  matches.sort((a, b) => a.score - b.score || String(a.station.name).localeCompare(String(b.station.name)));
  return matches.slice(0, limit).map(({ station }) => ({
    code: String(station.code).toUpperCase(),
    name: String(station.name),
    city: String(station.city || station.state || '').trim(),
    state: String(station.state || '').trim(),
  }));
}

function firstShardChar(code) {
  const first = String(code || '').trim().toUpperCase().charAt(0);
  return /^[A-Z0-9]$/.test(first) ? first : '_';
}

function numberPrefix(trainNumber) {
  const value = String(trainNumber || '').trim();
  return /^[A-Z0-9]{3}/i.test(value) ? value.slice(0, 3).toUpperCase() : 'other';
}

async function getTrainIndex() {
  if (!trainIndexPromise) {
    trainIndexPromise = getJson(`${DATA_ROOT}/train-index.json`).then((index) => {
      if (!index || typeof index !== 'object' || Array.isArray(index)) throw datasetNotReady();
      return index;
    }).catch((error) => {
      trainIndexPromise = null;
      throw error;
    });
  }
  return trainIndexPromise;
}

async function getStationStopIndex(code) {
  const shard = firstShardChar(code);
  try {
    const payload = await getJson(`${DATA_ROOT}/station-index/${encodeURIComponent(shard)}.json`);
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    // An absent station-index shard means there are no indexed stops starting
    // with that character; the core catalogue is validated separately.
    return {};
  }
}

async function getScheduleShard(trainNumber) {
  const prefix = numberPrefix(trainNumber);
  try {
    const payload = await getJson(`${DATA_ROOT}/schedules/${encodeURIComponent(prefix)}.json`);
    return payload && typeof payload === 'object' ? payload : {};
  } catch {
    // If a prefix has no schedule shard, the train is not in this snapshot.
    // A missing metadata file will still fail the catalogue readiness check.
    return {};
  }
}

function dateDayCode(dateString) {
  if (!dateString) return null;
  const parsed = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsed.getDay()];
}

function timeInMinutes(value, day) {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return (Math.max(1, Number(day) || 1) - 1) * 1440 + Number(match[1]) * 60 + Number(match[2]);
}

function journeyDuration(fromStop, toStop) {
  const start = timeInMinutes(fromStop.d || fromStop.a, fromStop.y);
  let end = timeInMinutes(toStop.a || toStop.d, toStop.y);
  if (start == null || end == null) return null;
  while (end < start) end += 1440;
  return end - start;
}

function stopListFor(indexPayload, code) {
  const value = indexPayload?.[String(code).toUpperCase()];
  return Array.isArray(value) ? value : [];
}

export async function searchStaticTrainsBetween(fromCodeValue, toCodeValue, dateString = '') {
  const fromCode = String(fromCodeValue || '').trim().toUpperCase();
  const toCode = String(toCodeValue || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(fromCode) || !/^[A-Z0-9]{2,10}$/.test(toCode)) {
    throw new Error('Enter valid station codes such as HWH and NDLS.');
  }
  if (fromCode === toCode) throw new Error('Choose two different stations.');
  const [stations, trainIndex, fromShard, toShard, metadata] = await Promise.all([
    getStaticStations(),
    getTrainIndex(),
    getStationStopIndex(fromCode),
    getStationStopIndex(toCode),
    getTimetableMetadata(),
  ]);
  const fromStation = stations.find((station) => String(station.code).toUpperCase() === fromCode);
  const toStation = stations.find((station) => String(station.code).toUpperCase() === toCode);
  if (!fromStation || !toStation) {
    throw new Error('One or both station codes are not in this timetable snapshot. Try a station suggested by the local catalogue or check the code.');
  }
  const sourceStops = stopListFor(fromShard, fromCode);
  const destinationStops = stopListFor(toShard, toCode);
  const destinationByTrain = new Map();
  for (const stop of destinationStops) {
    if (!stop?.n) continue;
    if (!destinationByTrain.has(String(stop.n))) destinationByTrain.set(String(stop.n), []);
    destinationByTrain.get(String(stop.n)).push(stop);
  }

  const wantedDay = dateDayCode(dateString);
  const results = [];
  const seen = new Set();
  for (const start of sourceStops) {
    const number = String(start?.n || '');
    if (!number || seen.has(number)) continue;
    const summary = trainIndex[number];
    const destChoices = destinationByTrain.get(number) || [];
    const end = destChoices.find((candidate) => Number(candidate.i) > Number(start.i));
    if (!summary || !end) continue;
    seen.add(number);
    const runDays = Array.isArray(summary.runDays) ? summary.runDays : [];
    if (wantedDay && runDays.length > 0 && !runDays.includes(wantedDay)) continue;

    const duration = journeyDuration(start, end);
    let distance = null;
    if (start.k != null && end.k != null && Number.isFinite(Number(start.k)) && Number.isFinite(Number(end.k))) {
      const delta = Number(end.k) - Number(start.k);
      if (delta >= 0) distance = delta;
    }
    results.push({
      train: { number, name: summary.name, type: summary.type, runDays },
      from: { departure: start.d || start.a || null },
      to: { arrival: end.a || end.d || null },
      duration,
      distance,
      totalHaltsBetween: Math.max(0, Number(end.i) - Number(start.i) - 1),
      _sortTime: timeInMinutes(start.d || start.a, start.y) ?? Number.MAX_SAFE_INTEGER,
    });
  }
  results.sort((a, b) => a._sortTime - b._sortTime || a.train.name.localeCompare(b.train.name));
  const trains = results.slice(0, 100).map(({ _sortTime, ...row }) => row);
  return {
    data: {
      from: { code: fromCode, name: fromStation?.name || fromCode },
      to: { code: toCode, name: toStation?.name || toCode },
      trains,
      source: 'local-static-timetable',
    },
    metadata,
    retrievedAt: metadata.sourceDataCommitAt && metadata.sourceDataCommitAt !== 'unknown' ? metadata.sourceDataCommitAt : null,
    syncCheckedAt: metadata.syncCheckedAt,
    sourceDataCommitAt: metadata.sourceDataCommitAt,
    cacheMode: 'static',
  };
}

export async function getStaticTrainSchedule(trainNumber) {
  const number = String(trainNumber || '').trim();
  if (!/^[A-Za-z0-9]{3,10}$/.test(number)) throw new Error('Invalid train number.');
  const [shard, metadata] = await Promise.all([getScheduleShard(number), getTimetableMetadata()]);
  const record = shard[number] || shard[number.toUpperCase()];
  if (!record) throw new Error('This train is not present in the current static timetable snapshot. The upstream dataset may be incomplete or out of date.');
  return {
    data: record,
    retrievedAt: metadata.sourceDataCommitAt && metadata.sourceDataCommitAt !== 'unknown' ? metadata.sourceDataCommitAt : null,
    syncCheckedAt: metadata.syncCheckedAt,
    sourceDataCommitAt: metadata.sourceDataCommitAt,
    cacheMode: 'static',
  };
}
