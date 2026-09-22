import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import get_datetime

from frappe_appointment.helpers.ics_file import add_ics_file_in_attachment
from frappe_appointment.tests import make_test_user


class TestAddIcsFileInAttachment(IntegrationTestCase):
    def _event(self, appointment_group=None, user_calendar=None):
        return frappe._dict(
            subject="Sync Meet",
            starts_on=get_datetime("2027-01-15 10:00:00"),
            ends_on=get_datetime("2027-01-15 10:30:00"),
            description="details",
            appointment_group=appointment_group,
            user_calendar=user_calendar,
        )

    def test_builds_invite_ics_file(self):
        """23.4 add_ics_file_in_attachment builds an invite.ics File carrying the subject and Frappe PRODID."""
        name = add_ics_file_in_attachment(self._event())
        file_doc = frappe.get_doc("File", name)
        self.assertTrue(file_doc.file_name.endswith(".ics"))  # frappe deduplicates the base name
        content = file_doc.get_content()
        self.assertIn("Sync Meet", content)
        self.assertIn("PRODID:-//Frappe Appointment", content)

    def test_includes_organizer_from_appointment_group(self):
        """23.4 the ICS includes an ORGANIZER line when the appointment group has an organizer."""
        organizer = "test_fa_ics_org@example.com"
        make_test_user(organizer)
        event = self._event(appointment_group=frappe._dict(event_organizer=organizer))
        content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertIn("ORGANIZER", content)

    def test_keeps_organizer_when_hide_flag_is_absent(self):
        """Without hide_ics_organizer on the event, the ORGANIZER line carries the organizer's email."""
        organizer = "test_fa_ics_org_default@example.com"
        make_test_user(organizer)
        event = self._event(appointment_group=frappe._dict(event_organizer=organizer))
        content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertIn("ORGANIZER", content)
        self.assertIn(f"MAILTO:{organizer}", content)

    def test_omits_organizer_when_hide_flag_is_set(self):
        """With hide_ics_organizer=True on the event, the ICS has no ORGANIZER line and no organizer email."""
        organizer = "test_fa_ics_org_hidden@example.com"
        make_test_user(organizer)
        event = self._event(appointment_group=frappe._dict(event_organizer=organizer))
        event.hide_ics_organizer = True
        content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertNotIn("ORGANIZER", content)
        self.assertNotIn(organizer, content)
        self.assertIn("Sync Meet", content)
