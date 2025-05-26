# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import datetime
from urllib.parse import quote_plus

import frappe
import frappe.utils
from frappe.model.document import Document
from frappe.utils import (
    add_days,
    add_to_date,
    format_time,
    get_datetime,
    get_datetime_str,
    get_time_str,
)

from frappe_appointment.constants import APPOINTMENT_GROUP, APPOINTMENT_TIME_SLOT
from frappe_appointment.frappe_appointment.doctype.appointment_time_slot.appointment_time_slot import (
    GoogleBadRequest,
    get_all_unavailable_google_calendar_slots_for_day,
)
from frappe_appointment.helpers.utils import (
    convert_timezone_to_utc,
    get_utc_datatime_with_time,
    get_weekday,
    utc_to_given_time_zone,
)

ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class AppointmentGroup(Document):
    def autoname(self):
        self.name = frappe.scrub(self.group_name).replace("_", "-")

    def validate_zoom(self):
        if self.meet_provider == "Zoom":
            appointment_settings = frappe.get_single("Appointment Settings")
            appointment_settings_link = frappe.utils.get_link_to_form(
                "Appointment Settings", None, "Appointment Settings"
            )
            if not appointment_settings.enable_zoom:
                return frappe.throw(
                    frappe._(f"Zoom is not enabled. Please enable it from {appointment_settings_link}.")
                )
            if (
                not appointment_settings.zoom_client_id
                or not appointment_settings.get_password("zoom_client_secret")
                or not appointment_settings.zoom_account_id
            ):
                return frappe.throw(
                    frappe._(f"Please set Zoom Account ID, Client ID and Secret in {appointment_settings_link}.")
                )
            g_calendar = frappe.get_doc("Google Calendar", self.event_creator, "Google Calendar")
            if not g_calendar.custom_zoom_user_email:
                g_calendar_link = frappe.utils.get_link_to_form("Google Calendar", self.event_creator)
                return frappe.throw(frappe._(f"Please set Zoom User Email in {g_calendar_link}."))

    def validate(self):
        self.validate_zoom()
        self.validate_members_list()

    def validate_members_list(self):
        is_valid_list = [member for member in self.members if member.is_mandatory]
        if not is_valid_list or len(is_valid_list) == 0:
            return frappe.throw(frappe._("Please add at least one mandatory member to the appointment group."))


def _get_time_slots_for_day(
    appointment_group: object, date: str, user_timezone_offset: str, time_slot_cache_dict: dict = None
) -> object:
    try:
        datetime_today = get_datetime(date)
        datetime_tomorrow = add_days(datetime_today, 1)
        datetime_yesterday = add_days(datetime_today, -1)

        all_time_slots_global_object = {}

        if int(user_timezone_offset) > 0:
            all_time_slots_global_object = {
                "yesterday": get_time_slots_for_given_date(appointment_group, datetime_yesterday, time_slot_cache_dict),
                "today": get_time_slots_for_given_date(appointment_group, datetime_today, time_slot_cache_dict),
            }
        else:
            all_time_slots_global_object = {
                "today": get_time_slots_for_given_date(appointment_group, datetime_today, time_slot_cache_dict),
                "tomorrow": get_time_slots_for_given_date(appointment_group, datetime_tomorrow, time_slot_cache_dict),
            }

        user_time_slots = get_user_time_slots(all_time_slots_global_object, date, user_timezone_offset)

        time_slots_today_object = all_time_slots_global_object["today"]

        current_time = utc_to_given_time_zone(datetime.datetime.now(), user_timezone_offset)

        filtered_slots = []

        for slot in user_time_slots:
            start_time = utc_to_given_time_zone(slot["start_time"], user_timezone_offset)
            end_time = utc_to_given_time_zone(slot["end_time"], user_timezone_offset)

            if current_time.date() == end_time.date() and (start_time < current_time and end_time < current_time):
                continue

            filtered_slots.append(slot)

        time_slots_today_object["all_available_slots_for_data"] = filtered_slots
        time_slots_today_object["total_slots_for_day"] = len(filtered_slots)

        return time_slots_today_object
    except GoogleBadRequest as e:
        frappe.log_error(e)
        frappe.throw(frappe._("Something went wrong while fetching time slots. Please try again later."))
    except Exception:
        frappe.log_error()
        return None


