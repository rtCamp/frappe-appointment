import uuid

import frappe
from frappe.utils.data import get_datetime
from ics import Calendar, Event
from ics.grammar.parse import ContentLine

from frappe_appointment.helpers.utils import convert_datetime_to_utc


def add_ics_file_in_attachment(event):
    # Create a calendar
    calendar_object = Calendar()

    # Create an event
    event_object = Event()
    event_object.name = event.subject

    # Convert strings to datetime objects
    event_object.begin = convert_datetime_to_utc(get_datetime(event.starts_on))
    event_object.end = convert_datetime_to_utc(get_datetime(event.ends_on))

    event_object.uid = str(uuid.uuid4())
    event_object.description = event.description

    if event.appointment_group and event.appointment_group.event_organizer:
        user_name, user_email = frappe.db.get_value(
            "User", event.appointment_group.event_organizer, ["full_name", "email"]
        )
        event_object.extra.append(
            ContentLine(
                name="ORGANIZER",
                params={"CN": [user_name]},
                value=f"MAILTO:{user_email}",
            )
        )
    elif event.user_calendar and event.user_calendar.user:
        user_name, user_email = frappe.db.get_value("User", event.user_calendar.user, ["full_name", "email"])
        event_object.extra.append(
            ContentLine(
                name="ORGANIZER",
                params={"CN": [user_name]},
                value=f"MAILTO:{user_email}",
            )
        )

    calendar_object.events.add(event_object)

    # Convert the calendar to a string
    ics_content = calendar_object.serialize()
    ics_content = ics_content.replace(
        "PRODID:ics.py - http://git.io/lLljaA", "PRODID:-//Frappe Appointment//Frappe Appointments Events//EN"
    )

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
