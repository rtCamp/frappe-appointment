import uuid

import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import get_google_calendar_object
from frappe.utils.data import get_datetime
from ics import Calendar, Event
from ics.grammar.parse import ContentLine

from frappe_appointment.helpers.utils import convert_datetime_to_utc


def get_ics_identity(event):
    """Return the UID, SEQUENCE and, for Google events, the organizer and attendees for the .ics.

    When the event is synced to Google, Google has already emailed its own invite, so the .ics
    reuses Google's iCalUID, sequence, organizer and attendees. Calendar clients then merge the two
    invites into one entry and move it in place on reschedule, instead of showing the meeting twice.
    """
    google_event_id = event.get("google_calendar_event_id")
    if google_event_id and event.get("google_calendar"):
        try:
            google_calendar, _ = get_google_calendar_object(event.google_calendar)
            google_event = (
                google_calendar.events().get(calendarId=event.google_calendar_id, eventId=google_event_id).execute()
            )
            organizer = google_event.get("organizer") or {}
            return frappe._dict(
                uid=google_event.get("iCalUID") or f"{google_event_id}@google.com",
                sequence=google_event.get("sequence", 0),
                organizer=organizer.get("email") and (organizer.get("displayName"), organizer["email"]),
                attendees=[
                    (attendee.get("displayName"), attendee["email"])
                    for attendee in google_event.get("attendees") or []
                    if attendee.get("email")
                ],
            )
        except Exception:
            frappe.log_error(title=f"Could not fetch Google Calendar event for {event.get('name')} .ics")
        # Google's iCalUID for events created through the API is the event id at google.com
        return frappe._dict(uid=f"{google_event_id}@google.com")

    if not event.get("name"):
        return frappe._dict(uid=str(uuid.uuid4()))

    # Not synced to Google: a stable UID per Event, and a sequence that grows with each save
    # (each reschedule), so clients update the earlier entry rather than adding a new one.
    return frappe._dict(
        uid=f"{event.name}@{frappe.local.site}",
        sequence=int(get_datetime(event.modified).timestamp()),
    )


def _mailto_line(name, display_name, email, **params):
    if display_name:
        params["CN"] = [display_name]
    return ContentLine(name=name, params=params, value=f"MAILTO:{email}")


def add_ics_file_in_attachment(event, ics_event_description=None, ics_identity=None):
    # Create a calendar
    calendar_object = Calendar()

    # Create an event
    event_object = Event()
    event_object.name = event.subject

    # Convert strings to datetime objects
    event_object.begin = convert_datetime_to_utc(get_datetime(event.starts_on))
    event_object.end = convert_datetime_to_utc(get_datetime(event.ends_on))

    identity = ics_identity or get_ics_identity(event)
    event_object.uid = identity.uid
    if identity.get("sequence") is not None:
        event_object.extra.append(ContentLine(name="SEQUENCE", value=str(identity.sequence)))
    event_object.description = ics_event_description or event.description

    # Optional opt-out: an Event override can set `hide_ics_organizer = True` (e.g. as a property)
    # to omit the ORGANIZER line, so the recipient does not see the organiser's email. Defaults
    # to keeping it.
    hide_organizer = getattr(event, "hide_ics_organizer", False)

    organizer = identity.get("organizer")
    if not organizer and event.appointment_group and event.appointment_group.event_organizer:
        organizer = frappe.db.get_value("User", event.appointment_group.event_organizer, ["full_name", "email"])
    elif not organizer and event.user_calendar and event.user_calendar.user:
        organizer = frappe.db.get_value("User", event.user_calendar.user, ["full_name", "email"])

    if organizer and not hide_organizer:
        event_object.extra.append(_mailto_line("ORGANIZER", *organizer))

    # Google lists the organiser among the attendees, so hiding the organizer drops them too.
    attendees = [] if hide_organizer else identity.get("attendees") or []
    for display_name, email in attendees:
        event_object.extra.append(_mailto_line("ATTENDEE", display_name, email, RSVP=["TRUE"]))

    # REQUEST makes clients treat the file as an invite (or its update) for the UID above. It needs
    # the same ORGANIZER and ATTENDEEs as the Google invite, so it is only used when Google gave them.
    calendar_object.method = "REQUEST" if organizer and attendees else "PUBLISH"

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
