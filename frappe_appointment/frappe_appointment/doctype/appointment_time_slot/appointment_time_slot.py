# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

from datetime import datetime

import frappe
import pytz
from dateutil import parser
from frappe import _
from frappe.integrations.doctype.google_calendar.google_calendar import (
    get_google_calendar_object,
)
from frappe.model.document import Document
from frappe.utils import (
    DATETIME_FORMAT,
    get_date_str,
    get_datetime,
    get_datetime_in_timezone,
    get_datetime_str,
    get_system_timezone,
    get_timedelta,
    now_datetime,
    nowdate,
)
from googleapiclient.errors import HttpError


class AppointmentTimeSlot(Document):
    pass


def get_all_unavailable_google_calendar_slots_for_day(
    member_time_slots: object,
    starttime: datetime,
    endtime: datetime,
    date: datetime,
    appointment_group: object,
) -> list:
    """Get all google time slots of the given memebers

    Args:
    member_time_slots (object): list  of members
    starttime (datetime): start time for slot
    endtime (datetime): end time for slot
    date (datetime): data for which need to fetch the data
    appointment_group (object): object

    Returns:
    list: List of all google time slots of members
    """

    cal_slots = []

    for member in member_time_slots:
        google_calendar_slots = get_google_calendar_slots_member(
            member, starttime, endtime, date, appointment_group
        )

        if google_calendar_slots == False:
            return False

        cal_slots = cal_slots + google_calendar_slots

    # Sort based on start time
    cal_slots = sorted(
        cal_slots,
        key=lambda slot: get_datetime_str(
            convert_timezone_to_utc(
                slot["start"]["dateTime"], slot["start"]["timeZone"]
            )
        ),
    )

    # Sort based on end time
    cal_slots = sorted(
        cal_slots,
        key=lambda slot: get_datetime_str(
            convert_timezone_to_utc(slot["end"]["dateTime"], slot["end"]["timeZone"])
        ),
    )

    remove_same_slots = remove_duplicate_slots(cal_slots)

    return remove_same_slots


def get_google_calendar_slots_member(
    member: str,
    starttime: datetime,
    endtime: datetime,
    date: datetime,
    appointment_group: object,
) -> list:
    """Fetch the google slots data for given memebr/user

    Args:
    member (str): member email
    starttime (datetime): Start time
    endtime (datetime): end time
    date (datetime): date
    appointment_group (object): object

    Returns:
    list: list of slots of user
    """

    if not member:
        return None

    google_calendar_id = frappe.get_value(
        "User Appointment Availability", member, "google_calendar"
    )

    if not google_calendar_id:
        return None

    google_calendar = frappe.get_doc("Google Calendar", google_calendar_id)

    google_calendar_api_obj, account = get_google_calendar_object(google_calendar.name)

    events = []

    try:
        time_max, time_min = get_today_min_max_time(date)

        events = (
            google_calendar_api_obj.events()
            .list(
                calendarId=google_calendar.google_calendar_id,
                maxResults=2000,
                singleEvents=True,
                timeMax=time_max,
                timeMin=time_min,
                orderBy="startTime",
            )
            .execute()
        )
    except Exception as err:
        frappe.throw(
            _(
                "Google Calendar - Could not fetch event from Google Calendar, error code {0}."
            ).format(err.resp.status)
        )

    events_items = events["items"]
    range_events = []

    for event in events_items:
        try:
            if check_if_datetime_in_range(
                convert_timezone_to_utc(
                    event["start"]["dateTime"], event["start"]["timeZone"]
                ),
                convert_timezone_to_utc(
                    event["end"]["dateTime"], event["end"]["timeZone"]
                ),
                starttime,
                endtime,
            ):
                range_events.append(event)
        except Exception as e:
            if (
                "timeZone" not in event["start"]
                and appointment_group.ignore_all_day_events
            ):
                pass
            else:
                return False

    return range_events


def remove_duplicate_slots(cal_slots: list):
    """Remove duplicate from google slots

    Args:
    cal_slots (list): List of time slots

    Returns:
    _type_: List of time slots
    """
    if len(cal_slots) <= 1:
        return cal_slots

    current = 1
    last = 0
    remove_duplicate_time_slots = []

    remove_duplicate_time_slots.append(cal_slots[last])

    while current < len(cal_slots):
        last_start = convert_timezone_to_utc(
            cal_slots[last]["start"]["dateTime"], cal_slots[last]["start"]["timeZone"]
        )
        last_end = convert_timezone_to_utc(
            cal_slots[last]["end"]["dateTime"], cal_slots[last]["end"]["timeZone"]
        )
        current_start = convert_timezone_to_utc(
            cal_slots[current]["start"]["dateTime"],
            cal_slots[current]["start"]["timeZone"],
        )
        current_end = convert_timezone_to_utc(
            cal_slots[current]["end"]["dateTime"], cal_slots[current]["end"]["timeZone"]
        )

        if current_start == last_start and current_end == last_end:
            current += 1
            continue

        remove_duplicate_time_slots.append(cal_slots[current])
        last = current
        current += 1

    return remove_duplicate_time_slots


def get_today_min_max_time(date: datetime):
    """Retrieve the current day's start and end time in UTC format.

    Args:
    date (datetime): date

    Returns:
    list: Date start and end time
    """
    time_min = datetime(date.year, date.month, date.day, 0, 0, 0)
    time_max = datetime(date.year, date.month, date.day, 23, 59, 59)

    time_min_str = time_min.isoformat() + "Z"
    time_max_str = time_max.isoformat() + "Z"

    return [time_max_str, time_min_str]


def get_utc_datatime_with_time(date: datetime, time: str) -> datetime:
    """Function to generate a datetime object for a given date and time.

    Args:
    date (datetime): Date
    time (str): Time

    Returns:
    datetime: Updated datetime object
    """
    system_timezone = pytz.timezone(get_system_timezone())
    local_datetime = system_timezone.localize(
        datetime.strptime(f"{get_date_str(date)} {time}", "%Y-%m-%d %H:%M:%S")
    )
    return local_datetime.astimezone(pytz.utc)


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


def check_if_datetime_in_range(
    start_datetime: datetime,
    end_datetime: datetime,
    lower_datetime: datetime,
    upper_datetime: datetime,
):
    """Check if [start_datetime, end_datetime] (s1) has an intersection with [lower_datetime, upper_datetime] (r1).

    Args:
    start_datetime (datetime): Start Datetime
    end_datetime (datetime): End Datetime
    lower_datetime (datetime): Lower Datetime (Start time of range)
    upper_datetime (datetime): Upper Datetime (End time of range)

    Returns:
    bool: True if s1 has overlap with r1, False otherwise.
    """

    # if lower_datetime <= start_datetime and end_datetime <= upper_datetime:
    # 	return True

    # if end_datetime > lower_datetime and lower_datetime > start_datetime:
    # 	return True

    # if start_datetime < upper_datetime and upper_datetime < end_datetime:
    # 	return True

    if lower_datetime > end_datetime or upper_datetime < start_datetime:
        return False

    return True
