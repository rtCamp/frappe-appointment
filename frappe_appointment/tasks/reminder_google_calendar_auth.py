import frappe

from frappe_appointment.helpers.email import send_email_template_mail
from frappe_appointment.patches.v0_1.reminder_google_calendar_auth_email_template import (
    GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE,
)
from frappe_appointment.patches.v0_1.reminder_google_calendar_auth_email_template import (
    execute as setup_reminder_template,
)


def send_reminder_mail():
    try:
        if not setup_reminder_template():
            return

        # Fetch calendars with needed fields to avoid N+1 queries
        google_calendars = frappe.get_all(
            "Google Calendar",
            filters={"enable": 1},
            fields=["name", "user", "google_calendar_id", "custom_is_google_calendar_authorized"],
        )

        if not google_calendars:
            return

        # Batch fetch user enabled status to avoid N+1 queries
        user_ids = list(set(gc.user for gc in google_calendars))
        users = frappe.get_all("User", filters={"name": ["in", user_ids]}, fields=["name", "enabled"])
        enabled_users = {u.name for u in users if u.enabled}

        calendars_needing_reminder = []

        for gc in google_calendars:
            # Skip if user is disabled
            if gc.user not in enabled_users:
                continue

            # Only check personal calendars (user == google_calendar_id)
            if gc.user != gc.google_calendar_id:
                continue

            # Need full doc only for authorization check
            full_gc = frappe.get_doc("Google Calendar", gc.name)
            if not google_calendar_authorized(full_gc):
                frappe.db.set_value(
                    "Google Calendar", gc.name, "custom_is_google_calendar_authorized", False
                )
                calendars_needing_reminder.append(full_gc)

        # Send all emails and commit once
        for gc in calendars_needing_reminder:
            send_email_template_mail(
                gc,
                args={"google_calendar": gc},
                email_template=GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE,
                recipients=[gc.user],
            )

        frappe.db.commit()  # Single commit at the end

    except Exception:
        frappe.log_error(title="send_reminder_google_calendar_auth_mail_failed", message=frappe.get_traceback())


def google_calendar_authorized(google_calendar: object):
    if not google_calendar.custom_is_google_calendar_authorized:
        return False

    try:
        # The given function will throw error in case refresh_toke is invalid
        token = google_calendar.get_access_token()
        if not token or token is None:
            return False
        return True
    except Exception:
        return False
