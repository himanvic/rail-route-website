import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, ExternalLink,
  Gauge, Globe2, Github, MapPin, Menu, Moon, Radio, RefreshCw, Route as RouteIcon, Search, ShieldCheck, Sun,
  Ticket, TrainFront, Wifi, WifiOff, X, Zap,
} from 'lucide-react';
import './style.css';
import { getStaticTrainSchedule, searchStaticStations, searchStaticTrainsBetween } from './lib/static-timetable.js';

const OFFICIAL_PNR_URL = 'https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.html';
const LAST_STATUS_KEY = 'rail-route:last-train-status:v1';

function localIsoDate() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function niceDateTime(value) {
  if (!value) return 'Time unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(parsed) + ' IST';
}

function niceClock(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(parsed);
}

function delayLabel(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Delay unavailable';
  if (value > 0) return `${value} min late`;
  if (value < 0) return `${Math.abs(value)} min early`;
  return 'On time';
}

function getStoredStatus(trainNumber) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_STATUS_KEY) || 'null');
    if (stored && stored.trainNumber === trainNumber && stored.data && stored.retrievedAt) return stored;
  } catch {
    // Browser storage can be disabled or contain malformed data. Ignore it safely.
  }
  return null;
}

function IconText({ icon: Icon, children, className = '' }) {
  return <span className={`icon-text ${className}`}><Icon size={16} strokeWidth={1.8} aria-hidden="true" />{children}</span>;
}

function Brand({ onClick }) {
  return (
    <a className="brand" href="#top" onClick={onClick} aria-label="Rail and Route home">
      <span className="brand-mark"><TrainFront size={23} strokeWidth={1.65} /></span>
      <span className="brand-copy"><span className="brand-name">RAIL <i>&</i> ROUTE</span><span className="brand-tagline">TRAIN STATUS &amp; JOURNEYS</span></span>
    </a>
  );
}

