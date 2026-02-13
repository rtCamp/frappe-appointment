import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import (
    GoogleCalendar,
    authorize_access,
)


class GoogleCalendarOverride(GoogleCalendar):
    """Google Calendar DocType overwrite"""

    def before_save(self):
        """Set the google_calendar_id as the user's email. So, for each user, the primary calendar will be the one used to update, get, and insert events."""
        if not self.google_calendar_id:
            self.google_calendar_id = self.user

        if self.refresh_token:
            self.custom_is_google_calendar_authorized = True
        else:
            self.custom_is_google_calendar_authorized = False


@frappe.whitelist()
def google_callback(code: str = None):
    """
    Authorization code is sent to callback as per the API configuration
    """
    google_calendar = frappe.cache.hget("google_calendar", "google_calendar")
    frappe.db.set_value("Google Calendar", google_calendar, "authorization_code", code)

    # nosemgrep
    frappe.db.commit()

    authorize_access(google_calendar)

    refresh_token = frappe.get_value("Google Calendar", google_calendar, "refresh_token")

    if refresh_token:
        frappe.db.set_value("Google Calendar", google_calendar, "custom_is_google_calendar_authorized", True)

    # nosemgrep
    frappe.db.commit()  # Make sure to commit the changes to the database as for some cases it do not update custom_is_google_calendar_authorized