def get_user_time_slots(all_time_slots_global_object: list, date: str, user_timezone_offset: str):
    list_all_available_slots_for_data = []

    today = int(date.split("-")[2])

    for day in all_time_slots_global_object:
        day_slots_object = all_time_slots_global_object[day]
        all_available_slots_for_data = day_slots_object["all_available_slots_for_data"]

        for time_slot in all_available_slots_for_data:
            user_timezone_start_time_slot = utc_to_given_time_zone(time_slot["start_time"], user_timezone_offset)
            if user_timezone_start_time_slot.day == today:
                list_all_available_slots_for_data.append(time_slot)

    return list_all_available_slots_for_data


def is_valid_time_slots(
    appointment_group: object,
    date: str,
    user_timezone_offset: str,
    start_time: str,
    end_time: str,
):
    today_time_slots = _get_time_slots_for_day(appointment_group, date, user_timezone_offset)

    if not today_time_slots:
        return False

    all_available_slots_for_data = today_time_slots["all_available_slots_for_data"]

    start_time = datetime.datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S%z")
    end_time = datetime.datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S%z")

    for time_slot in all_available_slots_for_data:
        if time_slot["start_time"] == start_time and time_slot["end_time"] == end_time:
            return True

    return False


def hours_to_time_slot(start_time, user_timezone_offset, current_time=None) -> int:
    """
    Returns the number of hours between current time and the given start time.

    Args:
        start_time (str): Start time in the format "YYYY-MM-DD HH:MM:SS"
        user_timezone_offset (str): User's timezone offset
        current_time (str, optional): Current time in the format "YYYY-MM-DD HH:MM:SS". Defaults to None. If None, current time will be used.

    Returns:
        int: Number of hours between current time and the given start time
    """
    start_time = datetime.datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S%z")
    current_time = utc_to_given_time_zone(current_time or datetime.datetime.now(), user_timezone_offset)

    return int((start_time - current_time).total_seconds() / 3600)


def get_time_slots_for_given_date(appointment_group: object, datetime: datetime, time_slot_cache_dict=None):
    if time_slot_cache_dict is not None:
        if datetime in time_slot_cache_dict:
            return time_slot_cache_dict[datetime]
    data = _get_time_slots_for_given_date(appointment_group, datetime)
    if time_slot_cache_dict is not None:
        time_slot_cache_dict[datetime] = data
    return data


def _get_time_slots_for_given_date(appointment_group: object, datetime: datetime):
    date = datetime.date()
    weekday = get_weekday(datetime)

    date_validation_obj = vaild_date(datetime, appointment_group)

    weekend_availability = check_availability(date_validation_obj, weekday, appointment_group)

    date_validation_obj["available_days"] = weekend_availability["available_days"]

    if is_member_on_leave_or_is_holiday(appointment_group, date):
        return get_response_body(
            avaiable_time_slot_for_day=[],
            appointment_group=appointment_group,
            date=date,
            date_validation_obj=date_validation_obj,
            is_invalid_date=weekend_availability["is_invalid_date"],
        )

    if weekend_availability["is_invalid_date"]:
        return get_response_body(
            avaiable_time_slot_for_day=[],
            appointment_group=appointment_group,
            date=date,
            date_validation_obj=weekend_availability["date_validation_obj"],
            is_invalid_date=True,
        )

    booking_frequency_reached_obj = get_booking_frequency_reached(datetime, appointment_group)

    if not booking_frequency_reached_obj["is_slots_available"]:
        return get_response_body(
            avaiable_time_slot_for_day=[],
            appointment_group=appointment_group,
            date=date,
            date_validation_obj=date_validation_obj,
        )

    members = appointment_group.members

    member_time_slots = {}
    max_start_time, min_end_time = "00:00:00", "24:00:00"

    for member in members:
        if not member.is_mandatory:
            continue

        appointment_time_slots = frappe.db.get_all(
            APPOINTMENT_TIME_SLOT,
            filters={"parent": member.user, "day": weekday},
            fields="*",
        )

        max_start_time, min_end_time = get_max_min_time_slot(appointment_time_slots, max_start_time, min_end_time)

        member_time_slots[member.user] = appointment_time_slots

    starttime = get_utc_datatime_with_time(date, max_start_time)
    endtime = get_utc_datatime_with_time(date, min_end_time)

    all_slots = get_all_unavailable_google_calendar_slots_for_day(
        member_time_slots, starttime, endtime, date, appointment_group
    )

    if not all_slots and all_slots != []:
        return get_response_body(
            avaiable_time_slot_for_day=[],
            appointment_group=appointment_group,
            date=date,
            date_validation_obj=date_validation_obj,
        )

    all_slots = update_cal_slots_with_events(all_slots, booking_frequency_reached_obj["events"])

    avaiable_time_slot_for_day = get_avaiable_time_slot_for_day(all_slots, starttime, endtime, appointment_group)

    return get_response_body(
        avaiable_time_slot_for_day=avaiable_time_slot_for_day,
        appointment_group=appointment_group,
        starttime=starttime,
        endtime=endtime,
        date=date,
        date_validation_obj=date_validation_obj,
    )


