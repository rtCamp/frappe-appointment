import frappe
from frappe.integrations.doctype.google_calendar.google_calendar import (
	GoogleCalendar,
	authorize_access,
)
from frappe import _


class GoogleCalendarOverride(GoogleCalendar):
	"""Google Calendar DocType overwrite"""

	def before_insert(self):
		"""Set the google_calendar_id as the user's email. So, for each user, the primary calendar will be the one used to update, get, and insert events."""
		self.google_calendar_id = self.user

	def before_save(self):
		if self.refresh_token:
			self.custom_is_google_calendar_authorized = True
		else:
			self.custom_is_google_calendar_authorized = False


@frappe.whitelist()
def google_callback(code=None):
	"""
	Authorization code is sent to callback as per the API configuration
	"""
	google_calendar = frappe.cache.hget("google_calendar", "google_calendar")
	frappe.db.set_value("Google Calendar", google_calendar, "authorization_code", code)
	frappe.db.commit()

	authorize_access(google_calendar)
 
	refresh_token=frappe.get_value("Google Calendar",google_calendar,"refresh_token")
 
	if refresh_token:
		frappe.db.set_value("Google Calendar", google_calendar, "custom_is_google_calendar_authorized", True)
		frappe.db.commit()