import frappe

from frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings import (
    get_default_email_template,
)

# Each doctype's email fields, with the kind of site default that fills them.
EMAIL_FIELDS = {
    "User Appointment Availability": {"response_email_template": "personal"},
    "Appointment Group": {"response_email_template": "group", "availability_email_template": "availability"},
}


def execute():
    """Every booking page and group sends an email, as saving one now makes sure: give the ones with no email the
    site's default."""
    defaults = get_default_email_template()
    for doctype, fields in EMAIL_FIELDS.items():
        for fieldname, kind in fields.items():
            if not defaults[kind]:
                continue
            for name in frappe.get_all(doctype, filters={fieldname: ["is", "not set"]}, pluck="name"):
                frappe.db.set_value(doctype, name, fieldname, defaults[kind], update_modified=False)