def check_availability(date_validation_obj: object, weekday: str, appointment_group: object) -> object:
    """
    Check if data is valid based on weekdays in user availability.

    Args:
    date_validation_obj (object): Date Object
    appointment_group (object): Appointment Group

    Returns:
    Object: Object with a valid start date
    """
    res = {
        "is_invalid_date": not date_validation_obj["is_valid"],
        "date_validation_obj": date_validation_obj,
    }

    mandatory_members = [member for member in appointment_group.members if member.is_mandatory]
    available_days = set(ALL_DAYS)

    for member in mandatory_members:
        availability = frappe.get_doc("User Appointment Availability", member.user)
        user_available_days = [day.day for day in availability.appointment_time_slot]
        available_days = available_days.intersection(set(user_available_days))

    res["available_days"] = available_days

    if not date_validation_obj["is_valid"]:
        return res

    if not available_days:
        res["is_slots_available"] = False
        res["is_invalid_date"] = True
        return res

    if weekday not in available_days:
        res["is_invalid_date"] = True
        next_available_day = get_next_available_day(weekday, available_days)
        prev_available_day = get_previous_available_day(weekday, available_days)
        if not next_available_day:
            res["is_slots_available"] = False
            return res
        next_available_date = add_days(date_validation_obj["next_valid_date"], next_available_day)
        if date_validation_obj["valid_end_date"] and next_available_date > date_validation_obj["valid_end_date"]:
            next_available_date = date_validation_obj["valid_end_date"]
        prev_available_date = add_days(date_validation_obj["prev_valid_date"], -prev_available_day)
        if prev_available_date < date_validation_obj["valid_start_date"]:
            prev_available_date = date_validation_obj["valid_start_date"]
        date_validation_obj["next_valid_date"] = next_available_date
        date_validation_obj["prev_valid_date"] = prev_available_date

    return res


def get_next_available_day(weekday: str, available_days: list) -> datetime:
    """
    Get the next available day from the given day.

    Args:
    weekday (str): Weekday
    available_days (list): List of available days

    Returns:
    int: Number of days to the next available day
    """
    days = ALL_DAYS
    current_day = days.index(weekday)

    for i in range(1, 7):
        next_day = days[(current_day + i) % 7]
        if next_day in available_days:
            return i

    return None


def get_previous_available_day(weekday: str, available_days: list) -> datetime:
    """
    Get the previous available day from the given day.

    Args:
    weekday (str): Weekday
    available_days (list): List of available days

    Returns:
    int: Number of days to the previous available day
    """
    days = ALL_DAYS
    current_day = days.index(weekday)

    for i in range(1, 7):
        previous_day = days[(current_day - i) % 7]
        if previous_day in available_days:
            return i

    return None


