from unittest.mock import patch

import frappe
import pytz
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, now_datetime

from frappe_appointment.overrides.event_override import _create_event_for_appointment_group
from frappe_appointment.tests import (
    make_appointment_group,
    make_google_calendar,
    make_user_availability,
    mock_gcal_object,
    mute_enqueue,
)

EO = "frappe_appointment.overrides.event_override"

DATE = "2027-01-15"
START = "2027-01-15 10:00:00+0000"
END = "2027-01-15 10:30:00+0000"


class TestCreateEventForAppointmentGroup(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_create@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA Create")
        make_user_availability(cls.user, slug="fa-create", google_calendar=cls.gcal.name)
        cls.create = make_appointment_group("FA Create", event_creator=cls.gcal.name, members=[cls.user])
        cls.noresched = make_appointment_group(
            "FA Create NoResched", event_creator=cls.gcal.name, members=[cls.user], allow_rescheduling=0
        )
        cls.resched_strict = make_appointment_group(
            "FA Create ReStrict",
            event_creator=cls.gcal.name,
            members=[cls.user],
            allow_rescheduling=1,
            minimum_notice_for_reschedule=48,
        )
        cls.resched_lax = make_appointment_group(
            "FA Create ReLax",
            event_creator=cls.gcal.name,
            members=[cls.user],
            allow_rescheduling=1,
            minimum_notice_for_reschedule=0,
        )

    def test_invalid_slot_throws(self):
        """18.1 an unavailable slot is rejected."""
        with patch(f"{EO}.is_valid_time_slots", return_value=False), self.assertRaises(frappe.ValidationError):
            _create_event_for_appointment_group(self.create, DATE, START, END, "0")

    def test_invalid_date_throws(self):
        """18.2 a date outside the booking window is rejected."""
        with patch(f"{EO}.is_valid_time_slots", return_value=True), self.assertRaises(frappe.ValidationError):
            _create_event_for_appointment_group(
                self.create, "2020-01-01", "2020-01-01 10:00:00+0000", "2020-01-01 10:30:00+0000", "0"
            )

    def test_no_members_throws(self):
        """18.3 an appointment group with no members is rejected."""
        empty = frappe._dict(name="fa-empty", members=[], minimum_notice_before_event=0, event_availability_window=0)
        with patch(f"{EO}.is_valid_time_slots", return_value=True), self.assertRaises(frappe.ValidationError):
            _create_event_for_appointment_group(empty, DATE, START, END, "0")

    def test_reschedule_disallowed_throws(self):
        """18.4 rescheduling a group that disallows it is rejected."""
        with (
            patch(f"{EO}.is_valid_time_slots", return_value=True),
            mock_gcal_object(EO, account=self.gcal),
            self.assertRaises(frappe.ValidationError),
        ):
            _create_event_for_appointment_group(self.noresched, DATE, START, END, "0", reschedule=True)

    def test_reschedule_too_soon_throws(self):
        """18.5 rescheduling within the minimum notice window is rejected."""
        near = pytz.utc.localize(add_to_date(now_datetime(), hours=1))
        with (
            patch(f"{EO}.is_valid_time_slots", return_value=True),
            mock_gcal_object(EO, account=self.gcal),
            self.assertRaises(frappe.ValidationError),
        ):
            _create_event_for_appointment_group(
                self.resched_strict,
                near.strftime("%Y-%m-%d"),
                near.strftime("%Y-%m-%d %H:%M:%S%z"),
                near.strftime("%Y-%m-%d %H:%M:%S%z"),
                "0",
                reschedule=True,
            )

    def test_reschedule_invalid_token_throws(self):
        """18.6 rescheduling with an undecryptable event token is rejected."""
        with (
            patch(f"{EO}.is_valid_time_slots", return_value=True),
            mock_gcal_object(EO, account=self.gcal),
            self.assertRaises(frappe.ValidationError),
        ):
            _create_event_for_appointment_group(
                self.resched_lax, DATE, START, END, "0", reschedule=True, event_token="garbage-token"
            )

    def test_happy_path_creates_event(self):
        """18.7 a valid booking inserts an Event and returns its id and meeting details."""
        with (
            patch(f"{EO}.is_valid_time_slots", return_value=True),
            patch(f"{EO}.insert_event_in_google_calendar_override", return_value=(None, {})),
            mock_gcal_object(EO, account=self.gcal),
            patch("frappe.db.commit"),
            mute_enqueue(),
        ):
            resp = _create_event_for_appointment_group(self.create, DATE, START, END, "0", "[]", return_event_id=True)
        self.assertIn("message", resp)
        self.assertTrue(frappe.db.exists("Event", resp["event_id"]))
