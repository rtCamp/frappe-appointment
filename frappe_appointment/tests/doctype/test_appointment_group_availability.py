import datetime

import pytz
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, add_to_date, get_datetime

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    check_availability,
    get_avaiable_time_slot_for_day,
    get_booking_frequency_reached,
    get_max_min_time_slot,
    get_next_available_day,
    get_next_round_value,
    get_previous_available_day,
    get_response_body,
    get_user_time_slots,
    hours_to_time_slot,
    is_member_on_leave_or_is_holiday,
    is_valid_buffer_time,
    update_cal_slots_with_events,
    vaild_date,
)
from frappe_appointment.helpers.utils import convert_timezone_to_utc
from frappe_appointment.tests import (
    make_appointment_group,
    make_approved_leave,
    make_employee,
    make_event,
    make_google_calendar,
    make_holiday_list,
    make_user_availability,
)

FIXED = get_datetime("2027-01-15 00:00:00")


def _slot(start, end):
    """A busy calendar slot with UTC starts_on/ends_on datetimes."""
    return {"starts_on": get_datetime(start), "ends_on": get_datetime(end)}


class TestAvailableDayMath(IntegrationTestCase):
    def test_next_available_day_same_week(self):
        """5.1 get_next_available_day returns the day offset to the next available weekday."""
        self.assertEqual(get_next_available_day("Monday", {"Wednesday"}), 2)

    def test_next_available_day_wraps(self):
        """5.2 get_next_available_day wraps across the week boundary."""
        self.assertEqual(get_next_available_day("Saturday", {"Monday"}), 2)

    def test_next_available_day_none(self):
        """5.3 get_next_available_day returns None when no day is available."""
        self.assertIsNone(get_next_available_day("Monday", set()))

    def test_previous_available_day(self):
        """5.4 get_previous_available_day returns the offset to the previous available weekday."""
        self.assertEqual(get_previous_available_day("Monday", {"Saturday"}), 2)

    def test_previous_available_day_none(self):
        """5.5 get_previous_available_day returns None when no day is available."""
        self.assertIsNone(get_previous_available_day("Monday", set()))


class TestCheckAvailability(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.weekday_user = "test_fa_ca_weekdays@example.com"
        make_user_availability(
            cls.weekday_user,
            slug="fa-ca-weekdays",
            days=[(d, "09:00:00", "17:00:00") for d in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]],
        )
        cls.group = make_appointment_group("FA CA Group", members=[cls.weekday_user])

        cls.mon_user = "test_fa_ca_mon@example.com"
        cls.tue_user = "test_fa_ca_tue@example.com"
        make_user_availability(cls.mon_user, slug="fa-ca-mon", days=[("Monday", "09:00:00", "17:00:00")])
        make_user_availability(cls.tue_user, slug="fa-ca-tue", days=[("Tuesday", "09:00:00", "17:00:00")])
        cls.disjoint_group = make_appointment_group("FA CA Disjoint", members=[cls.mon_user, cls.tue_user])

    def _valid_dvo(self):
        today = get_datetime(datetime.datetime.utcnow().date())
        return {
            "is_valid": True,
            "valid_start_date": today,
            "valid_end_date": add_days(today, 10),
            "next_valid_date": today,
            "prev_valid_date": today,
        }

    def test_weekday_in_intersection_is_valid(self):
        """5.6 a weekday inside the mandatory members' shared days is not invalid."""
        res = check_availability(self._valid_dvo(), "Monday", self.group)
        self.assertFalse(res["is_invalid_date"])
        self.assertIn("Monday", res["available_days"])

    def test_weekday_outside_intersection_shifts_dates(self):
        """5.7 a weekday outside the shared days is invalid and shifts next/prev valid dates."""
        dvo = self._valid_dvo()
        today = dvo["next_valid_date"]
        res = check_availability(dvo, "Saturday", self.group)
        self.assertTrue(res["is_invalid_date"])
        self.assertEqual(dvo["next_valid_date"], add_days(today, 2))
        self.assertEqual(dvo["prev_valid_date"], today)

    def test_empty_intersection_marks_no_slots(self):
        """5.8 members sharing no available day yields no slots and an invalid date."""
        res = check_availability(self._valid_dvo(), "Monday", self.disjoint_group)
        self.assertFalse(res["is_slots_available"])
        self.assertTrue(res["is_invalid_date"])