def get_response_body(
    avaiable_time_slot_for_day: list,
    appointment_group: object,
    starttime: datetime = None,
    endtime: datetime = None,
    date: datetime = None,
    date_validation_obj: object = None,
    is_invalid_date: bool = False,
):
    """
        Generate the API Response object for the API endpoint: get_time_slots_for_day

        Args:
    available_time_slots_for_day (list): List of available time slots for the user
    appointment_group (object): Appointment Group ID
    starttime (datetime, optional): Start Time for Events. Defaults to None.
    endtime (datetime, optional): End Time for Events. Defaults to None.
    date (datetime, optional): Date for which slots are fetched. Defaults to None.
    date_validation_obj (object, optional): Date validation object. Defaults to None.
    is_invalid_date (bool, optional): Is the given date invalid or not. Defaults to False.

        Returns:
        Object: API Response object
    """
    if not date_validation_obj:
        date_validation_obj = {"valid_start_date": None, "valid_end_date": None}

    return {
        "all_available_slots_for_data": avaiable_time_slot_for_day,
        "date": date,
        "duration": appointment_group.duration_for_event,
        "appointment_group_id": appointment_group.name,
        "starttime": starttime,
        "endtime": endtime,
        "total_slots_for_day": len(avaiable_time_slot_for_day),
        "valid_start_date": date_validation_obj["valid_start_date"],
        "valid_end_date": date_validation_obj["valid_end_date"],
        "next_valid_date": date_validation_obj["next_valid_date"],
        "prev_valid_date": date_validation_obj["prev_valid_date"],
        "available_days": date_validation_obj["available_days"] if "available_days" in date_validation_obj else [],
        "is_invalid_date": is_invalid_date,
    }


def get_booking_frequency_reached(datetime: datetime, appointment_group: object) -> bool:
    """
        Get a list of booked events from Frappe for a given date and Appointment Group.

        Args:
    datetime (datetime): Datetime object of the time for which events need to be fetched.
    appointment_group (object): Appointment Group

        Returns:
        Object: List of events
    """
    res = {
        "is_slots_available": int(appointment_group.limit_booking_frequency) < 0,
        "events": [],
    }

    # Get today's data and the range for the next day to fetch events.
    start_datetime, end_datetime = get_datetime_str(datetime), get_datetime_str(add_days(datetime, 1))

    if appointment_group.get("is_personal_meeting", False):
        all_events = frappe.get_list(
            "Event",
            filters=[
                ["custom_appointment_slot_duration", "=", appointment_group.duration_id],
                ["starts_on", ">=", start_datetime],
                ["starts_on", "<", end_datetime],
                ["ends_on", ">=", start_datetime],
                ["ends_on", "<", end_datetime],
            ],
            fields=["starts_on", "ends_on", "google_calendar_event_id"],
            order_by="starts_on asc",
            ignore_permissions=True,
        )
    elif appointment_group.name:
        all_events = frappe.get_list(
            "Event",
            filters=[
                ["custom_appointment_group", "=", appointment_group.name],
                ["starts_on", ">=", start_datetime],
                ["starts_on", "<", end_datetime],
                ["ends_on", ">=", start_datetime],
                ["ends_on", "<", end_datetime],
            ],
            fields=["starts_on", "ends_on", "google_calendar_event_id"],
            order_by="starts_on asc",
            ignore_permissions=True,
        )
    else:
        return res

    all_events = sorted(
        all_events,
        key=lambda slot: get_datetime_str(slot["ends_on"]),
    )

    if int(appointment_group.limit_booking_frequency) >= 0:
        res["is_slots_available"] = len(all_events) < int(appointment_group.limit_booking_frequency)

    res["events"] = all_events

    return res


def vaild_date(date: datetime, appointment_group: object) -> object:
    """
        Check if the given date is valid or not and return an object with valid start and end dates.

        Args:
    date (datetime): Date
    appointment_group (object): Appointment Group

        Returns:
        Object: Object that holds data for valid start and end dates
    """
    current_date = get_datetime(datetime.datetime.utcnow().date())

    start_date = add_days(current_date, int(appointment_group.minimum_notice_before_event))
    end_date = ""

    # Add the days == event_availability_window into start_date date
    if int(appointment_group.event_availability_window) > 0:
        end_date = add_days(start_date, int(appointment_group.event_availability_window) - 1)

    if start_date > date:
        return {
            "is_valid": False,
            "valid_start_date": start_date,
            "valid_end_date": end_date,
            "next_valid_date": start_date,
            "prev_valid_date": start_date,
        }

    if int(appointment_group.event_availability_window) > 0 and end_date < date:
        return {
            "is_valid": False,
            "valid_start_date": start_date,
            "valid_end_date": end_date,
            "next_valid_date": end_date,
            "prev_valid_date": start_date,
        }

    return {
        "is_valid": True,
        "valid_start_date": start_date,
        "valid_end_date": end_date,
        "next_valid_date": date,
        "prev_valid_date": date,
    }


