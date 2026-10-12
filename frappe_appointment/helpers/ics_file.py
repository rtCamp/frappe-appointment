import uuid

import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import get_google_calendar_object
from frappe.utils.data import get_datetime
from ics import Calendar, Event
from ics.grammar.parse import ContentLine

from frappe_appointment.helpers.utils import convert_datetime_to_utc


def get_ics_identity(event):
    """Return the (UID, SEQUENCE) pair for the event's .ics.

    When the event is synced to Google, Google has already emailed its own invite, so the .ics
    reuses Google's iCalUID and sequence. Calendar clients then merge the two invites into one
    entry and move it in place on reschedule, instead of showing the meeting twice.
    """
    google_event_id = event.get("google_calendar_event_id")
    if google_event_id and event.get("google_calendar"):
        try:
            google_calendar, _ = get_google_calendar_object(event.google_calendar)
            google_event = (
                google_calendar.events().get(calendarId=event.google_calendar_id, eventId=google_event_id).execute()
            )
            return (
                google_event.get("iCalUID") or f"{google_event_id}@google.com",
                google_event.get("sequence", 0),
            )
        except Exception:
            frappe.log_error(title=f"Could not fetch Google Calendar event for {event.get('name')} .ics")
        # Google's iCalUID for events created through the API is the event id at google.com
        return f"{google_event_id}@google.com", None

    if not event.get("name"):
        return str(uuid.uuid4()), None

    # Not synced to Google: a stable UID per Event, and a sequence that grows with each save
    # (each reschedule), so clients update the earlier entry rather than adding a new one.
    return f"{event.name}@{frappe.local.site}", int(get_datetime(event.modified).timestamp())


def add_ics_file_in_attachment(event, ics_event_description=None, ics_identity=None):
    # Create a calendar
    calendar_object = Calendar()

    # Create an event
    event_object = Event()
    event_object.name = event.subject

    # Convert strings to datetime objects
    event_object.begin = convert_datetime_to_utc(get_datetime(event.starts_on))
    event_object.end = convert_datetime_to_utc(get_datetime(event.ends_on))

    uid, sequence = ics_identity or get_ics_identity(event)
    event_object.uid = uid
    if sequence is not None:
        event_object.extra.append(ContentLine(name="SEQUENCE", value=str(sequence)))
    event_object.description = ics_event_description or event.description

    # Optional opt-out: an Event override can set `hide_ics_organizer = True` (e.g. as a property)
    # to omit the ORGANIZER line, so the recipient does not see the organiser's email. Defaults
    # to keeping it.
    hide_organizer = getattr(event, "hide_ics_organizer", False)

    if not hide_organizer and event.appointment_group and event.appointment_group.event_organizer:
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
    elif not hide_organizer and event.user_calendar and event.user_calendar.user:
        user_name, user_email = frappe.db.get_value("User", event.user_calendar.user, ["full_name", "email"])
        event_object.extra.append(
            ContentLine(
                name="ORGANIZER",
                params={"CN": [user_name]},
                value=f"MAILTO:{user_email}",
            )
        )

    # REQUEST makes clients treat the file as an invite for the UID above, which needs an ORGANIZER.
    has_organizer = any(line.name == "ORGANIZER" for line in event_object.extra)
    calendar_object.method = "REQUEST" if has_organizer else "PUBLISH"

    calendar_object.events.add(event_object)

    # Convert the calendar to a string
    ics_content = calendar_object.serialize()
    ics_content = ics_content.replace(
        "PRODID:ics.py - http://git.io/lLljaA", "PRODID:-//Frappe Appointment//Frappe Appointment Events//EN"
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
