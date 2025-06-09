import frappe
from frappe import _
from frappe.integrations.doctype.google_calendar.google_calendar import (
    format_date_according_to_google_calendar,
    get_attendees,
    get_conference_data,
    get_google_calendar_object,
    insert_event_in_google_calendar,
    repeat_on_to_google_calendar_recurrence_rule,
)
from frappe.utils import (
    get_datetime,
)
from googleapiclient.errors import HttpError


def update_event_in_google_calendar_override(doc, method=None):
    """
    Updates Events in Google Calendar if any existing event is modified in Frappe Calendar
    """
    # Workaround to avoid triggering updation when Event is being inserted since
    # creation and modified are same when inserting doc
    if (
        not doc.sync_with_google_calendar
        or doc.modified == doc.creation
        or not frappe.db.exists("Google Calendar", {"name": doc.google_calendar})
    ):
        return

    if doc.sync_with_google_calendar and not doc.google_calendar_event_id:
        # If sync_with_google_calendar is checked later, then insert the event rather than updating it.
        insert_event_in_google_calendar(doc)
        return

    google_calendar, account = get_google_calendar_object(doc.google_calendar)

    if not account.push_to_google_calendar:
        return

    try:
        event = (
            google_calendar.events()
            .get(calendarId=doc.google_calendar_id, eventId=doc.google_calendar_event_id)
            .execute()
        )

        event["summary"] = doc.subject
        event["description"] = doc.description
        event["recurrence"] = repeat_on_to_google_calendar_recurrence_rule(doc)
        event["status"] = "cancelled" if doc.status == "Cancelled" or doc.status == "Closed" else event.get("status")
        event.update(
            format_date_according_to_google_calendar(
                doc.all_day, get_datetime(doc.starts_on), get_datetime(doc.ends_on) if doc.ends_on else None
            )
        )

        conference_data_version = 0

        if doc.add_video_conferencing:
            event.update({"conferenceData": get_conference_data(doc)})
            conference_data_version = 1
        elif doc.get_doc_before_save().add_video_conferencing or event.get("hangoutLink"):
            # remove google meet from google calendar event, if turning off add_video_conferencing
            event.update({"conferenceData": None})
            conference_data_version = 1

        event.update({"attendees": get_attendees(doc)})

        if doc.custom_create_free_event:
            event.update({"transparency": "transparent"})
        else:
            event.update({"transparency": "opaque"})

        event = (
            google_calendar.events()
            .update(
                calendarId=doc.google_calendar_id,
                eventId=doc.google_calendar_event_id,
                body=event,
                conferenceDataVersion=conference_data_version,
                sendUpdates="all",
            )
            .execute()
        )

        # if add_video_conferencing enabled or disabled during update, overwrite
        frappe.db.set_value(
            "Event",
            doc.name,
            {"google_meet_link": event.get("hangoutLink")},
            update_modified=False,
        )
        doc.notify_update()

        frappe.msgprint(_("Event Synced with Google Calendar."))
    except HttpError as err:
        frappe.throw(
            _("Google Calendar - Could not update Event {0} in Google Calendar, error code {1}.").format(
                doc.name, err.resp.status
            )
        )


def patch_all():
    # Patch the update_event_in_google_calendar method
    import frappe.integrations.doctype.google_calendar.google_calendar as google_calendar_module

    google_calendar_module.update_event_in_google_calendar = update_event_in_google_calendar_override
    # End patching update_event_in_google_calendar
