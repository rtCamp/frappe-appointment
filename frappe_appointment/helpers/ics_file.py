import uuid

import frappe
from frappe.utils.data import get_datetime

from frappe_appointment.helpers.utils import convert_datetime_to_utc


def escape_ics_text(value):
    if not value:
        return ""

    value = str(value).replace("\\", "\\\\")
    value = value.replace("\r\n", "\\n").replace("\n", "\\n").replace("\r", "\\n")
    value = value.replace(",", "\\,").replace(";", "\\;")

    return value


def format_ics_datetime(value):
    return value.strftime("%Y%m%dT%H%M%SZ")


def add_ics_file_in_attachment(event, ics_event_description=None):
    event_uid = str(uuid.uuid4())
    event_subject = escape_ics_text(event.subject)
    event_description = escape_ics_text(ics_event_description or event.description)
    event_start = format_ics_datetime(convert_datetime_to_utc(get_datetime(event.starts_on)))
    event_end = format_ics_datetime(convert_datetime_to_utc(get_datetime(event.ends_on)))

    organizer = None
    if event.appointment_group and event.appointment_group.event_organizer:
        user_name, user_email = frappe.db.get_value(
            "User", event.appointment_group.event_organizer, ["full_name", "email"]
        )
        organizer = f"ORGANIZER;CN={escape_ics_text(user_name)}:MAILTO:{user_email}"
    elif event.user_calendar and event.user_calendar.user:
        user_name, user_email = frappe.db.get_value("User", event.user_calendar.user, ["full_name", "email"])
        organizer = f"ORGANIZER;CN={escape_ics_text(user_name)}:MAILTO:{user_email}"

    ics_lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Frappe Appointment//Frappe Appointment Events//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{event_uid}",
        f"DTSTAMP:{event_start}",
        f"DTSTART:{event_start}",
        f"DTEND:{event_end}",
        f"SUMMARY:{event_subject}",
        f"DESCRIPTION:{event_description}",
    ]
    if organizer:
        ics_lines.append(organizer)
    ics_lines.extend(["END:VEVENT", "END:VCALENDAR"])
    ics_content = "\r\n".join(ics_lines) + "\r\n"

    attached_file = frappe.get_doc(
        {
            "doctype": "File",
            "file_name": "invite.ics",
            "attached_to_name": "",
            "attached_to_doctype": "",
            "content": ics_content,
            "is_private": 1,
        }
    )

    attached_file.save(ignore_permissions=True)

    return attached_file.name
