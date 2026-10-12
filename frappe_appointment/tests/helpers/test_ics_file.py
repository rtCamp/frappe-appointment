import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import get_datetime

from frappe_appointment.helpers.ics_file import add_ics_file_in_attachment
from frappe_appointment.tests import gcal_service_mock, make_test_user, mock_gcal_object

ICS_FILE = "frappe_appointment.helpers.ics_file"


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

    def _google_event(self, sequence):
        event = self._event()
        event.update(
            name="EV-ICS-1",
            google_calendar="FA Calendar",
            google_calendar_id="primary",
            google_calendar_event_id="abc123",
        )
        service = gcal_service_mock()
        service.events().get().execute.return_value = {"iCalUID": "abc123@google.com", "sequence": sequence}
        return event, service

    def test_reuses_google_uid_and_sequence(self):
        """The .ics carries Google's iCalUID and sequence, so clients merge it with Google's invite."""
        event, service = self._google_event(sequence=0)
        with mock_gcal_object(ICS_FILE, service=service):
            content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertIn("UID:abc123@google.com", content)
        self.assertIn("SEQUENCE:0", content)

    def test_sequence_increases_on_reschedule(self):
        """After a reschedule Google bumps its sequence; the new .ics keeps the UID and follows it."""
        event, service = self._google_event(sequence=0)
        with mock_gcal_object(ICS_FILE, service=service):
            first = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
            service.events().get().execute.return_value = {"iCalUID": "abc123@google.com", "sequence": 1}
            second = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertIn("UID:abc123@google.com", first)
        self.assertIn("UID:abc123@google.com", second)
        self.assertIn("SEQUENCE:0", first)
        self.assertIn("SEQUENCE:1", second)

    def test_falls_back_to_google_id_when_fetch_fails(self):
        """If Google cannot be reached, the UID is still derived from the Google event id."""
        event, service = self._google_event(sequence=0)
        service.events().get().execute.side_effect = Exception("network down")
        with mock_gcal_object(ICS_FILE, service=service):
            content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertIn("UID:abc123@google.com", content)
        self.assertNotIn("SEQUENCE", content)

    def test_stable_uid_without_google(self):
        """An Event not synced to Google gets the same UID on every send and a growing SEQUENCE."""
        event = self._event()
        event.update(name="EV-ICS-2", modified=get_datetime("2027-01-10 09:00:00"))
        first = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        event.modified = get_datetime("2027-01-11 09:00:00")
        second = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        uid = f"UID:EV-ICS-2@{frappe.local.site}"
        self.assertIn(uid, first)
        self.assertIn(uid, second)
        seq = [
            int(line.split(":")[1]) for c in (first, second) for line in c.splitlines() if line.startswith("SEQUENCE")
        ]
        self.assertLess(seq[0], seq[1])

    def test_method_request_with_organizer_publish_without(self):
        """METHOD is REQUEST when an ORGANIZER is present (an invite), PUBLISH otherwise."""
        organizer = "test_fa_ics_org_method@example.com"
        make_test_user(organizer)
        with_org = self._event(appointment_group=frappe._dict(event_organizer=organizer))
        self.assertIn("METHOD:REQUEST", frappe.get_doc("File", add_ics_file_in_attachment(with_org)).get_content())
        self.assertIn("METHOD:PUBLISH", frappe.get_doc("File", add_ics_file_in_attachment(self._event())).get_content())
