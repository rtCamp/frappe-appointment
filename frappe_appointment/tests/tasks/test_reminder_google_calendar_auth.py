from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.tasks.reminder_google_calendar_auth import google_calendar_authorized, send_reminder_mail
from frappe_appointment.tests import make_google_calendar

RG = "frappe_appointment.tasks.reminder_google_calendar_auth"


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


class TestSendReminderMail(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.lapsed_user = "test_fa_rem_lapsed@example.com"
        cls.authorized_user = "test_fa_rem_authorized@example.com"
        cls.disabled_user = "test_fa_rem_disabled@example.com"
        cls.lapsed_calendar = make_google_calendar(cls.lapsed_user).name
        cls.authorized_calendar = make_google_calendar(cls.authorized_user).name
        cls.disabled_calendar = make_google_calendar(cls.disabled_user).name
        frappe.db.set_value("User", cls.disabled_user, "enabled", 0)

        # A calendar the user can see that isn't their own, which the reminder doesn't check.
        cls.shared_calendar = make_google_calendar(cls.lapsed_user, calendar_name="FA Rem Shared").name
        frappe.db.set_value(
            "Google Calendar", cls.shared_calendar, "google_calendar_id", "team@group.calendar.google.com"
        )

        for calendar in (cls.lapsed_calendar, cls.authorized_calendar, cls.disabled_calendar, cls.shared_calendar):
            frappe.db.set_value("Google Calendar", calendar, "custom_is_google_calendar_authorized", 1)

    def _run(self):
        """Run the job with only this class's lapsed, disabled and shared calendars failing the token check.

        Every other calendar on the site passes it, so the run never changes them.
        """
        unauthorized = {self.lapsed_calendar, self.disabled_calendar, self.shared_calendar}
        checked = []

        def authorized(google_calendar):
            checked.append(google_calendar.name)
            return google_calendar.name not in unauthorized

        with (
            patch(f"{RG}.google_calendar_authorized", side_effect=authorized),
            patch(f"{RG}.send_email_template_mail") as mock_send,
            patch("frappe.db.commit"),
        ):
            send_reminder_mail()
        recipients = {recipient for call in mock_send.call_args_list for recipient in call.kwargs["recipients"]}
        return checked, recipients

    def _is_authorized(self, calendar):
        return frappe.db.get_value("Google Calendar", calendar, "custom_is_google_calendar_authorized")

    def test_lapsed_calendar_is_flagged_and_reminded(self):
        """25.7 a calendar that fails the token check is marked unauthorized and its user is reminded."""
        _, recipients = self._run()
        self.assertIn(self.lapsed_user, recipients)
        self.assertFalse(self._is_authorized(self.lapsed_calendar))

    def test_authorized_calendar_is_left_alone(self):
        """25.7 a calendar that passes the token check gets no reminder and keeps its flag."""
        checked, recipients = self._run()
        self.assertIn(self.authorized_calendar, checked)
        self.assertNotIn(self.authorized_user, recipients)
        self.assertTrue(self._is_authorized(self.authorized_calendar))

    def test_disabled_user_is_skipped(self):
        """25.7 a disabled user's calendar isn't checked or reminded about."""
        checked, recipients = self._run()
        self.assertNotIn(self.disabled_calendar, checked)
        self.assertNotIn(self.disabled_user, recipients)
        self.assertTrue(self._is_authorized(self.disabled_calendar))

    def test_shared_calendar_is_not_checked(self):
        """25.7 a calendar that isn't the user's own isn't checked, so its flag is left as it was."""
        checked, _ = self._run()
        self.assertNotIn(self.shared_calendar, checked)
        self.assertTrue(self._is_authorized(self.shared_calendar))
