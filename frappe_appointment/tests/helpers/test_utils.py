from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytz
from frappe.tests import IntegrationTestCase
from frappe.utils.data import get_system_timezone

from frappe_appointment.helpers.utils import (
    cmp_items,
    compare_end_time_slots,
    convert_datetime_to_utc,
    convert_timezone_to_utc,
    convert_utc_datetime_to_timezone,
    duration_to_string,
    get_calendar_fetch_range,
    get_date_start_end_time_for_given_timezone,
    get_site_day_range,
    get_site_days_for_guest_day,
    get_time_slots_utc,
    get_time_zone,
    get_utc_datatime_with_time,
    get_weekday,
    local_time_to_utc,
    update_time_of_datetime,
    utc_to_given_time_zone,
    utc_to_sys_time,
)
from frappe_appointment.tests import google_slot

SYSTEM_TIMEZONE = "frappe_appointment.helpers.utils.get_system_timezone"


def _utc(value):
    return pytz.utc.localize(datetime.fromisoformat(value))


class TestUtilsDatetimeHelpers(IntegrationTestCase):
    """Pure datetime, timezone and duration helpers."""

    def test_calendar_fetch_range_is_the_utc_day(self):
        """get_calendar_fetch_range is the date's UTC day when the working hours are inside it."""
        # the input time-of-day is ignored
        day = datetime(2026, 7, 1, 15, 30, 45)
        self.assertEqual(get_calendar_fetch_range(day), ("2026-07-01T00:00:00Z", "2026-07-01T23:59:59Z"))
        self.assertEqual(
            get_calendar_fetch_range(day, _utc("2026-07-01T03:30:00"), _utc("2026-07-01T11:30:00")),
            ("2026-07-01T00:00:00Z", "2026-07-01T23:59:59Z"),
        )

    def test_calendar_fetch_range_widens_to_the_working_hours(self):
        """get_calendar_fetch_range reaches past the UTC day to take in working hours outside it."""
        day = datetime(2026, 7, 1)
        self.assertEqual(
            get_calendar_fetch_range(day, _utc("2026-06-30T18:30:00"), _utc("2026-07-01T12:00:00")),
            ("2026-06-30T18:30:00Z", "2026-07-01T23:59:59Z"),
        )
        self.assertEqual(
            get_calendar_fetch_range(day, _utc("2026-07-01T17:00:00"), _utc("2026-07-02T02:00:00")),
            ("2026-07-01T00:00:00Z", "2026-07-02T02:00:00Z"),
        )

    def test_get_time_zone(self):
        """get_time_zone returns the named zone, and the site's for a missing or unknown name."""
        site_time_zone = pytz.timezone(get_system_timezone())
        self.assertEqual(get_time_zone("America/New_York"), pytz.timezone("America/New_York"))
        self.assertEqual(get_time_zone(), site_time_zone)
        self.assertEqual(get_time_zone(""), site_time_zone)
        self.assertEqual(get_time_zone("Nowhere/Nothing"), site_time_zone)

    def test_local_time_to_utc(self):
        """local_time_to_utc reads a clock time in the given zone, following its daylight saving."""
        new_york = pytz.timezone("America/New_York")
        # Standard time is UTC-5, daylight time UTC-4.
        self.assertEqual(local_time_to_utc(date(2027, 3, 1), "07:30:00", new_york), _utc("2027-03-01T12:30:00"))
        self.assertEqual(
            local_time_to_utc(date(2027, 7, 1), timedelta(hours=7, minutes=30), new_york),
            _utc("2027-07-01T11:30:00"),
        )

    def test_get_site_day_range(self):
        """get_site_day_range runs from midnight to the next midnight in the site's time zone."""
        with patch(SYSTEM_TIMEZONE, return_value="Asia/Kolkata"):
            self.assertEqual(
                get_site_day_range(date(2027, 3, 1)), (_utc("2027-02-28T18:30:00"), _utc("2027-03-01T18:30:00"))
            )

    def test_get_site_days_for_guest_day(self):
        """get_site_days_for_guest_day lists the site days a guest's day runs over."""
        monday = datetime(2027, 3, 1)
        cases = {
            "330": [monday],  # the same offset as the site
            "60": [monday, monday + timedelta(days=1)],  # behind the site, ahead of UTC
            "-300": [monday, monday + timedelta(days=1)],
            "540": [monday - timedelta(days=1), monday],  # ahead of the site
        }
        with patch(SYSTEM_TIMEZONE, return_value="Asia/Kolkata"):
            for offset, days in cases.items():
                with self.subTest(offset=offset):
                    self.assertEqual(get_site_days_for_guest_day("2027-03-01", offset), days)

    def test_cmp_items(self):
        """cmp_items returns 1 / 0 / -1 for a>b / a==b / a<b."""
        self.assertEqual(cmp_items(2, 1), 1)
        self.assertEqual(cmp_items(1, 1), 0)
        self.assertEqual(cmp_items(1, 2), -1)
        # also drives the lexical ordering of datetime strings
        self.assertEqual(cmp_items("2026-07-01 10:00:00", "2026-07-01 09:00:00"), 1)
        self.assertEqual(cmp_items("2026-07-01 09:00:00", "2026-07-01 09:00:00"), 0)

    def test_get_weekday(self):
        """get_weekday maps a datetime to its weekday name."""
        self.assertEqual(get_weekday(datetime(2026, 7, 1)), "Wednesday")
        self.assertEqual(get_weekday(datetime(2026, 7, 5)), "Sunday")
        self.assertEqual(get_weekday(datetime(2026, 7, 6)), "Monday")

    def test_duration_to_string(self):
        """duration_to_string renders seconds as a human hour/minute string."""
        self.assertEqual(duration_to_string(3600), "1 hour")
        self.assertEqual(duration_to_string(5400), "1 hour 30 minutes")
        self.assertEqual(duration_to_string(120), "2 minutes")
        self.assertEqual(duration_to_string(0), "")
        # pluralisation boundaries
        self.assertEqual(duration_to_string(7200), "2 hours")
        self.assertEqual(duration_to_string(60), "1 minute")
        self.assertEqual(duration_to_string(3660), "1 hour 1 minute")

    def test_update_time_of_datetime(self):
        """update_time_of_datetime replaces H/M/S from the timedelta, keeping the date."""
        result = update_time_of_datetime(datetime(2026, 7, 1, 8, 15, 30), timedelta(hours=14, minutes=30, seconds=45))
        self.assertEqual(result, datetime(2026, 7, 1, 14, 30, 45))

    def test_get_date_start_end_time_for_given_timezone(self):
        """get_date_start_end_time_for_given_timezone returns 00:00:00 and 23:59:59 in a fixed-offset tz."""
        start, end = get_date_start_end_time_for_given_timezone("2026-07-01", "0")
        self.assertEqual(
            (start.year, start.month, start.day, start.hour, start.minute, start.second),
            (2026, 7, 1, 0, 0, 0),
        )
        self.assertEqual(start.utcoffset(), timedelta(0))
        self.assertEqual(
            (end.year, end.month, end.day, end.hour, end.minute, end.second),
            (2026, 7, 1, 23, 59, 59),
        )
        self.assertEqual(end.utcoffset(), timedelta(0))
        # a non-zero offset (+05:30) keeps the same wall-clock bounds
        start_ist, end_ist = get_date_start_end_time_for_given_timezone("2026-07-01", "330")
        self.assertEqual((start_ist.hour, start_ist.minute, start_ist.second), (0, 0, 0))
        self.assertEqual(start_ist.utcoffset(), timedelta(minutes=330))
        self.assertEqual((end_ist.hour, end_ist.minute, end_ist.second), (23, 59, 59))
        self.assertEqual(end_ist.utcoffset(), timedelta(minutes=330))

    def test_convert_datetime_to_utc(self):
        """convert_datetime_to_utc localises a naive system-tz datetime to the UTC instant."""
        naive = datetime(2026, 7, 1, 12, 0, 0)
        result = convert_datetime_to_utc(naive)
        self.assertEqual(result.utcoffset(), timedelta(0))
        sys_tz = pytz.timezone(get_system_timezone())
        # round-trip back to system tz recovers the original wall clock
        self.assertEqual(result.astimezone(sys_tz).replace(tzinfo=None), naive)
        self.assertEqual(result, sys_tz.localize(naive).astimezone(pytz.utc))

    def test_convert_timezone_to_utc(self):
        """convert_timezone_to_utc parses an offset-aware string and returns the UTC instant."""
        # SOURCE BUG: time_zone arg is inert (the instant is preserved to UTC); a naive input would be
        # read in the system tz, not time_zone. Offset-aware inputs are unambiguous, so test those.
        self.assertEqual(
            convert_timezone_to_utc("2026-07-01 12:00:00+00:00", "UTC"),
            datetime(2026, 7, 1, 12, 0, 0, tzinfo=pytz.utc),
        )
        self.assertEqual(
            convert_timezone_to_utc("2026-07-01 12:00:00+05:30", "UTC"),
            datetime(2026, 7, 1, 6, 30, 0, tzinfo=pytz.utc),
        )

    def test_convert_utc_datetime_to_timezone(self):
        """convert_utc_datetime_to_timezone returns the same instant in the target tz."""
        utc_dt = datetime(2026, 7, 1, 12, 0, 0, tzinfo=pytz.utc)
        result = convert_utc_datetime_to_timezone(utc_dt, "Asia/Kolkata")
        self.assertEqual((result.hour, result.minute), (17, 30))
        self.assertEqual(result.utcoffset(), timedelta(hours=5, minutes=30))
        self.assertEqual(result.astimezone(pytz.utc), utc_dt)

    def test_utc_to_given_time_zone(self):
        """utc_to_given_time_zone converts a UTC datetime to a fixed minutes-offset tz."""
        utc_dt = datetime(2026, 7, 1, 12, 0, 0, tzinfo=pytz.utc)
        result = utc_to_given_time_zone(utc_dt, "330")
        self.assertEqual((result.hour, result.minute), (17, 30))
        self.assertEqual(result.utcoffset(), timedelta(minutes=330))
        self.assertEqual(result.astimezone(pytz.utc), utc_dt)
        # negative offset
        neg = utc_to_given_time_zone(utc_dt, "-300")
        self.assertEqual(neg.hour, 7)
        self.assertEqual(neg.utcoffset(), timedelta(minutes=-300))

    def test_get_utc_datatime_with_time(self):
        """get_utc_datatime_with_time builds a system-tz datetime at the clock time and returns UTC."""
        result = get_utc_datatime_with_time(datetime(2026, 7, 1), "09:30:00")
        self.assertEqual(result.utcoffset(), timedelta(0))
        sys_tz = pytz.timezone(get_system_timezone())
        back = result.astimezone(sys_tz)
        self.assertEqual((back.year, back.month, back.day, back.hour, back.minute, back.second), (2026, 7, 1, 9, 30, 0))
        self.assertEqual(result, sys_tz.localize(datetime(2026, 7, 1, 9, 30, 0)).astimezone(pytz.utc))

    def test_get_time_slots_utc(self):
        """get_time_slots_utc maps a Google slot to UTC start_time/end_time strings."""
        slot = google_slot("2026-07-01T09:00:00+00:00", "2026-07-01T10:30:00+00:00", tz="UTC")
        self.assertEqual(
            get_time_slots_utc(slot),
            {"start_time": "2026-07-01 09:00:00.000000", "end_time": "2026-07-01 10:30:00.000000"},
        )

    def test_compare_end_time_slots(self):
        """compare_end_time_slots orders two Google slots by start, then by end."""
        early = google_slot("2026-07-01T09:00:00+00:00", "2026-07-01T10:00:00+00:00")
        late = google_slot("2026-07-01T11:00:00+00:00", "2026-07-01T12:00:00+00:00")
        self.assertEqual(compare_end_time_slots(early, late), -1)
        self.assertEqual(compare_end_time_slots(late, early), 1)
        # equal start falls back to the end comparison
        short_slot = google_slot("2026-07-01T09:00:00+00:00", "2026-07-01T09:30:00+00:00")
        long_slot = google_slot("2026-07-01T09:00:00+00:00", "2026-07-01T10:00:00+00:00")
        self.assertEqual(compare_end_time_slots(short_slot, long_slot), -1)
        self.assertEqual(compare_end_time_slots(long_slot, short_slot), 1)
        # identical slots compare equal
        self.assertEqual(
            compare_end_time_slots(early, google_slot("2026-07-01T09:00:00+00:00", "2026-07-01T10:00:00+00:00")),
            0,
        )

    def test_utc_to_sys_time(self):
        """utc_to_sys_time renders a UTC iso string as a system-tz datetime string."""
        result = utc_to_sys_time("2026-07-01T12:00:00")
        expected = (
            pytz.utc.localize(datetime(2026, 7, 1, 12, 0, 0))
            .astimezone(pytz.timezone(get_system_timezone()))
            .strftime("%Y-%m-%d %H:%M:%S.%f")
        )
        self.assertEqual(result, expected)
