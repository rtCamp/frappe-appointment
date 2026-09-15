import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_to_date, now_datetime

from frappe_appointment.overrides.event_override import EventOverride, has_permission
from frappe_appointment.tests import make_appointment_group, make_google_calendar, make_user_availability

UAA = "User Appointment Availability"


class TestHasPermission(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.todo = frappe.get_doc({"doctype": "ToDo", "description": "fa perm todo"}).insert(ignore_permissions=True)

    def test_administrator_allowed(self):
        """16.1 the Administrator always has permission."""
        doc = frappe._dict(event_type="Private", owner="someone@example.com", custom_doctype_link_with_event=[])
        self.assertTrue(has_permission(doc, "Administrator"))

    def test_public_event_allowed(self):
        """16.1 a Public event is readable by anyone."""
        doc = frappe._dict(event_type="Public", owner="a@example.com", custom_doctype_link_with_event=[])
        self.assertTrue(has_permission(doc, "b@example.com"))

    def test_owner_allowed(self):
        """16.1 the event owner has permission."""
        doc = frappe._dict(event_type="Private", owner="a@example.com", custom_doctype_link_with_event=[])
        self.assertTrue(has_permission(doc, "a@example.com"))

    def test_no_readable_link_denied(self):
        """16.2 a non-owner, non-public event with no readable linked reference is denied."""
        doc = frappe._dict(event_type="Private", owner="a@example.com", custom_doctype_link_with_event=[])
        self.assertFalse(has_permission(doc, "b@example.com"))

    def test_readable_link_allowed(self):
        """16.2 a readable linked reference grants permission."""
        doc = frappe._dict(
            event_type="Private",
            owner="a@example.com",
            custom_doctype_link_with_event=[frappe._dict(reference_doctype="ToDo", reference_docname=self.todo.name)],
        )
        self.assertTrue(has_permission(doc, "b@example.com"))


class TestParticipantSplit(IntegrationTestCase):
    def _event(self, participants):
        doc = EventOverride.__new__(EventOverride)
        doc.event_participants = [frappe._dict(p) for p in participants]
        return doc

    def test_recipients_exclude_organiser_doctypes(self):
        """16.3 get_recipients_event returns participants not referencing organiser doctypes."""
        doc = self._event(
            [
                {"reference_doctype": UAA, "email": "organiser@example.com"},
                {"reference_doctype": None, "email": "guest@example.com"},
            ]
        )
        self.assertEqual(doc.get_recipients_event(), ["guest@example.com"])

    def test_organisers_are_deduplicated(self):
        """16.4 get_organisers_event returns de-duplicated organiser-doctype emails."""
        doc = self._event(
            [
                {"reference_doctype": UAA, "email": "organiser@example.com"},
                {"reference_doctype": "Google Calendar", "email": "organiser@example.com"},
                {"reference_doctype": None, "email": "guest@example.com"},
            ]
        )
        self.assertEqual(doc.get_organisers_event(), ["organiser@example.com"])

    def test_empty_participants(self):
        """16.5 both lists are empty when there are no participants."""
        doc = self._event([])
        self.assertEqual(doc.get_recipients_event(), [])
        self.assertEqual(doc.get_organisers_event(), [])


class TestRescheduleUrl(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_resched@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA Resched")
        make_user_availability(cls.user, slug="fa-resched", google_calendar=cls.gcal.name)
        cls.allowed = make_appointment_group(
            "FA Resched Allowed", event_creator=cls.gcal.name, members=[cls.user], allow_rescheduling=1
        )
        cls.blocked = make_appointment_group(
            "FA Resched Blocked", event_creator=cls.gcal.name, members=[cls.user], allow_rescheduling=0
        )

    def _event(self, group):
        from frappe_appointment.tests import make_event

        starts = add_to_date(now_datetime(), days=2)
        return make_event(
            "FA Resched Event", starts, add_to_date(starts, hours=1), appointment_group=group, account=self.gcal
        )

    def test_unsaved_event_returns_none(self):
        """16.6 an unsaved event has no reschedule url."""
        doc = EventOverride.__new__(EventOverride)
        doc.name = None
        self.assertIsNone(doc.reschedule_url)

    def test_rescheduling_disabled_returns_none(self):
        """16.6 a group that disallows rescheduling yields no reschedule url."""
        self.assertIsNone(self._event(self.blocked.name).reschedule_url)

    def test_rescheduling_allowed_returns_url(self):
        """16.6 a group that allows rescheduling yields a signed reschedule url."""
        url = self._event(self.allowed.name).reschedule_url
        self.assertIn("/schedule/gr/", url)
        self.assertIn("reschedule=1", url)

    def test_as_dict_includes_reschedule_url(self):
        """16.7 as_dict injects the reschedule_url key."""
        self.assertIn("reschedule_url", self._event(self.allowed.name).as_dict())
