function isPassThroughStop(stop) {
  if (!stop || typeof stop !== 'object') return false;
  const raw = stop.isHalt;
  if (raw === false || raw === 0 || String(raw).toLowerCase() === 'false' || String(raw) === '0') return true;
  if (raw === true || raw === 1 || String(raw).toLowerCase() === 'true' || String(raw) === '1') return false;
  const kind = String(stop.stopType || stop.stopKind || stop.stationType || '').toLowerCase();
  return /pass.?through|non.?halt|non.?stop|passing/.test(kind);
}

/**
 * Return only the next N official halts strictly after the provider-reported
 * route index. The current station and pass-through points are never weather
 * targets. If halt metadata is absent, return [] rather than guessing.
 */
function isExplicitOfficialHalt(stop) {
  const value = stop?.isHalt;
  return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
}

export function getNextOfficialHaltIndexes(route, haltIndexes, currentIndex, limit = 2, hasHaltMetadata = true) {
  if (!hasHaltMetadata || !Array.isArray(route) || !Array.isArray(haltIndexes)) return [];
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= route.length) return [];
  const safeLimit = Math.max(0, Math.min(2, Number(limit) || 0));
  return haltIndexes
    .filter((index) => Number.isInteger(index) && index > currentIndex && index < route.length && isExplicitOfficialHalt(route[index]))
    .slice(0, safeLimit);
}

/**
 * Compact live preview: previous official halt, currently reported station
 * (even if it is a pass-through point), then the next two official halts.
 * If the current provider position cannot be matched, show only the route start
 * and two following official halts and let the UI explain that position is unknown.
 */
export function getCompactLiveStopIndexes(route, haltIndexes, currentIndex, upcomingLimit = 2) {
  if (!Array.isArray(route) || route.length === 0) return [];
  const safeHalts = Array.isArray(haltIndexes) && haltIndexes.length
    ? haltIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < route.length)
    : route.map((_, index) => index);

  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= route.length) {
    return safeHalts.slice(0, Math.max(1, Math.min(3, upcomingLimit + 1)));
  }

  const previousHalt = safeHalts.filter((index) => index < currentIndex && !isPassThroughStop(route[index])).slice(-1);
  const upcomingHalts = safeHalts
    .filter((index) => index > currentIndex && !isPassThroughStop(route[index]))
    .slice(0, Math.max(0, Math.min(2, Number(upcomingLimit) || 0)));
  const selected = [...previousHalt, currentIndex, ...upcomingHalts];
  return [...new Set(selected)].sort((a, b) => a - b);
}

function parseClock(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3]?.toLowerCase();
  if (suffix) hour = (hour % 12) + (suffix === 'pm' ? 12 : 0);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatMinutesAsClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function niceClock(value) {
  if (value == null || value === '') return '—';
  const raw = String(value).trim();
  const clockOnly = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (clockOnly) {
    let hours = Number(clockOnly[1]);
    const minutes = Number(clockOnly[2]);
    const suffix = clockOnly[3]?.toLowerCase();
    if (suffix) hours = (hours % 12) + (suffix === 'pm' ? 12 : 0);
    if (hours <= 23 && minutes <= 59) return formatMinutesAsClock(hours * 60 + minutes);
    return raw;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(parsed);
}

export function clockWithDelay(scheduledValue, delayMinutes) {
  if (!scheduledValue || typeof delayMinutes !== 'number' || !Number.isFinite(delayMinutes)) return niceClock(scheduledValue);
  const raw = String(scheduledValue).trim();
  const clockOnly = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (clockOnly) {
    let hours = Number(clockOnly[1]);
    const minutes = Number(clockOnly[2]);
    const suffix = clockOnly[3]?.toLowerCase();
    if (suffix) hours = (hours % 12) + (suffix === 'pm' ? 12 : 0);
    if (hours <= 23 && minutes <= 59) return formatMinutesAsClock(hours * 60 + minutes + delayMinutes);
    return niceClock(scheduledValue);
  }
  const parsed = new Date(scheduledValue);
  if (Number.isNaN(parsed.getTime())) return niceClock(scheduledValue);
  return niceClock(new Date(parsed.getTime() + delayMinutes * 60_000).toISOString());
}

export function delayState(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'unknown';
  if (value > 0) return 'late';
  if (value < 0) return 'early';
  return 'on-time';
}

export function formatDelayDelta(minutes) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes);
  if (rounded === 0) return null;
  const abs = Math.abs(rounded);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || hours === 0) parts.push(`${mins}m`);
  const sign = rounded > 0 ? '+' : '-';
  return `${sign}${parts.join(' ')}`;
}

