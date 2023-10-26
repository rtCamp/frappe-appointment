from frappe.integrations.doctype.google_calendar.google_calendar import (
	GoogleCalendar,
)

class GoogleCalendarOverride(GoogleCalendar):
	"""Google Calendar DocType overwrite"""

	def before_insert(self):
		"""Set the google_calendar_id as the user's email. So, for each user, the primary calendar will be the one used to update, get, and insert events."""
		super().before_insert()
		self.google_calendar_id = self.user
