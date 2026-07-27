from frappe.tests import IntegrationTestCase

from frappe_appointment.overrides.google_calendar_override import GoogleCalendarOverride


class TestGoogleCalendarBeforeSave(IntegrationTestCase):
    def _doc(self, google_calendar_id=None, refresh_token=None, user="fa-cal-user@example.com"):
        # before_save does not call super(), so a bare instance exercises only the override logic.
        doc = GoogleCalendarOverride.__new__(GoogleCalendarOverride)
        doc.google_calendar_id = google_calendar_id
        doc.user = user
        doc.refresh_token = refresh_token
        doc.custom_is_google_calendar_authorized = None
        return doc

    def test_google_calendar_id_defaults_to_user(self):
        """20.3 an empty google_calendar_id defaults to the user."""
        doc = self._doc(google_calendar_id=None, refresh_token="tok")
        doc.before_save()
        self.assertEqual(doc.google_calendar_id, "fa-cal-user@example.com")

    def test_existing_google_calendar_id_kept(self):
        """20.3 an existing google_calendar_id is left unchanged."""
        doc = self._doc(google_calendar_id="explicit-id", refresh_token="tok")
        doc.before_save()
        self.assertEqual(doc.google_calendar_id, "explicit-id")

    def test_authorized_when_refresh_token_present(self):
        """20.4 custom_is_google_calendar_authorized is True when a refresh token exists."""
        doc = self._doc(refresh_token="tok")
        doc.before_save()
        self.assertTrue(doc.custom_is_google_calendar_authorized)

    def test_unauthorized_when_no_refresh_token(self):
        """20.4 custom_is_google_calendar_authorized is False without a refresh token."""
        doc = self._doc(refresh_token="")
        doc.before_save()
        self.assertFalse(doc.custom_is_google_calendar_authorized)
