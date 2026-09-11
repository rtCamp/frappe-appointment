from unittest.mock import patch

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.api.group_meet import book_time_slot, get_time_slots
from frappe_appointment.tests import make_appointment_group, make_google_calendar, make_user_availability

GM = "frappe_appointment.api.group_meet"


class TestGroupMeetGetTimeSlots(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_gm@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA GM")
        make_user_availability(cls.user, slug="fa-gm", google_calendar=cls.gcal.name)
        cls.group = make_appointment_group(
            "FA GM Group", event_creator=cls.gcal.name, members=[cls.user], allow_rescheduling=1
        )

    def test_missing_group_id_throws(self):
        """15.1 a missing appointment group id is rejected."""
        with self.assertRaises(frappe.ValidationError):
            get_time_slots("", "2027-01-15", "0")

    def test_missing_date_throws(self):
        """15.1 a missing date is rejected."""
        with self.assertRaises(frappe.ValidationError):
            get_time_slots("x", "", "0")

    def test_valid_adds_title_and_rescheduling(self):
        """15.2 a valid request augments the slots with the group title and rescheduling flag."""
        with patch(f"{GM}._get_time_slots_for_day", return_value={"all_available_slots_for_data": []}):
            result = get_time_slots(self.group.name, "2027-01-15", "0")
        self.assertEqual(result["title"], self.group.group_name)
        self.assertTrue(result["rescheduling_allowed"])


class TestGroupMeetBookTimeSlot(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_gmbook@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA GM Book")
        make_user_availability(cls.user, slug="fa-gmbook", google_calendar=cls.gcal.name)
        cls.group = make_appointment_group("FA GM Book Group", event_creator=cls.gcal.name, members=[cls.user])

    def test_delegates_to_event_creation(self):
        """15.3 book_time_slot delegates to event creation with return_event_id set."""
        with patch(f"{GM}._create_event_for_appointment_group", return_value="SENTINEL") as create:
            result = book_time_slot(self.group.name, "2027-01-15", "s", "e", "0")
        self.assertEqual(result, "SENTINEL")
        self.assertTrue(create.call_args.kwargs["return_event_id"])
