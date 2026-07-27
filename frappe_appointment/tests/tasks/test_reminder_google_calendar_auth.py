from unittest.mock import MagicMock

from frappe.tests import IntegrationTestCase

from frappe_appointment.tasks.reminder_google_calendar_auth import google_calendar_authorized


class TestGoogleCalendarAuthorized(IntegrationTestCase):
    def test_not_authorized_flag_false(self):
        """25.6 an unauthorized calendar returns False."""
        cal = MagicMock(custom_is_google_calendar_authorized=0)
        self.assertFalse(google_calendar_authorized(cal))

    def test_token_retrieval_raises_false(self):
        """25.6 a calendar whose token retrieval raises returns False."""
        cal = MagicMock(custom_is_google_calendar_authorized=1)
        cal.get_access_token.side_effect = Exception("bad refresh token")
        self.assertFalse(google_calendar_authorized(cal))

    def test_valid_token_true(self):
        """25.6 a calendar returning a token is authorized."""
        cal = MagicMock(custom_is_google_calendar_authorized=1)
        cal.get_access_token.return_value = "tok"
        self.assertTrue(google_calendar_authorized(cal))