export function delayLabel(value, isUpcoming = false) {
  const state = delayState(value);
  const delta = formatDelayDelta(value);
  let base;
  if (state === 'late') base = delta ? `LATE (${delta})` : 'LATE';
  else if (state === 'early') base = delta ? `EARLY (${delta})` : 'EARLY';
  else if (state === 'on-time') base = 'ON TIME';
  else base = isUpcoming ? 'SCHEDULED' : 'STATUS UNAVAILABLE';

  return isUpcoming && state !== 'unknown' ? `EST. ${base}` : base;
}

export function stopDelayValue(stop) {
  if (typeof stop?.delayArrival === 'number' && Number.isFinite(stop.delayArrival)) return stop.delayArrival;
  if (typeof stop?.delayDeparture === 'number' && Number.isFinite(stop.delayDeparture)) return stop.delayDeparture;
  return null;
}

/**
 * Format stop timing for timeline rows.
 * Critical contract: An upcoming stop has NOT been reached yet and must NEVER
 * be labeled ACTUAL. If the provider returned a projection in the actual field,
 * it is treated strictly as an estimate.
 */
export function formatStopPresentation(stop, fallbackDelay = null, isUpcoming = false, hasPassed = false) {
  if (!stop || typeof stop !== 'object') {
    return {
      displayTime: '—',
      detail: 'SCHEDULED TIME',
      state: 'unknown',
      statusLabel: 'SCHEDULED',
      hasActual: false,
      hasEstimate: false,
      isUpcoming: false,
      usesFallbackDelay: false,
      delayMinutes: null,
    };
  }
  const usesArrival = Boolean(stop.scheduledArrival || stop.actualArrival);
  const scheduled = (usesArrival ? stop.scheduledArrival : stop.scheduledDeparture)
    || stop.scheduledArrival || stop.scheduledDeparture || null;
  const rawActual = usesArrival
    ? (stop.actualArrival || (!stop.scheduledArrival ? stop.actualDeparture : null) || null)
    : (stop.actualDeparture || (!stop.scheduledDeparture ? stop.actualArrival : null) || null);

  // Future/upcoming stops are NEVER actual historical arrivals.
  const hasActual = !isUpcoming && Boolean(rawActual);
  const explicitDelay = stopDelayValue(stop);
  const usesFallbackDelay = explicitDelay === null && isUpcoming && typeof fallbackDelay === 'number' && Number.isFinite(fallbackDelay);
  const delay = explicitDelay !== null ? explicitDelay : usesFallbackDelay ? fallbackDelay : null;
  const state = delayState(delay);
  const hasEstimate = isUpcoming && (Boolean(rawActual) || (Boolean(scheduled) && typeof delay === 'number'));

  let displayTime;
  if (hasActual) {
    displayTime = niceClock(rawActual);
  } else if (isUpcoming && rawActual) {
    // If the provider returned a projected time in the actual field for an upcoming stop, use it as estimate
    displayTime = niceClock(rawActual);
  } else if (hasEstimate && scheduled && typeof delay === 'number') {
    displayTime = clockWithDelay(scheduled, delay);
  } else if (scheduled) {
    displayTime = niceClock(scheduled);
  } else {
    displayTime = rawActual ? niceClock(rawActual) : '—';
  }

  let detail;
  if (hasActual) {
    detail = `ACTUAL · SCHED ${niceClock(scheduled)}`;
  } else if (isUpcoming) {
    detail = usesFallbackDelay
      ? `EST. FROM CURRENT DELAY · SCHED ${niceClock(scheduled)}`
      : `ESTIMATED · SCHED ${niceClock(scheduled)}`;
  } else if (scheduled) {
    detail = `SCHEDULED TIME · ${niceClock(scheduled)}`;
  } else {
    detail = 'SCHEDULED TIME';
  }

  let statusLabel;
  if (isUpcoming) {
    statusLabel = delayLabel(delay, true);
  } else if (hasActual) {
    statusLabel = delayLabel(delay, false);
  } else if (state === 'unknown') {
    statusLabel = hasPassed ? 'REPORTED' : 'SCHEDULED';
  } else {
    statusLabel = delayLabel(delay, false);
  }

  return {
    displayTime,
    detail,
    state,
    statusLabel,
    hasActual,
    hasEstimate,
    isUpcoming,
    usesFallbackDelay,
    delayMinutes: delay,
  };
}

/**
 * Format pass-through stop presentation:
 * Deduplicates labels (eliminates duplicate NO SCHEDULED HALT).
 * Formats skipped provider pings gracefully on past pass-through points.
 */