def update_cal_slots_with_events(all_slots: list, all_events: list) -> list:
    """
        Function to take all Frappe events and all Google Calendar available time slots and create a new list where each slot has updated `starts_on` and `ends_on` fields.

        Args:
    all_slots (list): List of all Google slots available
    all_events (list): List of all Frappe Events

        Returns:
        List: List of all slots with the updated `starts_on` and `ends_on` fields
    """
    update_slots = []
    for currernt_slot in all_slots:
        updated_slot = {}
        updated_slot["starts_on"] = convert_timezone_to_utc(
            currernt_slot["start"]["dateTime"], currernt_slot["start"]["timeZone"]
        )
        updated_slot["ends_on"] = convert_timezone_to_utc(
            currernt_slot["end"]["dateTime"], currernt_slot["end"]["timeZone"]
        )

        update_slots.append(updated_slot)

    return update_slots


def get_avaiable_time_slot_for_day(
    all_slots: list, starttime: datetime, endtime: datetime, appointment_group: object
) -> list:
    """Generate time available time slots for a given date based on Google slots within the range [starttime, endtime].

    Args:
    all_slots (list): All Google slots
    starttime (datetime): Start time from which slots should be generated
    endtime (datetime): End time until which slots should be generated
    appointment_group (object): Appointment Group

    Returns:
    list: List of available slots
    """
    available_slots = []

    index = 0

    minimum_buffer_time = appointment_group.minimum_buffer_time

    # Start time of event
    current_start_time = get_next_round_value(minimum_buffer_time, starttime, False)

    minute, second = divmod(appointment_group.duration_for_event, 60)
    hour, minute = divmod(minute, 60)

    current_end_time = add_to_date(current_start_time, hours=hour, minutes=minute, seconds=second)

    # This will make sure that slots will be genrate even though we reach at end of all_slots
    while current_end_time <= endtime:
        if index >= len(all_slots) and current_end_time <= endtime:
            available_slots.append({"start_time": current_start_time, "end_time": current_end_time})

            current_start_time = get_next_round_value(minimum_buffer_time, current_end_time, False)
            current_end_time = add_to_date(current_start_time, hours=hour, minutes=minute, seconds=second)

            continue

        currernt_slot = all_slots[index]
        currernt_slot_start_time = currernt_slot["starts_on"]
        currernt_slot_end_time = currernt_slot["ends_on"]

        if current_end_time <= currernt_slot_start_time and is_valid_buffer_time(
            minimum_buffer_time,
            current_end_time,
            currernt_slot_start_time,
            True,
        ):
            available_slots.append({"start_time": current_start_time, "end_time": current_end_time})
            current_start_time = get_next_round_value(minimum_buffer_time, current_end_time, False)
        else:
            current_start_time = get_next_round_value(
                minimum_buffer_time,
                currernt_slot_end_time,
                True,
            )
            index += 1

        current_end_time = add_to_date(current_start_time, hours=hour, minutes=minute, seconds=second)

    return available_slots


def is_valid_buffer_time(
    minimum_buffer_time: int,
    end: datetime,
    next_start: datetime,
    is_add_buffer_in_event: bool = True,
):
    """Check if the time difference between the next time slot and the current time slot meets the minimum_buffer_time requirement.

    Args:
    minimum_buffer_time (datetime): Minimum buffer time to maintain
    end (datetime): End time of the current time slot
    next_start (datetime): Start time of the next time slot
    is_add_buffer_in_event (bool, optional): Whether to add buffer time in the current slot. Defaults to True.

    Returns:
    bool: True if the buffer time is maintained, False otherwise
    """
    if not minimum_buffer_time or not is_add_buffer_in_event:
        return True

    return minimum_buffer_time <= (next_start - end).seconds


