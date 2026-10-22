from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.api.onboarding import blocks_time_off, get_google_setup, get_onboarding_status
from frappe_appointment.tests import as_user, make_test_user, set_password_field, setup_appointment_settings

DESK_USER = "test_fa_onb_desk@example.com"
ADMIN_USER = "test_fa_onb_admin@example.com"
WEBSITE_USER = "test_fa_onb_website@example.com"
CLIENT_ID = "fa-onb.apps.googleusercontent.com"
CLIENT_SECRET = "fa-onb-secret"


def set_google_settings(enable=1, client_id=CLIENT_ID, client_secret=CLIENT_SECRET):
    frappe.db.set_single_value("Google Settings", {"enable": enable, "client_id": client_id})
    set_password_field("Google Settings", "Google Settings", "client_secret", client_secret)
    frappe.clear_document_cache("Google Settings", "Google Settings")


def set_zoom_settings(enable=1, account_id="acc", client_id="cid", client_secret="sec"):
    setup_appointment_settings(
        enable_zoom=enable, zoom_account_id=account_id, zoom_client_id=client_id, zoom_client_secret=client_secret
    )
    frappe.clear_document_cache("Appointment Settings", "Appointment Settings")


class TestGetOnboardingStatus(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # A user without a desk role is saved as a Website User.
        make_test_user(DESK_USER).add_roles("Desk User")
        make_test_user(ADMIN_USER).add_roles("System Manager")
        make_test_user(WEBSITE_USER)

    def status_for(self, user):
        with as_user(user):
            return get_onboarding_status()

    def test_desk_user_google_ready(self):
        """Enabled with a client ID and secret reports Google as ready."""
        set_google_settings()
        set_zoom_settings(enable=0)
        self.assertEqual(
            self.status_for(DESK_USER),
            {
                "user_type": "System User",
                "is_admin": False,
                "google_ready": True,
                "zoom_ready": False,
                "blocks_time_off": False,
            },
        )

    def test_system_manager_is_admin(self):
        """System Managers are told they're admins, so they get the Google setup guide."""
        self.assertTrue(self.status_for(ADMIN_USER)["is_admin"])

    def test_desk_user_google_disabled(self):
        """Google Settings turned off reports not ready."""
        set_google_settings(enable=0)
        self.assertFalse(self.status_for(DESK_USER)["google_ready"])

    def test_desk_user_missing_client_id(self):
        """A missing client ID reports not ready."""
        set_google_settings(client_id="")
        self.assertFalse(self.status_for(DESK_USER)["google_ready"])

    def test_desk_user_missing_client_secret(self):
        """A missing client secret reports not ready."""
        set_google_settings(client_secret="")
        self.assertFalse(self.status_for(DESK_USER)["google_ready"])

    def test_desk_user_zoom_ready(self):
        """Zoom turned on with an account ID, client ID and secret reports Zoom as ready."""
        set_zoom_settings()
        self.assertTrue(self.status_for(DESK_USER)["zoom_ready"])

    def test_desk_user_zoom_incomplete(self):
        """Zoom turned off, or any credential missing, reports Zoom as not ready."""
        for settings in ({"enable": 0}, {"account_id": ""}, {"client_id": ""}, {"client_secret": ""}):
            with self.subTest(**settings):
                set_zoom_settings(**settings)
                self.assertFalse(self.status_for(DESK_USER)["zoom_ready"])

    def test_website_user_only_gets_user_type(self):
        """Website users learn nothing about the site's Google or Zoom setup."""
        set_google_settings()
        set_zoom_settings()
        self.assertEqual(self.status_for(WEBSITE_USER), {"user_type": "Website User"})

    def test_never_returns_credentials(self):
        """Google and Zoom credentials never leave the server."""
        set_google_settings()
        set_zoom_settings(account_id="fa-zoom-acc", client_id="fa-zoom-cid", client_secret="fa-zoom-sec")
        payload = frappe.as_json(self.status_for(DESK_USER))
        for secret in (CLIENT_ID, CLIENT_SECRET, "fa-zoom-acc", "fa-zoom-cid", "fa-zoom-sec"):
            self.assertNotIn(secret, payload)


class TestGetGoogleSetup(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        make_test_user(DESK_USER).add_roles("Desk User")
        make_test_user(ADMIN_USER).add_roles("System Manager")

    def setUp(self):
        # The redirect URI is built from the current request, which only exists over HTTP.
        frappe.utils.set_request(path="/")

    def tearDown(self):
        frappe.local.request = None

    def test_only_system_managers(self):
        """Other desk users can't read the Google setup."""
        with as_user(DESK_USER):
            self.assertRaises(frappe.PermissionError, get_google_setup)

    def test_redirect_uri_matches_authorize_access(self):
        """The redirect URI is the site address plus the Google Calendar callback, as authorize_access sends it."""
        with as_user(ADMIN_USER):
            setup = get_google_setup()
        self.assertEqual(
            setup["redirect_uri"],
            f"{frappe.utils.get_request_site_address(full_address=True)}"
            "?cmd=frappe.integrations.doctype.google_calendar.google_calendar.google_callback",
        )
        self.assertTrue(setup["redirect_uri"].startswith(setup["origin"]))
        self.assertIn(setup["domain"], setup["origin"])

    def test_reports_saved_settings_without_the_secret(self):
        """The saved client ID and whether a secret exists come back; the secret never does."""
        set_google_settings(enable=0)
        with as_user(ADMIN_USER):
            setup = get_google_setup()
        self.assertEqual((setup["enabled"], setup["client_id"], setup["has_client_secret"]), (False, CLIENT_ID, True))
        self.assertNotIn(CLIENT_SECRET, frappe.as_json(setup))

    def test_nothing_saved_yet(self):
        """A site with no Google credentials reports none."""
        set_google_settings(enable=0, client_id="", client_secret="")
        with as_user(ADMIN_USER):
            setup = get_google_setup()
        self.assertEqual((setup["enabled"], setup["client_id"], setup["has_client_secret"]), (False, "", False))


HR_APPS = ("frappe", "erpnext", "hrms", "frappe_appointment")


class TestBlocksTimeOff(IntegrationTestCase):
    def test_needs_erpnext_and_hrms(self):
        """Without both HR apps nothing checks leave or holidays, whatever the user's Employee record."""
        for apps in (["frappe", "frappe_appointment"], ["frappe", "erpnext", "frappe_appointment"]):
            with (
                self.subTest(apps=apps),
                patch("frappe.get_installed_apps", return_value=apps),
                patch.object(frappe.db, "exists", return_value=True),
            ):
                self.assertFalse(blocks_time_off(DESK_USER))

    def test_needs_an_employee(self):
        """With the HR apps, it depends on an Employee with the user's company email."""
        for found in (True, False):
            with (
                self.subTest(employee=found),
                patch("frappe.get_installed_apps", return_value=HR_APPS),
                patch.object(frappe.db, "exists", return_value=found) as exists,
            ):
                self.assertEqual(blocks_time_off(DESK_USER), found)
                exists.assert_called_once_with("Employee", {"company_email": DESK_USER})
