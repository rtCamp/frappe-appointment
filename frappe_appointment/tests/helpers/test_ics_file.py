from unittest.mock import MagicMock, patch

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import get_datetime

from frappe_appointment.helpers.ics_file import add_ics_file_in_attachment
from frappe_appointment.overrides.event_override import send_meet_email
from frappe_appointment.tests import EVENT_OVERRIDE, gcal_service_mock, make_test_user, mock_gcal_object

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

    def test_request_uses_google_organizer_and_attendees(self):
        """A Google-backed .ics is a REQUEST carrying Google's organizer and attendees, not the group's."""
        group_organizer = "test_fa_ics_org_group@example.com"
        make_test_user(group_organizer)
        event, service = self._google_event(sequence=2)
        event.appointment_group = frappe._dict(event_organizer=group_organizer)
        service.events().get().execute.return_value = {
            "iCalUID": "abc123@google.com",
            "sequence": 2,
            "organizer": {"email": "calendar-owner@example.com", "displayName": "Calendar Owner"},
            "attendees": [{"email": "guest@example.com"}, {"email": "calendar-owner@example.com"}],
        }
        with mock_gcal_object(ICS_FILE, service=service):
            content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertIn("METHOD:REQUEST", content)
        self.assertIn("MAILTO:calendar-owner@example.com", content)
        self.assertNotIn(group_organizer, content)
        self.assertIn("ATTENDEE", content)
        self.assertIn("MAILTO:guest@example.com", content)

    def test_hidden_organizer_drops_attendees_and_publishes(self):
        """hide_ics_organizer also drops Google's attendee list (it includes the organiser) and uses PUBLISH."""
        event, service = self._google_event(sequence=0)
        event.hide_ics_organizer = True
        service.events().get().execute.return_value = {
            "iCalUID": "abc123@google.com",
            "organizer": {"email": "calendar-owner@example.com"},
            "attendees": [{"email": "calendar-owner@example.com"}],
        }
        with mock_gcal_object(ICS_FILE, service=service):
            content = frappe.get_doc("File", add_ics_file_in_attachment(event)).get_content()
        self.assertNotIn("calendar-owner@example.com", content)
        self.assertIn("METHOD:PUBLISH", content)

    def test_publish_without_google_attendees(self):
        """Without Google's attendee list the .ics is PUBLISH, even when it has an ORGANIZER."""
        organizer = "test_fa_ics_org_method@example.com"
        make_test_user(organizer)
        with_org = self._event(appointment_group=frappe._dict(event_organizer=organizer))
        content = frappe.get_doc("File", add_ics_file_in_attachment(with_org)).get_content()
        self.assertIn("ORGANIZER", content)
        self.assertIn("METHOD:PUBLISH", content)


class TestSendMeetEmailIcsIdentity(IntegrationTestCase):
    def _doc(self, organisers):
        doc = MagicMock(custom_meet_link="https://meet.example.com/x", event_participants=[1])
        doc.custom_doctype_link_with_event = [frappe._dict(reference_doctype="User", reference_docname="Guest")]
        doc.get_organisers_event.return_value = organisers
        doc.get_recipients_event.return_value = ["guest@example.com"]
        return doc

    def test_no_identity_lookup_without_email_templates(self):
        """No response template configured → no Google lookup for the .ics identity."""
        group = MagicMock(response_email_template=None)
        with (
            patch(f"{EVENT_OVERRIDE}.get_ics_identity") as get_identity,
            patch(f"{EVENT_OVERRIDE}.send_email_template_mail") as send_mail,
        ):
            send_meet_email(self._doc(organisers=[]), group, None, {})
        get_identity.assert_not_called()
        send_mail.assert_not_called()

    def test_identity_looked_up_once_for_both_emails(self):
        """The organiser and booker emails share one .ics identity lookup."""
        user_calendar = MagicMock(response_email_template="Booker Template")
        settings = frappe._dict(personal_organisers_email_template="Organiser Template")
        with (
            patch(f"{EVENT_OVERRIDE}.get_ics_identity", return_value=frappe._dict(uid="u")) as get_identity,
            patch(f"{EVENT_OVERRIDE}.add_ics_file_in_attachment", return_value="FILE-1"),
            patch(f"{EVENT_OVERRIDE}.send_email_template_mail") as send_mail,
            patch.object(frappe, "get_single", return_value=settings),
        ):
            send_meet_email(self._doc(organisers=["organiser@example.com"]), None, user_calendar, {})
        get_identity.assert_called_once()
        self.assertEqual(send_mail.call_count, 2)
