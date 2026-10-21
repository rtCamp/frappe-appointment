import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.api.onboarding import get_onboarding_status
from frappe_appointment.tests import as_user, make_test_user, set_password_field

DESK_USER = "test_fa_onb_desk@example.com"
WEBSITE_USER = "test_fa_onb_website@example.com"
CLIENT_ID = "fa-onb.apps.googleusercontent.com"
CLIENT_SECRET = "fa-onb-secret"


def set_google_settings(enable=1, client_id=CLIENT_ID, client_secret=CLIENT_SECRET):
    frappe.db.set_single_value("Google Settings", {"enable": enable, "client_id": client_id})
    set_password_field("Google Settings", "Google Settings", "client_secret", client_secret)
    frappe.clear_document_cache("Google Settings", "Google Settings")


class TestGetOnboardingStatus(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # A user without a desk role is saved as a Website User.
        make_test_user(DESK_USER).add_roles("Desk User")
        make_test_user(WEBSITE_USER)

    def status_for(self, user):
        with as_user(user):
            return get_onboarding_status()

    def test_desk_user_google_ready(self):
        """Enabled with a client ID and secret reports Google as ready."""
        set_google_settings()
        self.assertEqual(self.status_for(DESK_USER), {"user_type": "System User", "google_ready": True})

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

    def test_website_user_only_gets_user_type(self):
        """Website users learn nothing about the site's Google setup."""
        set_google_settings()
        self.assertEqual(self.status_for(WEBSITE_USER), {"user_type": "Website User"})

    def test_never_returns_credentials(self):
        """The client ID and secret never leave the server."""
        set_google_settings()
        payload = frappe.as_json(self.status_for(DESK_USER))
        self.assertNotIn(CLIENT_ID, payload)
        self.assertNotIn(CLIENT_SECRET, payload)
