#!/usr/bin/env python3
"""Build a compact static timetable catalogue from the upstream open dataset.

This script does not call RailRadar or scrape NTES. It processes an already
published dataset snapshot downloaded by the scheduled GitHub Actions job.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

WEEKDAYS = ("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
ALLOWED_SHARD_CHARS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")


def compact_time(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"none", "null", "--", "-"}:
        return None
    match = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?$", text)
    if match:
        return f"{int(match.group(1)):02d}:{match.group(2)}"
    return text


def clean_code(value: Any) -> str:
    return str(value or "").strip().upper()


def clean_number(value: Any) -> str:
    # Preserve leading zeroes when the upstream data provides a string.
    return str(value or "").strip()


def parse_run_days(value: Any) -> list[str]:
    if isinstance(value, dict):
        days = [day for day in WEEKDAYS if value.get(day) is True or str(value.get(day)).lower() == "true"]
        return days
    if isinstance(value, (list, tuple, set)):
        mapped = {str(day).strip().upper()[:3] for day in value}
        return [day for day in WEEKDAYS if day in mapped]
    if isinstance(value, str):
        mapped = {part.strip().upper()[:3] for part in re.split(r"[,\s;/]+", value) if part.strip()}
        if "DAILY" in mapped or "ALL" in mapped:
            return list(WEEKDAYS)
        return [day for day in WEEKDAYS if day in mapped]
    return []


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def shard_char(code: str) -> str:
    first = (code or "_")[0].upper()
    return first if first in ALLOWED_SHARD_CHARS else "_"


def normalize_stations(raw_stations: Any, raw_trains: list[Any]) -> list[dict[str, Any]]:
    if not isinstance(raw_stations, list):
        raise ValueError("stations.json must contain a JSON array")
    by_code: dict[str, dict[str, Any]] = {}
    for item in raw_stations:
        if not isinstance(item, dict):
            continue
        code = clean_code(item.get("code") or item.get("stationCode"))
        name = str(item.get("name") or item.get("stationName") or "").strip()
        if not code or not name:
            continue
        coordinates = item.get("coordinates") if isinstance(item.get("coordinates"), dict) else {}
        row = {
            "code": code,
            "name": name,
            "city": str(item.get("city") or item.get("address") or item.get("state") or "").strip(),
            "state": str(item.get("state") or "").strip(),
            "zone": str(item.get("zone") or "").strip(),
        }
        lat = coordinates.get("latitude", item.get("latitude", item.get("lat")))
        lon = coordinates.get("longitude", item.get("longitude", item.get("lon", item.get("lng"))))
        try:
            if lat is not None and lon is not None:
                row["coordinates"] = {"latitude": float(lat), "longitude": float(lon)}
        except (TypeError, ValueError):
            pass
        # Prefer the first stable station record; add missing names from routes below.
        by_code.setdefault(code, row)

    for train in raw_trains:
        if not isinstance(train, dict):
            continue
        route = train.get("completeOrderedRoute")
        if not isinstance(route, list):
            continue
        for stop in route:
            if not isinstance(stop, dict):
                continue
            code = clean_code(stop.get("stationCode") or stop.get("code"))
            name = str(stop.get("stationName") or stop.get("name") or "").strip()
            if code and name and code not in by_code:
                by_code[code] = {"code": code, "name": name, "city": "", "state": "", "zone": ""}
    return sorted(by_code.values(), key=lambda row: (row["name"].casefold(), row["code"]))


def normalize_trains(raw_trains: Any, station_by_code: dict[str, dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, list[dict[str, Any]]]], dict[str, dict[str, Any]], int]:
    if not isinstance(raw_trains, list):
        raise ValueError("trains.json must contain a JSON array")

    summaries: dict[str, dict[str, Any]] = {}
    schedules: dict[str, dict[str, Any]] = {}
    station_index: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(dict)
    total_stops = 0

    for item in raw_trains:
        if not isinstance(item, dict):
            continue
        number = clean_number(item.get("trainNumber") or item.get("number"))
        name = str(item.get("trainName") or item.get("name") or "").strip()
        source_raw = item.get("source") if isinstance(item.get("source"), dict) else {}
        dest_raw = item.get("destination") if isinstance(item.get("destination"), dict) else {}
        source_code = clean_code(source_raw.get("code"))
        dest_code = clean_code(dest_raw.get("code"))
        route_raw = item.get("completeOrderedRoute") or item.get("route") or item.get("stops")
        if not number or not name or not isinstance(route_raw, list) or len(route_raw) < 2:
            continue

        route: list[dict[str, Any]] = []
        for ordinal, stop in enumerate(route_raw):
            if not isinstance(stop, dict):
                continue
            code = clean_code(stop.get("stationCode") or stop.get("code"))
            station_name = str(stop.get("stationName") or stop.get("name") or station_by_code.get(code, {}).get("name") or "").strip()
            if not code or not station_name:
                continue
            sequence = int(stop.get("sequence") or (ordinal + 1))
            try:
                journey_day = max(1, int(stop.get("journeyDay") or stop.get("day") or 1))
            except (ValueError, TypeError):
                journey_day = 1
            try:
                distance = float(stop.get("distance")) if stop.get("distance") is not None else None
            except (TypeError, ValueError):
                distance = None
            arrival = compact_time(stop.get("arrivalTime") or stop.get("arrival"))
            departure = compact_time(stop.get("departureTime") or stop.get("departure"))
            halt_minutes = None
            if arrival and departure:
                arrival_match = re.match(r"^(\d{1,2}):(\d{2})$", arrival)
                departure_match = re.match(r"^(\d{1,2}):(\d{2})$", departure)
                if arrival_match and departure_match:
                    arrival_abs = (journey_day - 1) * 1440 + int(arrival_match.group(1)) * 60 + int(arrival_match.group(2))
                    departure_abs = (journey_day - 1) * 1440 + int(departure_match.group(1)) * 60 + int(departure_match.group(2))
                    while departure_abs < arrival_abs:
                        departure_abs += 1440
                    halt_minutes = departure_abs - arrival_abs
            compact = {
                "sequence": sequence,
                "station": {"code": code, "name": station_name},
                "arrival": arrival,
                "departure": departure,
                "arrivalDay": journey_day,
                "distance": distance,
                "haltMinutes": halt_minutes,
            }
            route.append(compact)
        route.sort(key=lambda stop: stop["sequence"])
        if len(route) < 2:
            continue
        first_code = source_code or route[0]["station"]["code"]
        last_code = dest_code or route[-1]["station"]["code"]
        source_name = str(source_raw.get("name") or station_by_code.get(first_code, {}).get("name") or route[0]["station"]["name"]).strip()
        dest_name = str(dest_raw.get("name") or station_by_code.get(last_code, {}).get("name") or route[-1]["station"]["name"]).strip()
        try:
            distance_total = float(item.get("overallDistanceKm")) if item.get("overallDistanceKm") is not None else (route[-1]["distance"] if route[-1]["distance"] is not None else None)
        except (ValueError, TypeError):
            distance_total = None
        run_days = parse_run_days(item.get("runningDays") or item.get("runsDays") or item.get("runDays"))
        summary = {
            "number": number,
            "name": name,
            "type": str(item.get("type") or item.get("category") or "Train").strip(),
            "source": {"code": first_code, "name": source_name},
            "destination": {"code": last_code, "name": dest_name},
            "runDays": run_days,
            "distance": distance_total,
            "stopCount": len(route),
        }
        # De-duplicate numbers by retaining the longest valid schedule.
        existing = schedules.get(number)
        if existing and len(existing.get("route", [])) >= len(route):
            continue
        schedules[number] = {"train": summary, "route": route}
        summaries[number] = summary
        total_stops += len(route)

    # Build a stop index so station-to-station search doesn't need RailRadar.
    for number, record in schedules.items():
        for index, stop in enumerate(record["route"]):
            code = stop["station"]["code"]
            shard = shard_char(code)
            row = {
                "n": number,
                "i": index,
                "a": stop.get("arrival"),
                "d": stop.get("departure"),
                "y": stop.get("arrivalDay") or 1,
                "k": stop.get("distance"),
            }
            station_index.setdefault(shard, {}).setdefault(code, []).append(row)

    return summaries, station_index, schedules, total_stops


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="Directory containing upstream stations.json, trains.json and LICENSE")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--upstream-commit", default=os.getenv("UPSTREAM_COMMIT", "unknown"))
    parser.add_argument("--upstream-data-commit-at", default=os.getenv("UPSTREAM_DATA_COMMIT_AT", "unknown"))
    args = parser.parse_args()

    source_dir = args.source
    stations_path = source_dir / "stations.json"
    trains_path = source_dir / "trains.json"
    if not stations_path.is_file() or not trains_path.is_file():
        raise SystemExit("Upstream source must contain stations.json and trains.json at repository root.")

    raw_trains = read_json(trains_path)
    raw_stations = read_json(stations_path)
    if not isinstance(raw_trains, list) or len(raw_trains) < 1000:
        raise SystemExit(f"Safety check failed: expected at least 1,000 train records; found {len(raw_trains) if isinstance(raw_trains, list) else 'invalid'}.")
    if not isinstance(raw_stations, list) or len(raw_stations) < 1000:
        raise SystemExit(f"Safety check failed: expected at least 1,000 station records; found {len(raw_stations) if isinstance(raw_stations, list) else 'invalid'}.")

    license_path = source_dir / "LICENSE"
    if not license_path.is_file():
        raise SystemExit("Safety check failed: the upstream LICENSE file is missing. Do not redistribute this snapshot until its data license is verified.")

    stations = normalize_stations(raw_stations, raw_trains)
    station_by_code = {station["code"]: station for station in stations}
    summaries, station_index, schedules, total_stops = normalize_trains(raw_trains, station_by_code)
    if len(schedules) < 1000:
        raise SystemExit(f"Safety check failed: only {len(schedules)} valid train schedules normalized. Existing output will not be replaced.")

    # Build a clean output folder so deleted/renamed trains are removed too.
    output = args.output.resolve()
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    stations_compact = [{k: v for k, v in station.items() if v not in ("", None)} for station in stations]
    write_json(output / "stations.json", stations_compact)
    write_json(output / "train-index.json", summaries)

    station_dir = output / "station-index"
    for shard, codes in station_index.items():
        write_json(station_dir / f"{shard}.json", codes)

    schedule_dir = output / "schedules"
    schedule_shards: dict[str, dict[str, Any]] = defaultdict(dict)
    for number, record in schedules.items():
        prefix = number[:3] if number[:3].isalnum() else "other"
        schedule_shards[prefix].setdefault(number, record)
    for prefix, shard in schedule_shards.items():
        write_json(schedule_dir / f"{prefix}.json", shard)

    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    metadata = {
        "schemaVersion": 1,
        "syncCheckedAt": checked_at,
        "sourceSnapshotCommit": args.upstream_commit,
        "sourceDataCommitAt": args.upstream_data_commit_at,
        "sourceRepository": "https://github.com/prasenjit-27/Indian-Railway-Data",
        "sourceLicense": "MIT (as declared by upstream repository; see UPSTREAM-LICENSE.txt)",
        "trainCount": len(schedules),
        "stationCount": len(stations_compact),
        "stopCount": sum(len(record["route"]) for record in schedules.values()),
        "stationIndexShardCount": len(station_index),
        "scheduleShardCount": len(schedule_shards),
        "importantNote": "The job checks this upstream snapshot daily. A daily sync check does not mean the upstream timetable itself was changed that day. Scheduled data is not live running status. Verify important travel details with official railway sources.",
    }
    write_json(output / "metadata.json", metadata)
    notice = f"""# Timetable dataset notice\n\nRail & Route's static timetable catalogue is generated from the community dataset:\nhttps://github.com/prasenjit-27/Indian-Railway-Data\n\nUpstream declares the dataset and associated examples to be available under the MIT License; the upstream license text is copied to `UPSTREAM-LICENSE.txt`; the job stops if the repository's LICENSE file is missing. Source repository revision: `{args.upstream_commit}`. Source data-file commit date reported by Git: `{args.upstream_data_commit_at}`.\n\nThe daily GitHub Actions job checks the upstream repository and regenerates this compact catalogue. The check time is not the same as the time the upstream timetable data was last changed. If the upstream does not change, the snapshot remains the same. Data may be incomplete or out of date. This catalogue is for educational and informational purposes and is not live running status. Verify important travel information with official railway sources.\n\nRail & Route is an independent student project and is not affiliated with Indian Railways, IRCTC, CRIS or NTES.\n"""
    (output / "SOURCE-NOTICE.md").write_text(notice, encoding="utf-8")
    shutil.copyfile(license_path, output / "UPSTREAM-LICENSE.txt")

    # Cloudflare Pages limits a single static asset to 25 MiB; fail before commit if this is breached.
    limit = 24 * 1024 * 1024
    oversized = [(str(path), path.stat().st_size) for path in output.rglob("*.json") if path.stat().st_size >= limit]
    if oversized:
        lines = ", ".join(f"{path} ({size} bytes)" for path, size in oversized)
        raise SystemExit(f"Generated JSON assets are too large for a comfortable static deployment: {lines}")

    print(json.dumps({"ok": True, **metadata}, indent=2))


if __name__ == "__main__":
    main()
