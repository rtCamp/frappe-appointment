from datetime import datetime
from unittest.mock import patch

from frappe.tests import IntegrationTestCase
from frappe.utils import get_datetime

from frappe_appointment.frappe_appointment.doctype.appointment_time_slot.appointment_time_slot import (
    check_if_datetime_in_range,
    get_all_unavailable_google_calendar_slots_for_day,
    get_google_calendar_slots_member,
    is_busy_event,
    remove_duplicate_slots,
)
from frappe_appointment.helpers.utils import convert_timezone_to_utc
from frappe_appointment.tests import TIME_SLOT_MODULE, google_slot, make_user_availability, mock_gcal_object

SLOT_MEMBER = f"{TIME_SLOT_MODULE}.get_google_calendar_slots_member"


def _dt(s):
    return datetime.fromisoformat(s)


class TestCheckIfDatetimeInRange(IntegrationTestCase):
    def test_overlapping_returns_true(self):
        """12.1 an interval overlapping the range returns True."""
        self.assertTrue(
            check_if_datetime_in_range(
                _dt("2027-01-15T10:00"), _dt("2027-01-15T11:00"), _dt("2027-01-15T10:30"), _dt("2027-01-15T12:00")
            )
        )

    def test_interval_after_range_returns_false(self):
        """12.1 an interval entirely after the range returns False."""
        self.assertFalse(
            check_if_datetime_in_range(
                _dt("2027-01-15T13:00"), _dt("2027-01-15T14:00"), _dt("2027-01-15T10:00"), _dt("2027-01-15T12:00")
            )
        )

    def test_interval_before_range_returns_false(self):
        """12.1 an interval entirely before the range returns False."""
        self.assertFalse(
            check_if_datetime_in_range(
                _dt("2027-01-15T08:00"), _dt("2027-01-15T09:00"), _dt("2027-01-15T10:00"), _dt("2027-01-15T12:00")
            )
        )


class TestRemoveDuplicateSlots(IntegrationTestCase):
    def setUp(self):
        self.a = google_slot("2027-01-15T10:00:00", "2027-01-15T10:30:00")
        self.b = google_slot("2027-01-15T11:00:00", "2027-01-15T11:30:00")

    def test_collapses_adjacent_duplicates(self):
        """12.2 adjacent slots with identical UTC start+end collapse to one."""
        self.assertEqual(len(remove_duplicate_slots([self.a, dict(self.a), self.b])), 2)

    def test_keeps_distinct_slots(self):
        """12.2 distinct slots are all kept."""
        self.assertEqual(len(remove_duplicate_slots([self.a, self.b])), 2)

    def test_single_slot_unchanged(self):
        """12.2 a single-element list is returned unchanged."""
        self.assertEqual(remove_duplicate_slots([self.a]), [self.a])


class TestIsBusyEvent(IntegrationTestCase):
    def setUp(self):
        self.user = "busy@example.com"
        self.event = google_slot("2027-01-15T10:00:00", "2027-01-15T10:30:00")
        start = convert_timezone_to_utc("2027-01-15T10:00:00", "UTC")
        end = convert_timezone_to_utc("2027-01-15T10:30:00", "UTC")
        self.match = {"calendars": {self.user: {"busy": [{"start": start.isoformat(), "end": end.isoformat()}]}}}

    def test_matching_busy_slot(self):
        """12.3 an event matching a busy entry is busy."""
        self.assertTrue(is_busy_event(self.event, self.match, self.user))

    def test_missing_calendar_assumed_busy(self):
        """12.3 a missing calendar entry is assumed busy."""
        self.assertTrue(is_busy_event(self.event, {"calendars": {}}, self.user))

    def test_non_matching_not_busy(self):
        """12.3 an event not matching any busy entry is not busy."""
        other = {
            "calendars": {
                self.user: {"busy": [{"start": "2027-01-01T00:00:00+00:00", "end": "2027-01-01T01:00:00+00:00"}]}
            }
        }
        self.assertFalse(is_busy_event(self.event, other, self.user))


class TestGetAllUnavailableSlots(IntegrationTestCase):
    def test_member_returning_false_propagates(self):
        """12.4 a member returning False makes the whole result False."""
        with patch(SLOT_MEMBER, return_value=False):
            result = get_all_unavailable_google_calendar_slots_for_day({"m1@e.com": []}, None, None, None, None)
        self.assertFalse(result)

    def test_slots_concatenated_and_deduplicated(self):
        """12.4 per-member slots are concatenated, sorted and de-duplicated."""
        slot = google_slot("2027-01-15T10:00:00", "2027-01-15T10:30:00")
        with patch(SLOT_MEMBER, return_value=[dict(slot)]):
            result = get_all_unavailable_google_calendar_slots_for_day(
                {"m1@e.com": [], "m2@e.com": []}, None, None, None, None
            )
        self.assertEqual(len(result), 1)


class TestGetGoogleCalendarSlotsMember(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.member = "test_fa_ats_member@example.com"
        make_user_availability(cls.member, slug="fa-ats-member")

    def test_no_calendar_returns_none(self):
        """12.5 a member with no linked calendar returns None."""
        self.assertIsNone(get_google_calendar_slots_member("no-uaa@example.com", None, None, None, None))

    def test_self_created_event_in_range_kept(self):
        """12.5 a self-created event within the window is kept."""
        starttime = convert_timezone_to_utc("2027-01-15T00:00:00", "UTC")
        endtime = convert_timezone_to_utc("2027-01-15T23:59:59", "UTC")
        event = {
            "creator": {"email": self.member},
            "start": {"dateTime": "2027-01-15T10:00:00", "timeZone": "UTC"},
            "end": {"dateTime": "2027-01-15T10:30:00", "timeZone": "UTC"},
        }
        with mock_gcal_object(TIME_SLOT_MODULE, items=[event]):
            result = get_google_calendar_slots_member(self.member, starttime, endtime, get_datetime("2027-01-15"), None)
        self.assertEqual(len(result), 1)
