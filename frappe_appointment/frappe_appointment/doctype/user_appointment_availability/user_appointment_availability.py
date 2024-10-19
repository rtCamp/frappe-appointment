# Copyright (c) 2023, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class UserAppointmentAvailability(Document):
    def validate(self):
        calendar = frappe.get_doc("Google Calendar", self.google_calendar)
        if not calendar.custom_is_google_calendar_authorized:
            frappe.throw(frappe._("Please authorize Google Calendar before creating appointment availability."))
