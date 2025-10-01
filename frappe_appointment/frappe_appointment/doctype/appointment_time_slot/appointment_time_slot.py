# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

from datetime import datetime
from functools import cmp_to_key

import frappe
from frappe import _
from frappe.integrations.doctype.google_calendar.google_calendar import (
    get_google_calendar_object,
)
from frappe.model.document import Document

from frappe_appointment.helpers.utils import (
    compare_end_time_slots,
    convert_timezone_to_utc,
    get_today_min_max_time,
)


class AppointmentTimeSlot(Document):
    pass


class GoogleBadRequest(Exception):
    pass


def get_all_unavailable_google_calendar_slots_for_day(
    member_time_slots: object,
    starttime: datetime,
    endtime: datetime,
    date: datetime,
    appointment_group: object,
) -> list:
    """Get all google busy time slots from freebusy API for the given members

    Args:
    member_time_slots (object): list of members
    starttime (datetime): start time for slot
    endtime (datetime): end time for slot
    date (datetime): date for which need to fetch the data
    appointment_group (object): object

    Returns:
    list: List of all busy time slots from Google Calendar freebusy API
    """
    cal_slots = []

    for member in member_time_slots:
        google_calendar_slots = get_google_calendar_slots_member(member, starttime, endtime, date, appointment_group)

        # Empty list is valid (no busy slots), but None/False indicates error
        if google_calendar_slots is None:
            continue
            
        cal_slots = cal_slots + google_calendar_slots

    cal_slots.sort(key=cmp_to_key(compare_end_time_slots))

    return remove_duplicate_slots(cal_slots)


def get_google_calendar_slots_member(
    member: str,
    starttime: datetime,
    endtime: datetime,
    date: datetime,
    appointment_group: object,
) -> list:
    """Fetch the google freebusy data for given member/user

    Args:
    member (str): member email
    starttime (datetime): Start time
    endtime (datetime): end time
    date (datetime): date
    appointment_group (object): object

    Returns:
    list: list of busy slots of user in standardized format
    """

    if not member:
        return []

    google_calendar_id = frappe.get_value("User Appointment Availability", member, "google_calendar")

    if not google_calendar_id:
        return []

    google_calendar = frappe.get_doc("Google Calendar", google_calendar_id)

    try:
        google_calendar_api_obj, account = get_google_calendar_object(google_calendar.name)
    except Exception:
        raise GoogleBadRequest(_("Google Calendar - Could not create Google Calendar API object."))

    try:
        time_max, time_min = get_today_min_max_time(date)

        # Fetch freebusy data instead of events
        freebusy_response = (
            google_calendar_api_obj.freebusy()
            .query(
                body={
                    "timeMin": time_min,
                    "timeMax": time_max,
                    "items": [{"id": google_calendar.google_calendar_id}],
                }
            )
            .execute()
        )
    except Exception as err:
        frappe.throw(
            _("Google Calendar - Could not fetch freebusy data from Google Calendar, error code {0}.").format(
                getattr(err, 'resp', {}).get('status', 'unknown')
            )
        )

    # Extract busy periods from freebusy response
    calendar_data = freebusy_response.get("calendars", {}).get(google_calendar.google_calendar_id, {})
    
    if calendar_data.get("errors"):
        # If there are errors, log them and return empty list (assume no busy periods)
        error_messages = [error.get("reason", "Unknown error") for error in calendar_data["errors"]]
        frappe.log_error(f"Google Calendar freebusy errors for {member}: {error_messages}")
        return []

    busy_periods = calendar_data.get("busy", [])
    
    # Convert busy periods to standardized format and filter by time range
    busy_slots = []
    for busy_period in busy_periods:
        try:
            # Parse start and end times in UTC, handling both Z and +00:00 formats
            start_str = busy_period["start"]
            end_str = busy_period["end"]
            
            # Normalize timezone format
            if start_str.endswith('Z'):
                start_str = start_str.replace('Z', '+00:00')
            if end_str.endswith('Z'):
                end_str = end_str.replace('Z', '+00:00')
            
            # Handle milliseconds if present
            if '.000+00:00' in start_str:
                start_str = start_str.replace('.000+00:00', '+00:00')
            if '.000+00:00' in end_str:
                end_str = end_str.replace('.000+00:00', '+00:00')
                
            start_utc = datetime.fromisoformat(start_str)
            end_utc = datetime.fromisoformat(end_str)
            
            # Remove timezone info to match expected format
            start_utc = start_utc.replace(tzinfo=None)
            end_utc = end_utc.replace(tzinfo=None)
            
            # Check if this busy period overlaps with our requested time range
            if check_if_datetime_in_range(start_utc, end_utc, starttime, endtime):
                # Convert to the format expected by the rest of the system
                busy_slot = {
                    "start": {
                        "dateTime": start_utc.isoformat() + "Z",
                        "timeZone": "UTC"
                    },
                    "end": {
                        "dateTime": end_utc.isoformat() + "Z", 
                        "timeZone": "UTC"
                    }
                }
                busy_slots.append(busy_slot)
        except (ValueError, KeyError) as e:
            # Skip invalid busy periods and log the error
            frappe.log_error(f"Error parsing busy period for {member}: {busy_period}. Error: {str(e)}")
            continue

    return busy_slots


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
        last_start = convert_timezone_to_utc(cal_slots[last]["start"]["dateTime"], cal_slots[last]["start"]["timeZone"])
        last_end = convert_timezone_to_utc(cal_slots[last]["end"]["dateTime"], cal_slots[last]["end"]["timeZone"])
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
