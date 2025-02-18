import frappe

GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE = "Google Calendar Authentication Reminder"


def execute():
    try:
        if not frappe.db.exists("Email Template", GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE):
            response = '<h1>Your Google Calendar is not authorized in the system. Please visit the given <a href="/app/google-calendar/{{google_calendar.name}}">link</a> to authorize the calendar.</h1>'

            frappe.get_doc(
                {
                    "doctype": "Email Template",
                    "name": GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE,
                    "response_html": response,
                    "subject": GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE,
                    "use_html": 1,
                    "enabled": 1,
                }
            ).insert(ignore_permissions=True)
        return True
    except Exception:
        return False