class TestValidDate(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.today = get_datetime(datetime.datetime.utcnow().date())

    def test_before_minimum_notice_is_invalid(self):
        """6.1 a date before today + minimum_notice_before_event is invalid."""
        group = make_appointment_group("FA VD Notice", minimum_notice_before_event=2, event_availability_window=0)
        res = vaild_date(self.today, group)
        self.assertFalse(res["is_valid"])
        self.assertEqual(res["valid_start_date"], add_days(self.today, 2))
        self.assertEqual(res["next_valid_date"], add_days(self.today, 2))

    def test_past_window_is_invalid(self):
        """6.2 a date past the availability window is invalid, next_valid_date is the window end."""
        group = make_appointment_group("FA VD Window", minimum_notice_before_event=0, event_availability_window=3)
        res = vaild_date(add_days(self.today, 5), group)
        self.assertFalse(res["is_valid"])
        self.assertEqual(res["valid_end_date"], add_days(self.today, 2))
        self.assertEqual(res["next_valid_date"], add_days(self.today, 2))

    def test_inside_window_is_valid(self):
        """6.3 a date inside the window is valid with next/prev equal to the date."""
        group = make_appointment_group("FA VD Inside", minimum_notice_before_event=0, event_availability_window=10)
        target = add_days(self.today, 1)
        res = vaild_date(target, group)
        self.assertTrue(res["is_valid"])
        self.assertEqual(res["next_valid_date"], target)
        self.assertEqual(res["prev_valid_date"], target)

    def test_zero_window_has_no_end_bound(self):
        """6.4 event_availability_window of 0 imposes no end bound."""
        group = make_appointment_group("FA VD NoEnd", minimum_notice_before_event=0, event_availability_window=0)
        res = vaild_date(add_days(self.today, 365), group)
        self.assertTrue(res["is_valid"])


class TestBookingFrequency(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_bf@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA BF")
        make_user_availability(cls.user, slug="fa-bf", google_calendar=cls.gcal.name)
        cls.limited = make_appointment_group(
            "FA BF Limited", event_creator=cls.gcal.name, members=[cls.user], limit_booking_frequency=2
        )
        cls.unlimited = make_appointment_group(
            "FA BF Unlimited", event_creator=cls.gcal.name, members=[cls.user], limit_booking_frequency=-1
        )

    def _make_events(self, group_name, count):
        for i in range(count):
            make_event(
                f"FA BF Event {group_name} {i}",
                add_to_date(FIXED, hours=10 + i),
                add_to_date(FIXED, hours=10 + i, minutes=30),
                appointment_group=group_name,
                account=self.gcal,
            )

    def test_negative_limit_always_available(self):
        """7.1 limit_booking_frequency < 0 keeps slots available regardless of existing events."""
        self._make_events(self.unlimited.name, 3)
        res = get_booking_frequency_reached(FIXED, self.unlimited)
        self.assertTrue(res["is_slots_available"])

    def test_under_limit_available_and_sorted(self):
        """7.2 fewer same-day events than the limit stays available and returns events sorted by ends_on."""
        self._make_events(self.limited.name, 1)
        res = get_booking_frequency_reached(FIXED, self.limited)
        self.assertTrue(res["is_slots_available"])
        self.assertEqual(len(res["events"]), 1)

    def test_at_limit_not_available(self):
        """7.3 events reaching the limit make slots unavailable."""
        group = make_appointment_group(
            "FA BF Full", event_creator=self.gcal.name, members=[self.user], limit_booking_frequency=2
        )
        self._make_events(group.name, 2)
        res = get_booking_frequency_reached(FIXED, group)
        self.assertFalse(res["is_slots_available"])


class TestSlotGeneration(IntegrationTestCase):
    def test_next_round_value(self):
        """8.1 get_next_round_value advances by the buffer only when the flag is set."""
        base = get_datetime("2027-01-15 10:00:00")
        self.assertEqual(get_next_round_value(300, base, True), add_to_date(base, seconds=300))
        self.assertEqual(get_next_round_value(0, base, True), base)
        self.assertEqual(get_next_round_value(300, base, False), base)

    def test_is_valid_buffer_time(self):
        """8.2 is_valid_buffer_time is True only when the gap meets the buffer."""
        end = get_datetime("2027-01-15 10:00:00")
        self.assertTrue(is_valid_buffer_time(600, end, add_to_date(end, seconds=600)))
        self.assertFalse(is_valid_buffer_time(600, end, add_to_date(end, seconds=300)))
        self.assertTrue(is_valid_buffer_time(0, end, end))

    def test_get_max_min_time_slot(self):
        """8.3 get_max_min_time_slot narrows the window against each row."""
        rows = [self._dict(start_time="10:00:00", end_time="16:00:00")]
        self.assertEqual(get_max_min_time_slot(rows, "00:00:00", "24:00:00"), ["10:00:00", "16:00:00"])

    def _dict(self, **kw):
        import frappe

        return frappe._dict(kw)

    def _group(self, buffer, duration):
        return self._dict(minimum_buffer_time=buffer, duration_for_event=duration)

    def test_empty_busy_fills_window(self):
        """8.4 an empty busy list fills the window with back-to-back duration slots."""
        start = get_datetime("2027-01-15 10:00:00")
        end = get_datetime("2027-01-15 12:00:00")
        slots = get_avaiable_time_slot_for_day([], start, end, self._group(0, 1800))
        self.assertEqual(len(slots), 4)
        self.assertEqual(slots[0], {"start_time": start, "end_time": add_to_date(start, minutes=30)})

    def test_busy_slot_splits_window(self):
        """8.5 a busy slot removes the overlapping slot and resumes after the busy end."""
        start = get_datetime("2027-01-15 10:00:00")
        end = get_datetime("2027-01-15 12:00:00")
        busy = [_slot("2027-01-15 10:30:00", "2027-01-15 11:00:00")]
        slots = get_avaiable_time_slot_for_day(busy, start, end, self._group(0, 1800))
        starts = [s["start_time"] for s in slots]
        self.assertNotIn(get_datetime("2027-01-15 10:30:00"), starts)
        self.assertEqual(len(slots), 3)

    def test_trailing_partial_slot_dropped(self):
        """8.6 a trailing slot whose end passes the window end is not emitted."""
        start = get_datetime("2027-01-15 10:00:00")
        end = get_datetime("2027-01-15 11:15:00")
        slots = get_avaiable_time_slot_for_day([], start, end, self._group(0, 1800))
        self.assertEqual(len(slots), 2)

    def test_update_cal_slots_with_events(self):
        """8.7 update_cal_slots_with_events maps Google slots to UTC starts_on/ends_on."""
        google = [
            {
                "start": {"dateTime": "2027-01-15T10:00:00", "timeZone": "UTC"},
                "end": {"dateTime": "2027-01-15T10:30:00", "timeZone": "UTC"},
            }
        ]
        out = update_cal_slots_with_events(google, [])
        self.assertEqual(out[0]["starts_on"], convert_timezone_to_utc("2027-01-15T10:00:00", "UTC"))
        self.assertEqual(out[0]["ends_on"], convert_timezone_to_utc("2027-01-15T10:30:00", "UTC"))

    def test_get_user_time_slots_filters_by_day(self):
        """8.8 get_user_time_slots keeps only slots whose user-tz start day matches the date."""
        keep = {"start_time": pytz.utc.localize(get_datetime("2027-01-15 10:00:00"))}
        drop = {"start_time": pytz.utc.localize(get_datetime("2027-01-16 10:00:00"))}
        obj = {"today": {"all_available_slots_for_data": [keep, drop]}}
        result = get_user_time_slots(obj, "2027-01-15", "0")
        self.assertEqual(result, [keep])

    def test_hours_to_time_slot(self):
        """8.9 hours_to_time_slot returns whole hours between current time and the slot start."""
        current = pytz.utc.localize(get_datetime("2027-01-15 10:00:00"))
        self.assertEqual(hours_to_time_slot("2027-01-15 12:00:00+0000", "0", current), 2)


class TestResponseBody(IntegrationTestCase):
    def _dict(self, **kw):
        import frappe

        return frappe._dict(kw)

    def test_echoes_slots_and_group_fields(self):
        """9.1 get_response_body reports the slot count and echoes group/time fields."""
        group = self._dict(duration_for_event=1800, name="fa-rb-group")
        start = get_datetime("2027-01-15 10:00:00")
        end = get_datetime("2027-01-15 12:00:00")
        dvo = self._full_dvo()
        body = get_response_body(
            [{"a": 1}, {"b": 2}], group, starttime=start, endtime=end, date=start.date(), date_validation_obj=dvo
        )
        self.assertEqual(body["total_slots_for_day"], 2)
        self.assertEqual(body["duration"], 1800)
        self.assertEqual(body["appointment_group_id"], "fa-rb-group")
        self.assertEqual(body["starttime"], start)

    def test_carries_validation_fields(self):
        """9.2 get_response_body carries the date-validation fields through."""
        group = self._dict(duration_for_event=1800, name="fa-rb-group2")
        dvo = self._full_dvo()
        body = get_response_body([], group, date_validation_obj=dvo)
        self.assertEqual(body["valid_start_date"], dvo["valid_start_date"])
        self.assertEqual(body["next_valid_date"], dvo["next_valid_date"])
        self.assertEqual(body["available_days"], dvo["available_days"])
        self.assertFalse(body["is_invalid_date"])

    def _full_dvo(self):
        today = get_datetime("2027-01-15 00:00:00")
        return {
            "valid_start_date": today,
            "valid_end_date": add_days(today, 10),
            "next_valid_date": today,
            "prev_valid_date": today,
            "available_days": {"Monday", "Tuesday"},
        }


class TestMemberLeaveOrHoliday(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.leave_user = "test_fa_leave@example.com"
        cls.holiday_user = "test_fa_holiday@example.com"
        cls.free_user = "test_fa_free@example.com"
        cls.no_emp_user = "test_fa_noemp@example.com"
        for user, slug in (
            (cls.leave_user, "fa-leave"),
            (cls.holiday_user, "fa-holiday"),
            (cls.free_user, "fa-free"),
            (cls.no_emp_user, "fa-noemp"),
        ):
            make_user_availability(user, slug=slug)

        leave_emp = make_employee(cls.leave_user)
        make_approved_leave(leave_emp.name, "2027-02-01", "2027-02-03")
        cls.leave_group = make_appointment_group("FA Leave Grp", members=[cls.leave_user])

        holiday_list = make_holiday_list("FA HL", holidays=[("2027-02-10", "Founders Day")])
        make_employee(cls.holiday_user, holiday_list=holiday_list.name)
        cls.holiday_group = make_appointment_group("FA Holiday Grp", members=[cls.holiday_user])

        make_employee(cls.free_user)
        cls.free_group = make_appointment_group("FA Free Grp", members=[cls.free_user])

        cls.no_emp_group = make_appointment_group("FA NoEmp Grp", members=[cls.no_emp_user])

    def test_approved_leave_marks_unavailable(self):
        """10.1 an Approved leave covering the date returns True."""
        self.assertTrue(is_member_on_leave_or_is_holiday(self.leave_group, datetime.date(2027, 2, 2)))

    def test_holiday_marks_unavailable(self):
        """10.2 a date in the member's holiday list returns True."""
        self.assertTrue(is_member_on_leave_or_is_holiday(self.holiday_group, datetime.date(2027, 2, 10)))

    def test_no_leave_no_holiday_available(self):
        """10.3 no leave and no holiday returns False."""
        self.assertFalse(is_member_on_leave_or_is_holiday(self.free_group, datetime.date(2027, 2, 20)))

    def test_member_without_employee_available(self):
        """10.4 a member with no Employee record returns False."""
        self.assertFalse(is_member_on_leave_or_is_holiday(self.no_emp_group, datetime.date(2027, 2, 2)))