export function formatPassThroughPresentation(stop, fallbackDelay = null, isUpcoming = false, hasPassed = false) {
  const base = formatStopPresentation(stop, fallbackDelay, isUpcoming, hasPassed);
  const scheduled = stop?.scheduledArrival || stop?.scheduledDeparture;

  if (isUpcoming) {
    return {
      ...base,
      state: 'unknown',
      statusLabel: 'PASS',
      detail: '',
      displayTime: base.displayTime !== '—' ? `${base.displayTime} · PASS` : 'PASS',
      skippedPing: false,
    };
  }

  if (base.hasActual) {
    return {
      ...base,
      state: 'unknown',
      statusLabel: 'PASS',
      detail: scheduled ? `REPORTED PASS · SCHED ${niceClock(scheduled)}` : 'REPORTED PASS',
      displayTime: `${base.displayTime} · PASS`,
      skippedPing: false,
    };
  }

  if (hasPassed && !base.hasActual) {
    // Missing provider timestamp on past pass-through station: format skipped ping explicitly
    return {
      ...base,
      state: 'unknown',
      statusLabel: 'SKIPPED PING',
      detail: scheduled ? `Sched ${niceClock(scheduled)}` : '',
      displayTime: 'PASS TIME NOT REPORTED',
      skippedPing: true,
    };
  }

  return {
    ...base,
    state: 'unknown',
    statusLabel: 'PASS',
    detail: '',
    displayTime: `${base.displayTime} · PASS`,
    skippedPing: false,
  };
}

function istDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

function parseDateTimeInIndia(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const hasDateAndTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw);
  if (!hasDateAndTime) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Build an arrival/departure target time for a weather forecast. Uses an actual
 * provider time when supplied; otherwise uses the scheduled clock plus the
 * station-specific delay or the current train delay. Missing time => null.
 * Clock-only values are interpreted in Asia/Kolkata, independent of the device
 * timezone, to match the weather provider's timezone.
 */
export function estimateStopArrivalDate(stop, fallbackDelayMinutes = null, now = new Date()) {
  if (!stop || typeof stop !== 'object') return null;
  const actualValue = stop.actualArrival || stop.actualDeparture || stop.expectedArrival || stop.expectedDeparture || null;
  const scheduledValue = stop.scheduledArrival || stop.scheduledDeparture || stop.arrivalTime || stop.departureTime || null;
  const raw = actualValue || scheduledValue;
  if (!raw) return null;

  const isoDate = parseDateTimeInIndia(raw);
  let target = isoDate;
  const isActual = Boolean(actualValue);

  if (!target) {
    const clock = parseClock(raw);
    if (!clock) return null;
    const parts = istDateParts(now);
    const serviceDay = `${parts.year}-${parts.month}-${parts.day}`;
    const dayValue = Number(stop.arrivalDay ?? stop.departureDay ?? stop.dayNumber ?? stop.journeyDay);
    let base = new Date(`${serviceDay}T00:00:00+05:30`);
    if (Number.isFinite(dayValue) && dayValue >= 1 && dayValue <= 15) {
      base = new Date(base.getTime() + (Math.floor(dayValue) - 1) * 24 * 60 * 60_000);
    }
    target = new Date(base.getTime() + (clock.hour * 60 + clock.minute) * 60_000);
    if (!(Number.isFinite(dayValue) && dayValue >= 1 && dayValue <= 15)
      && target.getTime() < now.getTime() - 90 * 60_000) {
      target = new Date(target.getTime() + 24 * 60 * 60_000);
    }
  }

  if (!isActual) {
    const ownDelay = typeof stop.delayArrival === 'number' && Number.isFinite(stop.delayArrival)
      ? stop.delayArrival
      : typeof stop.delayDeparture === 'number' && Number.isFinite(stop.delayDeparture)
        ? stop.delayDeparture
        : Number.isFinite(fallbackDelayMinutes) ? fallbackDelayMinutes : null;
    if (ownDelay !== null) target = new Date(target.getTime() + ownDelay * 60_000);
  }
  return target;
}

function parseOpenMeteoTime(value) {
  if (typeof value !== 'string' || !value) return null;
  // Open-Meteo returns local-time strings without an offset when a timezone is
  // specified. Treat those as Asia/Kolkata; preserve explicit offsets if given.
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const local = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(hasZone ? value : `${local}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Choose the hourly forecast closest to the stop's estimated arrival. */
export function selectForecastForArrival(hourlyRows, arrivalDate, maxDistanceMinutes = 90) {
  if (!Array.isArray(hourlyRows) || hourlyRows.length === 0 || !(arrivalDate instanceof Date) || Number.isNaN(arrivalDate.getTime())) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const row of hourlyRows) {
    const time = parseOpenMeteoTime(row?.time);
    if (!time) continue;
    const distance = Math.abs(time.getTime() - arrivalDate.getTime());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { ...row, forecastTime: row.time };
    }
  }
  return best && bestDistance <= maxDistanceMinutes * 60_000 ? best : null;
}