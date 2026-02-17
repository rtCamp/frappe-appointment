import frappe

DEFAULTS = {
    "Appointment Settings": {
        "default_personal_email_template": "[Default] Appointment Scheduled",
        "default_group_email_template": "[Default] Appointment Scheduled",
        "default_availability_alerts_email_template": "[Default] Appointment Group Availability",
        "personal_organisers_email_template": "[Default] Appointment Scheduled - Organisers",
    }
}

def execute():
    for doctype, fields in DEFAULTS.items():
        for fieldname, default in fields.items():
            if not frappe.db.get_value(doctype, fieldname=fieldname):
                frappe.db.set_value(doctype, None, fieldname, default)
