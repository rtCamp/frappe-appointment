import json

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

from frappe_appointment.helpers import api_urls


def insert_event_in_google_calendar_override(
    doc,
    method=None,
    mute_message=False,
    success_msg=None,
    update_doc=True,
):
    """
    Insert Events in Google Calendar if sync_with_google_calendar is checked.
    """
    if not doc.sync_with_google_calendar or not frappe.db.exists("Google Calendar", {"name": doc.google_calendar}):
        return

    if not success_msg:
        success_msg = _("Event Synced with Google Calendar.")

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

    if doc.appointment_group and doc.custom_meet_link:
        event.update({"location": doc.custom_meet_link})

    event.update({"attendees": get_attendees(doc)})

    conference_data_version = 0

    if doc.custom_meeting_provider == "Google Meet":
        event.update({"conferenceData": get_conference_data(doc)})
        conference_data_version = 1
    elif doc.custom_meeting_provider == "Zoom":
        password = json.loads(doc.custom_meet_data).get("password")
        event.update(
            {
                "conferenceData": {
                    "conferenceSolution": {
                        "key": {"type": "addOn"},
                        "name": "Zoom Meeting",
                        "iconUri": api_urls.ZOOM_ICON_URL,
                    },
                    "entryPoints": [
                        {
                            "entryPointType": "video",
                            "passcode": password,
                            "uri": doc.custom_meet_link,
                        }
                    ],
                }
            }
        )
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

        if update_doc:
            frappe.db.set_value(
                "Event",
                doc.name,
                {
                    "google_calendar_event_id": event.get("id"),
                },
                update_modified=False,
            )

            if doc.custom_meeting_provider == "Google Meet":
                frappe.db.set_value(
                    "Event",
                    doc.name,
                    {
                        "google_meet_link": event.get("hangoutLink"),
                        "custom_meet_link": event.get("hangoutLink"),
                        "custom_meet_data": json.dumps(event.get("conferenceData", {}), indent=4),
                        "description": f"{doc.description or ''}\nMeet Link: {event.get('hangoutLink')}",
                    },
                    update_modified=False,
                )
        else:
            update_dict = {
                "google_calendar_event_id": event.get("id"),
            }
            if doc.custom_meeting_provider == "Google Meet":
                update_dict.update(
                    {
                        "google_meet_link": event.get("hangoutLink"),
                        "custom_meet_link": event.get("hangoutLink"),
                        "custom_meet_data": json.dumps(event.get("conferenceData", {}), indent=4),
                        "description": f"{doc.description or ''}\nMeet Link: {event.get('hangoutLink')}",
                    }
                )

        if not mute_message:
            frappe.msgprint(success_msg)

        if update_doc:
            return event.get("id")
        return event.get("id"), update_dict
    except HttpError as err:
        frappe.throw(
            _("Google Calendar - Could not insert event in Google Calendar {0}, error code {1}.").format(
                account.name, err.resp.status
            )
        )
