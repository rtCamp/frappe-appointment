import frappe.integrations.doctype.google_calendar.google_calendar as gc_module
from frappe.tests import IntegrationTestCase

from frappe_appointment.monkey_patch import patch_all, update_event_in_google_calendar_override


class TestMonkeyPatch(IntegrationTestCase):
    def setUp(self):
        self._original = gc_module.update_event_in_google_calendar

    def tearDown(self):
        gc_module.update_event_in_google_calendar = self._original

    def test_patch_all_rebinds_update(self):
        """24.4 patch_all rebinds update_event_in_google_calendar to the override."""
        patch_all()
        self.assertIs(gc_module.update_event_in_google_calendar, update_event_in_google_calendar_override)
