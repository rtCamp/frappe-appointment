# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import re
from datetime import datetime

import frappe
import frappe.utils
from frappe.model.document import Document
from frappe.utils.data import add_to_date

from frappe_scheduler.constants import APPOINTMENT_TIME_SLOT
from frappe_scheduler.helpers.intervals import find_intersection_interval
from frappe_scheduler.helpers.utils import (
    convert_datetime_to_utc,
    convert_utc_datetime_to_timezone,
    get_weekday,
    update_time_of_datetime,
)

SLUG_REGEX = re.compile(r"^[a-z0-9_]+(?:-[a-z0-9_]+)*$")


class UserAppointmentAvailability(Document):
    def validate(self):
        # validate time slots, so that start time is less than end time, and weekdays are unique
        if self.appointment_time_slot:
            weekdays = []
            for slot in self.appointment_time_slot:
                start_time = datetime.strptime(slot.start_time, "%H:%M:%S")
                end_time = datetime.strptime(slot.end_time, "%H:%M:%S")
                if start_time > end_time:
                    frappe.throw(frappe._("Start time should be less than end time for the day {0}").format(slot.day))
                if slot.day in weekdays:
                    frappe.throw(
                        frappe._("Day {0} is repeated in the time slots. Make sure each day is unique.").format(
                            slot.day
                        )
                    )
                weekdays.append(slot.day)
        calendar = frappe.get_doc("Google Calendar", self.google_calendar)
        if not calendar.custom_is_google_calendar_authorized:
            frappe.throw(frappe._("Please authorize Google Calendar before creating appointment availability."))
        if self.enable_scheduling and not self.slug:
            frappe.throw(frappe._("Please set a slug before enabling scheduling."))
        if self.slug:
            if not SLUG_REGEX.match(self.slug):
                frappe.throw(
                    frappe._(
                        "Slug can only contain lowercase alphanumeric characters, underscores and hyphens, and cannot start or end with a hyphen."
                    )
                )
            if frappe.db.exists("User Appointment Availability", {"slug": self.slug, "name": ["!=", self.name]}):
                frappe.throw(frappe._("Slug already exists. Please set a unique slug."))
        if self.enable_scheduling and self.meeting_provider == "Zoom":
            scheduler_settings = frappe.get_single("Scheduler Settings")
            scheduler_settings_link = frappe.utils.get_link_to_form("Scheduler Settings", None, "Scheduler Settings")
            if not scheduler_settings.enable_zoom:
                return frappe.throw(frappe._(f"Zoom is not enabled. Please enable it from {scheduler_settings_link}."))
            if (
                not scheduler_settings.zoom_client_id
                or not scheduler_settings.get_password("zoom_client_secret")
                or not scheduler_settings.zoom_account_id
            ):
                return frappe.throw(
                    frappe._(f"Please set Zoom Account ID, Client ID and Secret in {scheduler_settings_link}.")
                )
            if not calendar.custom_zoom_user_email:
                google_calendar_link = frappe.utils.get_link_to_form(
                    "Google Calendar", calendar.name, "Google Calendar"
                )
                return frappe.throw(frappe._(f"Please set Zoom User Email in {google_calendar_link}."))


def suggest_slug(og_slug: str):
    for i in range(1, 100):
        slug = f"{og_slug}{i}"
        if not frappe.db.exists("User Appointment Availability", {"slug": slug}):
            return slug
    return None


@frappe.whitelist()
def is_slug_available(slug: str):
    is_available = not frappe.db.exists("User Appointment Availability", {"slug": slug})
    suggested_slug = None
    if not is_available:
        suggested_slug = suggest_slug(slug)
    return {"is_available": is_available, "suggested_slug": suggested_slug}


def get_user_appointment_availability_slots(
    appointment_group: object, utc_start_time: datetime, utc_end_time: datetime
):
    members = appointment_group.members

    member_time_slots = {}

    global_interval = {
        "start_time": utc_start_time,
        "end_time": utc_end_time,
    }

    for member in members:
        if not member.is_mandatory:
            continue

        user_timezone = frappe.get_value("User", member.user, "time_zone")

        current_date = utc_start_time

        while current_date.date() <= utc_end_time.date():
            current_date_time = convert_utc_datetime_to_timezone(current_date, user_timezone)
            weekday = get_weekday(current_date_time)

            appointment_time_slots = frappe.db.get_all(
                APPOINTMENT_TIME_SLOT,
                filters={"parent": member.user, "day": weekday},
                fields="*",
            )

            user_appointment_time_slots_utc = []

            for slot in appointment_time_slots:
                interval = {
                    "start_time": convert_datetime_to_utc(update_time_of_datetime(current_date_time, slot.start_time)),
                    "end_time": convert_datetime_to_utc(
                        update_time_of_datetime(
                            current_date_time,
                            slot.end_time,
                        )
                    ),
                }

                interval = find_intersection_interval(interval, global_interval)

                if interval:
                    user_appointment_time_slots_utc.append(
                        {
                            "start_time": interval[0],
                            "end_time": interval[1],
                            "is_available": True,
                        }
                    )

            if member.user in member_time_slots:
                member_time_slots[member.user] += user_appointment_time_slots_utc
            else:
                member_time_slots[member.user] = user_appointment_time_slots_utc

            current_date = add_to_date(current_date, days=1)

    member_time_slots["tem"] = {
        "start_time": utc_start_time,
        "end_time": utc_end_time,
        "is_available": True,
    }

    return member_time_slots
