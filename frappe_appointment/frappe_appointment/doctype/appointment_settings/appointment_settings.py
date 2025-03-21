# Copyright (c) 2025, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class AppointmentSettings(Document):
	pass


@frappe.whitelist()
def get_default_email_template():
    scheduler_settings = frappe.get_single("Scheduler Settings")
    return {
        "personal": scheduler_settings.default_personal_email_template,
        "group": scheduler_settings.default_group_email_template,
        "availability": scheduler_settings.default_availability_alerts_email_template,
    }
