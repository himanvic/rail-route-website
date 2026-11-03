/**
 * Build the default live route display from RailRadar's complete route.
 * isHalt=false records are hidden behind the segment between adjacent halts.
 * Records without an explicit halt flag stay visible to avoid hiding data.
 */
export function isPassThroughStop(stop) {
  if (!stop || typeof stop !== 'object') return false;
  const raw = stop.isHalt;
  if (raw === false || raw === 0 || String(raw).toLowerCase() === 'false' || String(raw) === '0') return true;
  if (raw === true || raw === 1 || String(raw).toLowerCase() === 'true' || String(raw) === '1') return false;
  const kind = String(stop.stopType || stop.stopKind || stop.stationType || '').toLowerCase();
  return /pass.?through|non.?halt|non.?stop|passing/.test(kind);
}

export function buildLiveRouteRows(routeValue, expandedSegments = {}, currentIndex = -1) {
  const route = Array.isArray(routeValue) ? routeValue : [];
  const haltIndexes = route.map((stop, index) => isPassThroughStop(stop) ? -1 : index).filter((index) => index >= 0);
  // If the provider has supplied no identifiable halts, show every record safely.
  const visibleHaltIndexes = haltIndexes.length ? haltIndexes : route.map((_, index) => index);
  const rows = [];
  let passThroughCount = 0;

  for (let position = 0; position < visibleHaltIndexes.length; position += 1) {
    const startIndex = visibleHaltIndexes[position];
    rows.push({ type: 'stop', index: startIndex, passThrough: false });
    const endIndex = visibleHaltIndexes[position + 1];
    if (endIndex == null) continue;

    const passIndexes = [];
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      if (isPassThroughStop(route[index])) passIndexes.push(index);
    }
    passThroughCount += passIndexes.length;
    if (!passIndexes.length) continue;

    const key = `${startIndex}-${endIndex}`;
    const activeInside = passIndexes.includes(currentIndex);
    const expanded = Boolean(expandedSegments[key] || activeInside);
    rows.push({ type: 'segment', key, startIndex, endIndex, passIndexes, expanded, activeInside });
    if (expanded) passIndexes.forEach((index) => rows.push({ type: 'stop', index, passThrough: true }));
  }

  return {
    rows,
    haltIndexes: visibleHaltIndexes,
    passThroughCount,
    hasExplicitHaltMetadata: route.some((stop) => stop && Object.prototype.hasOwnProperty.call(stop, 'isHalt')),
  };
}
