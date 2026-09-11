from unittest.mock import MagicMock

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import get_datetime

from frappe_appointment.helpers.google_calendar import insert_event_in_google_calendar_override
from frappe_appointment.tests import GCAL_HELPER, make_google_calendar, mock_gcal_object


class TestInsertEventInGoogleCalendarOverride(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.gcal = make_google_calendar("test_fa_gcalins@example.com", calendar_name="GCal FA Ins")

    def _event(self, **overrides):
        data = {
            "doctype": "Event",
            "subject": "GCal Insert",
            "starts_on": get_datetime("2027-01-15 10:00:00"),
            "ends_on": get_datetime("2027-01-15 10:30:00"),
            "all_day": 0,
            "sync_with_google_calendar": 1,
            "google_calendar": self.gcal.name,
            "google_calendar_id": self.gcal.name,
            "custom_meeting_provider": "",
            "description": "d",
            "event_participants": [],
        }
        data.update(overrides)
        return frappe.get_doc(data)

    def test_sync_off_returns_empty(self):
        """24.1 with sync_with_google_calendar off it returns (None, {})."""
        result = insert_event_in_google_calendar_override(self._event(sync_with_google_calendar=0), update_doc=False)
        self.assertEqual(result, (None, {}))

    def test_push_disabled_returns_empty(self):
        """24.2 an account with push_to_google_calendar disabled returns (None, {})."""
        account = make_google_calendar(
            "test_fa_gcalins_nopush@example.com", calendar_name="GCal FA Ins NoPush", push_to_google_calendar=0
        )
        doc = self._event(google_calendar=account.name, google_calendar_id=account.name)
        with mock_gcal_object(GCAL_HELPER, account=account):
            result = insert_event_in_google_calendar_override(doc, update_doc=False)
        self.assertEqual(result, (None, {}))

    def test_happy_path_returns_event_id_and_updates(self):
        """24.3 a successful insert returns the event id and update dict."""
        service = MagicMock()
        service.events.return_value.insert.return_value.execute.return_value = {"id": "g-1", "htmlLink": "http://x"}
        with mock_gcal_object(GCAL_HELPER, service=service, account=self.gcal):
            event_id, updates = insert_event_in_google_calendar_override(self._event(), update_doc=False)
        self.assertEqual(event_id, "g-1")
        self.assertEqual(updates["google_calendar_event_id"], "g-1")
        self.assertEqual(updates["custom_google_calendar_event_url"], "http://x")
