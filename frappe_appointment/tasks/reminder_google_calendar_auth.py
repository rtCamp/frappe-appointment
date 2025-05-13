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

        google_calendars = frappe.get_all("Google Calendar", {"enable": 1})

        for google_calendar in google_calendars:
            google_calendar = frappe.get_doc("Google Calendar", google_calendar.name)
            user = frappe.get_doc("User", google_calendar.user)
            if not user.enabled:
                continue
            if google_calendar.user == google_calendar.google_calendar_id:
                if not google_calendar_authorized(google_calendar):
                    frappe.db.set_value(
                        "Google Calendar", google_calendar.name, "custom_is_google_calendar_authorized", False
                    )

                    send_email_template_mail(
                        google_calendar,
                        args={"google_calendar": google_calendar},
                        email_template=GOOGLE_CALENDAR_AUTH_EMAIL_TEMPLATE,
                        recipients=[google_calendar.user],
                    )

            frappe.db.commit()
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
