import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.tests import (
    make_appointment_group,
    make_google_calendar,
    make_user_availability,
    setup_appointment_settings,
)


class TestAppointmentGroupAutoname(IntegrationTestCase):
    def test_autoname_scrubs_group_name(self):
        """4.1 autoname scrubs the group name into a hyphenated id."""
        group = make_appointment_group("FA Autoname Group")
        self.assertEqual(group.name, "fa-autoname-group")


class TestAppointmentGroupMembers(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_agm@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA AGM")
        make_user_availability(cls.user, slug="fa-agm", google_calendar=cls.gcal.name)

    def test_no_mandatory_member_throws(self):
        """4.2 an appointment group with no mandatory member is rejected."""
        with self.assertRaises(frappe.ValidationError):
            frappe.get_doc(
                {
                    "doctype": "Appointment Group",
                    "group_name": "FA No Mandatory",
                    "event_creator": self.gcal.name,
                    "duration_for_event": 1800,
                    "members": [{"user": self.user, "is_mandatory": 0}],
                }
            ).insert(ignore_permissions=True)

    def test_mandatory_member_passes(self):
        """4.3 an appointment group with a mandatory member validates."""
        group = make_appointment_group("FA Has Mandatory", event_creator=self.gcal.name, members=[self.user])
        self.assertTrue(frappe.db.exists("Appointment Group", group.name))


class TestAppointmentGroupZoom(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_agz@example.com"
        cls.gcal_no_zoom = make_google_calendar(cls.user, calendar_name="GCal FA AGZ", zoom_user_email=None)
        make_user_availability(cls.user, slug="fa-agz", google_calendar=cls.gcal_no_zoom.name)

    def _zoom_group(self, name):
        return {
            "doctype": "Appointment Group",
            "group_name": name,
            "event_creator": self.gcal_no_zoom.name,
            "duration_for_event": 1800,
            "meet_provider": "Zoom",
            "members": [{"user": self.user, "is_mandatory": 1}],
        }

    def test_zoom_disabled_throws(self):
        """4.4 a Zoom group is rejected when Zoom is disabled in settings."""
        setup_appointment_settings(enable_zoom=0)
        with self.assertRaises(frappe.ValidationError):
            frappe.get_doc(self._zoom_group("FA Zoom Disabled")).insert(ignore_permissions=True)

    def test_zoom_missing_credentials_throws(self):
        """4.5 a Zoom group is rejected when Zoom credentials are incomplete."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="", zoom_client_secret="", zoom_account_id="")
        with self.assertRaises(frappe.ValidationError):
            frappe.get_doc(self._zoom_group("FA Zoom NoCreds")).insert(ignore_permissions=True)

    def test_zoom_missing_user_email_throws(self):
        """4.6 a fully configured Zoom group whose calendar has no Zoom user email is rejected."""
        setup_appointment_settings(
            enable_zoom=1, zoom_client_id="cid", zoom_client_secret="secret", zoom_account_id="acc"
        )
        with self.assertRaises(frappe.ValidationError):
            frappe.get_doc(self._zoom_group("FA Zoom NoEmail")).insert(ignore_permissions=True)

    def test_non_zoom_provider_skips_zoom_validation(self):
        """4.7 a non-Zoom provider performs no Zoom validation."""
        group = make_appointment_group(
            "FA Non Zoom", event_creator=self.gcal_no_zoom.name, members=[self.user], meet_provider="Google Meet"
        )
        self.assertTrue(frappe.db.exists("Appointment Group", group.name))