function StatusResult({ result, mode, onRefresh, refreshing }) {
  const data = result?.data;
  if (!data) return null;
  const train = data.train || {};
  const current = data.currentLocation || {};
  const route = Array.isArray(data.route) ? data.route : [];
  const previous = data.previousHalt || null;
  const next = data.nextHalt || null;
  const routeCurrentCode = String(current.stationCode || '').toUpperCase();
  const routeCurrentIndex = route.findIndex((stop) => String(stop.stationCode || stop.station?.code || stop.code || '').toUpperCase() === routeCurrentCode);
  const hasReportedRoutePosition = route.length > 1 && routeCurrentCode.length > 0 && routeCurrentIndex >= 0;
  const rawSegmentProgress = current.segmentProgress;
  const normalizedSegmentProgress = typeof rawSegmentProgress === 'number' && Number.isFinite(rawSegmentProgress) && rawSegmentProgress >= 0 && rawSegmentProgress <= 1 && routeCurrentIndex < route.length - 1 ? rawSegmentProgress : null;
  const routeProgressPercent = hasReportedRoutePosition
    ? Math.max(0, Math.min(100, ((routeCurrentIndex + (normalizedSegmentProgress ?? 0)) / (route.length - 1)) * 100))
    : null;
  const reportedStationName = current.stationName || route[routeCurrentIndex]?.stationName || routeCurrentCode;
  const routePositionLabel = hasReportedRoutePosition
    ? `${reportedStationName} · ${normalizedSegmentProgress !== null ? `${Math.round(normalizedSegmentProgress * 100)}% through next segment` : `stop ${routeCurrentIndex + 1} of ${route.length}`}`
    : 'Provider has not matched a reported station to this route';
  const safeRoute = route.length > 8 ? route.slice(Math.max(0, routeCurrentIndex - 2), Math.max(8, routeCurrentIndex + 5)) : route;
  const isStale = mode === 'device-cache' || mode === 'edge-cache';
  const statusText = (data.status || 'status unavailable').replaceAll('-', ' ');

  return (
    <section className={`result-panel reveal ${isStale ? 'is-stale' : ''}`} aria-live="polite">
      <div className="result-topline">
        <div className="result-source"><span className={`live-dot ${isStale ? 'dot-muted' : ''}`} />
          <span>{isStale ? 'Last known status' : 'Live result'}</span>
          <span className="source-separator">/</span>
          <span>{isStale ? 'Cached on this device' : 'RailRadar data'}</span>
        </div>
        <button className="icon-button" onClick={onRefresh} disabled={refreshing} type="button" aria-label="Refresh train status" title="Refresh status"><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></button>
      </div>
      <div className="result-heading">
        <div>
          <p className="eyebrow">{data.trainNumber || train.number || 'TRAIN'}</p>
          <h2>{data.trainName || train.name || 'Train status'}</h2>
          <p className="result-status">{statusText}</p>
        </div>
        <div className={`delay-pill ${typeof data.delayMinutes === 'number' && data.delayMinutes > 0 ? 'delay-late' : ''}`}>
          <Clock3 size={15} /> {delayLabel(data.delayMinutes)}
        </div>
      </div>
      <div className="journey-line">
        <div className="journey-place">
          <span className="journey-code">{train.source?.code || route[0]?.stationCode || '—'}</span>
          <strong>{train.source?.name || route[0]?.stationName || 'Origin'}</strong>
          <span>{route[0]?.scheduledDeparture ? `Dep. ${niceClock(route[0].scheduledDeparture)}` : 'Origin station'}</span>
        </div>
        <div className="journey-track" aria-label={hasReportedRoutePosition ? `Reported train position near ${reportedStationName}` : 'Live train position unavailable for the listed route'}>
          <div className="track-trackline">
            <span className="track-trackline-progress" style={{ width: `${routeProgressPercent ?? 0}%` }} />
            {hasReportedRoutePosition && <span className="track-train" style={{ left: `${routeProgressPercent}%` }} title={`Provider-reported position: ${reportedStationName}`}><TrainFront size={15} aria-hidden="true" /></span>}
          </div>
          <span className="track-progress">{routePositionLabel}</span>
          <span className="track-position-note">Marker follows the provider-reported station/segment, not continuous GPS.</span>
        </div>
        <div className="journey-place place-destination">
          <span className="journey-code">{train.destination?.code || route[route.length - 1]?.stationCode || '—'}</span>
          <strong>{train.destination?.name || route[route.length - 1]?.stationName || 'Destination'}</strong>
          <span>{route[route.length - 1]?.scheduledArrival ? `Arr. ${niceClock(route[route.length - 1].scheduledArrival)}` : 'Destination station'}</span>
        </div>
      </div>
      <div className="result-metrics">
        <div className="metric"><span>Last reported station</span><strong>{current.stationCode || 'Not supplied'}</strong><small>{previous?.stationName || previous?.stationCode || 'No previous halt supplied'}</small></div>
        <div className="metric"><span>Next halt</span><strong>{next?.stationName || next?.stationCode || 'Not supplied'}</strong><small>{typeof next?.distance === 'number' ? `${next.distance} km from previous halt` : 'Distance not supplied'}</small></div>
        <div className="metric"><span>Reported speed</span><strong>{typeof current.speedKmh === 'number' ? `${Math.round(current.speedKmh)} km/h` : '—'}</strong><small>Only when provider supplies it</small></div>
      </div>
      {safeRoute.length > 0 && (
        <div className="route-stops">
          <div className="route-stops-heading"><span>Route timeline</span><span>{route.length} reported stops</span></div>
          <div className="stops-list">
            {safeRoute.map((stop, index) => {
              const active = String(stop.stationCode || stop.station?.code || stop.code || '').toUpperCase() === routeCurrentCode;
              const stopDelay = typeof stop.delayArrival === 'number' ? stop.delayArrival : stop.delayDeparture;
              return <div className={`stop-row ${active ? 'active' : ''}`} key={`${stop.sequence || index}-${stop.stationCode}`}>
                <span className="stop-marker" />
                <div className="stop-name"><strong>{stop.stationName || stop.stationCode}</strong><small>{stop.stationCode || 'Station code unavailable'}</small></div>
                <div className="stop-time"><span>{niceClock(stop.scheduledArrival || stop.scheduledDeparture)}</span>{typeof stopDelay === 'number' && <small>{stopDelay > 0 ? `+${stopDelay}m` : stopDelay < 0 ? `${stopDelay}m` : 'On time'}</small>}</div>
                {active && <span className="here-tag">REPORTED HERE</span>}
              </div>;
            })}
          </div>
        </div>
      )}
      {Array.isArray(data.exceptions) && data.exceptions.length > 0 && <div className="exception-note"><ShieldCheck size={17}/><div><strong>Service notice</strong>{data.exceptions.map((item, i) => <p key={i}>{item.message || item.type || 'An operational update was reported.'}</p>)}</div></div>}
      <div className="result-footnote"><div className="result-timestamps"><IconText icon={Clock3}>Retrieved {niceDateTime(result.retrievedAt)}</IconText>{result.providerTimestamp && <span>Provider updated {niceDateTime(result.providerTimestamp)}</span>}</div><span>{isStale ? 'This result may be out of date. Refresh to try the live source again.' : 'Live information depends on the external data provider.'}</span></div>
    </section>
  );
}

