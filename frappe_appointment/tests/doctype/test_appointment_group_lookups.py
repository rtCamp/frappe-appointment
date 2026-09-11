from urllib.parse import quote_plus

import frappe
from frappe.tests import IntegrationTestCase

from frappe_appointment.frappe_appointment.doctype.appointment_group.appointment_group import (
    get_appointment_group_from_id,
    get_appointment_groups_from_doctype,
)
from frappe_appointment.tests import make_appointment_group, make_google_calendar, make_user_availability


class TestAppointmentGroupLookups(IntegrationTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user = "test_fa_lookup@example.com"
        cls.gcal = make_google_calendar(cls.user, calendar_name="GCal FA Lookup")
        make_user_availability(cls.user, slug="fa-lookup", google_calendar=cls.gcal.name)
        cls.group = make_appointment_group(
            "FA Lookup Group", event_creator=cls.gcal.name, members=[cls.user], linked_doctype="ToDo"
        )

    def _route(self, name):
        return frappe.utils.get_url(f"/schedule/gr/{quote_plus(name)}", full_address=True)

    def test_groups_from_doctype(self):
        """11.1 get_appointment_groups_from_doctype returns name + route for matching groups."""
        result = get_appointment_groups_from_doctype("ToDo")
        entry = next(r for r in result if r["name"] == self.group.name)
        self.assertEqual(entry["route"], self._route(self.group.name))

    def test_groups_from_doctype_no_match(self):
        """11.2 get_appointment_groups_from_doctype returns [] when no group is linked."""
        self.assertEqual(get_appointment_groups_from_doctype("Currency"), [])

    def test_group_from_id(self):
        """11.3 get_appointment_group_from_id returns name + route for an existing group."""
        result = get_appointment_group_from_id(self.group.name)
        self.assertEqual(result["name"], self.group.name)
        self.assertEqual(result["route"], self._route(self.group.name))

    def test_group_from_id_unknown(self):
        """11.4 get_appointment_group_from_id returns None for an unknown id."""
        self.assertIsNone(get_appointment_group_from_id("fa-nonexistent-group-xyz"))
