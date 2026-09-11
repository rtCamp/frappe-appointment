import json
from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, now_datetime

from frappe_appointment.overrides.event_override import EventOverride, check_one_time_schedule
from frappe_appointment.tests import make_appointment_group, make_event, make_google_calendar, make_user_availability

EO = "frappe_appointment.overrides.event_override"
THIS = "frappe_appointment.tests.overrides.test_event_webhook"


def ok_webhook(**kwargs):
    return {"ok": 1}


def boom_webhook(**kwargs):
    raise Exception("nope")


class TestHandleWebhook(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_wh@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA WH")
        make_user_availability(cls.user, slug="fa-wh", google_calendar=cls.gcal.name)
        cls.no_webhook = make_appointment_group("FA WH None", event_creator=cls.gcal.name, members=[cls.user])
        cls.fn_ok = make_appointment_group(
            "FA WH Ok", event_creator=cls.gcal.name, members=[cls.user], webhook=f"{THIS}.ok_webhook"
        )
        cls.fn_boom = make_appointment_group(
            "FA WH Boom", event_creator=cls.gcal.name, members=[cls.user], webhook=f"{THIS}.boom_webhook"
        )
        cls.url_group = make_appointment_group(
            "FA WH Url", event_creator=cls.gcal.name, members=[cls.user], webhook="https://example.com/hook"
        )

    def _event(self, group):
        doc = EventOverride.__new__(EventOverride)
        doc.custom_appointment_group = group
        return doc

    def test_no_group_is_success(self):
        """17.1 an event with no appointment group reports success."""
        self.assertEqual(self._event(None).handle_webhook({}), {"status": True, "message": ""})

    def test_group_without_webhook_is_success(self):
        """17.1 a group with no webhook reports success."""
        self.assertEqual(self._event(self.no_webhook.name).handle_webhook({}), {"status": True, "message": ""})

    def test_frappe_function_success(self):
        """17.2 a dotted-path webhook that returns is a success."""
        self.assertEqual(self._event(self.fn_ok.name).handle_webhook({}), {"status": True, "message": ""})

    def test_frappe_function_exception_is_failure(self):
        """17.2 a dotted-path webhook that raises reports failure with the message."""
        self.assertEqual(self._event(self.fn_boom.name).handle_webhook({}), {"status": False, "message": "nope"})

    def test_url_webhook_success(self):
        """17.3 a URL webhook returning a clean response is a success."""
        resp = MagicMock()
        resp.json.return_value = {"ok": 1}
        with patch(f"{EO}.requests.post", return_value=resp):
            result = self._event(self.url_group.name).handle_webhook({})
        self.assertEqual(result, {"status": True, "message": ""})


class TestCheckOneTimeSchedule(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_once@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA Once")
        make_user_availability(cls.user, slug="fa-once", google_calendar=cls.gcal.name)
        cls.once_group = make_appointment_group(
            "FA Once", event_creator=cls.gcal.name, members=[cls.user], schedule_only_once=1
        )
        cls.free_group = make_appointment_group("FA Once Free", event_creator=cls.gcal.name, members=[cls.user])
        cls.todo = frappe.get_doc({"doctype": "ToDo", "description": "fa once todo"}).insert(ignore_permissions=True)
        starts = add_to_date(now_datetime(), days=1)
        make_event(
            "FA Once Event",
            starts,
            add_to_date(starts, hours=1),
            appointment_group=cls.once_group.name,
            account=cls.gcal,
            custom_doctype_link_with_event=[{"reference_doctype": "ToDo", "reference_docname": cls.todo.name}],
        )

    def _args(self, docname):
        return json.dumps([{"reference_docname": "x"}, {"reference_docname": docname}])

    def test_existing_event_throws(self):
        """17.4 scheduling a schedule-only-once event a second time is rejected."""
        with self.assertRaises(frappe.ValidationError):
            check_one_time_schedule(self.once_group.name, custom_doctype_link_with_event=self._args(self.todo.name))

    def test_not_schedule_once_noop(self):
        """17.4 a group without schedule_only_once performs no check."""
        self.assertIsNone(
            check_one_time_schedule(self.free_group.name, custom_doctype_link_with_event=self._args(self.todo.name))
        )