function useStationSuggestions(query, selected) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    const term = query.trim();
    const isCode = term === term.toUpperCase() && /^[A-Z0-9]{2,10}$/.test(term);
    if (selected || term.length < 2 || isCode) {
      setItems([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        // Station suggestions come from the locally hosted timetable catalogue.
        // This does not call RailRadar and does not consume its API quota.
        const normalized = await searchStaticStations(term, 10);
        if (!cancelled) setItems(normalized);
      } catch (requestError) {
        if (!cancelled) {
          setItems([]);
          setError(requestError?.message || 'The local station catalogue is unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, selected]);

  return { items, loading, error };
}

function StationField({ id, label, value, selected, lookup, placeholder, onChange, onClear, onSelect }) {
  return (
    <div className="station-field">
      <label htmlFor={id}>{label}<span>Station name or code</span></label>
      <div className="input-shell station-input-shell">
        <MapPin size={17} aria-hidden="true" />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          aria-autocomplete="list"
          aria-expanded={lookup.items.length > 0}
          aria-controls={`${id}-options`}
          required
        />
        {value && <button type="button" className="input-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={onClear}><X size={15}/></button>}
      </div>
      {lookup.items.length > 0 && !selected && (
        <div className="station-suggestions" id={`${id}-options`} role="listbox" aria-label={`${label} suggestions`}>
          {lookup.items.map((station) => (
            <button className="station-suggestion" key={station.code} type="button" role="option" aria-selected="false" onClick={() => onSelect(station)}>
              <span className="station-suggestion-copy"><strong>{station.name}</strong>{station.city && <small>{station.city}</small>}</span>
              <span className="station-code-chip">{station.code}</span>
            </button>
          ))}
        </div>
      )}
      <div className={`field-hint ${lookup.error && !selected ? 'field-hint-warning' : ''}`}>
        {lookup.loading ? 'Finding station matches…' : selected ? `Selected: ${selected.name} · ${selected.code}` : lookup.error ? `${lookup.error} You can enter a station code directly.` : 'Choose a suggestion or enter a code such as NDLS or HWH.'}
      </div>
    </div>
  );
}

function formatDuration(minutes) {
  if (minutes == null || minutes === '' || !Number.isFinite(Number(minutes)) || Number(minutes) < 0) return 'Duration unavailable';
  const total = Math.round(Number(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins} min`;
}

function niceRunDays(days) {
  if (!Array.isArray(days) || !days.length) return 'Running days not supplied';
  if (days.length >= 7) return 'Daily service (provider data)';
  return days.map((day) => String(day).slice(0, 3).toUpperCase()).join(' · ');
}

function routeStopCode(stop) {
  return String(stop?.station?.code || stop?.stationCode || stop?.code || '').toUpperCase();
}

function routeStopName(stop) {
  return stop?.station?.name || stop?.stationName || stop?.name || routeStopCode(stop) || 'Station';
}

function JourneySchedule({ schedule, fromCode, toCode, retrievedAt, syncCheckedAt }) {
  const allStops = Array.isArray(schedule?.route) ? schedule.route : Array.isArray(schedule?.stops) ? schedule.stops : Array.isArray(schedule?.stations) ? schedule.stations : [];
  if (!allStops.length) {
    return <div className="journey-inline-error">This timetable record contains no stop-by-stop schedule in the current snapshot.</div>;
  }
  let fromIndex = allStops.findIndex((stop) => routeStopCode(stop) === fromCode);
  let toIndex = allStops.findIndex((stop) => routeStopCode(stop) === toCode);
  if (fromIndex < 0) fromIndex = 0;
  if (toIndex < 0 || toIndex < fromIndex) toIndex = allStops.length - 1;
  const stops = allStops.slice(fromIndex, toIndex + 1);

  return (
    <div className="journey-schedule reveal">
      <div className="journey-schedule-top">
        <div><p className="eyebrow">FULL SCHEDULE</p><h4>{schedule.train?.name || 'Train route'}</h4><p>{schedule.train?.number || ''} <span>·</span> {schedule.train?.type || schedule.train?.category || 'Train service'}</p></div>
        <div className="schedule-summary"><strong>{schedule.train?.distance != null && schedule.train.distance !== '' && Number.isFinite(Number(schedule.train.distance)) ? `${Math.round(Number(schedule.train.distance))} km` : `${stops.length} listed stops`}</strong><small>{schedule.train?.duration != null && schedule.train.duration !== '' && Number.isFinite(Number(schedule.train.duration)) ? formatDuration(schedule.train.duration) : 'Scheduled journey'}</small></div>
      </div>

      <div className="schedule-stops-heading"><span>STATION-BY-STATION</span><span>{stops.length} stops in selected journey</span></div>
      <div className="schedule-stops-list">
        {stops.map((stop, index) => {
          const arrival = stop.arrival || stop.scheduledArrival || null;
          const departure = stop.departure || stop.scheduledDeparture || null;
          const isFirst = index === 0;
          const isLast = index === stops.length - 1;
          const distance = stop.distance == null || stop.distance === '' ? Number.NaN : Number(stop.distance);
          return (
            <div className={`schedule-stop ${isFirst ? 'schedule-stop-origin' : ''} ${isLast ? 'schedule-stop-destination' : ''}`} key={`${stop.sequence || index}-${routeStopCode(stop)}`}>
              <div className="schedule-stop-rail"><span className="schedule-stop-dot"/><span className="schedule-stop-stem"/></div>
              <div className="schedule-stop-details">
                <div className="schedule-stop-name"><strong>{routeStopName(stop)}</strong><span>{routeStopCode(stop)}</span>{isFirst && <em>BOARD</em>}{isLast && <em>DESTINATION</em>}</div>
                <div className="schedule-stop-times"><span><small>ARR</small>{arrival || '—'}</span><span><small>DEP</small>{departure || '—'}</span></div>
                <div className="schedule-stop-meta"><span>{stop.platform ? `Platform ${stop.platform}` : stop.haltMinutes != null && Number.isFinite(Number(stop.haltMinutes)) ? `${Number(stop.haltMinutes)} min halt` : 'Scheduled stop'}</span><span>{Number.isFinite(distance) ? `${distance.toLocaleString('en-IN')} km${Number(stop.arrivalDay) > 1 ? ` · Day ${stop.arrivalDay}` : ''}` : stop.arrivalDay ? `Day ${stop.arrivalDay}` : ''}</span></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="schedule-disclaimer"><Clock3 size={14}/> Scheduled timetable snapshot, not live arrival tracking. {retrievedAt ? `Source data revision: ${niceDateTime(retrievedAt)}.` : 'Source data revision date not supplied.'}{syncCheckedAt ? ` Sync checked: ${niceDateTime(syncCheckedAt)}.` : ''} The source may not change every day.</div>
    </div>
  );
}

function JourneyResults({ result, mode, selectedTrainNumber, schedulesByTrain, scheduleLoadingNumber, scheduleErrors, onToggleSchedule, onRefresh }) {
  if (!result?.data) return null;
  const data = result.data;
  const trains = Array.isArray(data.trains) ? data.trains : [];
  const isStale = mode === 'device-cache' || result.cacheMode === 'edge';
  return (
    <section className={`journey-results reveal ${mode === 'device-cache' ? 'journey-results-stale' : ''}`} aria-live="polite">
      <div className="journey-results-heading">
        <div><p className="eyebrow">JOURNEY OPTIONS</p><h3>{data.from?.name || result.fromName || result.fromCode} <ArrowRight size={17}/> {data.to?.name || result.toName || result.toCode}</h3><p>{result.date ? `Travel date · ${result.date}` : 'Scheduled train options'} <span>·</span> {result.cacheMode === 'static' ? (result.retrievedAt ? `Source data revision ${niceDateTime(result.retrievedAt)}` : 'Source data revision date unavailable') : result.retrievedAt ? `Checked ${niceDateTime(result.retrievedAt)}` : 'Retrieval time unavailable'}{result.syncCheckedAt ? ` · Sync checked ${niceDateTime(result.syncCheckedAt)}` : ''}</p></div>
        <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh journey search"><RefreshCw size={16}/></button>
      </div>
      {isStale && <div className="journey-data-note"><Clock3 size={15}/> {mode === 'device-cache' ? 'Showing the last journey search stored in this page session after the latest request failed.' : 'This timetable came from the provider’s short-lived edge cache. It is scheduled data, not live running status.'}</div>}
      {result.cacheMode === 'static' && <div className="journey-data-note"><Check size={15}/> Served from the locally hosted timetable catalogue. No RailRadar request was made for this station-to-station search. The daily job checks the upstream snapshot; it cannot guarantee the source data changes every day.</div>}
      <div className="journey-count-row"><strong>{trains.length} {trains.length === 1 ? 'train' : 'trains'} found</strong><span>{result.cacheMode === 'static' ? 'Scheduled timetable · local snapshot' : 'Scheduled timetable · provider supplied'}</span></div>
      {trains.length === 0 && <div className="journey-empty"><TrainFront size={24}/><strong>No trains returned for this search.</strong><span>Try another date or check the station codes.</span></div>}
      <div className="journey-train-list">
        {trains.map((item, index) => {
          const train = item.train || {};
          const trainNumber = String(train.number || item.number || '');
          const from = item.from || {};
          const to = item.to || {};
          const selected = selectedTrainNumber === trainNumber;
          const scheduleState = schedulesByTrain[trainNumber];
          return (
            <article className={`journey-train-card ${selected ? 'journey-train-card-selected' : ''}`} key={`${trainNumber}-${index}`}>
              <div className="journey-train-topline"><span className="journey-train-number">{trainNumber || 'TRAIN'}</span><span className="journey-train-type">{train.type || train.category || 'Indian Railways'}</span>{train.runDays && <span className="journey-run-days">{niceRunDays(train.runDays)}</span>}</div>
              <h4>{train.name || 'Train name unavailable'}</h4>
              <div className="journey-train-times">
                <div><strong>{from.departure || '—'}</strong><span>{data.from?.code || result.fromCode}</span><small>{data.from?.name || result.fromName || 'Source station'}</small></div>
                <div className="journey-time-bridge"><span>{formatDuration(item.duration)}</span><i/><small>{Number.isFinite(Number(item.totalHaltsBetween)) ? `${item.totalHaltsBetween} halts` : 'Route details available on selection'}</small></div>
                <div className="journey-time-destination"><strong>{to.arrival || '—'}</strong><span>{data.to?.code || result.toCode}</span><small>{data.to?.name || result.toName || 'Destination station'}</small></div>
              </div>
              <div className="journey-train-bottom"><div className="journey-train-stats"><span>{item.distance != null && item.distance !== '' && Number.isFinite(Number(item.distance)) ? `${Number(item.distance).toLocaleString('en-IN')} km` : 'Distance unavailable'}</span><span>{item.duration != null && item.duration !== '' && Number.isFinite(Number(item.duration)) ? formatDuration(item.duration) : 'Duration unavailable'}</span></div><button className="schedule-toggle" type="button" onClick={() => onToggleSchedule(trainNumber)} disabled={!trainNumber || scheduleLoadingNumber === trainNumber}>{scheduleLoadingNumber === trainNumber ? <><span className="button-loader"/> Loading route</> : selected ? <>Hide full route <ChevronDown size={15}/></> : <>View full route <ArrowRight size={15}/></>}</button></div>
              {selected && <div className="schedule-detail-wrap">{scheduleState ? <JourneySchedule schedule={scheduleState.data} fromCode={result.fromCode} toCode={result.toCode} retrievedAt={scheduleState.retrievedAt} syncCheckedAt={scheduleState.syncCheckedAt}/> : scheduleErrors[trainNumber] ? <div className="journey-inline-error"><WifiOff size={16}/><span>{scheduleErrors[trainNumber]}</span><button type="button" className="text-button" onClick={() => onToggleSchedule(trainNumber, { retry: true })}>Retry</button></div> : <div className="journey-loading"><span className="button-loader"/> Fetching the complete station-by-station schedule…</div>}</div>}
            </article>
          );
        })}
      </div>
      <div className="journey-result-note"><ShieldCheck size={14}/> {result.cacheMode === 'static' ? 'Times and route details come from a locally hosted community timetable snapshot, not from live running data.' : 'Times and route details are supplied by the configured railway data provider.'} Check official railway information before travel.</div>
    </section>
  );
}

function App() {
  const [trainNumber, setTrainNumber] = useState('');
  const [journeyDate, setJourneyDate] = useState(localIsoDate());
  const [result, setResult] = useState(null);
  const [resultMode, setResultMode] = useState('live');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromSelected, setFromSelected] = useState(null);
  const [toSelected, setToSelected] = useState(null);
  const [journeySearchDate, setJourneySearchDate] = useState(localIsoDate());
  const [journeyBusy, setJourneyBusy] = useState(false);
  const [journeyNotice, setJourneyNotice] = useState(null);
  const [journeyResult, setJourneyResult] = useState(null);
  const [journeyMode, setJourneyMode] = useState('live');
  const [selectedTrainNumber, setSelectedTrainNumber] = useState(null);
  const [scheduleLoadingNumber, setScheduleLoadingNumber] = useState(null);
  const [schedulesByTrain, setSchedulesByTrain] = useState({});
  const [scheduleErrors, setScheduleErrors] = useState({});
  const journeyCache = useRef(new Map());
  const scheduleCache = useRef(new Map());
  const fromLookup = useStationSuggestions(fromQuery, fromSelected);
  const toLookup = useStationSuggestions(toQuery, toSelected);

  const progressLabel = useMemo(() => busy ? 'CONTACTING DATA PROVIDER' : 'LIVE STATUS ENQUIRY', [busy]);

  React.useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* Offline support is optional; the site still works without it. */ });
    }
  }, []);

  async function searchTrain(event) {
    event?.preventDefault();
    const number = trainNumber.trim();
    if (!/^\d{5}$/.test(number)) {
      setNotice({ kind: 'error', text: 'Enter a valid five-digit train number to continue.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    setResult(null);
    try {
      const url = new URL(`/api/trains/${number}/live`, window.location.origin);
      if (journeyDate) url.searchParams.set('date', journeyDate);
      const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success || !body.data) {
        const code = body?.error?.code || body?.code;
        let text = body?.error?.message || 'Live status is not available right now.';
        if (response.status === 503 && code === 'PROVIDER_NOT_CONFIGURED') text = 'The live-data connection is not configured yet. The site is ready, but the private API secret still needs to be added in Cloudflare.';
        else if (response.status === 429) text = 'The provider rate limit was reached. Try again later; repeated refreshes use up the free quota.';
        else if (response.status === 401) text = 'The data provider rejected the API credential. Check the private Cloudflare secret.';
        else if (response.status >= 500) text = 'The live-data service is temporarily unavailable.';
        throw new Error(text);
      }
      const received = body.data;
      const savedAt = body.retrievedAt || new Date().toISOString();
      const shaped = { data: received, retrievedAt: savedAt, providerTimestamp: body.providerTimestamp || received.lastUpdatedAt || null, trainNumber: number };
      setResult(shaped);
      setResultMode(body.cacheMode === 'edge' ? 'edge-cache' : 'live');
      try {
        localStorage.setItem(LAST_STATUS_KEY, JSON.stringify(shaped));
      } catch {
        // Search still works when browser storage is unavailable.
      }
      if (body.cacheMode === 'edge') setNotice({ kind: 'info', text: 'This result was served from a short-lived edge cache to reduce API calls.' });
    } catch (error) {
      const cached = getStoredStatus(number);
      if (cached) {
        setResult(cached);
        setResultMode('device-cache');
        setNotice({ kind: 'stale', text: `Live lookup failed. Showing the last result saved on this device from ${niceDateTime(cached.retrievedAt)}.` });
      } else {
        setResult(null);
        setNotice({ kind: 'error', text: error?.message || 'The live status request failed. Check your connection and try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  function resolvedStation(selected, query) {
    if (selected?.code) return selected;
    const code = query.trim().toUpperCase();
    if (/^[A-Z0-9]{2,10}$/.test(code)) return { code, name: code };
    return null;
  }

  async function searchJourneys(event) {
    event?.preventDefault();
    const from = resolvedStation(fromSelected, fromQuery);
    const to = resolvedStation(toSelected, toQuery);
    if (!from) {
      setJourneyNotice({ kind: 'error', text: 'Choose a source station from local suggestions, or enter its station code directly (for example, HWH).' });
      return;
    }
    if (!to) {
      setJourneyNotice({ kind: 'error', text: 'Choose a destination station from local suggestions, or enter its station code directly (for example, NDLS).' });
      return;
    }
    if (from.code === to.code) {
      setJourneyNotice({ kind: 'error', text: 'Select two different stations to find trains between them.' });
      return;
    }
    if (journeySearchDate && !/^\d{4}-\d{2}-\d{2}$/.test(journeySearchDate)) {
      setJourneyNotice({ kind: 'error', text: 'Choose a valid journey date.' });
      return;
    }

    const cacheKey = `${from.code}:${to.code}:${journeySearchDate || 'all-days'}`;
    setJourneyBusy(true);
    setJourneyNotice(null);
    setSelectedTrainNumber(null);
    setJourneyResult(null);
    try {
      // Station-to-station search uses the locally hosted timetable snapshot.
      // It does not contact RailRadar or use the 100-request monthly live-status quota.
      const body = await searchStaticTrainsBetween(from.code, to.code, journeySearchDate);
      const shaped = {
        data: body.data,
        fromCode: from.code,
        toCode: to.code,
        fromName: from.name || from.code,
        toName: to.name || to.code,
        date: journeySearchDate,
        retrievedAt: body.retrievedAt || null,
        syncCheckedAt: body.syncCheckedAt || null,
        sourceDataCommitAt: body.sourceDataCommitAt || null,
        cacheMode: 'static',
      };
      journeyCache.current.set(cacheKey, shaped);
      setJourneyResult(shaped);
      setJourneyMode('static');
      setJourneyNotice({ kind: 'info', text: `Searched the local timetable snapshot. No RailRadar API request was used. Snapshot sync checked ${niceDateTime(body.syncCheckedAt)}; the upstream schedule data may be older.` });
    } catch (requestError) {
      const cached = journeyCache.current.get(cacheKey);
      if (cached) {
        setJourneyResult(cached);
        setJourneyMode('device-cache');
        setJourneyNotice({ kind: 'stale', text: `Could not load the local timetable catalogue. Showing the previous result from this page session, retrieved ${niceDateTime(cached.retrievedAt)}.` });
      } else {
        setJourneyNotice({ kind: 'error', text: requestError?.message || 'The local timetable catalogue could not be loaded. Run the GitHub Actions timetable sync and wait for Cloudflare to redeploy.' });
      }
    } finally {
      setJourneyBusy(false);
    }
  }

  async function toggleSchedule(number, options = {}) {
    if (!number) return;
    if (selectedTrainNumber === number && !options.retry) {
      setSelectedTrainNumber(null);
      return;
    }
    setSelectedTrainNumber(number);
    setScheduleErrors((previous) => ({ ...previous, [number]: '' }));
    if (scheduleCache.current.has(number) && !options.retry) {
      setSchedulesByTrain((previous) => ({ ...previous, [number]: scheduleCache.current.get(number) }));
      return;
    }
    setScheduleLoadingNumber(number);
    try {
      // Full timetable expansion loads a static, prefix-sharded JSON file.
      // It does not call the RailRadar API.
      const body = await getStaticTrainSchedule(number);
      const shaped = {
        data: body.data,
        retrievedAt: body.retrievedAt || null,
        syncCheckedAt: body.syncCheckedAt || null,
        sourceDataCommitAt: body.sourceDataCommitAt || null,
        cacheMode: 'static',
      };
      scheduleCache.current.set(number, shaped);
      setSchedulesByTrain((previous) => ({ ...previous, [number]: shaped }));
    } catch (requestError) {
      setScheduleErrors((previous) => ({ ...previous, [number]: requestError?.message || 'This train schedule is unavailable in the local timetable snapshot.' }));
    } finally {
      setScheduleLoadingNumber(null);
    }
  }

  function goToSearch() {
    document.getElementById('live-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => document.getElementById('train-number')?.focus({ preventScroll: true }), 300);
    setMenuOpen(false);
  }

  function goToJourneys() {
    document.getElementById('journey-explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => document.getElementById('journey-from')?.focus({ preventScroll: true }), 300);
    setMenuOpen(false);
  }

  return (
    <div className={`site-shell ${dark ? 'theme-dark' : ''}`} id="top">
      <div className="announcement-bar"><span className="announcement-dot" /> LIVE TRAIN STATUS <span className="announcement-divider">·</span> TIMETABLES <span className="announcement-divider">·</span> JOURNEY PLANNING</div>
      <header className="site-header wrap">
        <Brand />
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
          <a href="#live-search" onClick={() => setMenuOpen(false)}>Live status</a>
          <a href="#journey-explorer" onClick={() => setMenuOpen(false)}>Journey explorer</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="/privacy.html" onClick={() => setMenuOpen(false)}>Privacy</a>
          <button className="theme-toggle" type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button>
          <button className="nav-cta" onClick={goToSearch} type="button">Track a train <ArrowUpRight size={15}/></button>
        </nav>
        <button className="mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X/> : <Menu/>}</button>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-image" aria-hidden="true"><div className="hero-image-shade"/><div className="hero-image-caption"><span>INDIAN RAILWAYS</span><span>THE JOURNEY, IN MOTION</span></div></div>
          <div className="hero-content">
            <div className="eyebrow hero-eyebrow"><span className="eyebrow-line"/> TRAIN INFORMATION, REIMAGINED</div>
            <h1>Every journey,<br/><em>informed.</em></h1>
            <p className="hero-description">A clearer view of the journey ahead. Explore routes, scheduled stops and live running status in a calmer travel experience.</p>
            <div className="hero-actions">
              <button className="button button-gold" onClick={goToSearch} type="button">Check live status <ArrowRight size={17}/></button>
              <button className="text-link text-link-button" onClick={goToJourneys} type="button">Explore journeys <RouteIcon size={15}/></button>
            </div>
            <div className="hero-note"><ShieldCheck size={15}/> No PNR entry on this website. No account required.</div>
          </div>
          <div className="hero-side-note"><span>01 / LIVE INFORMATION</span><span>DESIGNED FOR CLARITY</span></div>
          <div className="hero-scroll-indicator"><span/> SCROLL TO EXPLORE</div>
        </section>

        <section className="search-section wrap" id="live-search">
          <div className="section-intro">
            <p className="eyebrow">LIVE RUNNING STATUS</p>
            <h2>Start with your<br/><em>train number.</em></h2>
            <p>Check the latest response supplied by our configured data provider. Every result includes its retrieval time.</p>
            <div className="search-trust-list"><IconText icon={ShieldCheck}>API key stays server-side</IconText><IconText icon={Clock3}>Timestamped results</IconText></div>
          </div>
          <div className="search-column">
            <form className="search-card" onSubmit={searchTrain}>
              <div className="search-card-top"><div><span className="card-kicker">TRAIN ENQUIRY</span><h3>Where is your train?</h3></div><span className="card-icon"><TrainFront size={23}/></span></div>
              <label htmlFor="train-number">Train number <span>5 digits</span></label>
              <div className="input-shell"><TrainFront size={18}/><input id="train-number" name="train-number" inputMode="numeric" autoComplete="off" maxLength={5} pattern="[0-9]{5}" placeholder="e.g. 12919" value={trainNumber} onChange={(event) => setTrainNumber(event.target.value.replace(/\D/g, '').slice(0, 5))} required aria-describedby="train-number-hint"/><button type="button" className="input-clear" aria-label="Clear train number" onClick={() => setTrainNumber('')}><X size={15}/></button></div>
              <div id="train-number-hint" className="field-hint">Enter a five-digit Indian train number.</div>
              <label htmlFor="journey-date">Journey start date <span>Optional</span></label>
              <div className="input-shell date-shell"><Clock3 size={18}/><input id="journey-date" type="date" value={journeyDate} onChange={(event) => setJourneyDate(event.target.value)} max="2099-12-31"/></div>
              <button className="button button-dark search-submit" type="submit" disabled={busy}>{busy ? <><span className="button-loader"/> Checking status…</> : <><Search size={17}/> Find live status <ArrowRight size={17}/></>}</button>
              <div className="search-form-foot"><span><span className="live-dot"/> {progressLabel}</span><span>Data availability varies</span></div>
            </form>
            {notice && <div className={`notice notice-${notice.kind}`} role="status"><span>{notice.kind === 'stale' ? <Clock3 size={17}/> : notice.kind === 'info' ? <Check size={17}/> : <WifiOff size={17}/>}</span><p>{notice.text}</p></div>}
            {result && <StatusResult result={result} mode={resultMode} onRefresh={() => searchTrain()} refreshing={busy}/>}
          </div>
        </section>

        <section className="journey-explorer-section" id="journey-explorer">
          <div className="wrap journey-explorer-wrap">
            <div className="journey-explorer-heading">
              <div><p className="eyebrow"><span className="eyebrow-line"/> JOURNEY EXPLORER</p><h2>From here,<br/><em>to somewhere.</em></h2></div>
              <p>Compare trains between stations, then open a full timetable and open a station-by-station scheduled timetable.</p>
            </div>
            <form className="journey-search-card" onSubmit={searchJourneys}>
              <div className="journey-search-card-head"><div><span className="card-kicker">PLAN A JOURNEY</span><h3>Where would you like to go?</h3></div><div className="journey-card-icon"><RouteIcon size={22}/></div></div>
              <div className="journey-fields-grid">
                <StationField id="journey-from" label="From" value={fromQuery} selected={fromSelected} lookup={fromLookup} placeholder="Search city, station or code" onChange={(value) => { setFromQuery(value); setFromSelected(null); }} onClear={() => { setFromQuery(''); setFromSelected(null); }} onSelect={(station) => { setFromSelected(station); setFromQuery(`${station.name} (${station.code})`); }}/> 
                <button className="swap-stations-button" type="button" title="Swap stations" aria-label="Swap source and destination stations" onClick={() => { const previousQuery = fromQuery; const previousSelected = fromSelected; setFromQuery(toQuery); setFromSelected(toSelected); setToQuery(previousQuery); setToSelected(previousSelected); }}><ArrowLeftRight size={18}/></button>
                <StationField id="journey-to" label="To" value={toQuery} selected={toSelected} lookup={toLookup} placeholder="Search city, station or code" onChange={(value) => { setToQuery(value); setToSelected(null); }} onClear={() => { setToQuery(''); setToSelected(null); }} onSelect={(station) => { setToSelected(station); setToQuery(`${station.name} (${station.code})`); }}/>
                <div className="journey-date-field"><label htmlFor="journey-search-date">Journey date<span>Optional</span></label><div className="input-shell date-shell"><CalendarDays size={17}/><input id="journey-search-date" type="date" value={journeySearchDate} onChange={(event) => setJourneySearchDate(event.target.value)} max="2099-12-31"/></div><div className="field-hint">Date is checked at the source station.</div></div>
              </div>
              <div className="journey-search-footer"><div className="journey-search-trust"><ShieldCheck size={15}/><span>Station search and timetables use the configured external data provider.</span></div><button className="button button-dark" type="submit" disabled={journeyBusy}>{journeyBusy ? <><span className="button-loader"/> Finding trains…</> : <><Search size={16}/> Find trains <ArrowRight size={16}/></>}</button></div>
            </form>
            {journeyNotice && <div className={`notice notice-${journeyNotice.kind}`} role="status"><span>{journeyNotice.kind === 'stale' ? <Clock3 size={17}/> : journeyNotice.kind === 'info' ? <Check size={17}/> : <WifiOff size={17}/>}</span><p>{journeyNotice.text}</p></div>}
            {journeyResult && <JourneyResults result={journeyResult} mode={journeyMode} selectedTrainNumber={selectedTrainNumber} schedulesByTrain={schedulesByTrain} scheduleLoadingNumber={scheduleLoadingNumber} scheduleErrors={scheduleErrors} onToggleSchedule={toggleSchedule} onRefresh={() => searchJourneys()}/>}
            <div className="journey-static-note"><RouteIcon size={16}/><p>This is a scheduled timetable, not live train movement. Current position and delays are shown only in Live Status when supplied by the provider. Verify important travel details with official railway sources.</p></div>
          </div>
        </section>

        <section className="pnr-section">
          <div className="pnr-inner wrap">
            <div className="pnr-symbol"><Ticket size={26} strokeWidth={1.5}/></div>
            <div className="pnr-copy"><p className="eyebrow">RESERVATION ENQUIRY</p><h2>Your PNR, your privacy.</h2><p>We don't collect PNRs, ticket details or passenger information. Continue directly to the official Indian Railways enquiry service.</p></div>
            <a className="button button-outline" href={OFFICIAL_PNR_URL} target="_blank" rel="noreferrer noopener">Open official PNR enquiry <ExternalLink size={16}/></a>
          </div>
        </section>

        <section className="feature-section wrap" id="how-it-works">
          <div className="feature-heading"><div><p className="eyebrow">A QUIETER WAY TO CHECK</p><h2>Less uncertainty.<br/><em>More clarity.</em></h2></div><p>Useful information, a straightforward interface, and transparent handling when data is late or unavailable.</p></div>
          <div className="feature-grid">
            <article className="feature-card"><div className="feature-number">01</div><div className="feature-icon"><Radio size={21}/></div><h3>Live when available</h3><p>Connect to a configured train-status data provider. If the live source is unavailable, the page says so instead of inventing a location.</p><a href="#live-search">Check a train <ArrowUpRight size={14}/></a></article>
            <article className="feature-card"><div className="feature-number">02</div><div className="feature-icon"><RouteIcon size={21}/></div><h3>Routes with context</h3><p>Compare trains between stations and expand a timetable to see stops, scheduled times, halts and distance where the provider supplies them.</p><a href="#journey-explorer">Explore a route <ArrowUpRight size={14}/></a></article>
            <article className="feature-card"><div className="feature-number">03</div><div className="feature-icon"><ShieldCheck size={21}/></div><h3>Privacy by design</h3><p>No login, no PNR input, and no central search-history database in this first version. API credentials stay on the server.</p><a href="/privacy.html">Read the privacy note <ArrowUpRight size={14}/></a></article>
          </div>
        </section>

        <section className="closing-banner wrap"><div className="closing-lines" aria-hidden="true"/><div><p className="eyebrow">THE JOURNEY CONTINUES</p><h2>Travel with a little<br/><em>more confidence.</em></h2></div><button className="button button-gold" onClick={goToJourneys} type="button">Explore a route <ArrowUpRight size={16}/></button></section>
      </main>

      <footer className="site-footer">
        <div className="footer-main wrap">
          <div className="footer-brand-column"><Brand/><p>Train running status, scheduled routes and journey planning across India.</p><span className="footer-disclaimer">Independent service; not affiliated with Indian Railways, IRCTC or CRIS.</span></div>
          <div className="footer-links"><h4>Explore</h4><a href="#live-search">Live train status</a><a href="#journey-explorer">Journey explorer</a><a href={OFFICIAL_PNR_URL} target="_blank" rel="noreferrer noopener">Official PNR enquiry <ExternalLink size={12}/></a></div>
          <div className="footer-links"><h4>Trust & privacy</h4><a href="/privacy.html">Privacy & data transparency <ArrowUpRight size={12}/></a><a href="/privacy.html#data-sources">Data sources</a><a href="/privacy.html#limits">Service limitations</a></div>
        </div>
        <div className="footer-bottom wrap"><span>© {new Date().getFullYear()} Rail &amp; Route</span><a className="footer-github-link" href="https://github.com/himanvic" target="_blank" rel="noreferrer noopener" aria-label="Open GitHub profile"><Github size={14} aria-hidden="true"/> GitHub</a><a href="#top">Back to top ↑</a></div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
