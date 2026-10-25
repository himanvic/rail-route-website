import unittest

from scripts.sync_timetable import (
    compact_time,
    normalize_stations,
    normalize_trains,
    parse_run_days,
)


class TimetableSyncTests(unittest.TestCase):
    def test_compact_time_removes_seconds(self):
        self.assertEqual(compact_time("08:05:00"), "08:05")
        self.assertIsNone(compact_time(None))
        self.assertIsNone(compact_time("--"))

    def test_parse_run_days_from_upstream_boolean_map(self):
        self.assertEqual(
            parse_run_days({"MON": True, "WED": False, "FRI": True}),
            ["MON", "FRI"],
        )

    def test_normalize_route_keeps_order_and_indexes_stops(self):
        raw_stations = [
            {"code": "HWH", "name": "Howrah Junction"},
            {"code": "BWN", "name": "Barddhaman"},
            {"code": "PNBE", "name": "Patna Junction"},
        ]
        raw_trains = [{
            "trainNumber": "12345",
            "trainName": "Example Express",
            "type": "Exp",
            "source": {"code": "HWH", "name": "Howrah Junction"},
            "destination": {"code": "PNBE", "name": "Patna Junction"},
            "runningDays": {"SUN": True, "MON": True},
            "overallDistanceKm": 500,
            "completeOrderedRoute": [
                {"sequence": 1, "stationCode": "HWH", "stationName": "Howrah Junction", "arrivalTime": None, "departureTime": "08:00:00", "journeyDay": 1, "distance": 0},
                {"sequence": 2, "stationCode": "BWN", "stationName": "Barddhaman", "arrivalTime": "09:00:00", "departureTime": "09:05:00", "journeyDay": 1, "distance": 100},
                {"sequence": 3, "stationCode": "PNBE", "stationName": "Patna Junction", "arrivalTime": "14:00:00", "departureTime": None, "journeyDay": 1, "distance": 500},
            ],
        }]
        stations = normalize_stations(raw_stations, raw_trains)
        station_by_code = {station["code"]: station for station in stations}
        summaries, station_index, schedules, total_stops = normalize_trains(raw_trains, station_by_code)

        self.assertEqual(summaries["12345"]["name"], "Example Express")
        self.assertEqual([stop["station"]["code"] for stop in schedules["12345"]["route"]], ["HWH", "BWN", "PNBE"])
        self.assertEqual(schedules["12345"]["route"][1]["haltMinutes"], 5)
        self.assertEqual([row["n"] for row in station_index["H"]["HWH"]], ["12345"])
        self.assertEqual(total_stops, 3)


if __name__ == "__main__":
    unittest.main()
