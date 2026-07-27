from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, nowdate

from frappe_appointment.helpers.email import get_send_after, send_email_template_mail
from frappe_appointment.tests import mute_enqueue


class TestSendEmailTemplateMail(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.template = frappe.get_doc(
            {
                "doctype": "Email Template",
                "name": "FA Booking Confirmed",
                "subject": "Booking for {{ name }}",
                "response": "Hello {{ name }}, your slot is confirmed.",
                "use_html": 0,
            }
        ).insert(ignore_permissions=True)

    def test_creates_rendered_communication_and_sends(self):
        """23.3 send_email_template_mail creates a rendered Communication and sends the mail."""
        todo = frappe.get_doc({"doctype": "ToDo", "description": "fa email todo"}).insert(ignore_permissions=True)
        with mute_enqueue(), patch("frappe.sendmail") as sendmail:
            send_email_template_mail(todo, {"name": "Ada"}, self.template.name, recipients=["fa_rcpt@example.com"])
        comm = frappe.get_last_doc("Communication", filters={"reference_doctype": "ToDo", "reference_name": todo.name})
        self.assertEqual(comm.subject, "Booking for Ada")
        self.assertEqual(comm.email_template, self.template.name)
        self.assertIn("your slot is confirmed", comm.content)
        sendmail.assert_called_once()


class TestGetSendAfter(IntegrationTestCase):
    def test_out_of_range_returns_none(self):
        """23.1 get_send_after returns None for a value <= 0 or > 24."""
        self.assertIsNone(get_send_after(frappe._dict(custom_time_to_send_email=0)))
        self.assertIsNone(get_send_after(frappe._dict(custom_time_to_send_email=25)))

    def test_valid_hour_returns_today_or_tomorrow(self):
        """23.2 get_send_after returns that hour today or tomorrow depending on the current time."""
        result = get_send_after(frappe._dict(custom_time_to_send_email=9))
        date_part, time_part = result.split(" ")
        self.assertEqual(time_part, "09:00:00.000000")
        self.assertIn(date_part, {nowdate(), add_to_date(nowdate(), days=1)})
