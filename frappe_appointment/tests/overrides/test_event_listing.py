import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, now_datetime

from frappe_appointment.overrides.event_override import get_events_from_doc, get_personal_meetings
from frappe_appointment.tests import (
    make_appointment_group,
    make_event,
    make_google_calendar,
    make_slot_duration,
    make_user_availability,
)


class TestGetEventsFromDoc(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_list@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA List")
        make_user_availability(cls.user, slug="fa-list", google_calendar=cls.gcal.name)
        cls.group = make_appointment_group(
            "FA List Group", event_creator=cls.gcal.name, members=[cls.user], allow_rescheduling=1
        )
        cls.todo = frappe.get_doc({"doctype": "ToDo", "description": "fa list todo"}).insert(ignore_permissions=True)
        now = now_datetime()
        cls._make("FA List Future", add_to_date(now, days=2), add_to_date(now, days=2, hours=1))
        cls._make("FA List Past", add_to_date(now, days=-2), add_to_date(now, days=-1))

    @classmethod
    def _make(cls, subject, starts, ends):
        make_event(
            subject,
            starts,
            ends,
            appointment_group=cls.group.name,
            account=cls.gcal,
            custom_doctype_link_with_event=[{"reference_doctype": "ToDo", "reference_docname": cls.todo.name}],
        )

    def test_categorizes_with_past(self):
        """19.1 linked events are grouped into upcoming/ongoing/past."""
        result = get_events_from_doc("ToDo", self.todo.name, past_events=True)
        self.assertEqual(len(result["upcoming"]), 1)
        self.assertEqual(len(result["past"]), 1)

    def test_excludes_past_when_flag_false(self):
        """19.2 past_events=False excludes ended events from the query."""
        result = get_events_from_doc("ToDo", self.todo.name, past_events=False)
        self.assertEqual(result["past"], [])
        self.assertEqual(len(result["upcoming"]), 1)

    def test_reschedule_url_present(self):
        """19.3 an event of a reschedulable group carries a reschedule url."""
        result = get_events_from_doc("ToDo", self.todo.name, past_events=False)
        self.assertIsNotNone(result["upcoming"][0]["reschedule_url"])

    def test_no_events_returns_none(self):
        """19.4 no linked events returns None."""
        self.assertIsNone(get_events_from_doc("ToDo", "fa-nonexistent-docname"))


class TestGetPersonalMeetings(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_pmlist@example.com"
        cls.uaa = make_user_availability(cls.user, slug="fa-pmlist", durations=[make_slot_duration()])
        cls.gcal = frappe.get_doc("Google Calendar", cls.uaa.google_calendar)
        duration_id = cls.uaa.available_durations[0].name
        now = now_datetime()
        make_event(
            "FA PM Future",
            add_to_date(now, days=2),
            add_to_date(now, days=2, hours=1),
            user_calendar=cls.uaa.name,
            account=cls.gcal,
            custom_appointment_slot_duration=duration_id,
            custom_doctype_link_with_event=[
                {"reference_doctype": "User Appointment Availability", "reference_docname": cls.uaa.name}
            ],
        )

    def test_returns_upcoming_meeting(self):
        """19.5 get_personal_meetings groups the user's personal events."""
        result = get_personal_meetings(self.uaa.name)
        self.assertEqual(len(result["upcoming"]), 1)
