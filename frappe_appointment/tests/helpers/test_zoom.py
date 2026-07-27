import base64
from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.helpers.zoom import (
    base64_encode,
    create_meeting,
    delete_meeting,
    get_zoom_access_token,
    reauthorize_zoom,
)
from frappe_appointment.tests import make_google_calendar, setup_appointment_settings

ZOOM = "frappe_appointment.helpers.zoom"


class TestBase64Encode(IntegrationTestCase):
    def test_base64_encode(self):
        """22.1 base64_encode returns the base64 of the utf-8 bytes."""
        self.assertEqual(base64_encode("a:b"), base64.b64encode(b"a:b").decode())


class TestZoomAccessToken(IntegrationTestCase):
    def test_returns_stored_token(self):
        """22.2 get_zoom_access_token returns the stored token when present."""
        setup_appointment_settings(enable_zoom=1, zoom_access_token="stored-tok")
        self.assertEqual(get_zoom_access_token(), "stored-tok")

    def test_reauthorizes_when_absent(self):
        """22.2 get_zoom_access_token re-authorizes when no token is stored."""
        setup_appointment_settings(
            enable_zoom=1, zoom_client_id="cid", zoom_client_secret="sec", zoom_account_id="acc", zoom_access_token=""
        )
        resp = MagicMock()
        resp.json.return_value = {"access_token": "fresh-tok"}
        with patch(f"{ZOOM}.requests.post", return_value=resp):
            self.assertEqual(get_zoom_access_token(), "fresh-tok")


class TestReauthorizeZoom(IntegrationTestCase):
    def test_disabled_throws(self):
        """22.3 reauthorize_zoom throws when Zoom is disabled."""
        setup_appointment_settings(enable_zoom=0)
        with self.assertRaises(frappe.ValidationError):
            reauthorize_zoom()

    def test_missing_credentials_throws(self):
        """22.3 reauthorize_zoom throws when credentials are incomplete."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="", zoom_client_secret="", zoom_account_id="")
        with self.assertRaises(frappe.ValidationError):
            reauthorize_zoom()

    def test_success_returns_token(self):
        """22.3 reauthorize_zoom stores and returns the access token on success."""
        setup_appointment_settings(enable_zoom=1, zoom_client_id="cid", zoom_client_secret="sec", zoom_account_id="acc")
        resp = MagicMock()
        resp.json.return_value = {"access_token": "new-tok"}
        with patch(f"{ZOOM}.requests.post", return_value=resp):
            self.assertEqual(reauthorize_zoom(), "new-tok")


class TestCreateMeeting(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.gcal = make_google_calendar(
            "test_fa_zoom@example.com", calendar_name="GCal FA Zoom", zoom_user_email="z@example.com"
        )

    def test_create_meeting_returns_join_url(self):
        """22.4 create_meeting posts the meeting and returns (join_url, response)."""
        setup_appointment_settings(enable_zoom=1, zoom_access_token="tok")
        resp = MagicMock()
        resp.ok = True
        resp.json.return_value = {"join_url": "https://z", "id": 1}
        with patch(f"{ZOOM}.requests.post", return_value=resp):
            link, data = create_meeting(self.gcal.name, "Subject", "2027-01-15 10:00:00", 30, "desc")
        self.assertEqual(link, "https://z")
        self.assertEqual(data["id"], 1)


class TestDeleteMeeting(IntegrationTestCase):
    def test_meeting_not_found_is_success(self):
        """22.5 delete_meeting treats a 3001 (not found) response as success."""
        setup_appointment_settings(enable_zoom=1, zoom_access_token="tok")
        resp = MagicMock()
        resp.ok = False
        resp.json.return_value = {"code": 3001}
        with patch(f"{ZOOM}.requests.delete", return_value=resp):
            self.assertTrue(delete_meeting("gcal", "meeting-1"))
