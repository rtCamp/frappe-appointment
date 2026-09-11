import json
from unittest.mock import patch

import frappe
import pytz
from frappe.tests import IntegrationTestCase

from frappe_appointment.api.personal_meet import (
    book_time_slot,
    create_dummy_appointment_group,
    get_all_timezones,
    get_meeting_windows,
    get_schedular_link,
    get_time_slots,
)
from frappe_appointment.tests import make_slot_duration, make_user_availability

PM = "frappe_appointment.api.personal_meet"


class TestGetMeetingWindows(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_pmwin@example.com"
        make_user_availability(
            cls.user, slug="fa-pmwin", enable_scheduling=1, durations=[make_slot_duration(title="30 Min")]
        )

    def test_valid_slug_returns_profile_and_durations(self):
        """14.1 an enabled slug returns the profile and duration list with status 200."""
        result = get_meeting_windows("fa-pmwin")
        self.assertEqual(result["full_name"], "test_fa_pmwin")
        self.assertEqual(result["meeting_provider"], "Google Meet")
        self.assertEqual(len(result["durations"]), 1)
        self.assertEqual(frappe.local.response.http_status_code, 200)

    def test_unknown_slug_returns_404(self):
        """14.2 an unknown slug returns a No-user error with status 404."""
        result = get_meeting_windows("fa-no-such-slug")
        self.assertEqual(result["error"], "No user found")
        self.assertEqual(frappe.local.response.http_status_code, 404)


class TestGetTimeSlots(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_pmts@example.com"
        uaa = make_user_availability(cls.user, slug="fa-pmts", durations=[make_slot_duration()])
        cls.duration_id = uaa.available_durations[0].name

    def test_missing_date_returns_400(self):
        """14.3 missing both date and start/end returns status 400."""
        get_time_slots(self.duration_id, date=None, user_timezone_offset="0")
        self.assertEqual(frappe.local.response.http_status_code, 400)

    def test_missing_timezone_returns_400(self):
        """14.4 a missing timezone offset returns status 400."""
        get_time_slots(self.duration_id, date="2027-01-15", user_timezone_offset=None)
        self.assertEqual(frappe.local.response.http_status_code, 400)

    def test_unknown_duration_raises(self):
        """14.5 an unknown duration id raises DoesNotExistError."""
        with self.assertRaises(frappe.DoesNotExistError):
            get_time_slots("fa-nonexistent-duration", date="2027-01-15", user_timezone_offset="0")

    def test_valid_date_augments_payload(self):
        """14.6 a valid single date adds user/label/rescheduling_allowed and drops appointment_group_id."""
        stub = {"appointment_group_id": "x", "all_available_slots_for_data": []}
        with patch(f"{PM}._get_time_slots_for_day", return_value=stub):
            result = get_time_slots(self.duration_id, date="2027-01-15", user_timezone_offset="0")
        self.assertNotIn("appointment_group_id", result)
        self.assertEqual(result["user"], self.user)
        self.assertEqual(result["label"], "30 Minutes")
        self.assertFalse(result["rescheduling_allowed"])


class TestPersonalMeetHelpers(IntegrationTestCase):
    def test_create_dummy_appointment_group(self):
        """14.7 create_dummy_appointment_group builds a personal-meeting group from a duration + availability."""
        duration = frappe._dict(
            name="dur-1",
            duration=1800,
            minimum_buffer_time=0,
            minimum_notice_before_event=0,
            availability_window=0,
            limit_booking_frequency=5,
            allow_rescheduling=1,
            minimum_notice_for_reschedule=2,
        )
        ua = frappe._dict(
            name="uaa-1",
            user="u@example.com",
            google_calendar="gc-1",
            meeting_provider="Zoom",
            meeting_link="link",
            response_email_template=None,
        )
        result = create_dummy_appointment_group(duration, ua)
        self.assertEqual(result["is_personal_meeting"], 1)
        self.assertEqual(result["limit_booking_frequency"], 5)
        self.assertEqual(result["members"], [{"user": "uaa-1", "is_mandatory": 1}])
        self.assertEqual(result["duration_for_event"], 1800)

    def test_get_all_timezones(self):
        """14.8 get_all_timezones returns pytz.common_timezones."""
        self.assertEqual(get_all_timezones(), pytz.common_timezones)


class TestGetSchedularLink(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_pmlink@example.com"
        make_user_availability(cls.user, slug="fa-pmlink", enable_scheduling=1, durations=[make_slot_duration()])

    def test_returns_link_and_durations(self):
        """14.9 an enabled availability returns url, slug and available_durations."""
        result = get_schedular_link(self.user)
        self.assertEqual(result["slug"], "fa-pmlink")
        self.assertEqual(len(result["available_durations"]), 1)

    def test_unknown_user_returns_error(self):
        """14.9 an unknown user returns a No-user error with status 404."""
        result = get_schedular_link("fa-no-user@example.com")
        self.assertEqual(result[0]["error"], "No user found")
        self.assertEqual(result[1], 404)


class TestBookTimeSlot(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_pmbook@example.com"
        uaa = make_user_availability(cls.user, slug="fa-pmbook", durations=[make_slot_duration()])
        cls.duration_id = uaa.available_durations[0].name

    def test_filters_invalid_other_participants(self):
        """14.10 invalid other_participants emails are filtered before delegating to event creation."""
        with patch(f"{PM}._create_event_for_appointment_group", return_value="SENTINEL") as create:
            result = book_time_slot(
                self.duration_id,
                "2027-01-15",
                "2027-01-15 10:00:00+0000",
                "2027-01-15 10:30:00+0000",
                "0",
                "John",
                "john@example.com",
                other_participants="valid@example.com,not-an-email,also@example.com",
            )
        self.assertEqual(result, "SENTINEL")
        participants = json.loads(create.call_args.args[5])
        emails = [p.get("email") for p in participants]
        self.assertIn("valid@example.com", emails)
        self.assertIn("also@example.com", emails)
        self.assertNotIn("not-an-email", emails)
