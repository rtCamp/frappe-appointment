# Copyright (c) 2025, rtCamp and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

# The site's default emails that booking pages and groups fall back on, so they can't be left empty.
REQUIRED_DEFAULT_EMAILS = (
    "default_personal_email_template",
    "default_group_email_template",
    "default_availability_alerts_email_template",
)


class AppointmentSettings(Document):
    def validate(self):
        for fieldname in REQUIRED_DEFAULT_EMAILS:
            if not self.get(fieldname) and self.get_value_before_save(fieldname):
                frappe.throw(
                    frappe._("{0} can't be empty: booking pages and groups use it when nothing else is chosen.").format(
                        frappe._(self.meta.get_label(fieldname))
                    )
                )


@frappe.whitelist()
def get_default_email_template():
    appointment_settings = frappe.get_single("Appointment Settings")
    return {
        "personal": appointment_settings.default_personal_email_template,
        "group": appointment_settings.default_group_email_template,
        "availability": appointment_settings.default_availability_alerts_email_template,
    }


def validate_email_template_choice(doc: Document, fieldname: str, kind: str):
    """Every booking page and group sends an email, so an empty one gets the site's default for `kind`
    (personal, group or availability). Emails go out in the site's name, so only System Managers choose which;
    everyone else keeps the one that's set, or starts on the default."""
    default = get_default_email_template()[kind]
    if not doc.get(fieldname):
        doc.set(fieldname, default)

    if "System Manager" in frappe.get_roles():
        return

    value_before = None if doc.is_new() else doc.get_value_before_save(fieldname) or None
    value_now = doc.get(fieldname) or None
    if value_now == value_before:
        return
    if value_before is None and value_now == default:
        return

    frappe.throw(
        frappe._("Only a System Manager can change the {0}.").format(frappe._(doc.meta.get_label(fieldname))),
        frappe.PermissionError,
    )
