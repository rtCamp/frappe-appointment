from unittest.mock import MagicMock, patch

import frappe
import requests
from frappe.tests import IntegrationTestCase

from frappe_appointment.api import admin_setup
from frappe_appointment.api.admin_setup import GOOGLE_CALLBACK, get_admin_setup_status
from frappe_appointment.tests import (
    as_user,
    make_appointment_group,
    make_google_calendar,
    make_test_user,
    make_user_availability,
    set_password_field,
    setup_appointment_settings,
)

ADMIN_SETUP = "frappe_appointment.api.admin_setup"


def zoom_response(payload):
    response = MagicMock()
    response.json.return_value = payload
    return response


class TestAdminSetupStatus(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.ready_user = "test_fa_admin_ready@example.com"
        cls.ready_cal = make_google_calendar(
            cls.ready_user, calendar_name="GCal FA Admin Ready", zoom_user_email="z@x.com"
        )
        cls.ready_availability = make_user_availability(
            cls.ready_user, slug="fa-admin-ready", google_calendar=cls.ready_cal.name
        )

        cls.pending_user = "test_fa_admin_pending@example.com"
        make_google_calendar(cls.pending_user, calendar_name="GCal FA Admin Pending", authorized=False)

        cls.bare_user = "test_fa_admin_bare@example.com"
        make_test_user(cls.bare_user)

        # Users without a Desk role are saved as Website Users and left out of the team.
        for user in (cls.ready_user, cls.pending_user, cls.bare_user):
            frappe.get_doc("User", user).add_roles("Desk User")

        cls.group = make_appointment_group(
            group_name="FA Admin Setup Group",
            event_creator=cls.ready_cal.name,
            members=[cls.ready_availability.name],
        )

        google = frappe.get_single("Google Settings")
        google.enable = 1
        google.client_id = "fa-client.apps.googleusercontent.com"
        google.save(ignore_permissions=True)
        set_password_field("Google Settings", "Google Settings", "client_secret", "fa-secret")

    def team_row(self, status, user):
        return next(row for row in status["team"] if row["user"] == user)

    def test_requires_system_manager(self):
        """A user without System Manager can't read the admin status."""
        with as_user(self.bare_user):
            self.assertRaises(frappe.PermissionError, get_admin_setup_status)

    def test_google_settings_without_secret_value(self):
        """Google credentials report the client id and whether a secret is saved, never the secret."""
        status = get_admin_setup_status()
        self.assertTrue(status["google"]["enable"])
        self.assertEqual(status["google"]["client_id"], "fa-client.apps.googleusercontent.com")
        self.assertTrue(status["google"]["has_client_secret"])
        self.assertNotIn("fa-secret", frappe.as_json(status))

    def test_redirect_uri_points_at_google_callback(self):
        """The redirect URI is the site URL plus the core Google Calendar callback."""
        status = get_admin_setup_status()
        self.assertEqual(status["redirect_uri"], f"{status['site_url']}?cmd={GOOGLE_CALLBACK}")

    def test_team_rows(self):
        """Each person shows calendar, hours and booking page state."""
        status = get_admin_setup_status()

        ready = self.team_row(status, self.ready_user)
        self.assertTrue(ready["calendar_connected"])
        self.assertEqual(ready["availability"], self.ready_availability.name)
        self.assertTrue(ready["booking_live"])

        pending = self.team_row(status, self.pending_user)
        self.assertTrue(pending["has_calendar"])
        self.assertFalse(pending["calendar_connected"])
        self.assertIsNone(pending["availability"])

        bare = self.team_row(status, self.bare_user)
        self.assertFalse(bare["has_calendar"])
        self.assertFalse(bare["booking_live"])

    def test_only_connected_calendars_listed(self):
        """Event creator choices are limited to enabled, authorized calendars."""
        names = {c["name"]: c for c in get_admin_setup_status()["calendars"]}
        self.assertIn(self.ready_cal.name, names)
        self.assertEqual(names[self.ready_cal.name]["zoom_email"], "z@x.com")
        self.assertNotIn("GCal FA Admin Pending", names)

    def test_groups_with_member_counts(self):
        """Groups are listed with how many members they have."""
        group = next(g for g in get_admin_setup_status()["groups"] if g["name"] == self.group.name)
        self.assertEqual(group["members"], 1)
        self.assertEqual(group["event_creator"], self.ready_cal.name)


class TestZoomConnection(IntegrationTestCase):
    def test_requires_system_manager(self):
        """A user without System Manager can't run the Zoom check."""
        user = make_test_user("test_fa_admin_zoom_nosm@example.com")
        with as_user(user.name):
            self.assertRaises(frappe.PermissionError, admin_setup.test_zoom_connection)

    def test_missing_credentials(self):
        """Without all three credentials the check stops before calling Zoom."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="cid")
        with patch(f"{ADMIN_SETUP}.requests.post") as post:
            result = admin_setup.test_zoom_connection()
        self.assertFalse(result["ok"])
        post.assert_not_called()

    def test_valid_credentials_store_token(self):
        """A token from Zoom is saved so the next meeting doesn't fetch one."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="cid", zoom_account_id="acc", zoom_client_secret="sec")
        with patch(f"{ADMIN_SETUP}.requests.post", return_value=zoom_response({"access_token": "tok"})) as post:
            result = admin_setup.test_zoom_connection()
        self.assertTrue(result["ok"])
        self.assertEqual(post.call_args.kwargs["data"]["account_id"], "acc")
        token = frappe.get_single("Appointment Settings").get_password("zoom_access_token", raise_exception=False)
        self.assertEqual(token, "tok")

    def test_rejected_credentials(self):
        """Zoom's reason is passed back when it rejects the credentials."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="cid", zoom_account_id="acc", zoom_client_secret="bad")
        payload = {"error": "invalid_client", "reason": "Invalid client_id or client_secret"}
        with patch(f"{ADMIN_SETUP}.requests.post", return_value=zoom_response(payload)):
            result = admin_setup.test_zoom_connection()
        self.assertFalse(result["ok"])
        self.assertEqual(result["message"], "Invalid client_id or client_secret")

    def test_network_error(self):
        """A network failure is reported instead of raised."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="cid", zoom_account_id="acc", zoom_client_secret="sec")
        with patch(f"{ADMIN_SETUP}.requests.post", side_effect=requests.ConnectionError):
            result = admin_setup.test_zoom_connection()
        self.assertFalse(result["ok"])
