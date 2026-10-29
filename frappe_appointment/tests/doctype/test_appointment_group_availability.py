import datetime
from unittest.mock import patch

import frappe
import pytz
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, add_to_date, get_datetime, getdate

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    _get_time_slots_for_day,
    check_availability,
    get_avaiable_time_slot_for_day,
    get_booking_frequency_reached,
    get_max_min_time_slot,
    get_next_available_day,
    get_next_round_value,
    get_previous_available_day,
    get_response_body,
    get_time_slots_for_given_date,
    get_user_time_slots,
    hours_to_time_slot,
    is_member_on_leave_or_is_holiday,
    is_valid_buffer_time,
    update_cal_slots_with_events,
    vaild_date,
)
from frappe_appointment.helpers.utils import convert_timezone_to_utc, get_utc_datatime_with_time
from frappe_appointment.tests import (
    make_appointment_group,
    make_approved_leave,
    make_employee,
    make_event,
    make_google_calendar,
    make_holiday_list,
    make_user_availability,
)

AG = "frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group"

FIXED = get_datetime("2027-01-15 00:00:00")


def _with_extra_rows(doctype, *rows):
    """Patch frappe.get_all to add `rows` to reads of `doctype`.

    They stand in for rows the database matches by accents or trailing spaces alone, which a member's
    name or an employee's doesn't equal in Python.
    """
    get_all = frappe.get_all

    def get_all_with_rows(dt, *args, **kwargs):
        result = get_all(dt, *args, **kwargs)
        return result + [frappe._dict(row) for row in rows] if dt == doctype else result

    return patch("frappe.get_all", side_effect=get_all_with_rows)


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

    def test_member_name_case_differs(self):
        """5.10 a member row whose name differs from its availability only in case still gets its hours."""
        user = "test_fa_ca_case@example.com"
        make_user_availability(user, slug="fa-ca-case")
        group = make_appointment_group("FA CA Case", members=[user])
        frappe.db.set_value("Members", {"parent": group.name}, "user", user.upper())
        group = frappe.get_doc("Appointment Group", group.name)
        res = check_availability(self._valid_dvo(), "Monday", group)
        self.assertEqual(res["available_days"], {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"})

    def test_hours_of_a_near_match_are_skipped(self):
        """5.11 hours whose availability only nearly matches a member's name are skipped, not an error."""
        group = frappe.get_doc("Appointment Group", self.group.name)
        near_match = {"parent": "tést_fa_ca_weekdays@example.com", "day": "Saturday"}
        with _with_extra_rows("Appointment Time Slot", near_match | {"start_time": "09:00:00", "end_time": "17:00:00"}):
            res = check_availability(self._valid_dvo(), "Monday", group)
        self.assertEqual(res["available_days"], {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"})

    def test_weekly_hours_read_once_per_group(self):
        """5.9 the members' weekly hours are read once per group object, not once per day."""
        group = frappe.get_doc("Appointment Group", self.disjoint_group.name)
        check_availability(self._valid_dvo(), "Monday", group)
        with self.assertQueryCount(0):
            res = check_availability(self._valid_dvo(), "Tuesday", group)
        self.assertFalse(res["available_days"])


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

        cls.far_holiday_user = "test_fa_far_holiday@example.com"
        make_user_availability(cls.far_holiday_user, slug="fa-far-holiday")
        far_holiday_list = make_holiday_list(
            "FA HL Far", holidays=[("2027-02-10", "Founders Day"), ("2027-06-15", "Midsummer")]
        )
        make_employee(cls.far_holiday_user, holiday_list=far_holiday_list.name)
        cls.far_holiday_group = make_appointment_group("FA Far Holiday Grp", members=[cls.far_holiday_user])

        # The Employee's company email differs from the member only in case.
        cls.case_user = "test_fa_case_leave@example.com"
        make_user_availability(cls.case_user, slug="fa-case-leave")
        case_emp = make_employee(cls.case_user)
        frappe.db.set_value("Employee", case_emp.name, "company_email", cls.case_user.upper())
        make_approved_leave(case_emp.name, "2027-03-01", "2027-03-01")
        cls.case_group = make_appointment_group("FA Case Leave Grp", members=[cls.case_user])

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

    def test_member_without_employee_does_not_hide_others_leave(self):
        """10.9 a member with no Employee record listed first doesn't stop the next member's leave counting."""
        group = make_appointment_group("FA NoEmp Then Leave Grp", members=[self.no_emp_user, self.leave_user])
        self.assertTrue(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 2)))

    def test_leave_of_a_near_match_is_skipped(self):
        """10.10 leave whose employee only nearly matches a member's employee is skipped, not an error."""
        group = frappe.get_doc("Appointment Group", self.free_group.name)
        near_match = {"employee": "HR-EMP-NEAR-MATCH ", "from_date": getdate("2027-02-20")}
        with _with_extra_rows("Leave Application", near_match | {"to_date": getdate("2027-02-20")}):
            self.assertFalse(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 20)))

    def test_days_in_window_read_once(self):
        """10.5 leave and holidays are read once for the window; later days in it need no queries."""
        group = frappe.get_doc("Appointment Group", self.leave_group.name)
        # The leave started on 2027-02-01, before the window opens on 2027-02-02.
        self.assertTrue(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 2)))
        with self.assertQueryCount(0):
            self.assertTrue(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 3)))
            self.assertFalse(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 4)))

    def test_day_past_window_reads_again(self):
        """10.6 a day past the window reads that day's leave and holidays instead of reusing the old window."""
        group = frappe.get_doc("Appointment Group", self.far_holiday_group.name)
        self.assertTrue(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 10)))
        self.assertTrue(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 6, 15)))

    def test_day_before_window_reads_again(self):
        """10.8 a day before the window (the day-before lookup) reads that day instead of reusing the window."""
        group = frappe.get_doc("Appointment Group", self.far_holiday_group.name)
        self.assertFalse(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 11)))
        self.assertTrue(is_member_on_leave_or_is_holiday(group, datetime.date(2027, 2, 10)))

    def test_company_email_matches_case_insensitively(self):
        """10.7 an Employee whose company email differs from the member only in case still counts."""
        self.assertTrue(is_member_on_leave_or_is_holiday(self.case_group, datetime.date(2027, 3, 1)))