def get_next_round_value(
    minimum_buffer_time: int,
    current_end_time: datetime,
    is_add_buffer_in_event: bool = True,
):
    """Generate the next possible start time for an event as per the buffer time value.

    Args:
    minimum_buffer_time (datetime): Minimum buffer time to maintain
    current_end_time (datetime): Start time of the current slot
    is_add_buffer_in_event (bool, optional): Whether to add buffer time in the current slot. Defaults to True.

    Returns:
    Datetime: Next slot possible start time
    """
    if not minimum_buffer_time or not is_add_buffer_in_event:
        return current_end_time

    minute, second = divmod(minimum_buffer_time, 60)
    hour, minute = divmod(minute, 60)

    min_start_time = add_to_date(current_end_time, hours=hour, minutes=minute, seconds=second)

    return min_start_time


def get_max_min_time_slot(appointmen_time_slots: list, max_start_time: str, min_end_time: str) -> list:
    """Select the maximum between the given start time and appointment_time_slots start time, and the minimum between the given end time and appointment_time_slots end time.

    Args:
    appointment_time_slots (list): Appointment time slots
    max_start_time (str): Max start time
    min_end_time (str): Min end time

    Returns:
    list: Updated list of start time and min end time
    """

    for appointmen_time_slot in appointmen_time_slots:
        max_start_time = max(max_start_time, format_time(get_time_str(appointmen_time_slot.start_time)))
        min_end_time = min(min_end_time, format_time(get_time_str(appointmen_time_slot.end_time)))

    return [max_start_time, min_end_time]


def is_member_on_leave_or_is_holiday(appointment_group, date):
    """
    Check if the given date is marked as invalid due to user leaves or holiday of mandatory members.

    Args:
    appointment_group (object): Appointment group containing members
    date (datetime): Date to check

    Returns:
    bool: True if the date is invalid due to mandatory member leaves or holiday, False otherwise
    """

    # check if erpnext and hrms are installed or not
    installed_apps = frappe.get_installed_apps()
    if "erpnext" not in installed_apps:
        return False
    if "hrms" not in installed_apps:
        return False

    date_str = date.strftime("%Y-%m-%d")

    for member in appointment_group.members:
        if member.is_mandatory:  # Only check for mandatory members
            employee = frappe.get_all(
                "Employee", filters={"company_email": member.user}, fields=["name", "holiday_list"]
            )
            if not employee:
                return False  # If we don't have the employee, we can't check for leaves or holidays

            leaves = frappe.get_all(
                "Leave Application",
                filters={
                    "employee": employee[0].name,
                    "from_date": ["<=", date_str],
                    "to_date": [">=", date_str],
                    "status": "Approved",
                },
            )

            if leaves:
                return True

            if employee and employee[0].holiday_list:
                holidays = frappe.get_doc("Holiday List", employee[0].holiday_list)
                for holiday in holidays.holidays:
                    if holiday.holiday_date.strftime("%Y-%m-%d") == date_str:
                        return True

    return False


@frappe.whitelist()
def get_appointment_groups_from_doctype(doctype: str) -> str:
    """Get the appointment group for a given doctype, based on the linked_doctype field.

    Args:
    doctype (str): Doctype name

    Returns:
    str: Appointment Group ID
    """
    try:
        appointment_groups = frappe.get_all(
            APPOINTMENT_GROUP,
            filters={"linked_doctype": doctype},
            fields=["name"],
        )
    except frappe.DoesNotExistError:
        return None

    return [
        {
            "name": appointment_group.name,
            "route": frappe.utils.get_url(f"/schedule/gr/{quote_plus(appointment_group.name)}", full_address=True),
        }
        for appointment_group in appointment_groups
    ]


@frappe.whitelist()
def get_appointment_group_from_id(appointment_group_id: str) -> object:
    """Get the appointment group for a given ID.

    Args:
    appointment_group_id (str): Appointment Group ID

    Returns:
    object: Appointment Group
    """
    try:
        appointment_group = frappe.get_doc(APPOINTMENT_GROUP, appointment_group_id)
    except frappe.DoesNotExistError:
        return None

    return {
        "name": appointment_group.name,
        "route": frappe.utils.get_url(f"/schedule/gr/{quote_plus(appointment_group.name)}", full_address=True),
    }
