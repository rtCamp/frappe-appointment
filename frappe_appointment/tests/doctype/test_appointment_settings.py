import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.frappe_appointment.doctype.appointment_settings.appointment_settings import (
    REQUIRED_DEFAULT_EMAILS,
    get_default_email_template,
)
from frappe_appointment.patches.v0_1 import fill_empty_email_templates
from frappe_appointment.tests import make_user_availability

USER = "test_fa_settings_email@example.com"


class TestDefaultEmails(IntegrationTestCase):
    def test_default_emails_cannot_be_cleared(self):
        for fieldname in REQUIRED_DEFAULT_EMAILS:
            settings = frappe.get_single("Appointment Settings")
            if not settings.get(fieldname):
                continue
            settings.set(fieldname, None)
            with self.subTest(fieldname=fieldname), self.assertRaises(frappe.ValidationError):
                settings.save()

    def test_patch_gives_pages_with_no_email_the_default(self):
        make_user_availability(USER, slug="fa-settings-email", days=[])
        frappe.db.set_value("User Appointment Availability", USER, "response_email_template", None)
        fill_empty_email_templates.execute()
        self.assertEqual(
            frappe.db.get_value("User Appointment Availability", USER, "response_email_template"),
            get_default_email_template()["personal"],
        )