class TestSlotCalculation(IntegrationTestCase):
    """A whole day's slot calculation on real members, with only the Google Calendar read patched out."""

    MONDAY, HOLIDAY_TUESDAY, WEDNESDAY, THURSDAY = "2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # The early member works Mon-Fri 09:00-17:00 and has a holiday on the Tuesday.
        cls.early_user = "test_fa_sc_early@example.com"
        make_user_availability(cls.early_user, slug="fa-sc-early")
        holiday_list = make_holiday_list("FA SC HL", holidays=[(cls.HOLIDAY_TUESDAY, "SC Day")])
        make_employee(cls.early_user, holiday_list=holiday_list.name)

        # The late member works 11:00-15:00 on every weekday but Wednesday.
        cls.late_user = "test_fa_sc_late@example.com"
        make_user_availability(
            cls.late_user,
            slug="fa-sc-late",
            days=[(d, "11:00:00", "15:00:00") for d in ["Monday", "Tuesday", "Thursday", "Friday"]],
        )
        make_employee(cls.late_user)

        cls.group = make_appointment_group("FA SC Group", members=[cls.early_user, cls.late_user])

    def _slots(self, group, day):
        with patch(f"{AG}.get_all_unavailable_google_calendar_slots_for_day", return_value=[]):
            return get_time_slots_for_given_date(group, get_datetime(day))

    def _fresh_group(self):
        return frappe.get_doc("Appointment Group", self.group.name)

    def test_shared_hours_set_the_day_window(self):
        """11.1 a day runs from the latest start to the earliest end of the mandatory members' hours."""
        res = self._slots(self._fresh_group(), self.MONDAY)
        start = get_utc_datatime_with_time(get_datetime(self.MONDAY), "11:00:00")
        end = get_utc_datatime_with_time(get_datetime(self.MONDAY), "15:00:00")
        self.assertFalse(res["is_invalid_date"])
        self.assertEqual((res["starttime"], res["endtime"]), (start, end))
        self.assertEqual(res["total_slots_for_day"], 8)
        self.assertEqual(res["all_available_slots_for_data"][0]["start_time"], start)
        self.assertEqual(res["all_available_slots_for_data"][-1]["end_time"], end)
        self.assertEqual(res["available_days"], {"Monday", "Tuesday", "Thursday", "Friday"})

    def test_day_a_member_does_not_work_has_no_slots(self):
        """11.2 a weekday one mandatory member doesn't work is invalid and points to the next shared day."""
        res = self._slots(self._fresh_group(), self.WEDNESDAY)
        self.assertTrue(res["is_invalid_date"])
        self.assertEqual(res["total_slots_for_day"], 0)
        self.assertEqual(getdate(res["next_valid_date"]), getdate(self.THURSDAY))

    def test_member_holiday_has_no_slots(self):
        """11.3 a mandatory member's holiday leaves the day with no slots."""
        res = self._slots(self._fresh_group(), self.HOLIDAY_TUESDAY)
        self.assertEqual(res["total_slots_for_day"], 0)
        self.assertEqual(res["all_available_slots_for_data"], [])

    def test_one_group_across_days_matches_fresh_groups(self):
        """11.4 one group object reused across days gives the same result as a fresh group for each day."""
        days = [self.MONDAY, self.HOLIDAY_TUESDAY, self.WEDNESDAY, self.THURSDAY, self.MONDAY]
        reused = self._fresh_group()
        for day in days:
            with self.subTest(day=day):
                self.assertEqual(self._slots(reused, day), self._slots(self._fresh_group(), day))

    def test_guest_timezone_paths(self):
        """11.5 the day-before (ahead of UTC) and day-after (behind UTC) paths give the same slots."""
        with patch(f"{AG}.get_all_unavailable_google_calendar_slots_for_day", return_value=[]):
            for offset in ("330", "-300"):
                with self.subTest(offset=offset):
                    monday = _get_time_slots_for_day(self._fresh_group(), self.MONDAY, offset)
                    holiday = _get_time_slots_for_day(self._fresh_group(), self.HOLIDAY_TUESDAY, offset)
                    self.assertEqual(monday["total_slots_for_day"], 8)
                    self.assertEqual(holiday["total_slots_for_day"], 0)
