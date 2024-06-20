import uuid

import frappe
import pytz
from frappe.utils.data import get_datetime, getdate
from ics import Calendar, Event
from ics.grammar.parse import ContentLine

from frappe_appointment.helpers.utils import convert_datetime_to_utc


def add_ics_file_in_attachment(event):
    # Create a calendar
    c = Calendar()

    # Create an event
    e = Event()
    e.name = event.subject

    # Convert strings to datetime objects
    e.begin = convert_datetime_to_utc(get_datetime(event.starts_on))
    e.end = convert_datetime_to_utc(get_datetime(event.ends_on))
    e.uid = str(uuid.uuid4())
    e.description = event.description

    if event.appointment_group.event_organizer:
        user_name, user_email = frappe.db.get_value(
            "User", event.appointment_group.event_organizer, ["full_name", "email"]
        )
        e.extra.append(
            ContentLine(
                name="ORGANIZER",
                params={"CN": [user_name]},
                value=f"MAILTO:{user_email}",
            )
        )

    c.events.add(e)

    # Convert the calendar to a string
    ics_content = c.serialize()
    ics_content = ics_content.replace(
        "PRODID:ics.py - http://git.io/lLljaA",
        "PRODID:-//Frappe Appointment//Frappe Appointments Events//EN",
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
