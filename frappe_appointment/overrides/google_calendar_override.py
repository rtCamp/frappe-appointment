from frappe.integrations.doctype.google_calendar.google_calendar import (
	GoogleCalendar,
)


class GoogleCalendarOverride(GoogleCalendar):
	def before_insert(self):
		self.google_calendar_id = self.user
