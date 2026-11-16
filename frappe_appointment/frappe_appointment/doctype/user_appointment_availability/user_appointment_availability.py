# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import re
from datetime import datetime

import frappe
import frappe.utils
from frappe.model.document import Document

from frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings import (
    validate_email_template_choice,
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
        validate_email_template_choice(self, "response_email_template", "personal")
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
