import frappe
from frappe import _
from frappe.integrations.doctype.google_calendar.google_calendar import (
    format_date_according_to_google_calendar,
    get_attendees,
    get_conference_data,
    get_google_calendar_object,
    repeat_on_to_google_calendar_recurrence_rule,
)
from frappe.utils.data import get_datetime
from googleapiclient.errors import HttpError


def insert_event_in_google_calendar_override(doc, method=None):
    """
    Insert Events in Google Calendar if sync_with_google_calendar is checked.
    """
    if not doc.sync_with_google_calendar or not frappe.db.exists(
        "Google Calendar", {"name": doc.google_calendar}
    ):
        return

    google_calendar, account = get_google_calendar_object(doc.google_calendar)

    if not account.push_to_google_calendar:
        return

    event = {
        "summary": doc.subject,
        "description": doc.description,
        "google_calendar_event": 1,
    }
    event.update(
        format_date_according_to_google_calendar(
            doc.all_day,
            get_datetime(doc.starts_on),
            get_datetime(doc.ends_on) if doc.ends_on else None,
        )
    )

    if doc.repeat_on:
        event.update({"recurrence": repeat_on_to_google_calendar_recurrence_rule(doc)})

    if doc.appointment_group and doc.appointment_group.meet_link:
        event.update({"location": doc.appointment_group.meet_link})

    if doc.appointment_group:
        event.update(
            {
                "reminders": {
                    "useDefault": False,
                    "overrides": [
                        {"method": "email", "minutes": 10},
                        {"method": "email", "minutes": 60},
                        {"method": "email", "minutes": 120},
                        {"method": "email", "minutes": 720},
                    ],
                }
            }
        )

    event.update({"attendees": get_attendees(doc)})

    conference_data_version = 0

    if doc.add_video_conferencing:
        event.update({"conferenceData": get_conference_data(doc)})
        conference_data_version = 1

    try:
        event = (
            google_calendar.events()
            .insert(
                calendarId=doc.google_calendar_id,
                body=event,
                conferenceDataVersion=conference_data_version,
                sendUpdates="all",
            )
            .execute()
        )

        frappe.db.set_value(
            "Event",
            doc.name,
            {
                "google_calendar_event_id": event.get("id"),
                "google_meet_link": event.get("hangoutLink"),
            },
            update_modified=False,
        )

        frappe.msgprint(_("Event Synced with Google Calendar."))
    except HttpError as err:
        frappe.throw(
            _(
                "Google Calendar - Could not insert event in Google Calendar {0}, error code {1}."
            ).format(account.name, err.resp.status)
        )
