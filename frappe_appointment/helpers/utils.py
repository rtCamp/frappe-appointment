from datetime import datetime, timedelta

import pytz
from dateutil import parser
from frappe.utils import convert_utc_to_system_timezone, get_datetime_str
from frappe.utils.data import get_date_str, get_system_timezone, to_timedelta

weekdays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def get_utc_datatime_with_time(date: datetime, time: str) -> datetime:
    """Function to generate a datetime object for a given date and time.

    Args:
    date (datetime): Date
    time (str): Time

    Returns:
    datetime: Updated datetime object
    """
    system_timezone = pytz.timezone(get_system_timezone())
    local_datetime = system_timezone.localize(datetime.strptime(f"{get_date_str(date)} {time}", "%Y-%m-%d %H:%M:%S"))
    return local_datetime.astimezone(pytz.utc)


def get_time_zone(time_zone: str | None = None):
    """The named time zone, or the site's when there's no name or it isn't a known one."""
    try:
        return pytz.timezone(time_zone or get_system_timezone())
    except pytz.UnknownTimeZoneError:
        return pytz.timezone(get_system_timezone())


def local_time_to_utc(date, time, time_zone) -> datetime:
    """The UTC moment of a clock time on a calendar date in a time zone.

    Args:
    date (date): Calendar date in the time zone
    time (timedelta | str): Time of day, as an Appointment Time Slot holds it
    time_zone (tzinfo): pytz time zone the date and time are in
    """
    local_datetime = datetime(date.year, date.month, date.day) + to_timedelta(time)
    return time_zone.localize(local_datetime).astimezone(pytz.utc)


def get_site_day_range(date) -> tuple:
    """The UTC moments a calendar day starts and ends in the site's time zone."""
    site_time_zone = get_time_zone()
    day_start = datetime(date.year, date.month, date.day)
    day_end = day_start + timedelta(days=1)
    return (
        site_time_zone.localize(day_start).astimezone(pytz.utc),
        site_time_zone.localize(day_end).astimezone(pytz.utc),
    )


def get_site_days_for_guest_day(date_str: str, timezone_offset: str) -> list:
    """The site's calendar days that a guest's day runs over, as midnight datetimes in order.

    The day with the guest's own date is always one of them: its details describe the day to the guest.
    """
    guest_day_start, guest_day_end = get_date_start_end_time_for_given_timezone(date_str, timezone_offset)
    site_time_zone = get_time_zone()

    day = guest_day_start.astimezone(site_time_zone).date()
    last_day = guest_day_end.astimezone(site_time_zone).date()
    days = {datetime.strptime(date_str, "%Y-%m-%d").date()}
    while day <= last_day:
        days.add(day)
        day += timedelta(days=1)

    return [datetime(day.year, day.month, day.day) for day in sorted(days)]


def get_calendar_fetch_range(date: datetime, starttime: datetime = None, endtime: datetime = None) -> tuple:
    """The time range to read calendar events for, as (time_min, time_max) strings in UTC.

    It is the date's UTC day, made wider to take in all of [starttime, endtime]: working hours in another
    time zone can fall outside that day.
    """
    time_min = pytz.utc.localize(datetime(date.year, date.month, date.day, 0, 0, 0))
    time_max = pytz.utc.localize(datetime(date.year, date.month, date.day, 23, 59, 59))

    if starttime and endtime:
        time_min = min(time_min, starttime.astimezone(pytz.utc))
        time_max = max(time_max, endtime.astimezone(pytz.utc))

    return time_min.strftime("%Y-%m-%dT%H:%M:%SZ"), time_max.strftime("%Y-%m-%dT%H:%M:%SZ")


def convert_timezone_to_utc(date_time: str, time_zone: str) -> datetime:
    """Helper function to convert a given datetime string to a datetime object with the specified time zone.

    Args:
    date_time (str): Datetime string
    time_zone (str): Time zone

    Returns:
    datetime: Datetime object
    """
    local_datetime = parser.parse(date_time).astimezone(pytz.timezone(time_zone))
    return local_datetime.astimezone(pytz.utc)


def convert_datetime_to_utc(date_time: datetime) -> datetime:
    """Converts the given datetime object to a UTC timezone datetime object.

    Args:
    date_time (datetime): Datetime Object

    Returns:
    datetime: Updated Object
    """
    system_timezone = pytz.timezone(get_system_timezone())
    local_datetime = system_timezone.localize(date_time)
    return local_datetime.astimezone(pytz.utc)


def convert_utc_datetime_to_timezone(date_time: datetime, timezone: str) -> datetime:
    """Converts the given datetime object to a UTC timezone datetime object."""
    return date_time.astimezone(pytz.timezone(timezone))


def get_weekday(date_time: datetime) -> str:
    date = date_time.date()
    return weekdays[date.weekday()]


def utc_to_sys_time(time: str) -> str:
    return get_datetime_str(convert_utc_to_system_timezone(datetime.fromisoformat(time).replace(tzinfo=None)))


def utc_to_given_time_zone(utc_datetime: datetime, time_zone_offset: str) -> str:
    # utc_date_time = datetime.datetime.strptime(utc_string, "%Y-%m-%d %H:%M:%S%z")

    converted_datetime = utc_datetime.astimezone(pytz.FixedOffset(int(time_zone_offset)))

    return converted_datetime


def compare_end_time_slots(current_slot, next_slot):
    current_slot, next_slot = get_time_slots_utc(current_slot), get_time_slots_utc(next_slot)

    if current_slot["start_time"] != next_slot["start_time"]:
        return cmp_items(current_slot["start_time"], next_slot["start_time"])

    return cmp_items(current_slot["end_time"], next_slot["end_time"])


def get_time_slots_utc(slot):
    return {
        "start_time": get_datetime_str(convert_timezone_to_utc(slot["start"]["dateTime"], slot["start"]["timeZone"])),
        "end_time": get_datetime_str(convert_timezone_to_utc(slot["end"]["dateTime"], slot["end"]["timeZone"])),
    }


def cmp_items(a, b):
    if a > b:
        return 1
    elif a == b:
        return 0
    else:
        return -1


def get_date_start_end_time_for_given_timezone(date_str: str, timezone_offset: str):
    date = datetime.strptime(date_str, "%Y-%m-%d")
    timezone = pytz.FixedOffset(int(timezone_offset))
    start_time = timezone.localize(datetime(date.year, date.month, date.day, 0, 0, 0))
    end_time = start_time + timedelta(days=1) - timedelta(seconds=1)

    return start_time, end_time


def update_time_of_datetime(dt: datetime, new_time: timedelta):
    total_seconds = new_time.total_seconds()
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)

    return dt.replace(hour=hours, minute=minutes, second=seconds)


def duration_to_string(duration):
    seconds = int(duration)
    minutes = seconds // 60
    hours = minutes // 60
    rest_minutes = minutes % 60

    duration_str = ""
    if hours:
        duration_str += f"{hours} hour{'s' if hours > 1 else ''}"
    if rest_minutes:
        duration_str += f" {rest_minutes} minute{'s' if rest_minutes > 1 else ''}"

    duration_str = duration_str.strip()
    return duration_str
