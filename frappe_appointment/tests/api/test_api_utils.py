import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.api.utils import check_google_calendar_setup
from frappe_appointment.tests import make_google_calendar, make_test_user, make_user_availability


class TestCheckGoogleCalendarSetup(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.full_user = "test_fa_ccs_full@example.com"
        cls.gcal = make_google_calendar(cls.full_user, calendar_name="GCal FA CCS Full", authorized=True)
        make_user_availability(cls.full_user, slug="fa-ccs-full", google_calendar=cls.gcal.name)

        cls.no_cal_user = "test_fa_ccs_nocal@example.com"
        make_test_user(cls.no_cal_user)

        cls.disabled_user = "test_fa_ccs_disabled@example.com"
        cls.dcal = make_google_calendar(cls.disabled_user, calendar_name="GCal FA CCS Disabled", authorized=False)
        frappe.db.set_value("Google Calendar", cls.dcal.name, "enable", 0)

    def test_full_setup(self):
        """15.4 an enabled + authorized calendar reports all flags true with its id."""
        result = check_google_calendar_setup(self.full_user)
        self.assertTrue(result["is_google_calendar_setup"])
        self.assertTrue(result["is_google_calendar_enabled"])
        self.assertTrue(result["is_google_calendar_authorized"])
        self.assertEqual(result["google_calendar_id"], self.gcal.name)

    def test_no_calendar(self):
        """15.5 no Google Calendar reports setup false and no calendar id."""
        result = check_google_calendar_setup(self.no_cal_user)
        self.assertFalse(result["is_google_calendar_setup"])
        self.assertIsNone(result["google_calendar_id"])

    def test_disabled_and_unauthorized_flags(self):
        """15.6 a disabled + unauthorized calendar reports those flags false."""
        result = check_google_calendar_setup(self.disabled_user)
        self.assertFalse(result["is_google_calendar_enabled"])
        self.assertFalse(result["is_google_calendar_authorized"])

    def test_user_availability_returned(self):
        """15.7 the user's User Appointment Availability name is returned."""
        result = check_google_calendar_setup(self.full_user)
        self.assertEqual(result["user_appointment_availability"], self.full_user)
