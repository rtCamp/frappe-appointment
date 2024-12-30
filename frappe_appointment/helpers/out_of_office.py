import datetime

import frappe
from frappe import _
from frappe.integrations.doctype.google_calendar.google_calendar import (
    format_date_according_to_google_calendar,
    get_google_calendar_object,
)
from frappe.utils.data import add_days, get_datetime


def create_out_of_office_google_calander_event(
    leave_id: str, employee: str, start_date: datetime.date, end_date: datetime.date
):
    """
    Insert Events in Google Calendar if sync_with_google_calendar is checked.
    """
    try:
        google_calendar = get_employee_google_calendar(employee)

        if not google_calendar:
            return

        date_object = format_date_according_to_google_calendar(
            False, get_datetime(start_date), add_days(get_datetime(end_date), 1)
        )

        event = {
            "start": date_object.get("start"),
            "end": date_object.get("end"),
            "eventType": "outOfOffice",  # Note this will only work for organazation email addresses
            "summary": "Out of Office",
        }

        event = google_calendar.events().insert(calendarId="primary", body=event).execute()

        frappe.db.set_value("Leave Application", leave_id, "custom_google_calendar_event_id", event.get("id"))
    except Exception as err:
        frappe.log_error(
            _("Google Calendar - Could not insert event in Google Calendar for leave req: {0}.").format(leave_id),
            message=str(err),
        )


def delete_out_of_office_google_calendar_event(leave_id: str, employee: str, event_id: str):
    """
    Delete Events from Google Calendar if Frappe Event is deleted.
    """

    if not event_id:
        return

    google_calendar = get_employee_google_calendar(employee)

    if not google_calendar:
        return

    try:
        event = google_calendar.events().get(calendarId="primary", eventId=event_id).execute()
        event["recurrence"] = None
        event["status"] = "cancelled"

        google_calendar.events().update(calendarId="primary", eventId=event_id, body=event).execute()
    except Exception as err:
        frappe.log_error(
            _("Google Calendar - Could not delete event in Google Calendar for leave req: {0}.").format(leave_id),
            message=str(err),
        )


def get_employee_google_calendar(employee: str):
    """
    Get Google Calendar for the employee.
    """
    user_email = frappe.db.get_value("Employee", employee, "user_id")

    if not user_email:
        return

    google_calendar = frappe.db.get_value(
        "Google Calendar", {"user": user_email, "google_calendar_id": user_email}, "name"
    )

    if not google_calendar:
        return

    google_calendar, account = get_google_calendar_object(google_calendar)

    if not account.push_to_google_calendar:
        return

    return google_calendar
